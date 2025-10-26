# Solana Trading Bot

A real-time Solana mempool monitoring bot that automatically sells tokens when large buy orders are detected.

## 🚀 **Quick Start**

### **Option 1: Railway Dashboard (Deployed)**
Visit: https://solana-bot-production-a6d2.up.railway.app
- ✅ Live monitoring dashboard
- ✅ Real-time transaction feed
- ✅ Professional UI

### **Option 2: CLI Bot (Terminal)**
```bash
npm run cli
```
- ✅ Pure command-line interface
- ✅ Fastest performance
- ✅ Best for production trading

### **Option 3: Development**
```bash
npm start  # Bot + HTML dashboard on localhost:3001
npm run web  # Next.js dashboard (separate)
```

## 🎯 **Features**

### **Core Functionality:**
- **🔍 Real-time Monitoring** - Helius Parse API integration
- **⚡ Auto Trading** - Sells 25% when buy orders > 0.2 SOL detected
- **📊 Live Dashboard** - Modern web interface with transaction feed
- **🔄 Token Management** - Change monitored token via web interface
- **📱 Mobile Friendly** - Responsive design

### **Technical:**
- **Node.js Backend** - Express server with Socket.IO
- **Helius Integration** - Professional Solana RPC with parsing
- **Modern UI** - Dark theme with glassmorphism design
- **Real-time Updates** - WebSocket communication
- **Production Ready** - Deployed on Railway

## 🔧 **Configuration**

Create `.env` file:
```env
WALLET_PRIVATE_KEY=your_private_key_here
TARGET_TOKEN_ADDRESS=8NfK7b9u1RvMpHJnAnZki4mNQwjhvzrVZs7bRQatpump
BUY_THRESHOLD_SOL=0.2
SELL_PERCENTAGE=25
```

## 📊 **Dashboard Features**

### **Live Indicators:**
- 🟢 **Connection Status** - Shows if bot is connected
- 🟢 **Live Monitoring** - Pulsing indicator when actively monitoring
- ⏰ **Last Updated** - Timestamp of last data update
- 📈 **Real-time Stats** - Transaction counts and bot uptime

### **Transaction Display:**
- **🟢 BUY Orders** - Green with SOL amounts
- **🔴 SELL Orders** - Red with SOL amounts
- **⚡ PUMP Activity** - Yellow for pump.fun transactions
- **Real Signatures** - Actual transaction hashes
- **Live Timestamps** - When each transaction occurred

## 🎊 **Current Status**

✅ **Bot is Live and Monitoring**
✅ **Railway Deployment Active**
✅ **Helius Parse API Integration**
✅ **Modern Web Interface**
✅ **Real-time Transaction Feed**

## 🚦 **How to Know It's Working**

### **Visual Indicators:**
1. **🟢 Green Dot** - Bot is connected and monitoring
2. **🟢 Live Monitoring** - Shows when actively checking transactions
3. **⏰ Last Updated** - Updates every few seconds
4. **Transaction Feed** - Shows real pump.fun transactions
5. **Stats Updates** - Numbers change as activity happens

### **Expected Activity:**
- **Every 10 seconds** - Bot checks for new transactions
- **Real transactions** - Shows actual buy/sell/pump activity
- **Live updates** - Interface updates without refresh
- **Heartbeat** - Regular status updates show bot is alive

## 🔍 **Monitoring Your Token**

The bot monitors: `8NfK7b9u1RvMpHJnAnZki4mNQwjhvzrVZs7bRQatpump`

When it detects buy orders > 0.2 SOL, it will:
1. **Log the detection** in terminal
2. **Update dashboard** with buy order count
3. **Execute sell** of 25% of your token balance
4. **Show transaction** in the activity feed

**Visit the dashboard to see live activity!** 🌐