# Quick Start Guide

Get your bot running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Create Configuration File

```bash
cp env.example .env
```

## Step 3: Edit Configuration

Open `.env` and set:

```env
# Your wallet private key (base58 format)
WALLET_PRIVATE_KEY=your_actual_private_key_here

# Token you want to trade
TARGET_TOKEN_ADDRESS=your_token_mint_address_here

# When to sell (0.2 SOL buy triggers sell)
BUY_THRESHOLD_SOL=0.2

# How much to sell (25% of holdings)
SELL_PERCENTAGE=25
```

### How to Get Your Private Key

**From Phantom Wallet:**
1. Open Phantom
2. Settings → Show Secret Recovery Phrase
3. Use a tool to convert the seed phrase to base58 private key

**From Solana CLI:**
```bash
# If you have a keypair.json file
cat ~/.config/solana/id.json
# Copy the array of numbers and use a converter to base58
```

**⚠️ Security Warning:** Never share your private key! Keep it secure!

## Step 4: Test on Devnet First (Recommended)

```bash
# In .env, change to devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WSS_URL=wss://api.devnet.solana.com

# Get devnet SOL
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

## Step 5: Run the Bot

### Option A: Simple Run (for testing)
```bash
npm start
```

### Option B: With PM2 (for production)
```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start ecosystem.config.js

# View logs
pm2 logs solana-bot

# View status
pm2 status
```

### Option C: Use Deployment Script
```bash
./deploy.sh
```

## Step 6: Monitor

Watch the logs to see the bot working:

```bash
# If using npm start
# Logs show in terminal

# If using PM2
pm2 logs solana-bot
```

You should see:
```
[timestamp] Starting bot...
[timestamp] ✓ Bot initialized successfully!
[timestamp] Watching for buy orders > 0.2 SOL
```

## What to Expect

1. **Bot starts**: Connects to Solana and begins monitoring
2. **Detects buys**: Logs when someone buys your target token
3. **Checks threshold**: Compares buy amount to your BUY_THRESHOLD_SOL
4. **Executes sell**: If threshold met, sells SELL_PERCENTAGE of your tokens
5. **Logs result**: Shows transaction signature and new balance

## Common First-Time Issues

### "Configuration errors: WALLET_PRIVATE_KEY is required"
- You forgot to edit `.env` file
- Make sure to remove "your_private_key_here" and add your actual key

### "Configuration errors: TARGET_TOKEN_ADDRESS is required"
- You need to set the token mint address you want to trade
- Get this from pump.fun when the token launches

### "Token account not found - balance is 0"
- You don't have any of the target token yet
- You need to buy some first before the bot can sell

### "Error: 429 Too Many Requests"
- You're hitting rate limits on the free RPC
- The bot will keep trying - this is normal
- Consider spacing out polling (edit `mempoolMonitorFree.js` line 192)

## Testing the Bot

### Test 1: Check Configuration
```bash
node -e "import('./src/config.js').then(({ config }) => { config.validate(); console.log('✓ Config OK'); });"
```

### Test 2: Check Connection
```bash
node -e "import('@solana/web3.js').then(({ Connection }) => { const c = new Connection('https://api.mainnet-beta.solana.com'); c.getVersion().then(v => console.log('✓ Connected:', v)); });"
```

### Test 3: Check Balance
After starting the bot, it will show your token balance in logs

## Next Steps

- Read `DEPLOYMENT.md` for production deployment options
- Monitor your bot's performance
- Start with small amounts
- Adjust BUY_THRESHOLD_SOL and SELL_PERCENTAGE based on your strategy

## Getting Help

Check the logs:
```bash
pm2 logs solana-bot
```

Common log messages:
- ✓ = Success
- ⚠ = Warning (usually safe to ignore)
- ERROR = Something went wrong (check the message)

## Stop the Bot

```bash
# If using npm start
# Press Ctrl+C

# If using PM2
pm2 stop solana-bot
```

## Safety Checklist

- [ ] Tested on devnet first
- [ ] Using a dedicated wallet (not your main wallet)
- [ ] Wallet only has tokens you want to trade
- [ ] BUY_THRESHOLD_SOL is set appropriately
- [ ] SELL_PERCENTAGE is reasonable (25% is good start)
- [ ] Monitoring logs regularly
- [ ] Have enough SOL for transaction fees (~0.001 SOL per transaction)

---

**Ready to trade?** 🚀

Start the bot and watch it work! Remember to monitor the logs and start with small amounts.

