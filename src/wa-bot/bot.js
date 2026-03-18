// ===================================================
//  src/wa-bot/bot.js
//  WhatsApp Bot (Baileys) - No Puppeteer/Chromium
// ===================================================
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino     = require('pino');
const qrcode   = require('qrcode-terminal');
const axios    = require('axios');
const config   = require('../../config');

// ============================================
// Helpers Format
// ============================================
const usd    = (v) => `$${(parseFloat(v) || 0).toFixed(2)}`;
const pct    = (v) => `${(parseFloat(v) || 0).toFixed(2)}%`;
const fl2    = (v) => (parseFloat(v) || 0).toFixed(2);
const dt     = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';
const sign   = (v) => (parseFloat(v) >= 0 ? '🟢 +' : '🔴 ') + usd(v);

// ============================================
// Fetch data dari endpoint
// ============================================
const getData = async () => {
    try {
        const res = await axios.get(`${config.ENDPOINT_URL}/api/mt5`, { timeout: 5000 });
        return res.data;
    } catch {
        return null;
    }
};

// ============================================
// Cek apakah data MT5 valid & fresh
// ============================================
const checkData = (data) => {
    if (!data || !data.lastUpdated) return false;
    // Anggap data stale jika lebih dari 60 detik
    const age = (Date.now() - new Date(data.lastUpdated).getTime()) / 1000;
    return age < 60;
};

// ============================================
// HANDLER PERINTAH
// ============================================
const handleCommand = async (cmd) => {
    const data = await getData();

    if (!data || !data.lastUpdated) {
        return `⚠️ *Endpoint offline atau MT5 belum sync.*\nPastikan server endpoint dan EA MT5 berjalan.`;
    }

    const freshWarning = checkData(data) ? '' : `\n\n⚠️ _Data mungkin sudah lama (>60 detik). Cek EA MT5._`;
    const lastSync = `🕒 _Last Sync: ${dt(data.lastUpdated)}_`;

    // ========== /menu ==========
    if (cmd === '/menu' || cmd === '/help') {
        return [
            `🤖 *${config.BOT_NAME}*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📊 /stats          - Info akun lengkap`,
            `💰 /profit         - Laporan profit (Hari/Minggu/Bulan)`,
            `📂 /open           - Daftar posisi open`,
            `📈 /performance    - Statistik performa akun`,
            `📜 /history        - Riwayat deal terakhir`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `_Powered by ${config.BOT_NAME}_`,
        ].join('\n');
    }

    // ========== /stats ==========
    if (cmd === '/stats') {
        const a = data.account || {};
        return [
            `🏦 *ACCOUNT STATS*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🆔 Login    : ${a.login || '-'}`,
            `👤 Name     : ${a.name || '-'}`,
            `🏢 Company  : ${a.company || '-'}`,
            `🖥️ Server   : ${a.server || '-'}`,
            `💱 Currency : ${a.currency || 'USD'}`,
            `📊 Leverage : 1:${a.leverage || '-'}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `💰 Balance   : ${usd(a.balance)}`,
            `💵 Equity    : ${usd(a.equity)}`,
            `🎁 Credit    : ${usd(a.credit)}`,
            `📈 Margin    : ${usd(a.margin)}`,
            `🆓 Free Margin: ${usd(a.freeMargin)}`,
            `📊 Margin Lvl: ${pct(a.marginLevel)}`,
            `💹 Floating P/L: ${sign(a.profit)}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            lastSync + freshWarning,
        ].join('\n');
    }

    // ========== /profit ==========
    if (cmd === '/profit') {
        const p = data.history || {};
        return [
            `📊 *PROFIT REPORT*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📅 Hari Ini   : ${sign(p.profitToday)}`,
            `📅 Minggu Ini : ${sign(p.profitWeek)}`,
            `📅 Bulan Ini  : ${sign(p.profitMonth)}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            lastSync + freshWarning,
        ].join('\n');
    }

    // ========== /performance ==========
    if (cmd === '/performance') {
        const p  = data.performance || {};
        const h  = data.history || {};
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
            lastSync + freshWarning,
        ].join('\n');
    }

    // ========== /open ==========
    if (cmd === '/open') {
        const positions = data.openPositions || [];
        if (positions.length === 0) {
            return `📂 *OPEN POSITIONS*\n━━━━━━━━━━━━━━━━━━━━━━\n_Tidak ada posisi open saat ini._\n\n${lastSync}`;
        }
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
        msg += lastSync + freshWarning;
        return msg;
    }

    // ========== /history ==========
    if (cmd === '/history') {
        const deals = data.recentDeals || [];
        if (deals.length === 0) {
            return `📜 *HISTORY*\n━━━━━━━━━━━━━━━━━━━━━━\n_Belum ada history deal._\n\n${lastSync}`;
        }
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
        msg += lastSync + freshWarning;
        return msg;
    }

    return `❓ Perintah tidak dikenal.\nKetik */menu* untuk melihat daftar perintah.`;
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

        const jid  = msg.key.remoteJid;
        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase();

        if (!text.startsWith('/')) return;

        if (!isAllowed(jid)) {
            await sock.sendMessage(jid, { text: '⛔ Akses ditolak.' }, { quoted: msg });
            return;
        }

        console.log(`[BOT] Command: ${text} | dari: ${jid}`);
        const reply = await handleCommand(text);
        await sock.sendMessage(jid, { text: reply }, { quoted: msg });
    });
};

module.exports = { startBot };
