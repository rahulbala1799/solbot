import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebServer {
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
    this.setupRoutes();
    this.setupSocket();
  }

  setupRoutes() {
    // Serve static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // API routes
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
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

    // Serve dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  setupSocket() {
    this.io.on('connection', (socket) => {
      Logger.log('Web client connected');
      
      socket.on('disconnect', () => {
        Logger.log('Web client disconnected');
      });
    });
  }

  // Emit events to connected clients
  emitBotStatus(status, data = {}) {
    this.io.emit('bot-status', {
      status,
      data,
      timestamp: new Date().toISOString()
    });
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

  start() {
    this.server.listen(this.port, () => {
      Logger.success(`Web interface running on port ${this.port}`);
      Logger.log(`Dashboard: http://localhost:${this.port}`);
    });
  }

  stop() {
    this.server.close();
  }
}
