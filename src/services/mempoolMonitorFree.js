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
    this.targetTokenAddress = targetTokenAddress ? new PublicKey(targetTokenAddress) : null;
    this.pumpProgramId = pumpProgramId;
    this.webServer = webServer;
    this.subscriptionId = null;
    this.accountSubscriptionId = null;
    this.isRunning = false;
    this.processedSignatures = new Set();
    this.maxProcessedSignatures = 1000; // Prevent memory leak
    this.heartbeatInterval = null; // For regular status updates
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

    if (!this.targetTokenAddress) {
      Logger.log('No target token set - waiting for token configuration');
      return;
    }

    Logger.log('Starting free RPC monitor...');
    const tokenStr = this.targetTokenAddress?.toString().substring(0, 8) || 'no token set';
    Logger.log(`Monitoring token: ${tokenStr}`);
    Logger.log('Note: Using confirmed transactions (slightly delayed, but free)');

    this.isRunning = true;

    try {
      // Use only polling strategy to avoid rate limits
      this.startPolling(onBuyDetected);

      // Start heartbeat for regular status updates
      this.startHeartbeat();

      Logger.success('Polling monitor started (checks every 10s)');
      Logger.success('Heartbeat active (status updates every 15s)');

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
   * Check recent transactions using Helius Parse API
   */
  async checkRecentTransactions(onBuyDetected) {
    try {
      // Check if target token is set
      if (!this.targetTokenAddress) {
        Logger.log('No target token set - waiting for token configuration');
        return;
      }

      // Use Helius Parse API for better transaction parsing
      const parseApiUrl = 'https://api.helius.xyz/v0/transactions/?api-key=8fa5a141-a272-488e-8dba-edb177602cf9';

      // Monitor the token directly (not just bonding curve)
      const tokenStr = this.targetTokenAddress?.toString().substring(0, 8) || 'unknown';
      Logger.log(`Monitoring token: ${tokenStr}...`);

      // Try bonding curve first (for pump.fun tokens)
      let signatures = [];
      try {
        const bondingCurve = await this.deriveBondingCurveAddress(this.targetTokenAddress);
        signatures = await this.connection.getSignaturesForAddress(
          bondingCurve,
          { limit: 10 }, // Check more transactions
          'confirmed'
        );
        Logger.log(`Found ${signatures.length} transactions on bonding curve`);
      } catch (error) {
        Logger.warn('Bonding curve not found, trying direct token monitoring');
      }

      // If no bonding curve activity, check token directly
      if (signatures.length === 0) {
        try {
          signatures = await this.connection.getSignaturesForAddress(
            this.targetTokenAddress,
            { limit: 10 },
            'confirmed'
          );
          Logger.log(`Found ${signatures.length} transactions on token directly`);
        } catch (error) {
          Logger.warn('No transactions found for token');
        }
      }

      // Always show activity status, even if no transactions
      if (this.webServer) {
        const statusMessage = signatures.length > 0
          ? `🔍 Found ${signatures.length} transactions - monitoring ${tokenStr}...`
          : `🔍 Monitoring ${tokenStr}... - no recent transactions (token may be new)`;

        this.webServer.emitTransaction({
          signature: `status_${Date.now()}`,
          type: 'monitor',
          timestamp: new Date().toISOString(),
          accounts: signatures.length,
          solAmount: 0,
          tokenAmount: 0,
          transactionType: 'monitor',
          message: statusMessage
        });
      }

      if (signatures.length === 0) {
        Logger.log(`No recent transactions for token ${tokenStr}... Token might be new or inactive.`);
        return;
      }

      Logger.log(`Found ${signatures.length} recent transactions for token ${tokenStr}...`);
      Logger.log(`Signatures: ${signatures.map(s => s.signature.substring(0, 8)).join(', ')}`);

      // Use Helius Parse API to get detailed transaction data
      const signatureList = signatures.map(sig => sig.signature);
      const parseResponse = await fetch(parseApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: signatureList
        })
      });

      if (!parseResponse.ok) {
        throw new Error(`Parse API error: ${parseResponse.status}`);
      }

      const parsedTransactions = await parseResponse.json();

      Logger.log(`Parsed ${parsedTransactions.length} transactions using Helius Parse API`);

      // If no transactions parsed, emit basic info for each signature
      if (parsedTransactions.length === 0) {
        for (const sigInfo of signatures) {
          const signature = sigInfo.signature;

          if (this.processedSignatures.has(signature)) {
            continue;
          }

          this.processedSignatures.add(signature);

          if (this.webServer) {
            Logger.log(`Emitting basic transaction: ${signature.substring(0, 8)}...`);
            this.webServer.emitTransaction({
              signature: signature,
              type: 'pump',
              timestamp: new Date().toISOString(),
              accounts: 0,
              solAmount: 0,
              tokenAmount: 0,
              transactionType: 'pump',
              message: `⚡ Transaction: ${signature.substring(0, 8)}... (detected)`
            });
          }
        }
      }
      
      // Debug: Log the structure of the first transaction
      if (parsedTransactions.length > 0) {
        Logger.log('Sample transaction structure:', JSON.stringify(parsedTransactions[0], null, 2));
      }

      // Emit monitoring status (not as transaction)
      if (this.webServer) {
        this.webServer.emitBotStatus('running', {
          message: `Parsed ${parsedTransactions.length} transactions for ${this.targetTokenAddress.toString().substring(0, 8)}...`,
          lastCheck: new Date().toISOString()
        });
      }

      // Emit each transaction individually for display
      for (const parsedTx of parsedTransactions) {
        try {
          const signature = parsedTx.signature;

          if (!signature || this.processedSignatures.has(signature)) {
            continue;
          }

          this.processedSignatures.add(signature);

          // Parse transaction using Helius data
          const transactionInfo = this.parseHeliusTransaction(parsedTx);

          // Always emit transaction to web interface for display
          if (this.webServer) {
            Logger.log(`Emitting transaction: ${transactionInfo.transactionType} - ${signature.substring(0, 8)}...`);

            this.webServer.emitTransaction({
              signature: signature,
              type: transactionInfo.type || 'pump',
              timestamp: new Date().toISOString(),
              accounts: parsedTx.accountData?.length || parsedTx.tokenTransfers?.length || 0,
              solAmount: transactionInfo.solAmount || 0,
              tokenAmount: transactionInfo.tokenAmount || 0,
              transactionType: transactionInfo.transactionType || 'pump',
              message: transactionInfo.message || `⚡ Transaction: ${signature.substring(0, 8)}...`
            });
          }

          // Check for buy orders
          if (transactionInfo.transactionType === 'buy' && transactionInfo.solAmount >= 0.2) {
            const buyInfo = {
              signature: signature,
              solAmount: transactionInfo.solAmount,
              tokenAddress: this.targetTokenAddress.toString(),
              timestamp: new Date().toISOString()
            };

            Logger.success('Buy order detected via Helius Parse!', buyInfo);
            await onBuyDetected(buyInfo);
          }
        } catch (error) {
          Logger.error('Error processing parsed transaction:', error.message);

          // Fallback: emit basic transaction info even if parsing fails
          if (this.webServer) {
            Logger.log(`Fallback emission for: ${signature.substring(0, 8)}...`);
            this.webServer.emitTransaction({
              signature: signature,
              type: 'pump',
              timestamp: new Date().toISOString(),
              accounts: 0,
              solAmount: 0,
              tokenAmount: 0,
              transactionType: 'pump',
              message: `⚡ Transaction: ${signature.substring(0, 8)}... (detected)`
            });
          }

          continue;
        }
      }

    } catch (error) {
      if (error.message?.includes('429')) {
        // Handle rate limit
        this.rpcManager.handleRateLimit();
        Logger.warn('Rate limited, switching RPC...');
        this.connection = this.rpcManager.getConnection();
      } else if (error.message?.includes('Parse API error')) {
        Logger.warn('Helius Parse API error, falling back to basic RPC...');
        // Fallback to basic transaction fetching
        await this.checkRecentTransactionsBasic(onBuyDetected);
      } else {
        Logger.error('Error checking recent transactions', error.message);
      }
    }
  }

  /**
   * Fallback method for basic transaction checking
   */
  async checkRecentTransactionsBasic(onBuyDetected) {
    try {
      // Get bonding curve address
      const bondingCurve = await this.deriveBondingCurveAddress(this.targetTokenAddress);
      
      // Fetch recent signatures for the bonding curve
      const signatures = await this.connection.getSignaturesForAddress(
        bondingCurve,
        { limit: 3 }, // Reduced limit for fallback
        'confirmed'
      );

      Logger.log(`Fallback: Found ${signatures.length} recent transactions`);

      // Process each signature with basic parsing
      for (const sigInfo of signatures) {
        const signature = sigInfo.signature;
        
        if (this.processedSignatures.has(signature)) {
          continue;
        }

        this.processedSignatures.add(signature);

        // Emit basic transaction info
        if (this.webServer) {
          this.webServer.emitTransaction({
            signature: signature,
            type: 'transaction',
            timestamp: new Date().toISOString(),
            accounts: 0,
            solAmount: 0,
            transactionType: 'transaction',
            message: `📄 Transaction: ${signature.substring(0, 8)}... (Basic)`
          });
        }
      }
    } catch (error) {
      Logger.error('Error in fallback transaction checking', error.message);
    }
  }

  /**
   * Start heartbeat for regular status updates
   */
  startHeartbeat() {
    // Send heartbeat every 15 seconds to show bot is alive
    this.heartbeatInterval = setInterval(() => {
      if (this.webServer && this.isRunning) {
        this.webServer.emitTransaction({
          signature: `heartbeat_${Date.now()}`,
          type: 'monitor',
          timestamp: new Date().toISOString(),
          accounts: 0,
          solAmount: 0,
          tokenAmount: 0,
          transactionType: 'monitor',
          message: `💓 Bot heartbeat - monitoring ${this.targetTokenAddress?.toString().substring(0, 8) || 'no token set'}...`
        });
      }
    }, 15000); // 15 second intervals

    Logger.log('Heartbeat started (updates every 15s)');
  }

  /**
   * Start periodic polling (backup strategy)
   */
  startPolling(onBuyDetected) {
    // Poll every 10 seconds to avoid rate limits
    this.pollingInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(this.pollingInterval);
        return;
      }

      await this.checkRecentTransactions(onBuyDetected);
    }, 10000); // 10 second intervals to avoid rate limiting

    Logger.success('Polling monitor started (checks every 10s)');
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

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
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
   * Parse Helius transaction data
   */
  parseHeliusTransaction(parsedTx) {
    try {
      // Get signature safely - Helius response has signature directly
      const signature = parsedTx.signature || 'unknown';
      
      // Safely handle events - might be array, object, or undefined
      let events = [];
      if (Array.isArray(parsedTx.events)) {
        events = parsedTx.events;
      } else if (parsedTx.events && typeof parsedTx.events === 'object') {
        events = Object.values(parsedTx.events);
      }
      
      const nativeTransfers = Array.isArray(parsedTx.nativeTransfers) ? parsedTx.nativeTransfers : [];
      const tokenTransfers = Array.isArray(parsedTx.tokenTransfers) ? parsedTx.tokenTransfers : [];
      
      // Calculate SOL amount from native transfers
      let solAmount = 0;
      for (const transfer of nativeTransfers) {
        if (transfer && typeof transfer.amount === 'number') {
          solAmount += transfer.amount / 1e9; // Convert lamports to SOL
        }
      }
      
      // Determine transaction type based on Helius data
      let transactionType = 'pump'; // Default to pump for pump.fun transactions
      let message = `⚡ PUMP: ${solAmount.toFixed(4)} SOL`;

      // Check if it's a pump.fun swap
      if (parsedTx.type === 'SWAP') {
        if (solAmount > 0) {
          transactionType = 'buy';
          message = `🟢 BUY: ${solAmount.toFixed(4)} SOL`;
        } else {
          transactionType = 'sell';
          message = `🔴 SELL: ${Math.abs(solAmount).toFixed(4)} SOL`;
        }
      } else if (solAmount > 0) {
        transactionType = 'transaction';
        message = `📄 Transaction: ${solAmount.toFixed(4)} SOL`;
      }
      
      Logger.log(`Parsed transaction: ${transactionType} - ${message}`);
      
      return {
        type: transactionType,
        solAmount: Math.abs(solAmount),
        tokenAmount: tokenTransfers.length,
        transactionType: transactionType,
        message: message
      };
    } catch (error) {
      Logger.error('Error parsing Helius transaction', error);
      return {
        type: 'unknown',
        solAmount: 0,
        tokenAmount: 0,
        transactionType: 'unknown',
        message: `Transaction: unknown...`
      };
    }
  }

  /**
   * Show demo transactions when RPC fails
   */
  showDemoTransactions() {
    if (!this.webServer) return;
    
    // Only show demo transactions occasionally to avoid spam
    const now = Date.now();
    if (!this.lastDemoTime || (now - this.lastDemoTime) > 30000) { // Every 30 seconds
      this.lastDemoTime = now;
      
      const demoTransactions = [
        {
          signature: `demo_buy_${Date.now()}`,
          type: 'buy',
          timestamp: new Date().toISOString(),
          accounts: 3,
          solAmount: 0.25,
          transactionType: 'buy',
          message: `🟢 BUY: 0.2500 SOL (Demo)`
        },
        {
          signature: `demo_sell_${Date.now()}`,
          type: 'sell',
          timestamp: new Date().toISOString(),
          accounts: 4,
          solAmount: 0.15,
          transactionType: 'sell',
          message: `🔴 SELL: 0.1500 SOL (Demo)`
        },
        {
          signature: `demo_pump_${Date.now()}`,
          type: 'pump',
          timestamp: new Date().toISOString(),
          accounts: 5,
          solAmount: 0.50,
          transactionType: 'pump',
          message: `⚡ PUMP: 0.5000 SOL (Demo)`
        }
      ];
      
      // Show one random demo transaction
      const randomTx = demoTransactions[Math.floor(Math.random() * demoTransactions.length)];
      this.webServer.emitTransaction(randomTx);
    }
  }

  /**
   * Check if monitor is running
   */
  isActive() {
    return this.isRunning;
  }
}

