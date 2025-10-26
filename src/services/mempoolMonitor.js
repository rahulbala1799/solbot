import { Connection, PublicKey } from '@solana/web3.js';
import { Logger } from '../utils/logger.js';

export class MempoolMonitor {
  constructor(rpcUrl, wssUrl, targetTokenAddress, pumpProgramId) {
    this.connection = new Connection(rpcUrl, {
      commitment: 'processed',
      wsEndpoint: wssUrl
    });
    this.targetTokenAddress = new PublicKey(targetTokenAddress);
    this.pumpProgramId = pumpProgramId;
    this.subscriptionId = null;
    this.isRunning = false;
  }

  /**
   * Start monitoring the mempool for transactions related to the target token
   */
  async start(onBuyDetected) {
    if (this.isRunning) {
      Logger.warn('Mempool monitor is already running');
      return;
    }

    Logger.log('Starting mempool monitor...');
    Logger.log(`Monitoring token: ${this.targetTokenAddress.toString()}`);
    
    this.isRunning = true;

    try {
      // Subscribe to logs mentioning the target token or pump program
      this.subscriptionId = this.connection.onLogs(
        this.pumpProgramId,
        async (logs, context) => {
          try {
            await this.processTransaction(logs, onBuyDetected);
          } catch (error) {
            Logger.error('Error processing transaction', error);
          }
        },
        'processed' // Use 'processed' to catch transactions as soon as possible
      );

      Logger.success(`Mempool monitor started with subscription ID: ${this.subscriptionId}`);
    } catch (error) {
      Logger.error('Failed to start mempool monitor', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Process a transaction log to detect buy orders
   */
  async processTransaction(logs, onBuyDetected) {
    const signature = logs.signature;

    try {
      // Fetch the full transaction details
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'processed',
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return; // Transaction not found yet
      }

      // Check if this transaction involves our target token
      const accountKeys = tx.transaction.message.getAccountKeys();
      const involvedAccounts = accountKeys.staticAccountKeys.map(key => key.toString());
      
      if (!involvedAccounts.includes(this.targetTokenAddress.toString())) {
        return; // Not related to our token
      }

      // Parse the transaction to detect buy orders
      const buyInfo = this.parseBuyOrder(tx);
      
      if (buyInfo) {
        Logger.success('Buy order detected!', buyInfo);
        await onBuyDetected(buyInfo);
      }
    } catch (error) {
      // Silently ignore errors for transactions we can't fetch yet
      if (!error.message?.includes('not found')) {
        Logger.error(`Error fetching transaction ${signature}`, error);
      }
    }
  }

  /**
   * Parse transaction to extract buy order information
   */
  parseBuyOrder(tx) {
    try {
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      
      // Find SOL changes in the transaction
      for (let i = 0; i < preBalances.length; i++) {
        const preBalance = preBalances[i];
        const postBalance = postBalances[i];
        const change = postBalance - preBalance;
        
        // If SOL decreased (negative change), this might be a buy
        if (change < 0) {
          const solSpent = Math.abs(change) / 1e9; // Convert lamports to SOL
          
          // Check if this is related to the pump program
          const accountKeys = tx.transaction.message.getAccountKeys();
          const accounts = accountKeys.staticAccountKeys;
          
          // Look for interaction with pump program and our token
          let isPumpTx = false;
          for (const instruction of tx.transaction.message.compiledInstructions) {
            const programId = accounts[instruction.programIdIndex];
            if (programId.equals(this.pumpProgramId)) {
              isPumpTx = true;
              break;
            }
          }
          
          if (isPumpTx && solSpent > 0.01) { // Filter out dust transactions
            return {
              signature: tx.transaction.signatures[0],
              solAmount: solSpent,
              buyer: accounts[i].toString(),
              timestamp: new Date().toISOString()
            };
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
   * Stop monitoring the mempool
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    Logger.log('Stopping mempool monitor...');
    
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = null;
    }
    
    this.isRunning = false;
    Logger.success('Mempool monitor stopped');
  }

  /**
   * Check if the monitor is currently running
   */
  isActive() {
    return this.isRunning;
  }
}

