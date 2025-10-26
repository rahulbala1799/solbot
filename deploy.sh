#!/bin/bash

# Solana Bot Deployment Script
# This script helps deploy the bot to a VPS or local server

set -e  # Exit on error

echo "================================"
echo "Solana Bot Deployment"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 18+ first:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

echo "✓ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

echo "✓ PM2 version: $(pm2 --version)"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from template..."
    cp env.example .env
    echo ""
    echo "❗ IMPORTANT: Please edit .env file with your configuration:"
    echo "   - Add your WALLET_PRIVATE_KEY"
    echo "   - Set your TARGET_TOKEN_ADDRESS"
    echo "   - Adjust BUY_THRESHOLD_SOL and SELL_PERCENTAGE if needed"
    echo ""
    echo "Run 'nano .env' to edit, then run this script again."
    exit 1
fi

echo "✓ .env file found"
echo ""

# Create logs directory
mkdir -p logs

echo "================================"
echo "Deployment Options:"
echo "================================"
echo "1. Start bot with PM2 (recommended for production)"
echo "2. Start bot in development mode"
echo "3. Just test the configuration"
echo ""
read -p "Select option (1-3): " option

case $option in
    1)
        echo ""
        echo "🚀 Starting bot with PM2..."
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo ""
        echo "✓ Bot started successfully!"
        echo ""
        echo "Useful commands:"
        echo "  pm2 logs solana-bot     - View logs"
        echo "  pm2 restart solana-bot  - Restart bot"
        echo "  pm2 stop solana-bot     - Stop bot"
        echo "  pm2 monit               - Monitor in real-time"
        echo ""
        echo "To make bot start on system boot:"
        echo "  pm2 startup"
        echo "  (follow the instructions shown)"
        ;;
    2)
        echo ""
        echo "🔧 Starting bot in development mode..."
        npm run dev
        ;;
    3)
        echo ""
        echo "🧪 Testing configuration..."
        node -e "
        import('./src/config.js').then(({ config }) => {
          try {
            config.validate();
            console.log('✓ Configuration is valid!');
            console.log('');
            console.log('Settings:');
            console.log('  RPC URL:', config.rpcUrl);
            console.log('  Token:', config.targetTokenAddress);
            console.log('  Buy threshold:', config.buyThresholdSol, 'SOL');
            console.log('  Sell percentage:', config.sellPercentage, '%');
          } catch (error) {
            console.error('❌ Configuration error:', error.message);
            process.exit(1);
          }
        });
        "
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "================================"
echo "Deployment complete!"
echo "================================"

