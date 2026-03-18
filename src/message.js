// src/message.js — Message Dispatcher (Gaya Hitori)
// File ini bertugas mem-parsing pesan dan mendelegasikan ke command yang tepat.
require('../settings');

const monitor = require('./commands/monitor');
const trade   = require('./commands/trade');

// ==============================
// MENU
// ==============================
const menuText = () => [
    `🤖 *${global.botname}*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *MONITORING*`,
    `  /stats         - Info akun lengkap`,
    `  /profit        - Profit Hari/Minggu/Bulan`,
    `  /open          - Posisi open + SL/TP`,
    `  /performance   - Win Rate, Drawdown, Growth`,
    `  /history       - N deal terakhir`,
    `  /cmdlog        - Log status command`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📤 *TRADE COMMANDS*`,
    `  /buy  [SYM] [LOT]             - Open Buy`,
    `  /buy  [SYM] [LOT] [SL] [TP]  - Buy + SL/TP`,
    `  /sell [SYM] [LOT]             - Open Sell`,
    `  /sell [SYM] [LOT] [SL] [TP]  - Sell + SL/TP`,
    `  /close    [TICKET]            - Close posisi`,
    `  /closeall                     - Close semua`,
    `  /modify [TICKET] [SL] [TP]   - Ubah SL/TP`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `_Contoh: /buy EURUSD 0.1_`,
    `_Powered by ${global.botname}_`,
].join('\n');

// ==============================
// Route: Command → Handler
// ==============================
const route = async (cmd, args) => {
    switch (cmd) {
        // ==== MONITORING ====
        case '/menu':
        case '/help':
            return menuText();

        case '/stats':      return await monitor.stats();
        case '/profit':     return await monitor.profit();
        case '/open':       return await monitor.open();
        case '/performance':return await monitor.performance();
        case '/history':    return await monitor.history();

        // ==== TRADE ====
        case '/buy':        return await trade.openOrder('BUY', args);
        case '/sell':       return await trade.openOrder('SELL', args);
        case '/close':      return await trade.close(args);
        case '/closeall':   return await trade.closeAll();
        case '/modify':     return await trade.modify(args);
        case '/cmdlog':     return await trade.cmdlog();

        default:
            return `❓ Perintah tidak dikenal.\nKetik */menu* untuk daftar semua perintah.`;
    }
};

// ==============================
// MessagesUpsert Handler (dipanggil dari index.js)
// ==============================
const MessagesUpsert = async (sock, { messages, type }) => {
    // Hanya proses pesan BARU (bukan history sync)
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg?.message) return;
    if (msg.key.fromMe) return;
    if (msg.messageStubType) return; // Abaikan pesan sistem grup

    const jid = msg.key.remoteJid;

    // Ekstrak teks dari berbagai jenis pesan WA
    const fullText = (
        msg.message?.conversation              ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption     ||
        msg.message?.videoMessage?.caption     ||
        ''
    ).trim();

    // Cek prefix
    const isCommand = global.prefix.some(p => fullText.startsWith(p));
    if (!isCommand) return;

    const parts = fullText.split(/\s+/);
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    // Whitelist check
    const allowed = !global.allowedNumbers?.length ||
                    global.allowedNumbers.includes(jid.split('@')[0]);

    if (!allowed) {
        await sock.sendMessage(jid, { text: global.mess.denied }, { quoted: msg });
        return;
    }

    console.log(`[MSG] ${cmd} ${args.join(' ')} | ${jid}`);

    try {
        const reply = await route(cmd, args);
        if (reply) await sock.sendMessage(jid, { text: reply }, { quoted: msg });
    } catch (err) {
        console.error('[MSG ERROR]', err.message);
        await sock.sendMessage(jid, { text: global.mess.error }, { quoted: msg });
    }
};

module.exports = { MessagesUpsert };
