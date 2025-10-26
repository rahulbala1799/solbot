// PM2 configuration file for production deployment
module.exports = {
  apps: [{
    name: 'solana-bot',
    script: './src/index.js',
    
    // Instances
    instances: 1,
    exec_mode: 'fork',
    
    // Auto restart configuration
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Restart strategy
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Environment variables (override with .env file)
    env: {
      NODE_ENV: 'production',
    },
    
    // Development environment
    env_development: {
      NODE_ENV: 'development',
      SOLANA_RPC_URL: 'https://api.devnet.solana.com',
      SOLANA_WSS_URL: 'wss://api.devnet.solana.com',
    },
    
    // Production environment
    env_production: {
      NODE_ENV: 'production',
    }
  }]
};

