// ===================================================
//  src/endpoint/server.js
//  Express API Server - Data MT5 + Command Queue
// ===================================================
const express = require('express');
const fs      = require('fs');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');
const config  = require('../../config');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cors());

// ============================================
// Path database terpisah: data MT5 & commands
// ============================================
const CMD_DB_PATH = path.join(path.dirname(config.DB_PATH), 'commands.json');

// ============================================
// Helpers DB
// ============================================
const ensureDir = (p) => {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const readJSON = (filePath, defaultVal = {}) => {
    ensureDir(filePath);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
        return defaultVal;
    }
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch { return defaultVal; }
};

const writeJSON = (filePath, data) => {
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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
// ======= ENDPOINT DATA MT5 =================
// ============================================

// POST /api/mt5 → MT5 kirim data ke sini
app.post('/api/mt5', validateKey, (req, res) => {
    try {
        const body = req.body;
        if (!body || Object.keys(body).length === 0)
            return res.status(400).json({ ok: false, message: 'Body kosong!' });

        const db      = readJSON(config.DB_PATH, {});
        const updated = { ...db, ...body, lastUpdated: new Date().toISOString() };
        writeJSON(config.DB_PATH, updated);
        console.log(`[ENDPOINT] ✅ Sync MT5 | ${new Date().toLocaleTimeString('id-ID')}`);
        res.json({ ok: true, message: 'Data saved' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/mt5 → Bot WA / App lain ambil data
app.get('/api/mt5', (req, res) => {
    try { res.json(readJSON(config.DB_PATH, {})); }
    catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ============================================
// ======= ENDPOINT COMMAND QUEUE ============
// ============================================

// POST /api/commands → Bot WA / App kirim command ke EA MT5
// Body: { type, symbol, volume, sl, tp, ticket, price, deviation }
// type: BUY | SELL | CLOSE | CLOSEALL | MODIFY
app.post('/api/commands', validateKey, (req, res) => {
    try {
        const { type, symbol, volume, sl, tp, ticket, price, deviation } = req.body;

        if (!type) return res.status(400).json({ ok: false, message: 'Field "type" wajib diisi (BUY/SELL/CLOSE/CLOSEALL/MODIFY)' });

        const validTypes = ['BUY', 'SELL', 'CLOSE', 'CLOSEALL', 'MODIFY'];
        if (!validTypes.includes(type.toUpperCase()))
            return res.status(400).json({ ok: false, message: `Type tidak valid. Gunakan: ${validTypes.join(', ')}` });

        const cmds = readJSON(CMD_DB_PATH, []);
        const newCmd = {
            id:        crypto.randomUUID(),
            type:      type.toUpperCase(),
            symbol:    symbol  || '',
            volume:    parseFloat(volume)    || 0,
            sl:        parseFloat(sl)        || 0,
            tp:        parseFloat(tp)        || 0,
            ticket:    parseInt(ticket)      || 0,
            price:     parseFloat(price)     || 0,
            deviation: parseInt(deviation)   || 10,
            status:    'pending',
            result:    '',
            createdAt: new Date().toISOString(),
            executedAt: null,
        };

        cmds.push(newCmd);
        writeJSON(CMD_DB_PATH, cmds);

        console.log(`[CMD] 📥 Command masuk: ${newCmd.type} ${newCmd.symbol || ''} ${newCmd.volume || ''}`);
        res.status(201).json({ ok: true, message: 'Command dikirim ke antrian!', id: newCmd.id, command: newCmd });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/commands/pending → MT5 EA polling command pending
app.get('/api/commands/pending', validateKey, (req, res) => {
    try {
        const cmds = readJSON(CMD_DB_PATH, []);
        const pending = cmds.filter(c => c.status === 'pending');
        res.json({ ok: true, count: pending.length, commands: pending });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/commands → Lihat semua command (history)
app.get('/api/commands', (req, res) => {
    try {
        const cmds = readJSON(CMD_DB_PATH, []);
        // Tampilkan 50 command terbaru
        res.json({ ok: true, commands: cmds.slice(-50).reverse() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// PATCH /api/commands/:id → MT5 EA update status command (executed/failed)
app.patch('/api/commands/:id', validateKey, (req, res) => {
    try {
        const { id } = req.params;
        const { status, result } = req.body; // status: executed | failed

        const cmds = readJSON(CMD_DB_PATH, []);
        const idx  = cmds.findIndex(c => c.id === id);

        if (idx === -1) return res.status(404).json({ ok: false, message: 'Command tidak ditemukan.' });

        cmds[idx].status     = status || 'executed';
        cmds[idx].result     = result || '';
        cmds[idx].executedAt = new Date().toISOString();
        writeJSON(CMD_DB_PATH, cmds);

        console.log(`[CMD] ✅ Command ${id.substring(0, 8)} → ${cmds[idx].status}: ${cmds[idx].result}`);
        res.json({ ok: true, message: 'Status updated', command: cmds[idx] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================
// GET /api/health
// ============================================
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, server: 'MT5 Endpoint', time: new Date() });
});

// ============================================
// Start
// ============================================
const startEndpoint = () => {
    app.listen(config.ENDPOINT_PORT, () => {
        console.log(`\n🚀 ==========================================`);
        console.log(`   MT5 Endpoint Server AKTIF`);
        console.log(`   Port     : ${config.ENDPOINT_PORT}`);
        console.log(`   Data MT5 : POST/GET /api/mt5`);
        console.log(`   Commands : POST /api/commands`);
        console.log(`            : GET  /api/commands/pending`);
        console.log(`            : PATCH /api/commands/:id`);
        console.log(`==========================================\n`);
    });
};

module.exports = { startEndpoint };
