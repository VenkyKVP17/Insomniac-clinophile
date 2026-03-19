// master.ecosystem.config.cjs
// PM2 master configuration for the entire Pantheon Stack

module.exports = {
  apps: [
    {
      name: 'pantheon-stable',
      script: '.output/server/index.mjs',
      cwd: '/home/ubuntu/vp/05-Development/pantheon-server',
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'pantheon-new',
      script: '.output/server/index.mjs',
      cwd: '/home/ubuntu/pantheon-new',
      env: {
        PORT: 3001,
        NODE_ENV: 'production',
        ANTHROPIC_BASE_URL: 'https://pro-proxy.katthan.online/v1',
        ANTHROPIC_API_KEY: 'dummy'
      }
    },
    {
      name: 'pro-proxy',
      script: '/usr/bin/antigravity-claude-proxy',
      args: 'start --log',
      env: {
        PORT: 8080
      }
    },
    {
      name: 'openclaw',
      script: '/home/ubuntu/start-openclaw.sh',
      env: {
        PORT: 3002
      }
    },
    {
      name: 'jr-hub',
      script: '/home/ubuntu/start-jrhub.sh',
      cwd: '/home/ubuntu/vp/03-Projects/Roster_v3',
      env: {
        PORT: 8081,
        APP_ENV: 'production',
        HOST: '127.0.0.1'
      }
    }
  ]
};
