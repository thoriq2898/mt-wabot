// ===================================================
//  src/wa-bot/bot.js
//  WhatsApp Bot (Baileys) - Monitor + Trade Commands
// ===================================================
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino     = require('pino');
const qrcode   = require('qrcode-terminal');
const axios    = require('axios');
const config   = require('../../config');

// ============================================
// Helpers Format
// ============================================
const usd  = (v) => `$${(parseFloat(v) || 0).toFixed(2)}`;
const pct  = (v) => `${(parseFloat(v) || 0).toFixed(2)}%`;
const fl2  = (v) => (parseFloat(v) || 0).toFixed(2);
const sign = (v) => (parseFloat(v) >= 0 ? '🟢 +' : '🔴 ') + usd(v);

// Handles both ISO strings AND UNIX timestamps (seconds) dari MT5
const dt = (val) => {
    if (!val) return '-';
    const ms = typeof val === 'number' && val < 1e12 ? val * 1000 : val;
    return new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
};

// ============================================
// Axios Helper - dengan API Key
// ============================================
const api = axios.create({
    baseURL: config.ENDPOINT_URL,
    timeout: 5000,
    headers: { 'x-api-key': config.API_KEY, 'Content-Type': 'application/json' },
});

// ============================================
// Fetch data MT5
// ============================================
const getData = async () => {
    try { return (await api.get('/api/mt5')).data; }
    catch { return null; }
};

const sendCommand = async (payload) => {
    return (await api.post('/api/commands', payload)).data;
};

const getCommandHistory = async () => {
    try { return (await api.get('/api/commands')).data; }
    catch { return null; }
};

// ============================================
// Cek data masih fresh (< 60 detik)
// ============================================
const checkFresh = (data) => {
    if (!data?.lastUpdated) return false;
    return (Date.now() - new Date(data.lastUpdated).getTime()) / 1000 < 60;
};

// ============================================
// HANDLER COMMAND WA
// ============================================
const handleCommand = async (cmd, args) => {
    // ========== /menu ==========
    if (cmd === '/menu' || cmd === '/help') {
        return [
            `🤖 *${config.BOT_NAME}*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📊 *MONITORING*`,
            `  /stats         - Info akun lengkap`,
            `  /profit        - Profit Hari/Minggu/Bulan`,
            `  /open          - Posisi open + SL/TP`,
            `  /performance   - Win Rate, Drawdown, Growth`,
            `  /history       - N deal terakhir`,
            `  /cmdlog        - Log command terakhir`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📤 *TRADE COMMANDS*`,
            `  /buy  [SYM] [LOT]       - Open Buy`,
            `  /sell [SYM] [LOT]       - Open Sell`,
            `  /buy  [SYM] [LOT] [SL] [TP] - Buy + SL/TP`,
            `  /sell [SYM] [LOT] [SL] [TP] - Sell + SL/TP`,
            `  /close    [TICKET]      - Close posisi`,
            `  /closeall               - Close semua posisi`,
            `  /modify [TICKET] [SL] [TP] - Ubah SL/TP`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `_Contoh: /buy EURUSD 0.1_`,
            `_Contoh: /buy EURUSD 0.1 1.1000 1.1200_`,
            `_Contoh: /modify 12345 1.1000 1.1200_`,
            `_Powered by ${config.BOT_NAME}_`,
        ].join('\n');
    }

    // ========== /stats ==========
    if (cmd === '/stats') {
        const data = await getData();
        if (!data?.lastUpdated) return `⚠️ *Endpoint offline atau MT5 belum sync.*`;
        const a = data.account || {};
        const fresh = checkFresh(data) ? '' : `\n\n⚠️ _Data lama (>60 detik). Cek EA MT5._`;
        return [
            `🏦 *ACCOUNT STATS*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🆔 Login     : ${a.login || '-'}`,
            `👤 Name      : ${a.name || '-'}`,
            `🏢 Company   : ${a.company || '-'}`,
            `🖥️ Server    : ${a.server || '-'}`,
            `💱 Currency  : ${a.currency || 'USD'}`,
            `📊 Leverage  : 1:${a.leverage || '-'}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `💰 Balance    : ${usd(a.balance)}`,
            `💵 Equity     : ${usd(a.equity)}`,
            `🎁 Credit     : ${usd(a.credit)}`,
            `📈 Margin     : ${usd(a.margin)}`,
            `🆓 Free Margin: ${usd(a.freeMargin)}`,
            `📊 Margin Lvl : ${pct(a.marginLevel)}`,
            `💹 Floating   : ${sign(a.profit)}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🕒 _Sync: ${dt(data.lastUpdated)}_` + fresh,
        ].join('\n');
    }

    // ========== /profit ==========
    if (cmd === '/profit') {
        const data = await getData();
        if (!data?.lastUpdated) return `⚠️ *Endpoint offline atau MT5 belum sync.*`;
        const p = data.history || {};
        return [
            `📊 *PROFIT REPORT*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📅 Hari Ini   : ${sign(p.profitToday)}`,
            `📅 Minggu Ini : ${sign(p.profitWeek)}`,
            `📅 Bulan Ini  : ${sign(p.profitMonth)}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🕒 _Sync: ${dt(data.lastUpdated)}_`,
        ].join('\n');
    }

    // ========== /performance ==========
    if (cmd === '/performance') {
        const data = await getData();
        if (!data?.lastUpdated) return `⚠️ *Endpoint offline atau MT5 belum sync.*`;
        const p = data.performance || {};
        const h = data.history    || {};
        return [
            `📈 *PERFORMANCE SUMMARY*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📌 Total Trade  : ${h.totalTrades || 0} deals`,
            `✅ Win          : ${h.totalWins || 0} (${pct(h.winRate)})`,
            `❌ Loss         : ${h.totalLoss || 0}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🏆 Best Trade   : ${usd(h.bestTrade)}`,
            `💔 Worst Trade  : ${usd(h.worstTrade)}`,
            `💹 Avg Profit   : ${usd(h.avgProfit)}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📉 Max Drawdown : ${usd(p.maxDrawdown)} (${pct(p.maxDrawdownPct)})`,
            `📊 Growth       : ${sign(p.growth)}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🕒 _Sync: ${dt(data.lastUpdated)}_`,
        ].join('\n');
    }

    // ========== /open ==========
    if (cmd === '/open') {
        const data = await getData();
        if (!data?.lastUpdated) return `⚠️ *Endpoint offline atau MT5 belum sync.*`;
        const positions = data.openPositions || [];
        if (positions.length === 0)
            return `📂 *OPEN POSITIONS*\n━━━━━━━━━━━━━━━━━━━━━━\n_Tidak ada posisi open saat ini._\n\n🕒 _Sync: ${dt(data.lastUpdated)}_`;

        let msg = `📂 *OPEN POSITIONS (${positions.length})*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        positions.forEach((pos, i) => {
            const dir = pos.type === 'BUY' ? '🔵' : '🔴';
            msg += `*${i + 1}. ${dir} ${pos.symbol} (${pos.type})*\n`;
            msg += `   🎫 Ticket  : #${pos.ticket}\n`;
            msg += `   📦 Volume  : ${fl2(pos.volume)} lots\n`;
            msg += `   🕒 Open    : ${dt(pos.timeOpen)}\n`;
            msg += `   💵 Open Px : ${pos.openPrice}\n`;
            msg += `   📍 Cur Px  : ${pos.currentPrice}\n`;
            msg += `   🛡️ SL      : ${pos.sl > 0 ? pos.sl : 'Tidak ada'}\n`;
            msg += `   🎯 TP      : ${pos.tp > 0 ? pos.tp : 'Tidak ada'}\n`;
            msg += `   💹 P/L     : ${sign(pos.profit)}\n`;
            msg += `   🔄 Swap    : ${usd(pos.swap)}\n`;
            if (pos.comment) msg += `   💬 Comment : ${pos.comment}\n`;
            msg += '\n';
        });
        msg += `🕒 _Sync: ${dt(data.lastUpdated)}_`;
        return msg;
    }

    // ========== /history ==========
    if (cmd === '/history') {
        const data = await getData();
        if (!data?.lastUpdated) return `⚠️ *Endpoint offline atau MT5 belum sync.*`;
        const deals = data.recentDeals || [];
        if (deals.length === 0)
            return `📜 *HISTORY*\n━━━━━━━━━━━━━━━━━━━━━━\n_Belum ada history deal._\n\n🕒 _Sync: ${dt(data.lastUpdated)}_`;

        let msg = `📜 *RECENT DEALS (${deals.length})*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        deals.forEach((d, i) => {
            const dir = d.type === 'BUY' ? '🔵' : '🔴';
            msg += `*${i + 1}. ${dir} ${d.symbol}*\n`;
            msg += `   🎫 Ticket : #${d.ticket}\n`;
            msg += `   ⏱️ Close  : ${dt(d.time)}\n`;
            msg += `   💵 Price  : ${d.price}\n`;
            msg += `   📦 Vol    : ${fl2(d.volume)}\n`;
            msg += `   💹 Profit : ${sign(d.profit)}\n\n`;
        });
        msg += `🕒 _Sync: ${dt(data.lastUpdated)}_`;
        return msg;
    }

    // ========== /cmdlog ==========
    if (cmd === '/cmdlog') {
        const result = await getCommandHistory();
        if (!result?.commands?.length) return `📋 *COMMAND LOG*\n━━━━━━━━━━━━━━━━━━━━━━\n_Belum ada command._`;

        const statusEmoji = { pending: '⏳', executed: '✅', failed: '❌' };
        let msg = `📋 *COMMAND LOG (Terbaru)*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        result.commands.slice(0, 10).forEach((c, i) => {
            const em = statusEmoji[c.status] || '❓';
            msg += `*${i + 1}. ${em} ${c.type}* ${c.symbol ? c.symbol : ''} ${c.volume ? c.volume + 'L' : ''}\n`;
            msg += `   Status : ${c.status}\n`;
            if (c.result) msg += `   Hasil  : ${c.result}\n`;
            msg += `   Waktu  : ${dt(c.createdAt)}\n\n`;
        });
        return msg;
    }

    // ========== TRADE COMMANDS ==========

    // /buy [SYMBOL] [VOLUME] [SL?] [TP?]
    if (cmd === '/buy' || cmd === '/sell') {
        const type   = cmd.replace('/', '').toUpperCase();
        const symbol = args[0]?.toUpperCase();
        const volume = parseFloat(args[1]);
        const sl     = parseFloat(args[2]) || 0;
        const tp     = parseFloat(args[3]) || 0;

        if (!symbol || isNaN(volume) || volume <= 0)
            return `❌ Format salah!\nGunakan: ${cmd} [SYMBOL] [VOLUME]\nContoh: ${cmd} EURUSD 0.1\nDengan SL/TP: ${cmd} EURUSD 0.1 1.1000 1.1200`;

        try {
            const result = await sendCommand({ type, symbol, volume, sl, tp });
            return [
                `📤 *Command ${type} Dikirim!*`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `🆔 ID      : ${result.id?.substring(0, 8)}...`,
                `📌 Symbol  : ${symbol}`,
                `📦 Volume  : ${fl2(volume)} lots`,
                `🛡️ SL      : ${sl > 0 ? sl : 'Tidak ada'}`,
                `🎯 TP      : ${tp > 0 ? tp : 'Tidak ada'}`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `⏳ _Menunggu eksekusi oleh MT5..._`,
                `_Gunakan /cmdlog untuk cek status_`,
            ].join('\n');
        } catch (err) {
            return `❌ Gagal kirim command: ${err.response?.data?.message || err.message}`;
        }
    }

    // /close [TICKET]
    if (cmd === '/close') {
        const ticket = parseInt(args[0]);
        if (!ticket || isNaN(ticket))
            return `❌ Format salah!\nGunakan: /close [TICKET]\nContoh: /close 12345\n\nGunakan /open untuk lihat daftar ticket.`;

        try {
            const result = await sendCommand({ type: 'CLOSE', ticket });
            return [
                `📤 *Command CLOSE Dikirim!*`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `🆔 ID     : ${result.id?.substring(0, 8)}...`,
                `🎫 Ticket : #${ticket}`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `⏳ _Menunggu eksekusi oleh MT5..._`,
                `_Gunakan /cmdlog untuk cek status_`,
            ].join('\n');
        } catch (err) {
            return `❌ Gagal kirim command: ${err.response?.data?.message || err.message}`;
        }
    }

    // /closeall
    if (cmd === '/closeall') {
        try {
            const result = await sendCommand({ type: 'CLOSEALL' });
            return [
                `📤 *Command CLOSEALL Dikirim!*`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `🆔 ID : ${result.id?.substring(0, 8)}...`,
                `⚠️ Semua posisi akan ditutup!`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `⏳ _Menunggu eksekusi oleh MT5..._`,
                `_Gunakan /cmdlog untuk cek status_`,
            ].join('\n');
        } catch (err) {
            return `❌ Gagal kirim command: ${err.response?.data?.message || err.message}`;
        }
    }

    // /modify [TICKET] [SL] [TP]
    if (cmd === '/modify') {
        const ticket = parseInt(args[0]);
        const sl     = parseFloat(args[1]);
        const tp     = parseFloat(args[2]);

        if (!ticket || isNaN(ticket) || isNaN(sl) || isNaN(tp))
            return `❌ Format salah!\nGunakan: /modify [TICKET] [SL] [TP]\nContoh: /modify 12345 1.1000 1.1200\n_Gunakan 0 jika tidak mau ubah SL atau TP_`;

        try {
            const result = await sendCommand({ type: 'MODIFY', ticket, sl, tp });
            return [
                `📤 *Command MODIFY Dikirim!*`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `🆔 ID     : ${result.id?.substring(0, 8)}...`,
                `🎫 Ticket : #${ticket}`,
                `🛡️ SL Baru : ${sl > 0 ? sl : 'Hapus SL'}`,
                `🎯 TP Baru : ${tp > 0 ? tp : 'Hapus TP'}`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `⏳ _Menunggu eksekusi oleh MT5..._`,
                `_Gunakan /cmdlog untuk cek status_`,
            ].join('\n');
        } catch (err) {
            return `❌ Gagal kirim command: ${err.response?.data?.message || err.message}`;
        }
    }

    return `❓ Perintah tidak dikenal.\nKetik */menu* untuk melihat semua perintah.`;
};

// ============================================
// Cek whitelist nomor
// ============================================
const isAllowed = (jid) => {
    if (!config.ALLOWED_NUMBERS || config.ALLOWED_NUMBERS.length === 0) return true;
    return config.ALLOWED_NUMBERS.includes(jid.split('@')[0]);
};

// ============================================
// Main Baileys Connection
// ============================================
const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(config.WA_SESSION_PATH);
    const { version }          = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('\n📱 SCAN QR KODE INI DI WHATSAPP KAMU:\n');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('[BOT] Reconnecting...');
                setTimeout(startBot, 5000);
            } else {
                console.log('[BOT] Logged out. Hapus folder data/wa_session untuk login ulang.');
            }
        } else if (connection === 'open') {
            console.log('\n✅ ========================================');
            console.log(`   ${config.BOT_NAME} SIAP!`);
            console.log(`   Kirim /menu ke nomor WhatsApp ini.`);
            console.log('========================================\n');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message || msg.key.fromMe) return;

        const jid      = msg.key.remoteJid;
        const fullText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
        const parts    = fullText.split(/\s+/);
        const cmd      = parts[0].toLowerCase();
        const args     = parts.slice(1);

        if (!cmd.startsWith('/')) return;

        if (!isAllowed(jid)) {
            await sock.sendMessage(jid, { text: '⛔ Akses ditolak.' }, { quoted: msg });
            return;
        }

        console.log(`[BOT] Command: ${cmd} ${args.join(' ')} | dari: ${jid}`);
        const reply = await handleCommand(cmd, args);
        await sock.sendMessage(jid, { text: reply }, { quoted: msg });
    });
};

module.exports = { startBot };
