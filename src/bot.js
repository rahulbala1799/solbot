import { Connection } from '@solana/web3.js';
import { MempoolMonitorFree } from './services/mempoolMonitorFree.js';
import { TokenTracker } from './services/tokenTracker.js';
import { TradeExecutor, keypairFromPrivateKey } from './services/tradeExecutor.js';
import { WebServer } from './web/server.js';
import { Logger } from './utils/logger.js';
import { config } from './config.js';

export class SolanaBot {
  constructor() {
    this.connection = null;
    this.mempoolMonitor = null;
    this.tokenTracker = null;
    this.tradeExecutor = null;
    this.webServer = null;
    this.wallet = null;
    this.isRunning = false;
    this.buyThreshold = config.buyThresholdSol;
    this.sellPercentage = config.sellPercentage;
  }

  /**
   * Initialize the bot with configuration
   */
  async initialize() {
    try {
      Logger.log('Initializing Solana Bot...');
      
      // Validate configuration
      config.validate();

      // Create connection
      this.connection = new Connection(config.rpcUrl, {
        commitment: 'confirmed',
        wsEndpoint: config.wssUrl
      });

      // Create wallet keypair
      this.wallet = keypairFromPrivateKey(config.walletPrivateKey);
      Logger.log(`Wallet address: ${this.wallet.publicKey.toString()}`);

      // Initialize services (using free RPC-compatible monitor)
      this.mempoolMonitor = new MempoolMonitorFree(
        config.rpcUrl,
        config.wssUrl,
        config.targetTokenAddress,
        config.pumpProgramId,
        this.webServer
      );

      this.tokenTracker = new TokenTracker(
        this.connection,
        this.wallet.publicKey,
        config.targetTokenAddress
      );

      await this.tokenTracker.initialize();

      this.tradeExecutor = new TradeExecutor(
        this.connection,
        this.wallet,
        config.targetTokenAddress,
        config.pumpProgramId
      );

      // Initialize web server
      this.webServer = new WebServer(process.env.PORT || 3000);
      this.webServer.start();

      // Listen for token change requests
      this.webServer.io.on('connection', (socket) => {
        socket.on('changeToken', async (data) => {
          try {
            Logger.log(`Changing token to: ${data.tokenAddress}`);
            await this.changeToken(data.tokenAddress);
          } catch (error) {
            Logger.error('Error changing token', error);
          }
        });
      });

      // Check initial balance
      const balance = await this.tokenTracker.getBalance();
      Logger.log(`Initial token balance: ${balance}`);

      // Update web interface
      this.webServer.emitBotStatus('running', {
        message: 'Bot initialized successfully',
        wallet: this.wallet.publicKey.toString(),
        tokenBalance: balance,
        buyThreshold: this.buyThreshold,
        sellPercentage: this.sellPercentage
      });

      // Re-initialize mempool monitor with web server reference
      if (config.targetTokenAddress) {
        this.mempoolMonitor = new MempoolMonitorFree(
          config.rpcUrl,
          config.wssUrl,
          config.targetTokenAddress,
          config.pumpProgramId,
          this.webServer
        );
      }

      // Listen for token change requests from web interface
      this.webServer.io.on('connection', (socket) => {
        socket.on('tokenChange', async (data) => {
          try {
            Logger.log(`Changing token to: ${data.tokenAddress}`);
            await this.changeToken(data.tokenAddress);
          } catch (error) {
            Logger.error('Error changing token', error);
          }
        });
      });

      Logger.success('Bot initialized successfully!');
      return true;
    } catch (error) {
      Logger.error('Failed to initialize bot', error);
      throw error;
    }
  }

  /**
   * Start the bot
   */
  async start() {
    if (this.isRunning) {
      Logger.warn('Bot is already running');
      return;
    }

    try {
      Logger.log('Starting bot...');
      this.isRunning = true;

      // Start monitoring mempool
      await this.mempoolMonitor.start(async (buyInfo) => {
        await this.handleBuyDetected(buyInfo);
      });

      Logger.success('Bot is now running!');
      Logger.log(`Watching for buy orders > ${this.buyThreshold} SOL`);
      Logger.log(`Will sell ${this.sellPercentage}% on trigger`);

      // Update web interface
      this.webServer.emitBotStatus('running', {
        message: 'Bot is monitoring for transactions',
        buyThreshold: this.buyThreshold,
        sellPercentage: this.sellPercentage,
        targetToken: this.mempoolMonitor ? this.mempoolMonitor.targetTokenAddress.toString() : null
      });
    } catch (error) {
      Logger.error('Failed to start bot', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Handle detected buy order
   */
  async handleBuyDetected(buyInfo) {
    try {
      Logger.log('Processing detected buy order...', buyInfo);

      // Check if buy amount meets threshold
      if (buyInfo.solAmount < this.buyThreshold) {
        Logger.log(`Buy amount ${buyInfo.solAmount} SOL is below threshold ${this.buyThreshold} SOL, skipping...`);
        return;
      }

      Logger.success(`Buy threshold met! ${buyInfo.solAmount} SOL >= ${this.buyThreshold} SOL`);

      // Calculate sell amount
      const sellAmount = await this.tokenTracker.calculateSellAmount(this.sellPercentage);

      if (sellAmount === 0) {
        Logger.warn('No tokens available to sell');
        return;
      }

      // Execute sell
      Logger.log(`Executing sell order for ${this.sellPercentage}% (${sellAmount} tokens)...`);
      const result = await this.tradeExecutor.executeSell(sellAmount);

      if (result) {
        Logger.success('Sell order completed!', result);
        this.webServer.emitSellExecuted(result);
        
        // Log updated balance
        const newBalance = await this.tokenTracker.getBalance();
        Logger.log(`New token balance: ${newBalance}`);
      } else {
        Logger.error('Sell order failed');
        this.webServer.emitError(new Error('Sell order failed'));
      }
    } catch (error) {
      Logger.error('Error handling buy detection', error);
      this.webServer.emitError(error);
    }
  }

  /**
   * Change monitored token
   */
  async changeToken(newTokenAddress) {
    try {
      Logger.log(`Changing monitored token to: ${newTokenAddress}`);
      
      // Stop current monitoring
      if (this.mempoolMonitor) {
        await this.mempoolMonitor.stop();
      }
      
      // Update token tracker
      this.tokenTracker = new TokenTracker(
        this.connection,
        this.wallet.publicKey,
        newTokenAddress
      );
      
      await this.tokenTracker.initialize();
      
      // Update mempool monitor with new token
      this.mempoolMonitor = new MempoolMonitorFree(
        config.rpcUrl,
        config.wssUrl,
        newTokenAddress,
        config.pumpProgramId,
        this.webServer
      );
      
      // Restart monitoring
      if (this.isRunning) {
        await this.mempoolMonitor.start(this.handleBuyDetected.bind(this));
      }
      
      // Update web interface
      this.webServer.emitBotStatus('running', {
        message: `Now monitoring token: ${newTokenAddress.substring(0, 8)}...`,
        targetToken: newTokenAddress,
        buyThreshold: this.buyThreshold,
        sellPercentage: this.sellPercentage
      });

      Logger.success(`Token changed to: ${newTokenAddress}`);
    } catch (error) {
      Logger.error('Error changing token', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      Logger.log('Stopping bot...');
      
      if (this.mempoolMonitor) {
        await this.mempoolMonitor.stop();
      }

      this.isRunning = false;
      
      if (this.webServer) {
        this.webServer.emitBotStatus('stopped', { message: 'Bot stopped' });
        this.webServer.stop();
      }
      
      Logger.success('Bot stopped successfully');
    } catch (error) {
      Logger.error('Error stopping bot', error);
      throw error;
    }
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      walletAddress: this.wallet?.publicKey.toString(),
      targetToken: config.targetTokenAddress,
      buyThreshold: this.buyThreshold,
      sellPercentage: this.sellPercentage,
      mempoolMonitorActive: this.mempoolMonitor?.isActive() || false,
      tradeInProgress: this.tradeExecutor?.isTradeInProgress() || false
    };
  }
}

