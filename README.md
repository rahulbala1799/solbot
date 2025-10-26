# Solana Mempool Trading Bot

A Solana trading bot that monitors the mempool for large buy orders on pump.fun tokens and automatically executes sell orders when specific conditions are met.

## Features

- **Real-time Mempool Monitoring**: Watches pending transactions for the target token
- **Configurable Thresholds**: Set custom SOL amount triggers and sell percentages
- **Automatic Trading**: Executes sells when buy orders exceed the threshold
- **Token Balance Tracking**: Monitors your token holdings in real-time
- **Comprehensive Logging**: Detailed logs of all bot activities

## How It Works

1. The bot monitors Solana transactions for your target token using FREE public RPC endpoints
2. Uses three monitoring strategies: program logs, account changes, and periodic polling
3. When it detects a buy order over the configured threshold (default: 0.2 SOL)
4. It automatically sells a specified percentage of your holdings (default: 25%)

**Note:** Works with free Solana RPC endpoints - no premium RPC needed!

## Prerequisites

- Node.js 18+ installed
- A Solana wallet with:
  - SOL for transaction fees
  - The target token you want to trade
- Access to Solana RPC (free public endpoints work fine: api.mainnet-beta.solana.com)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd botat1
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Configure your `.env` file with:
   - Your Solana RPC URL (free public endpoints work great!)
   - Your wallet private key (base58 encoded)
   - Target token address
   - Trading parameters

## Quick Deploy

Use the deployment script:

```bash
./deploy.sh
```

Or see `DEPLOYMENT.md` for detailed deployment options (VPS, Railway, Render, etc.)

## Configuration

Edit the `.env` file:

```env
# Solana RPC endpoint (free public endpoints work perfectly!)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WSS_URL=wss://api.mainnet-beta.solana.com

# Your wallet private key (base58 encoded)
WALLET_PRIVATE_KEY=your_private_key_here

# Token to monitor (pump.fun token address)
TARGET_TOKEN_ADDRESS=

# Trading parameters
BUY_THRESHOLD_SOL=0.2
SELL_PERCENTAGE=25

# Pump.fun program ID
PUMP_PROGRAM_ID=6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
```

### Configuration Parameters

- `BUY_THRESHOLD_SOL`: Minimum SOL amount in a buy order to trigger a sell (default: 0.2)
- `SELL_PERCENTAGE`: Percentage of your token holdings to sell when triggered (default: 25)
- `TARGET_TOKEN_ADDRESS`: The mint address of the token you want to monitor

## Usage

Start the bot:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

Stop the bot:
- Press `Ctrl+C` for graceful shutdown

## Important Notes

### ⚠️ Pump.fun Integration

The sell execution logic in `src/services/tradeExecutor.js` contains a **placeholder implementation** for pump.fun swaps. You need to:

1. Obtain the correct pump.fun program instruction format
2. Update the `createPumpFunSellInstruction` method with actual instruction data
3. Ensure correct account derivation for bonding curves

Refer to pump.fun's documentation or use their SDK for the correct implementation.

### 🔐 Security

- **NEVER commit your `.env` file or expose your private key**
- Store your private key securely
- Consider using a dedicated wallet for bot trading
- Test on devnet before using real funds

### 📊 Monitoring Strategy

The bot uses **THREE** strategies to catch transactions quickly (even with free RPCs):

1. **Program Log Subscriptions** - Monitors pump.fun program activity in real-time
2. **Account Change Monitoring** - Watches the bonding curve account for updates  
3. **Periodic Polling** - Checks recent transactions every 2 seconds

This multi-layered approach works great with FREE public RPC endpoints!

**Optional:** For even faster detection, you can use premium RPC providers like Helius or QuickNode, but it's not required.

### 💰 Transaction Fees

- The bot uses priority fees for faster transaction processing
- Adjust compute budget in `tradeExecutor.js` if needed
- Keep sufficient SOL in your wallet for transaction fees

## Project Structure

```
botat1/
├── src/
│   ├── services/
│   │   ├── mempoolMonitorFree.js  # FREE RPC-compatible monitor
│   │   ├── tokenTracker.js        # Tracks token balance
│   │   └── tradeExecutor.js       # Executes sell orders
│   ├── utils/
│   │   └── logger.js              # Logging utility
│   ├── config.js                  # Configuration management
│   ├── bot.js                     # Main bot orchestrator
│   └── index.js                   # Entry point
├── ecosystem.config.js            # PM2 configuration
├── deploy.sh                      # Deployment script
├── DEPLOYMENT.md                  # Detailed deployment guide
├── .env                           # Configuration (create from env.example)
├── .gitignore
├── package.json
└── README.md
```

## Troubleshooting

### Bot doesn't detect transactions
- Verify your RPC endpoint supports websocket subscriptions
- Check that the target token address is correct
- Ensure transactions are actually happening for the token
- The bot uses confirmed transactions, so there's a ~1-2 second delay (this is normal)

### Sell transactions fail
- Verify you have sufficient token balance
- Check you have enough SOL for transaction fees
- Confirm the pump.fun instruction implementation is correct

### Connection issues
- Try a different RPC endpoint
- Check your internet connection
- Verify websocket support on your RPC

## Development

To modify the bot behavior:

1. **Adjust detection logic**: Edit `src/services/mempoolMonitor.js`
2. **Change sell strategy**: Modify `src/bot.js` `handleBuyDetected` method
3. **Update trade execution**: Edit `src/services/tradeExecutor.js`

## Disclaimer

This bot is provided as-is for educational purposes. Trading cryptocurrencies involves significant risk. Always:

- Test thoroughly on devnet first
- Start with small amounts
- Monitor the bot's performance
- Understand the risks involved
- Never invest more than you can afford to lose

The authors are not responsible for any financial losses incurred while using this bot.

## License

MIT

