// ecosystem.config.cjs
// PM2 process configuration for NEW Pantheon Server
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Read the .env file and parse it
const envPath = path.resolve(__dirname, '.env');
const envConfig = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};

module.exports = {
    apps: [
        {
            name: 'pantheon-new',
            script: '.output/server/index.mjs',
            cwd: __dirname,
            env: {
                NODE_ENV: 'production',
                ...envConfig,
            },
            error_file: '/home/ubuntu/.pm2/logs/pantheon-new-error.log',
            out_file: '/home/ubuntu/.pm2/logs/pantheon-new-out.log',
            restart_delay: 3000,
            max_restarts: 10,
        },
    ],
};
