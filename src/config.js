import dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';

dotenv.config();

export const config = {
  // RPC Configuration - Helius free tier
  rpcEndpoints: [
    'https://mainnet.helius-rpc.com/?api-key=8fa5a141-a272-488e-8dba-edb177602cf9',
    'https://api.mainnet-beta.solana.com',
    'https://solana-mainnet.g.alchemy.com/v2/demo'
  ],
  wssEndpoints: [
    'wss://mainnet.helius-rpc.com/?api-key=8fa5a141-a272-488e-8dba-edb177602cf9',
    'wss://api.mainnet-beta.solana.com',
    'wss://solana-mainnet.g.alchemy.com/v2/demo'
  ],
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  wssUrl: process.env.SOLANA_WSS_URL || 'wss://api.mainnet-beta.solana.com',
  
  // Wallet Configuration
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  
  // Token Configuration
  targetTokenAddress: process.env.TARGET_TOKEN_ADDRESS,
  
  // Trading Parameters
  buyThresholdSol: parseFloat(process.env.BUY_THRESHOLD_SOL || '0.2'),
  sellPercentage: parseFloat(process.env.SELL_PERCENTAGE || '25'),
  
  // Program IDs
  pumpProgramId: new PublicKey(process.env.PUMP_PROGRAM_ID || '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'),
  
  // Validation
  validate() {
    const errors = [];
    
    if (!this.walletPrivateKey) {
      errors.push('WALLET_PRIVATE_KEY is required');
    }
    
    if (!this.targetTokenAddress) {
      errors.push('TARGET_TOKEN_ADDRESS is required');
    }
    
    if (this.sellPercentage <= 0 || this.sellPercentage > 100) {
      errors.push('SELL_PERCENTAGE must be between 0 and 100');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    }
    
    return true;
  }
};

