// start-all.js — Jalankan endpoint + WA Bot sekaligus
const { startEndpoint } = require('./src/endpoint/server');
startEndpoint();
setTimeout(() => require('./index'), 1500);
