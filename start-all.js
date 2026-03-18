// start-all.js
// Gunakan: npm run start:all  ATAU  node start-all.js
// Menjalankan ENDPOINT + WA BOT sekaligus dalam 1 proses
const { startEndpoint } = require('./src/endpoint/server');
const { startBot }      = require('./src/wa-bot/bot');

startEndpoint();
setTimeout(() => startBot(), 1000); // Delay 1 detik agar endpoint siap dulu
