// src/lib/format.js — Helper format angka & tanggal
const usd  = (v) => `$${(parseFloat(v) || 0).toFixed(2)}`;
const pct  = (v) => `${(parseFloat(v) || 0).toFixed(2)}%`;
const fl2  = (v) => (parseFloat(v) || 0).toFixed(2);
const sign = (v) => (parseFloat(v) >= 0 ? '🟢 +' : '🔴 ') + usd(v);

// Handles ISO string dan UNIX timestamp (seconds) dari MT5
const fmtDate = (val) => {
    if (!val) return '-';
    const ms = typeof val === 'number' && val < 1e12 ? val * 1000 : val;
    return new Date(ms).toLocaleString('id-ID', { timeZone: global.timezone || 'Asia/Jakarta' });
};

module.exports = { usd, pct, fl2, sign, fmtDate };
