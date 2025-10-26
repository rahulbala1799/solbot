# Next.js Trading Bot Dashboard

## 🚀 **Three Ways to Run Your Bot:**

### **1. CLI Bot (Recommended for Trading)**
```bash
npm run cli
# Pure Node.js command line interface
# Best for production trading
```

### **2. Next.js Dashboard (Modern Web Interface)**
```bash
# Terminal 1: Start the bot backend
npm start

# Terminal 2: Start Next.js frontend
npm run web
# Visit: http://localhost:3000
```

### **3. Legacy HTML Dashboard**
```bash
npm start
# Visit: http://localhost:3001 (old HTML interface)
```

## 🎯 **Next.js Features:**

### **Modern React Dashboard:**
- **✅ Real-time Updates** - Socket.IO integration
- **✅ Professional UI** - Tailwind CSS + Lucide icons
- **✅ TypeScript Support** - Type safety
- **✅ Responsive Design** - Mobile-friendly
- **✅ Live Statistics** - Real-time bot stats
- **✅ Transaction Feed** - Live pump.fun transactions
- **✅ Token Management** - Change monitored token
- **✅ Error Handling** - React error boundaries

### **Architecture:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │  Express Server │    │   Solana Bot    │
│   (Port 3000)   │◄──►│   (Port 3001)   │◄──►│   (Backend)     │
│                 │    │                 │    │                 │
│ • React UI      │    │ • Socket.IO     │    │ • Helius API    │
│ • Tailwind CSS  │    │ • API Routes    │    │ • Trading Logic │
│ • TypeScript    │    │ • WebSocket     │    │ • Mempool Monitor│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 **Setup Instructions:**

### **Install Dependencies:**
```bash
npm install
```

### **Run Next.js Dashboard:**
```bash
# Terminal 1: Start bot backend
npm start

# Terminal 2: Start Next.js frontend  
npm run web
```

### **Build for Production:**
```bash
npm run build
npm run web:start
```

## 🎊 **Why Next.js is Better:**

### **vs Plain HTML:**
- **✅ React Components** - Better state management
- **✅ TypeScript** - Type safety and better DX
- **✅ Tailwind CSS** - Professional styling
- **✅ Server-Side Rendering** - Better performance
- **✅ API Routes** - Built-in backend
- **✅ Error Boundaries** - Better error handling
- **✅ Hot Reload** - Faster development

### **vs CLI:**
- **✅ Visual Interface** - See transactions in real-time
- **✅ Better Monitoring** - Charts and statistics
- **✅ User-Friendly** - Easy to use for non-technical users
- **✅ Mobile Support** - Responsive design

## 📱 **Dashboard Features:**

### **Real-time Monitoring:**
- Live transaction feed
- Pump.fun specific transactions
- Bot statistics and uptime
- Connection status

### **Trading Controls:**
- Change monitored token
- View bot configuration
- Real-time buy/sell detection

### **Professional UI:**
- Modern gradient design
- Responsive layout
- Real-time updates
- Error handling

**Choose the interface that works best for you!** 🚀
