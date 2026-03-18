// src/commands/monitor.js — Perintah monitoring MT5
const { getData, isFresh } = require('../lib/api');
const { usd, pct, sign, fl2, fmtDate } = require('../lib/format');

const lastSync = (data) => `🕒 _Sync: ${fmtDate(data.lastUpdated)}_` + (isFresh(data) ? '' : `\n⚠️ _Data lama (>60 detik)!_`);

module.exports = {
    // /stats
    stats: async () => {
        const data = await getData();
        if (!data?.lastUpdated) return global.mess.offline;
        const a = data.account || {};
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
            lastSync(data),
        ].join('\n');
    },

    // /profit
    profit: async () => {
        const data = await getData();
        if (!data?.lastUpdated) return global.mess.offline;
        const p = data.history || {};
        return [
            `📊 *PROFIT REPORT*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📅 Hari Ini   : ${sign(p.profitToday)}`,
            `📅 Minggu Ini : ${sign(p.profitWeek)}`,
            `📅 Bulan Ini  : ${sign(p.profitMonth)}`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            lastSync(data),
        ].join('\n');
    },

    // /open
    open: async () => {
        const data = await getData();
        if (!data?.lastUpdated) return global.mess.offline;
        const positions = data.openPositions || [];
        if (!positions.length)
            return `📂 *OPEN POSITIONS*\n━━━━━━━━━━━━━━━━━━━━━━\n_Tidak ada posisi open._\n\n${lastSync(data)}`;
        let msg = `📂 *OPEN POSITIONS (${positions.length})*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        positions.forEach((pos, i) => {
            const dir = pos.type === 'BUY' ? '🔵' : '🔴';
            msg += `*${i + 1}. ${dir} ${pos.symbol} (${pos.type})*\n`;
            msg += `   🎫 Ticket  : #${pos.ticket}\n`;
            msg += `   📦 Volume  : ${fl2(pos.volume)} lots\n`;
            msg += `   🕒 Open    : ${fmtDate(pos.timeOpen)}\n`;
            msg += `   💵 Open Px : ${pos.openPrice}\n`;
            msg += `   📍 Cur Px  : ${pos.currentPrice}\n`;
            msg += `   🛡️ SL      : ${pos.sl > 0 ? pos.sl : 'Tidak ada'}\n`;
            msg += `   🎯 TP      : ${pos.tp > 0 ? pos.tp : 'Tidak ada'}\n`;
            msg += `   💹 P/L     : ${sign(pos.profit)}\n`;
            msg += `   🔄 Swap    : ${usd(pos.swap)}\n`;
            if (pos.comment) msg += `   💬 Comment : ${pos.comment}\n`;
            msg += '\n';
        });
        msg += lastSync(data);
        return msg;
    },

    // /performance
    performance: async () => {
        const data = await getData();
        if (!data?.lastUpdated) return global.mess.offline;
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
            lastSync(data),
        ].join('\n');
    },

    // /history
    history: async () => {
        const data = await getData();
        if (!data?.lastUpdated) return global.mess.offline;
        const deals = data.recentDeals || [];
        if (!deals.length)
            return `📜 *HISTORY*\n━━━━━━━━━━━━━━━━━━━━━━\n_Belum ada history deal._\n\n${lastSync(data)}`;
        let msg = `📜 *RECENT DEALS (${deals.length})*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        deals.forEach((d, i) => {
            const dir = d.type === 'BUY' ? '🔵' : '🔴';
            msg += `*${i + 1}. ${dir} ${d.symbol}*\n`;
            msg += `   🎫 Ticket : #${d.ticket}\n`;
            msg += `   ⏱️ Close  : ${fmtDate(d.time)}\n`;
            msg += `   💵 Price  : ${d.price}\n`;
            msg += `   📦 Vol    : ${fl2(d.volume)}\n`;
            msg += `   💹 Profit : ${sign(d.profit)}\n\n`;
        });
        msg += lastSync(data);
        return msg;
    },
};
