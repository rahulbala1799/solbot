#!/usr/bin/env node

import { Connection, PublicKey } from '@solana/web3.js';
import { MempoolMonitorFree } from './services/mempoolMonitorFree.js';
import { TokenTracker } from './services/tokenTracker.js';
import { TradeExecutor, keypairFromPrivateKey } from './services/tradeExecutor.js';
import { Logger } from './utils/logger.js';
import { config } from './config.js';

/**
 * Pure Node.js CLI Bot - No Web Interface
 * Simple command-line interface for monitoring and trading
 */
class SolanaCLIBot {
  constructor() {
    this.connection = null;
    this.mempoolMonitor = null;
    this.tokenTracker = null;
    this.tradeExecutor = null;
    this.wallet = null;
    this.isRunning = false;
    this.buyThreshold = config.buyThresholdSol;
    this.sellPercentage = config.sellPercentage;
    this.totalTransactions = 0;
    this.buyOrdersDetected = 0;
    this.sellOrdersExecuted = 0;
  }

  async initialize() {
    try {
      Logger.log('Initializing Solana CLI Bot...');
      
      // Initialize connection
      this.connection = new Connection(config.rpcUrl, 'confirmed');
      Logger.log(`Connected to: ${config.rpcUrl}`);

      // Initialize wallet
      this.wallet = keypairFromPrivateKey(config.walletPrivateKey);
      Logger.log(`Wallet address: ${this.wallet.publicKey.toString()}`);

      // Initialize token tracker
      this.tokenTracker = new TokenTracker(
        this.connection,
        this.wallet.publicKey,
        config.targetTokenAddress
      );

      await this.tokenTracker.initialize();
      const balance = await this.tokenTracker.getBalance();
      Logger.log(`Initial token balance: ${balance}`);

      // Initialize trade executor
      this.tradeExecutor = new TradeExecutor(
        this.connection,
        this.wallet,
        config.targetTokenAddress,
        config.pumpProgramId
      );

      // Initialize mempool monitor (without web server)
      this.mempoolMonitor = new MempoolMonitorFree(
        config.rpcUrl,
        config.wssUrl,
        config.targetTokenAddress,
        config.pumpProgramId,
        null // No web server for CLI
      );

      Logger.success('CLI Bot initialized successfully!');
      return true;
    } catch (error) {
      Logger.error('Failed to initialize CLI bot', error);
      throw error;
    }
  }

  async start() {
    try {
      Logger.log('Starting CLI bot...');
      this.isRunning = true;

      // Start monitoring
      await this.mempoolMonitor.start(this.handleBuyDetected.bind(this));
      
      Logger.success('CLI Bot is now running!');
      Logger.log(`Watching for buy orders > ${this.buyThreshold} SOL`);
      Logger.log(`Will sell ${this.sellPercentage}% on trigger`);
      Logger.log('Press Ctrl+C to stop');

      // Keep the process running
      process.on('SIGINT', () => {
        Logger.log('\nShutting down CLI bot...');
        this.stop();
        process.exit(0);
      });

      // Display stats every 30 seconds
      setInterval(() => {
        this.displayStats();
      }, 30000);

    } catch (error) {
      Logger.error('Failed to start CLI bot', error);
      this.isRunning = false;
      throw error;
    }
  }

  async handleBuyDetected(buyInfo) {
    try {
      this.buyOrdersDetected++;
      Logger.success('🚨 BUY ORDER DETECTED!', buyInfo);
      
      // Get current token balance
      const balance = await this.tokenTracker.getBalance();
      const sellAmount = (balance * this.sellPercentage) / 100;
      
      if (sellAmount > 0) {
        Logger.log(`Executing sell: ${sellAmount} tokens (${this.sellPercentage}% of ${balance})`);
        
        // Execute sell order
        const sellResult = await this.tradeExecutor.executeSell(sellAmount);
        
        if (sellResult.success) {
          this.sellOrdersExecuted++;
          Logger.success('✅ Sell order executed successfully!', sellResult);
        } else {
          Logger.error('❌ Sell order failed:', sellResult.error);
        }
      } else {
        Logger.warn('No tokens to sell');
      }
    } catch (error) {
      Logger.error('Error handling buy detection', error);
    }
  }

  displayStats() {
    Logger.log('\n📊 Bot Statistics:');
    Logger.log(`Total Transactions: ${this.totalTransactions}`);
    Logger.log(`Buy Orders Detected: ${this.buyOrdersDetected}`);
    Logger.log(`Sell Orders Executed: ${this.sellOrdersExecuted}`);
    Logger.log(`Uptime: ${Math.floor(process.uptime())} seconds`);
    Logger.log('─'.repeat(50));
  }

  async stop() {
    if (this.mempoolMonitor) {
      await this.mempoolMonitor.stop();
    }
    this.isRunning = false;
    Logger.log('CLI Bot stopped');
  }
}

// Custom mempool monitor for CLI (without web server)
class CLIMempoolMonitor extends MempoolMonitorFree {
  constructor(rpcUrl, wssUrl, targetTokenAddress, pumpProgramId) {
    super(rpcUrl, wssUrl, targetTokenAddress, pumpProgramId, null);
  }

  async checkRecentTransactions(onBuyDetected) {
    try {
      // Use Helius Parse API for better transaction parsing
      const parseApiUrl = 'https://api.helius.xyz/v0/transactions/?api-key=8fa5a141-a272-488e-8dba-edb177602cf9';
      
      // Get bonding curve address
      const bondingCurve = await this.deriveBondingCurveAddress(this.targetTokenAddress);
      
      // Fetch recent signatures for the bonding curve
      const signatures = await this.connection.getSignaturesForAddress(
        bondingCurve,
        { limit: 5 },
        'confirmed'
      );

      if (signatures.length === 0) {
        return;
      }

      Logger.log(`Found ${signatures.length} recent transactions for token ${this.targetTokenAddress.toString().substring(0, 8)}...`);

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

      // Process parsed transactions
      for (const parsedTx of parsedTransactions) {
        try {
          const signature = parsedTx.signature;
          
          if (!signature || this.processedSignatures.has(signature)) {
            continue;
          }

          this.processedSignatures.add(signature);

          // Parse transaction using Helius data
          const transactionInfo = this.parseHeliusTransaction(parsedTx);
          
          // Display transaction in CLI
          Logger.log(`📄 ${transactionInfo.message}`);
          
          // Check for buy orders
          if (transactionInfo.transactionType === 'buy' && transactionInfo.solAmount >= 0.2) {
            const buyInfo = {
              signature: signature,
              solAmount: transactionInfo.solAmount,
              tokenAddress: this.targetTokenAddress.toString(),
              timestamp: new Date().toISOString()
            };
            
            await onBuyDetected(buyInfo);
          }
        } catch (error) {
          Logger.error('Error processing parsed transaction:', error.message);
          continue;
        }
      }
    } catch (error) {
      if (error.message?.includes('Parse API error')) {
        Logger.warn('Helius Parse API error, falling back to basic RPC...');
        // Fallback to basic transaction fetching
        await this.checkRecentTransactionsBasic(onBuyDetected);
      } else {
        Logger.error('Error checking recent transactions', error.message);
      }
    }
  }
}

// Main execution
async function main() {
  try {
    const bot = new SolanaCLIBot();
    await bot.initialize();
    await bot.start();
  } catch (error) {
    Logger.error('Failed to start CLI bot', error);
    process.exit(1);
  }
}

// Run the CLI bot
main();
