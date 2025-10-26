'use client'

import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { Activity, TrendingUp, TrendingDown, Zap, Wallet, Settings } from 'lucide-react'

interface Transaction {
  signature: string
  type: string
  timestamp: string
  accounts: number
  solAmount: number
  tokenAmount: number
  transactionType: string
  message: string
}

interface BotStatus {
  status: string
  message: string
  wallet: string
  tokenBalance: number
  buyThreshold: number
  sellPercentage: number
  targetTokenAddress: string
}

export default function Dashboard() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pumpTransactions, setPumpTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState({
    totalTransactions: 0,
    buyOrdersDetected: 0,
    sellOrdersExecuted: 0,
    uptime: 0
  })

  useEffect(() => {
    // Connect to Socket.IO server
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('Connected to bot server')
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from bot server')
      setConnected(false)
    })

    newSocket.on('bot-status', (data) => {
      setBotStatus(data)
    })

    newSocket.on('transaction', (data: Transaction) => {
      setTransactions(prev => [data, ...prev.slice(0, 49)]) // Keep last 50
      
      // Add to pump transactions if it's a pump-related transaction
      if (data.transactionType === 'buy' || data.transactionType === 'sell' || data.transactionType === 'pump') {
        setPumpTransactions(prev => [data, ...prev.slice(0, 19)]) // Keep last 20
      }
    })

    newSocket.on('buy-detected', (data) => {
      setStats(prev => ({ ...prev, buyOrdersDetected: prev.buyOrdersDetected + 1 }))
    })

    newSocket.on('sell-executed', (data) => {
      setStats(prev => ({ ...prev, sellOrdersExecuted: prev.sellOrdersExecuted + 1 }))
    })

    setSocket(newSocket)

    // Fetch initial stats
    fetchStats()

    return () => {
      newSocket.close()
    }
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stats')
      const data = await response.json()
      setStats(prev => ({ ...prev, ...data }))
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const changeToken = async (newToken: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/change-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenAddress: newToken })
      })
      const data = await response.json()
      if (data.success) {
        alert('Token updated successfully!')
      } else {
        alert('Failed to update token: ' + data.error)
      }
    } catch (error) {
      console.error('Error changing token:', error)
      alert('Error changing token')
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy': return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'sell': return <TrendingDown className="w-4 h-4 text-red-500" />
      case 'pump': return <Zap className="w-4 h-4 text-yellow-500" />
      default: return <Activity className="w-4 h-4 text-blue-500" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Solana Trading Bot Dashboard
          </h1>
          <p className="text-blue-200">
            Real-time mempool monitoring and automated trading
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
            connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">Total Transactions</p>
                <p className="text-2xl font-bold text-white">{stats.totalTransactions}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-sm">Buy Orders Detected</p>
                <p className="text-2xl font-bold text-white">{stats.buyOrdersDetected}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-200 text-sm">Sell Orders Executed</p>
                <p className="text-2xl font-bold text-white">{stats.sellOrdersExecuted}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm">Uptime</p>
                <p className="text-2xl font-bold text-white">{formatUptime(stats.uptime)}</p>
              </div>
              <Settings className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Bot Status */}
        {botStatus && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">Bot Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-blue-200 text-sm">Wallet</p>
                <p className="text-white font-mono text-sm">{botStatus.wallet}</p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">Token Balance</p>
                <p className="text-white">{botStatus.tokenBalance} tokens</p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">Buy Threshold</p>
                <p className="text-white">{botStatus.buyThreshold} SOL</p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">Sell Percentage</p>
                <p className="text-white">{botStatus.sellPercentage}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Token Change */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-semibold text-white mb-4">Change Monitored Token</h3>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Enter new token address..."
              className="flex-1 px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  changeToken((e.target as HTMLInputElement).value)
                }
              }}
            />
            <button
              onClick={() => {
                const input = document.querySelector('input') as HTMLInputElement
                if (input.value) changeToken(input.value)
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Change Token
            </button>
          </div>
        </div>

        {/* Pump.fun Live Transactions */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-400" />
            Pump.fun Live Transactions
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pumpTransactions.length === 0 ? (
              <p className="text-blue-200 text-center py-8">Waiting for pump.fun transactions...</p>
            ) : (
              pumpTransactions.map((tx, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getTransactionIcon(tx.transactionType)}
                      <span className="text-white font-medium">{tx.message}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-200 text-sm">{new Date(tx.timestamp).toLocaleTimeString()}</p>
                      <p className="text-blue-300 text-xs font-mono">{tx.signature.substring(0, 16)}...</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-400" />
            Activity Feed
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {transactions.length === 0 ? (
              <p className="text-blue-200 text-center py-8">Waiting for activity...</p>
            ) : (
              transactions.map((tx, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getTransactionIcon(tx.transactionType)}
                      <span className="text-white font-medium">{tx.message}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-200 text-sm">{new Date(tx.timestamp).toLocaleTimeString()}</p>
                      <p className="text-blue-300 text-xs font-mono">{tx.signature.substring(0, 16)}...</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
