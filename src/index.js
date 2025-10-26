import { SolanaBot } from './bot.js';
import { Logger } from './utils/logger.js';

/**
 * Main entry point for the Solana trading bot
 */
async function main() {
  Logger.log('='.repeat(60));
  Logger.log('Solana Mempool Trading Bot');
  Logger.log('='.repeat(60));

  const bot = new SolanaBot();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    Logger.log('\nReceived SIGINT, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    Logger.log('\nReceived SIGTERM, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled rejection', reason);
    process.exit(1);
  });

  try {
    // Initialize and start the bot
    await bot.initialize();
    await bot.start();

    // Keep the process running
    Logger.log('Bot is running. Press Ctrl+C to stop.');
    Logger.log('Web dashboard available at: http://localhost:3000');

  } catch (error) {
    Logger.error('Bot initialization failed, but web interface will still work', error);
    Logger.log('You can still set a token address via the web interface to start monitoring');
  }
}

// Start the bot
main();

