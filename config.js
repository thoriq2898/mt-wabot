// ===================================================
//  config.js - Konfigurasi Terpusat
//  ⚠️ Edit file ini sebelum menjalankan project
// ===================================================
const path = require('path');

module.exports = {

    // === SERVER ENDPOINT ===
    // Port dimana server Express berjalan
    ENDPOINT_PORT: 3000,
    ENDPOINT_URL: 'http://localhost:3000',

    // === API KEY (KEAMANAN) ===
    // Ganti dengan string acak yang kuat!
    // MT5 EA dan bot harus pakai nilai yang SAMA
    API_KEY: 'MT5_RAHASIA_GANTI_INI_123',

    // === WHATSAPP ===
    // Kosong = semua nomor boleh pakai bot
    // Isi nomor = hanya nomor yg terdaftar diizinkan
    // Format: ['628123456789', '628987654321']
    ALLOWED_NUMBERS: [],

    // Nama/Bot-ID untuk header pesan
    BOT_NAME: 'MT5 Monitor Pro',

    // === PATH FILE ===
    DB_PATH: path.join(__dirname, 'data', 'db.json'),
    WA_SESSION_PATH: path.join(__dirname, 'data', 'wa_session'),
};
