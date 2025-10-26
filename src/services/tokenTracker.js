import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { Logger } from '../utils/logger.js';

export class TokenTracker {
  constructor(connection, walletPublicKey, tokenMintAddress) {
    this.connection = connection;
    this.walletPublicKey = walletPublicKey;
    this.tokenMintAddress = new PublicKey(tokenMintAddress);
    this.tokenAccountAddress = null;
  }

  /**
   * Initialize and get the token account address
   */
  async initialize() {
    try {
      this.tokenAccountAddress = await getAssociatedTokenAddress(
        this.tokenMintAddress,
        this.walletPublicKey
      );
      
      Logger.log(`Token account address: ${this.tokenAccountAddress.toString()}`);
      return this.tokenAccountAddress;
    } catch (error) {
      Logger.error('Error initializing token tracker', error);
      throw error;
    }
  }

  /**
   * Get current token balance
   */
  async getBalance() {
    try {
      if (!this.tokenAccountAddress) {
        await this.initialize();
      }

      const tokenAccount = await getAccount(
        this.connection,
        this.tokenAccountAddress
      );

      const balance = Number(tokenAccount.amount);
      Logger.log(`Current token balance: ${balance}`);
      
      return balance;
    } catch (error) {
      if (error.message?.includes('could not find account')) {
        Logger.warn('Token account not found - balance is 0');
        return 0;
      }
      Logger.error('Error getting token balance', error);
      throw error;
    }
  }

  /**
   * Calculate amount to sell based on percentage
   */
  async calculateSellAmount(percentage) {
    const balance = await this.getBalance();
    
    if (balance === 0) {
      Logger.warn('No tokens to sell');
      return 0;
    }

    const sellAmount = Math.floor((balance * percentage) / 100);
    Logger.log(`Calculated sell amount: ${sellAmount} (${percentage}% of ${balance})`);
    
    return sellAmount;
  }

  /**
   * Get token account address
   */
  getTokenAccountAddress() {
    return this.tokenAccountAddress;
  }
}

