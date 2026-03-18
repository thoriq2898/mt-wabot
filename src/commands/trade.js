// src/commands/trade.js — Perintah kirim order ke MT5
const { sendCommand, getCmdLog } = require('../lib/api');
const { fl2, usd, sign, fmtDate } = require('../lib/format');

const statusEmoji = { pending: '⏳', executed: '✅', failed: '❌' };

module.exports = {
    // /buy [SYM] [LOT] [SL?] [TP?]
    // /sell [SYM] [LOT] [SL?] [TP?]
    openOrder: async (type, args) => {
        const symbol = args[0]?.toUpperCase();
        const volume = parseFloat(args[1]);
        const sl     = parseFloat(args[2]) || 0;
        const tp     = parseFloat(args[3]) || 0;
        if (!symbol || isNaN(volume) || volume <= 0)
            return `❌ Format salah!\nGunakan: /${type.toLowerCase()} [SYMBOL] [VOLUME] [SL?] [TP?]\nContoh: /${type.toLowerCase()} EURUSD 0.1\nDengan SL/TP: /${type.toLowerCase()} EURUSD 0.1 1.1000 1.1200`;
        try {
            const result = await sendCommand({ type, symbol, volume, sl, tp });
            return [
                `📤 *Command ${type} Terkirim!*`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `🆔 ID      : ${result.id?.substring(0, 8)}...`,
                `📌 Symbol  : ${symbol}`,
                `📦 Volume  : ${fl2(volume)} lots`,
                `🛡️ SL      : ${sl > 0 ? sl : 'Tidak ada'}`,
                `🎯 TP      : ${tp > 0 ? tp : 'Tidak ada'}`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `⏳ _Menunggu eksekusi MT5..._`,
                `_Ketik /cmdlog untuk cek status_`,
            ].join('\n');
        } catch (err) {
            return `❌ Gagal: ${err.response?.data?.message || err.message}`;
        }
    },

    // /close [TICKET]
    close: async (args) => {
        const ticket = parseInt(args[0]);
        if (!ticket || isNaN(ticket))
            return `❌ Format salah!\nGunakan: /close [TICKET]\nContoh: /close 12345\n\nGunakan /open untuk lihat daftar ticket.`;
        try {
            const result = await sendCommand({ type: 'CLOSE', ticket });
            return [
                `📤 *Command CLOSE Terkirim!*`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `🆔 ID     : ${result.id?.substring(0, 8)}...`,
                `🎫 Ticket : #${ticket}`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `⏳ _Menunggu eksekusi MT5..._`,
            ].join('\n');
        } catch (err) {
            return `❌ Gagal: ${err.response?.data?.message || err.message}`;
        }
    },

    // /closeall
    closeAll: async () => {
        try {
            const result = await sendCommand({ type: 'CLOSEALL' });
            return [
                `📤 *Command CLOSEALL Terkirim!*`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `🆔 ID : ${result.id?.substring(0, 8)}...`,
                `⚠️ Semua posisi akan ditutup!`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `⏳ _Menunggu eksekusi MT5..._`,
            ].join('\n');
        } catch (err) {
            return `❌ Gagal: ${err.response?.data?.message || err.message}`;
        }
    },

    // /modify [TICKET] [SL] [TP]
    modify: async (args) => {
        const ticket = parseInt(args[0]);
        const sl     = parseFloat(args[1]);
        const tp     = parseFloat(args[2]);
        if (!ticket || isNaN(sl) || isNaN(tp))
            return `❌ Format salah!\nGunakan: /modify [TICKET] [SL] [TP]\nContoh: /modify 12345 1.1000 1.1200\n_Gunakan 0 untuk hapus SL/TP_`;
        try {
            const result = await sendCommand({ type: 'MODIFY', ticket, sl, tp });
            return [
                `📤 *Command MODIFY Terkirim!*`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `🆔 ID      : ${result.id?.substring(0, 8)}...`,
                `🎫 Ticket  : #${ticket}`,
                `🛡️ SL Baru : ${sl > 0 ? sl : 'Hapus SL'}`,
                `🎯 TP Baru : ${tp > 0 ? tp : 'Hapus TP'}`,
                `━━━━━━━━━━━━━━━━━━━━━━`,
                `⏳ _Menunggu eksekusi MT5..._`,
            ].join('\n');
        } catch (err) {
            return `❌ Gagal: ${err.response?.data?.message || err.message}`;
        }
    },

    // /cmdlog
    cmdlog: async () => {
        try {
            const result = await getCmdLog();
            const cmds   = result?.commands || [];
            if (!cmds.length)
                return `📋 *COMMAND LOG*\n━━━━━━━━━━━━━━━━━━━━━━\n_Belum ada command._`;
            let msg = `📋 *COMMAND LOG (10 Terbaru)*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            cmds.slice(0, 10).forEach((c, i) => {
                const em = statusEmoji[c.status] || '❓';
                msg += `*${i + 1}. ${em} ${c.type}* ${c.symbol || ''} ${c.volume ? c.volume + 'L' : ''}\n`;
                msg += `   Status : ${c.status}\n`;
                if (c.result) msg += `   Hasil  : ${c.result}\n`;
                msg += `   Waktu  : ${fmtDate(c.createdAt)}\n\n`;
            });
            return msg;
        } catch (err) {
            return `❌ Gagal ambil log: ${err.message}`;
        }
    },
};
