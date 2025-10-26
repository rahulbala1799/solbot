# Deployment Guide

## Where to Deploy Your Solana Bot

Since this bot needs to run 24/7 to monitor transactions, here are your deployment options:

### 1. 🏠 Local Machine (Easiest for Testing)

**Pros:**
- Free
- Full control
- Easy debugging

**Cons:**
- Must keep computer running 24/7
- Internet connection dependency
- No automatic restarts

**Setup:**
```bash
# Just run it
npm start

# Or use PM2 for auto-restart
npm install -g pm2
pm2 start src/index.js --name solana-bot
pm2 save
pm2 startup
```

---

### 2. ☁️ Railway (Recommended - Free Tier Available)

**Pros:**
- $5 free credit monthly
- Easy deployment from GitHub
- Automatic restarts
- Simple dashboard

**Setup:**
1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repo
3. Add environment variables in dashboard
4. Deploy automatically

**Cost:** Free tier includes $5/month credit (enough for small bots)

---

### 3. 🚀 Render (Free Tier)

**Pros:**
- Free tier available
- Auto-deploys from Git
- SSL included

**Cons:**
- Free tier sleeps after 15 min inactivity (not good for continuous monitoring)

**Setup:**
1. Create account at [render.com](https://render.com)
2. New > Background Worker
3. Connect repo and set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables

**Cost:** Free (but sleeps), or $7/month for always-on

---

### 4. 💧 DigitalOcean Droplet (VPS)

**Pros:**
- Full control
- Reliable
- Good for multiple bots

**Cons:**
- Requires some Linux knowledge
- Manual setup

**Setup:**
```bash
# 1. Create $6/month droplet (Ubuntu)
# 2. SSH into droplet
ssh root@your_droplet_ip

# 3. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# 4. Clone your repo
git clone <your-repo-url>
cd botat1

# 5. Install dependencies
npm install

# 6. Set up environment
nano .env
# (paste your config)

# 7. Install PM2 for process management
npm install -g pm2

# 8. Start bot
pm2 start src/index.js --name solana-bot
pm2 startup
pm2 save

# 9. Monitor logs
pm2 logs solana-bot
```

**Cost:** $6/month for basic droplet

---

### 5. 🌐 AWS EC2 / Google Cloud / Azure

**Pros:**
- Enterprise-grade
- Scalable
- Free tier available

**Cons:**
- More complex setup
- Can be expensive if misconfigured

**Setup:** Similar to DigitalOcean but with cloud provider's console

**Cost:** Free tier available (12 months AWS), then $5-10/month

---

### 6. 📦 Heroku (Simple but Paid)

**Pros:**
- Very easy to deploy
- Good documentation

**Cons:**
- No free tier anymore (removed in 2022)
- $7/month minimum

**Setup:**
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-bot-name

# Add buildpack
heroku buildpacks:set heroku/nodejs

# Set environment variables
heroku config:set WALLET_PRIVATE_KEY=your_key
heroku config:set TARGET_TOKEN_ADDRESS=your_token
# ... etc

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

**Cost:** $7/month

---

## 🎯 Recommended Setup for Beginners

### Option A: Testing Phase
**Use local machine with PM2**
- Cost: Free
- Setup time: 5 minutes
- Good for: Testing and development

### Option B: Production
**Use Railway or DigitalOcean**
- Railway: Easiest, $5/month
- DigitalOcean: More control, $6/month
- Good for: 24/7 operation

---

## 📋 Pre-Deployment Checklist

- [ ] Test bot thoroughly on devnet first
- [ ] Create `.env` file with all required variables
- [ ] Fund wallet with SOL and target tokens
- [ ] Set up monitoring/alerts for errors
- [ ] Have plan for when bot needs updates
- [ ] Back up your private key securely
- [ ] Test with small amounts first

---

## 🔧 Process Management with PM2

PM2 is recommended for any deployment to ensure your bot restarts automatically:

```bash
# Install PM2 globally
npm install -g pm2

# Start bot
pm2 start src/index.js --name solana-bot

# Other useful commands
pm2 logs solana-bot          # View logs
pm2 restart solana-bot       # Restart bot
pm2 stop solana-bot          # Stop bot
pm2 delete solana-bot        # Remove from PM2
pm2 monit                    # Monitor in real-time
pm2 startup                  # Auto-start on system boot
pm2 save                     # Save current process list

# View all processes
pm2 list
```

---

## 🔍 Monitoring Your Bot

After deployment, monitor:

1. **Logs**: Check for errors
   ```bash
   pm2 logs solana-bot --lines 100
   ```

2. **Process Status**: Ensure it's running
   ```bash
   pm2 status
   ```

3. **Wallet Balance**: Make sure you have SOL for fees

4. **Token Balance**: Verify bot has tokens to sell

---

## 🆘 Troubleshooting

### Bot keeps crashing
- Check logs: `pm2 logs`
- Verify .env configuration
- Ensure wallet has SOL for fees
- Check RPC endpoint is working

### Can't connect to RPC
- Try different RPC endpoint
- Check internet connection
- Verify firewall isn't blocking websockets

### Transactions failing
- Check wallet has enough SOL
- Verify token account exists
- Test on devnet first

---

## 🔒 Security Best Practices

1. **Never commit .env file**
2. **Use environment variables on hosting platform**
3. **Limit wallet funds** (only keep what you need)
4. **Monitor regularly** for unusual activity
5. **Keep dependencies updated**: `npm audit fix`
6. **Use SSH keys** for VPS access (not passwords)
7. **Enable 2FA** on hosting platforms

