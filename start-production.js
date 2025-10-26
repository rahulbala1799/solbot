#!/usr/bin/env node

import { spawn } from 'child_process';
import { Logger } from './src/utils/logger.js';

/**
 * Production startup script for Railway
 * Runs both the bot backend and Next.js frontend
 */
class ProductionStarter {
  constructor() {
    this.botProcess = null;
    this.webProcess = null;
    this.isShuttingDown = false;
  }

  async start() {
    try {
      Logger.log('🚀 Starting Solana Trading Bot in Production Mode...');
      
      // Start the bot backend
      this.startBotBackend();
      
      // Wait a moment for bot to initialize
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Start Next.js frontend
      this.startNextJS();
      
      // Handle graceful shutdown
      this.setupGracefulShutdown();
      
      Logger.success('✅ Production setup complete!');
      Logger.log('📊 Bot Backend: Running on internal port');
      Logger.log('🌐 Next.js Dashboard: Will be available on Railway URL');
      
    } catch (error) {
      Logger.error('❌ Failed to start production setup:', error);
      process.exit(1);
    }
  }

  startBotBackend() {
    Logger.log('🤖 Starting bot backend...');
    
    this.botProcess = spawn('node', ['src/index.js'], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    this.botProcess.on('error', (error) => {
      Logger.error('Bot backend error:', error);
    });

    this.botProcess.on('exit', (code) => {
      if (!this.isShuttingDown) {
        Logger.error(`Bot backend exited with code ${code}`);
        this.restartBotBackend();
      }
    });
  }

  startNextJS() {
    Logger.log('🌐 Starting Next.js frontend...');
    
    // Build Next.js first
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    buildProcess.on('exit', (code) => {
      if (code === 0) {
        Logger.log('✅ Next.js build complete, starting server...');
        
        this.webProcess = spawn('npm', ['run', 'web:start'], {
          stdio: 'inherit',
          env: { 
            ...process.env,
            PORT: process.env.PORT || 3000
          }
        });

        this.webProcess.on('error', (error) => {
          Logger.error('Next.js error:', error);
        });

        this.webProcess.on('exit', (code) => {
          if (!this.isShuttingDown) {
            Logger.error(`Next.js exited with code ${code}`);
          }
        });
      } else {
        Logger.error('❌ Next.js build failed');
      }
    });
  }

  restartBotBackend() {
    if (this.isShuttingDown) return;
    
    Logger.log('🔄 Restarting bot backend...');
    setTimeout(() => {
      this.startBotBackend();
    }, 5000);
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      Logger.log('🛑 Shutting down production setup...');
      
      if (this.botProcess) {
        this.botProcess.kill('SIGTERM');
      }
      
      if (this.webProcess) {
        this.webProcess.kill('SIGTERM');
      }
      
      setTimeout(() => {
        process.exit(0);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}

// Start production setup
const starter = new ProductionStarter();
starter.start();
