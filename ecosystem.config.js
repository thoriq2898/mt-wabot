// ecosystem.config.js — PM2 Config
module.exports = {
    apps: [
        {
            name       : 'mt5-endpoint',
            script     : './start-endpoint.js',
            watch      : false,
            autorestart: true,
            max_restarts: 10,
            restart_delay: 3000,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
        {
            name       : 'mt5-bot',
            script     : './index.js',      // ← Langsung ke index.js (gaya hitori)
            watch      : false,
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
};
