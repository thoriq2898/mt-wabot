// settings.js — Global Configuration (Gaya Hitori)
const path = require('path');

// ==============================
// BOT IDENTITY
// ==============================
global.botname    = 'MT5 Monitor Pro';
global.author     = 'MT5 WA Bot Suite';
global.timezone   = 'Asia/Jakarta';
global.owner      = []; // ['62812xxx'] - Nomor owner yg punya akses penuh

// ==============================
// WHITELIST NOMOR
// Kosong = semua boleh pakai
// ==============================
global.allowedNumbers = []; // ['628123456789']

// ==============================
// ENDPOINT MT5
// ==============================
global.endpointUrl  = 'http://localhost:3000';
global.endpointKey  = '$2a$12$Axpyj12ftthYV.kXIE1leeVD/GrfYVOkt7OHWSdBfxbsRL/lTO6m.';

// ==============================
// PATH
// ==============================
global.sessionPath = path.join(__dirname, 'data', 'wa_session');
global.dbPath      = path.join(__dirname, 'data', 'db.json');

// ==============================
// PREFIX COMMAND
// ==============================
global.prefix = ['/'];

// ==============================
// PESAN BAWAAN
// ==============================
global.mess = {
    wait    : '⏳ _Memproses..._',
    error   : '❌ Terjadi error. Coba lagi.',
    denied  : '⛔ Akses ditolak.',
    offline : '⚠️ *Endpoint offline atau MT5 belum sync.*\nPastikan server endpoint dan EA MT5 berjalan.',
};
