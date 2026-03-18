// ===================================================
//  src/endpoint/server.js
//  Express API Server - Penerima & Penyimpan data MT5
// ===================================================
const express = require('express');
const fs      = require('fs');
const cors    = require('cors');
const path    = require('path');
const config  = require('../../config');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cors());

// ============================================
// Helpers
// ============================================
const ensureDataDir = () => {
    const dir = path.dirname(config.DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const readDB = () => {
    ensureDataDir();
    if (!fs.existsSync(config.DB_PATH)) {
        fs.writeFileSync(config.DB_PATH, JSON.stringify({ openPositions: [] }, null, 2));
    }
    try { return JSON.parse(fs.readFileSync(config.DB_PATH, 'utf-8')); }
    catch { return {}; }
};

const writeDB = (data) => {
    ensureDataDir();
    fs.writeFileSync(config.DB_PATH, JSON.stringify(data, null, 2));
};

// ============================================
// Middleware: API Key Validator
// ============================================
const validateKey = (req, res, next) => {
    if (req.headers['x-api-key'] !== config.API_KEY) {
        return res.status(403).json({ ok: false, message: 'Forbidden: Invalid API Key' });
    }
    next();
};

// ============================================
// POST /api/mt5  → MT5 kirim data ke sini
// ============================================
app.post('/api/mt5', validateKey, (req, res) => {
    try {
        const body = req.body;
        if (!body || Object.keys(body).length === 0)
            return res.status(400).json({ ok: false, message: 'Body kosong!' });

        const db = readDB();
        const updated = { ...db, ...body, lastUpdated: new Date().toISOString() };
        writeDB(updated);
        console.log(`[ENDPOINT] ✅ Sync dari MT5 | ${new Date().toLocaleTimeString('id-ID')}`);
        res.json({ ok: true, message: 'Data saved' });
    } catch (err) {
        console.error('[ENDPOINT] Error:', err.message);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================
// GET /api/mt5  → Bot WA / App lain ambil data
// ============================================
app.get('/api/mt5', (req, res) => {
    try { res.json(readDB()); }
    catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ============================================
// GET /api/health  → Cek server hidup
// ============================================
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, server: 'MT5 Endpoint', time: new Date() });
});

// ============================================
// Start
// ============================================
const startEndpoint = () => {
    app.listen(config.ENDPOINT_PORT, () => {
        console.log(`\n🚀 ========================================`);
        console.log(`   MT5 Endpoint Server AKTIF`);
        console.log(`   Port  : ${config.ENDPOINT_PORT}`);
        console.log(`   POST  : http://localhost:${config.ENDPOINT_PORT}/api/mt5`);
        console.log(`   GET   : http://localhost:${config.ENDPOINT_PORT}/api/mt5`);
        console.log(`========================================\n`);
    });
};

module.exports = { startEndpoint };
