module.exports = {
  apps: [
    {
      name: 'gemini-service',
      script: './server-v2.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        GEMINI_SERVICE_PORT: 3500,
        GEMINI_SERVICE_API_KEY: 'gemini-service-secret-key-change-this-in-production',
        GOOGLE_AI_API_KEY: 'AIzaSyCfVAATd3uJ1SP3cz4D53U9wjmbZwF8vJs',
      },
      error_file: '/home/ubuntu/.pm2/logs/gemini-service-error.log',
      out_file: '/home/ubuntu/.pm2/logs/gemini-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      restart_delay: 5000,
    },
  ],
};
