import { Connection, PublicKey } from '@solana/web3.js';
import { Logger } from '../utils/logger.js';
import { RPCManager } from '../utils/rpcManager.js';

/**
 * Free RPC-compatible mempool monitor
 * Uses log subscriptions instead of true mempool access
 * Works with free public Solana RPC endpoints
 */
export class MempoolMonitorFree {
  constructor(rpcUrl, wssUrl, targetTokenAddress, pumpProgramId, webServer = null) {
    this.rpcManager = new RPCManager();
    this.connection = this.rpcManager.getConnection();
    this.targetTokenAddress = new PublicKey(targetTokenAddress);
    this.pumpProgramId = pumpProgramId;
    this.webServer = webServer;
    this.subscriptionId = null;
    this.accountSubscriptionId = null;
    this.isRunning = false;
    this.processedSignatures = new Set();
    this.maxProcessedSignatures = 1000; // Prevent memory leak
  }

  /**
   * Start monitoring for transactions
   * Uses confirmed transactions instead of true mempool
   */
  async start(onBuyDetected) {
    if (this.isRunning) {
      Logger.warn('Monitor is already running');
      return;
    }

    Logger.log('Starting free RPC monitor...');
    Logger.log(`Monitoring token: ${this.targetTokenAddress.toString()}`);
    Logger.log('Note: Using confirmed transactions (slightly delayed, but free)');
    
    this.isRunning = true;

    try {
      // Use only polling strategy to avoid rate limits
      this.startPolling(onBuyDetected);
      
      Logger.success('Polling monitor started (checks every 5s to avoid rate limits)');

    } catch (error) {
      Logger.error('Failed to start monitor', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Process transaction logs from program subscription
   */
  async processTransactionLogs(logs, onBuyDetected) {
    const signature = logs.signature;

    // Skip if already processed
    if (this.processedSignatures.has(signature)) {
      return;
    }

    // Add to processed set
    this.processedSignatures.add(signature);
    
    // Clean up old signatures to prevent memory leak
    if (this.processedSignatures.size > this.maxProcessedSignatures) {
      const firstItem = this.processedSignatures.values().next().value;
      this.processedSignatures.delete(firstItem);
    }

    try {
      // Fetch transaction details
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return;
      }

      // Check if involves our token
      const accountKeys = tx.transaction.message.getAccountKeys();
      const accounts = accountKeys.staticAccountKeys;
      const involvedAccounts = accounts.map(key => key.toString());
      
      if (!involvedAccounts.includes(this.targetTokenAddress.toString())) {
        return;
      }

      // Emit transaction to web interface for live monitoring
      if (this.webServer) {
        // Try to parse transaction type and amount
        const transactionInfo = this.parseTransactionDetails(tx);
        
        this.webServer.emitTransaction({
          signature: signature,
          type: transactionInfo.type || 'pump_transaction',
          timestamp: new Date().toISOString(),
          accounts: involvedAccounts.length,
          solAmount: transactionInfo.solAmount,
          tokenAmount: transactionInfo.tokenAmount,
          transactionType: transactionInfo.transactionType,
          message: transactionInfo.message || `Processing pump.fun transaction: ${signature.substring(0, 8)}...`
        });
      }

      // Parse for buy orders
      const buyInfo = this.parseBuyOrder(tx);
      
      if (buyInfo) {
        Logger.success('Buy order detected!', buyInfo);
        await onBuyDetected(buyInfo);
      }
    } catch (error) {
      // Silently skip transactions we can't fetch
      if (!error.message?.includes('not found')) {
        Logger.error(`Error processing ${signature}`, error.message);
      }
    }
  }

  /**
   * Check recent transactions (polling strategy)
   */
  async checkRecentTransactions(onBuyDetected) {
    try {
      // Test connection first
      const isWorking = await this.rpcManager.testConnection();
      if (!isWorking) {
        Logger.warn('RPC connection failed, switching...');
        this.connection = this.rpcManager.getConnection();
        return; // Skip this cycle
      }
      
      // Get current connection (may switch if rate limited)
      this.connection = this.rpcManager.getConnection();
      
      // Get bonding curve address
      const bondingCurve = await this.deriveBondingCurveAddress(this.targetTokenAddress);
      
      // Fetch recent signatures for the bonding curve
      const signatures = await this.connection.getSignaturesForAddress(
        bondingCurve,
        { limit: 5 }, // Only check last 5 transactions
        'confirmed'
      );

      // Reset rate limit counter on successful request
      this.rpcManager.resetRateLimit();
      
      Logger.log(`Found ${signatures.length} recent transactions for token ${this.targetTokenAddress.toString().substring(0, 8)}...`);

      // If no transactions found, emit a sample transaction to show monitoring is working
      if (signatures.length === 0 && this.webServer) {
        this.webServer.emitTransaction({
          signature: `monitor_${Date.now()}`,
          type: 'monitor',
          timestamp: new Date().toISOString(),
          accounts: 0,
          solAmount: 0,
          transactionType: 'monitor',
          message: `🔍 Monitoring ${this.targetTokenAddress.toString().substring(0, 8)}... (No recent activity)`
        });
      }

      // Process each signature
      for (const sigInfo of signatures) {
        const signature = sigInfo.signature;
        
        // Skip if already processed
        if (this.processedSignatures.has(signature)) {
          continue;
        }

        this.processedSignatures.add(signature);

        // Fetch and parse transaction
        try {
          const tx = await this.connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });

          if (tx) {
            const buyInfo = this.parseBuyOrder(tx);
            if (buyInfo) {
              Logger.success('Buy order detected via polling!', buyInfo);
              await onBuyDetected(buyInfo);
            }
          }
        } catch (error) {
          if (error.message?.includes('429')) {
            // Handle rate limit
            this.rpcManager.handleRateLimit();
            Logger.warn('Rate limited, switching RPC...');
            this.connection = this.rpcManager.getConnection();
            break; // Exit loop and try again next time
          } else if (!error.message?.includes('not found')) {
            Logger.error(`Error fetching transaction ${signature}`, error.message);
          }
        }
      }
    } catch (error) {
      if (error.message?.includes('429')) {
        // Handle rate limit
        this.rpcManager.handleRateLimit();
        Logger.warn('Rate limited, switching RPC...');
        this.connection = this.rpcManager.getConnection();
      } else {
        Logger.error('Error checking recent transactions', error.message);
      }
    }
  }

  /**
   * Start periodic polling (backup strategy)
   */
  startPolling(onBuyDetected) {
    // Poll every 5 seconds to avoid rate limits
    this.pollingInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(this.pollingInterval);
        return;
      }
      
      await this.checkRecentTransactions(onBuyDetected);
    }, 5000); // 5 second intervals to avoid rate limiting

    Logger.success('Polling monitor started (checks every 5s)');
  }

  /**
   * Parse transaction to extract buy order information
   */
  parseBuyOrder(tx) {
    try {
      if (!tx.meta) {
        return null;
      }

      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      const accountKeys = tx.transaction.message.getAccountKeys();
      const accounts = accountKeys.staticAccountKeys;
      
      // Find SOL changes
      for (let i = 0; i < preBalances.length; i++) {
        const preBalance = preBalances[i];
        const postBalance = postBalances[i];
        const change = postBalance - preBalance;
        
        // Negative change = SOL spent = potential buy
        if (change < 0) {
          const solSpent = Math.abs(change) / 1e9;
          
          // Filter dust and check if it's a pump program interaction
          if (solSpent > 0.01) {
            // Verify it's a pump.fun transaction
            let isPumpTx = false;
            for (const instruction of tx.transaction.message.compiledInstructions) {
              const programId = accounts[instruction.programIdIndex];
              if (programId.equals(this.pumpProgramId)) {
                isPumpTx = true;
                break;
              }
            }
            
            if (isPumpTx) {
              return {
                signature: tx.transaction.signatures[0],
                solAmount: solSpent,
                buyer: accounts[i].toString(),
                timestamp: new Date(tx.blockTime * 1000).toISOString()
              };
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      Logger.error('Error parsing buy order', error);
      return null;
    }
  }

  /**
   * Derive bonding curve address
   */
  async deriveBondingCurveAddress(mint) {
    try {
      const [bondingCurve] = await PublicKey.findProgramAddress(
        [Buffer.from('bonding-curve'), mint.toBuffer()],
        this.pumpProgramId
      );
      return bondingCurve;
    } catch (error) {
      Logger.error('Error deriving bonding curve', error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    Logger.log('Stopping monitor...');
    
    // Remove log subscription
    if (this.subscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.subscriptionId);
      } catch (error) {
        Logger.warn('Error removing logs listener', error.message);
      }
      this.subscriptionId = null;
    }

    // Remove account subscription
    if (this.accountSubscriptionId !== null) {
      try {
        await this.connection.removeAccountChangeListener(this.accountSubscriptionId);
      } catch (error) {
        Logger.warn('Error removing account listener', error.message);
      }
      this.accountSubscriptionId = null;
    }

    // Stop polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.isRunning = false;
    this.processedSignatures.clear();
    
    Logger.success('Monitor stopped');
  }

  /**
   * Parse transaction details for display
   */
  parseTransactionDetails(tx) {
    try {
      const logs = tx.meta?.logMessages || [];
      const preBalances = tx.meta?.preBalances || [];
      const postBalances = tx.meta?.postBalances || [];
      
      // Calculate SOL amount change
      let solAmount = 0;
      if (preBalances.length > 0 && postBalances.length > 0) {
        const solChange = postBalances[0] - preBalances[0];
        solAmount = Math.abs(solChange) / 1e9;
      }
      
      // Determine transaction type based on logs and program interactions
      let transactionType = 'unknown';
      let message = `Transaction: ${tx.transaction.signatures[0].substring(0, 8)}...`;
      
      // Check for pump.fun program interactions
      const programIds = tx.transaction.message.instructions.map(ix => 
        tx.transaction.message.getAccountKeys().get(ix.programIdIndex)?.toString()
      );
      
      const isPumpTransaction = programIds.some(id => 
        id === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' || // pump.fun program
        id === 'So11111111111111111111111111111111111111112' // SOL token program
      );
      
      if (isPumpTransaction) {
        if (logs.some(log => log.includes('buy') || log.includes('swap') || log.includes('Buy'))) {
          transactionType = 'buy';
          message = `🟢 BUY: ${solAmount.toFixed(4)} SOL`;
        } else if (logs.some(log => log.includes('sell') || log.includes('Sell'))) {
          transactionType = 'sell';
          message = `🔴 SELL: ${solAmount.toFixed(4)} SOL`;
        } else if (solAmount > 0.01) { // Any significant SOL movement on pump.fun
          transactionType = 'pump';
          message = `⚡ PUMP: ${solAmount.toFixed(4)} SOL`;
        }
      }
      
      return {
        type: transactionType,
        solAmount: solAmount,
        tokenAmount: 0, // Would need token account parsing
        transactionType: transactionType,
        message: message
      };
    } catch (error) {
      Logger.error('Error parsing transaction details', error);
      return {
        type: 'unknown',
        solAmount: 0,
        tokenAmount: 0,
        transactionType: 'unknown',
        message: `Transaction: ${tx.transaction.signatures[0].substring(0, 8)}...`
      };
    }
  }

  /**
   * Check if monitor is running
   */
  isActive() {
    return this.isRunning;
  }
}

