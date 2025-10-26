import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from './utils/logger.js';
import { Connection } from '@solana/web3.js';
import { MempoolMonitorFree } from './services/mempoolMonitorFree.js';
import { TokenTracker } from './services/tokenTracker.js';
import { TradeExecutor, keypairFromPrivateKey } from './services/tradeExecutor.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Combined server that runs both the bot and serves the Next.js app
 * This is optimized for Railway deployment
 */
class CombinedServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Bot components
    this.connection = null;
    this.mempoolMonitor = null;
    this.tokenTracker = null;
    this.tradeExecutor = null;
    this.wallet = null;
    this.isRunning = false;
    
    this.setupRoutes();
    this.setupSocket();
  }

  setupRoutes() {
    // Serve static files from Next.js build
    this.app.use(express.static(path.join(__dirname, '../../out')));
    this.app.use(express.json());
    
    // API routes
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        botStatus: this.isRunning ? 'active' : 'inactive'
      });
    });

    this.app.get('/api/stats', (req, res) => {
      res.json({
        totalTransactions: this.totalTransactions || 0,
        buyOrdersDetected: this.buyOrdersDetected || 0,
        sellOrdersExecuted: this.sellOrdersExecuted || 0,
        lastActivity: this.lastActivity || null
      });
    });

    this.app.post('/api/change-token', (req, res) => {
      const { tokenAddress } = req.body;
      
      if (!tokenAddress) {
        return res.json({ success: false, error: 'Token address is required' });
      }
      
      this.io.emit('changeToken', { tokenAddress });
      this.addActivityLog(`Token changed to: ${tokenAddress.substring(0, 8)}...`);
      
      res.json({ success: true, message: 'Token change request sent' });
    });

    // Serve Next.js app
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../out/index.html'));
    });
  }

  setupSocket() {
    this.io.on('connection', (socket) => {
      Logger.log('Web client connected');
      
      // Emit initial status
      socket.emit('bot-status', {
        status: this.isRunning ? 'running' : 'stopped',
        message: this.isRunning ? 'Bot is running' : 'Bot is stopped',
        wallet: this.wallet?.publicKey?.toString() || 'Not initialized',
        tokenBalance: 0,
        buyThreshold: config.buyThresholdSol,
        sellPercentage: config.sellPercentage
      });
      
      socket.on('disconnect', () => {
        Logger.log('Web client disconnected');
      });
    });
  }

  async initializeBot() {
    try {
      Logger.log('🤖 Initializing Solana Bot...');
      
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

      // Initialize mempool monitor
      this.mempoolMonitor = new MempoolMonitorFree(
        config.rpcUrl,
        config.wssUrl,
        config.targetTokenAddress,
        config.pumpProgramId,
        this // Pass this server as web server
      );

      Logger.success('✅ Bot initialized successfully!');
      return true;
    } catch (error) {
      Logger.error('❌ Failed to initialize bot', error);
      throw error;
    }
  }

  async startBot() {
    try {
      Logger.log('🚀 Starting bot...');
      this.isRunning = true;

      await this.mempoolMonitor.start(this.handleBuyDetected.bind(this));
      
      Logger.success('✅ Bot is now running!');
      Logger.log(`Watching for buy orders > ${config.buyThresholdSol} SOL`);
      Logger.log(`Will sell ${config.sellPercentage}% on trigger`);

      // Emit bot status
      this.emitBotStatus('running', {
        message: 'Bot is monitoring for transactions',
        wallet: this.wallet.publicKey.toString(),
        tokenBalance: await this.tokenTracker.getBalance(),
        buyThreshold: config.buyThresholdSol,
        sellPercentage: config.sellPercentage
      });

    } catch (error) {
      Logger.error('❌ Failed to start bot', error);
      this.isRunning = false;
      throw error;
    }
  }

  async handleBuyDetected(buyInfo) {
    try {
      this.buyOrdersDetected = (this.buyOrdersDetected || 0) + 1;
      Logger.success('🚨 BUY ORDER DETECTED!', buyInfo);
      
      const balance = await this.tokenTracker.getBalance();
      const sellAmount = (balance * config.sellPercentage) / 100;
      
      if (sellAmount > 0) {
        Logger.log(`Executing sell: ${sellAmount} tokens (${config.sellPercentage}% of ${balance})`);
        
        const sellResult = await this.tradeExecutor.executeSell(sellAmount);
        
        if (sellResult.success) {
          this.sellOrdersExecuted = (this.sellOrdersExecuted || 0) + 1;
          Logger.success('✅ Sell order executed successfully!', sellResult);
          this.emitSellExecuted(sellResult);
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

  // Emit events to connected clients
  emitBotStatus(status, data = {}) {
    this.io.emit('bot-status', { status, ...data });
  }

  emitTransaction(transaction) {
    this.totalTransactions = (this.totalTransactions || 0) + 1;
    this.lastActivity = new Date().toISOString();
    
    this.io.emit('transaction', {
      ...transaction,
      timestamp: new Date().toISOString()
    });
  }

  emitBuyDetected(buyInfo) {
    this.buyOrdersDetected = (this.buyOrdersDetected || 0) + 1;
    this.lastActivity = new Date().toISOString();
    
    this.io.emit('buy-detected', {
      ...buyInfo,
      timestamp: new Date().toISOString()
    });
  }

  emitSellExecuted(sellInfo) {
    this.sellOrdersExecuted = (this.sellOrdersExecuted || 0) + 1;
    this.lastActivity = new Date().toISOString();
    
    this.io.emit('sell-executed', {
      ...sellInfo,
      timestamp: new Date().toISOString()
    });
  }

  emitError(error) {
    this.io.emit('error', {
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  addActivityLog(message) {
    this.io.emit('activityLog', {
      message: message,
      timestamp: new Date().toISOString(),
      type: 'info'
    });
  }

  async start() {
    try {
      // Initialize and start bot
      await this.initializeBot();
      await this.startBot();
      
      // Start web server
      this.server.listen(this.port, () => {
        Logger.success(`🌐 Combined server running on port ${this.port}`);
        Logger.log(`📊 Dashboard: http://localhost:${this.port}`);
        Logger.log('🎯 Bot is monitoring and trading!');
      });
      
    } catch (error) {
      Logger.error('❌ Failed to start combined server', error);
      process.exit(1);
    }
  }

  async stop() {
    if (this.mempoolMonitor) {
      await this.mempoolMonitor.stop();
    }
    this.isRunning = false;
    this.server.close();
    Logger.log('🛑 Combined server stopped');
  }
}

// Start the combined server
const server = new CombinedServer(process.env.PORT || 3000);
server.start();
