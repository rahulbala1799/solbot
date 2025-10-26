# Deploy to Railway - Complete Guide

## Method 1: Web Dashboard (Easiest - Recommended!) ✅

### Step 1: Go to Railway
Visit: https://railway.app/dashboard

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Authorize GitHub access if prompted
4. Select repository: `rahulbala1799/solbot`

### Step 3: Configure Environment Variables
Once your project is created, click on your service and go to the "Variables" tab.

Add these variables:

```
WALLET_PRIVATE_KEY=your_wallet_private_key_base58
TARGET_TOKEN_ADDRESS=your_pump_fun_token_mint_address
BUY_THRESHOLD_SOL=0.2
SELL_PERCENTAGE=25
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WSS_URL=wss://api.mainnet-beta.solana.com
PUMP_PROGRAM_ID=6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
```

### Step 4: Deploy
Railway will automatically:
- Detect your `package.json`
- Run `npm install`
- Start your bot with `npm start`

### Step 5: Monitor
- Click "View Logs" to see your bot running
- Check for "✓ Bot initialized successfully!"
- Monitor for buy order detections

---

## Method 2: Railway CLI (Advanced)

### Prerequisites
If Railway CLI login is not working, you need to authenticate in your terminal:

```bash
# Open Terminal app
railway login
```

This will open your browser for authentication.

### After Login

```bash
cd /Users/rahul/Documents/Crsr/botat1

# Initialize project
railway init

# Set environment variables
railway variables set WALLET_PRIVATE_KEY="your_key"
railway variables set TARGET_TOKEN_ADDRESS="your_token"
railway variables set BUY_THRESHOLD_SOL="0.2"
railway variables set SELL_PERCENTAGE="25"
railway variables set SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
railway variables set SOLANA_WSS_URL="wss://api.mainnet-beta.solana.com"
railway variables set PUMP_PROGRAM_ID="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"

# Deploy
railway up

# View logs
railway logs
```

---

## Troubleshooting

### "Unauthorized" Error
- Make sure you're logged in to Railway
- Try logging out and back in: `railway logout` then `railway login`
- Use the web dashboard method instead

### Bot Not Starting
- Check logs in Railway dashboard
- Verify all environment variables are set
- Make sure WALLET_PRIVATE_KEY is base58 encoded
- Ensure TARGET_TOKEN_ADDRESS is set

### "Configuration errors"
- Double-check all required environment variables
- No spaces around the `=` sign
- No quotes needed in Railway dashboard (just the value)

### Bot Crashes
- Check you have enough credits in Railway
- View logs for specific error messages
- Verify your wallet has SOL for fees

---

## Monitoring Your Bot

### In Railway Dashboard:
1. Click your project
2. Click your service
3. Click "View Logs"

### What to Look For:
```
✓ Bot initialized successfully!
✓ Mempool monitor started
✓ Watching for buy orders > 0.2 SOL
```

### When a Trade Happens:
```
✓ Buy order detected!
  SOL Amount: 0.5
✓ Buy threshold met! 0.5 SOL >= 0.2 SOL
✓ Executing sell order for 25%...
✓ Sell executed successfully! Signature: [tx_signature]
```

---

## Cost

Railway pricing:
- **Free tier**: $5 credit per month
- This bot uses minimal resources (~$3-5/month)
- Add credit card for usage beyond free tier

---

## Updates

When you push changes to GitHub:
1. Railway auto-deploys new code
2. Bot restarts automatically
3. Check logs to confirm update

Manual restart:
- Railway Dashboard → Click service → "Restart"

---

## Security

✅ Environment variables are encrypted
✅ .env file is not pushed to GitHub
✅ Private key is secure in Railway

⚠️ Never share your Railway project URL with private key access
⚠️ Monitor your wallet balance regularly
⚠️ Use a dedicated trading wallet (not your main wallet)

---

## Next Steps

1. Deploy to Railway
2. Monitor logs for 10-15 minutes
3. Test with small token amounts
4. Adjust BUY_THRESHOLD_SOL and SELL_PERCENTAGE as needed
5. Scale up once comfortable

**Happy Trading! 🚀**


