import { Connection } from '@solana/web3.js';
import { Logger } from './logger.js';
import { config } from '../config.js';

/**
 * RPC Manager with automatic failover and rate limit handling
 */
export class RPCManager {
  constructor() {
    this.rpcEndpoints = config.rpcEndpoints;
    this.wssEndpoints = config.wssEndpoints;
    this.currentRpcIndex = 0;
    this.currentWssIndex = 0;
    this.rateLimitCount = 0;
    this.maxRateLimitCount = 3;
    this.connection = null;
    this.lastSwitchTime = 0;
    this.switchCooldown = 30000; // 30 seconds cooldown between switches
  }

  /**
   * Get current connection, switching if needed
   */
  getConnection() {
    if (!this.connection || this.shouldSwitchRPC()) {
      this.switchToNextRPC();
    }
    return this.connection;
  }

  /**
   * Test if current RPC is working
   */
  async testConnection() {
    try {
      const connection = this.getConnection();
      await connection.getSlot();
      return true;
    } catch (error) {
      Logger.warn(`RPC test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if we should switch RPC due to rate limiting
   */
  shouldSwitchRPC() {
    const now = Date.now();
    return (
      this.rateLimitCount >= this.maxRateLimitCount &&
      (now - this.lastSwitchTime) > this.switchCooldown
    );
  }

  /**
   * Switch to next RPC endpoint
   */
  switchToNextRPC() {
    const oldIndex = this.currentRpcIndex;
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcEndpoints.length;
    this.currentWssIndex = (this.currentWssIndex + 1) % this.wssEndpoints.length;
    
    const rpcUrl = this.rpcEndpoints[this.currentRpcIndex];
    const wssUrl = this.wssEndpoints[this.currentWssIndex];
    
    Logger.log(`Switching RPC from ${this.rpcEndpoints[oldIndex]} to ${rpcUrl}`);
    
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: wssUrl
    });
    
    this.rateLimitCount = 0;
    this.lastSwitchTime = Date.now();
    
    Logger.success(`RPC switched to: ${rpcUrl}`);
  }

  /**
   * Handle rate limit error
   */
  handleRateLimit() {
    this.rateLimitCount++;
    Logger.warn(`Rate limit hit (${this.rateLimitCount}/${this.maxRateLimitCount})`);
    
    if (this.shouldSwitchRPC()) {
      Logger.log('Switching RPC due to rate limiting...');
      this.switchToNextRPC();
    }
  }

  /**
   * Reset rate limit counter on successful request
   */
  resetRateLimit() {
    if (this.rateLimitCount > 0) {
      this.rateLimitCount = Math.max(0, this.rateLimitCount - 1);
    }
  }

  /**
   * Get current RPC info
   */
  getCurrentRPC() {
    return {
      rpcUrl: this.rpcEndpoints[this.currentRpcIndex],
      wssUrl: this.wssEndpoints[this.currentWssIndex],
      rateLimitCount: this.rateLimitCount
    };
  }
}
