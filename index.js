// index.js — Core Connector (Gaya Hitori)
// File ini HANYA menangani: koneksi Baileys, event handling, QR/Pairing.
// Logic command ada di src/message.js dan src/commands/
require('./settings');

const pino    = require('pino');
const qrcode  = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { MessagesUpsert } = require('./src/message');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(global.sessionPath);
    const { version }          = await fetchLatestBaileysVersion();
    const logger               = pino({ level: 'silent' });

    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys : makeCacheableSignalKeyStore(state.keys, logger),
        },
        syncFullHistory       : false,
        maxMsgRetryCount      : 5,
        connectTimeoutMs      : 60000,
        keepAliveIntervalMs   : 30000,
        generateHighQualityLinkPreview: false,
        printQRInTerminal     : false,
    });

    // ==============================
    // Simpan sesi
    // ==============================
    sock.ev.on('creds.update', saveCreds);

    // ==============================
    // Koneksi WA
    // ==============================
    sock.ev.on('connection.update', ({ qr, connection, lastDisconnect }) => {
        if (qr) {
            console.log('\n📱 SCAN QR CODE INI DI WHATSAPP KAMU:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            console.log(`[CONN] Terputus. Code: ${code} | Reconnect: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(startBot, 5000);
            } else {
                console.log('[CONN] Logout. Hapus folder data/wa_session lalu restart.');
            }
        }

        if (connection === 'open') {
            console.log('\n┌─────────────────────────────────┐');
            console.log(`│  ✅ ${global.botname} TERHUBUNG!`);
            console.log('│  Kirim /menu ke WhatsApp ini.');
            console.log('└─────────────────────────────────┘\n');
        }
    });

    // ==============================
    // Pesan masuk → Dispatcher
    // ==============================
    sock.ev.on('messages.upsert', (upsert) => MessagesUpsert(sock, upsert));
}

startBot();
