# MT5 WA Bot Suite v3.0

## Struktur Project
```
mt5-wabot/
├── package.json          ← Satu kali install semua dependency
├── config.js             ← ⚠️ Edit ini dulu sebelum menjalankan!
├── start-endpoint.js     ← Entry: Jalankan endpoint saja
├── start-bot.js          ← Entry: Jalankan WA bot saja
├── start-all.js          ← Entry: Jalankan keduanya sekaligus
├── data/
│   ├── db.json           ← Database JSON (auto-dibuat)
│   └── wa_session/       ← Sesi WA (auto-dibuat setelah scan QR)
├── src/
│   ├── endpoint/server.js
│   └── wa-bot/bot.js
└── mt5-script/
    └── MT5_WA_Monitor_V4.mq5
```

## Data yang Tersinkronisasi dari MT5

| Kategori | Data |
|---|---|
| **Account** | Login, Name, Server, Company, Leverage, Currency |
| **Balance** | Balance, Equity, Credit, Margin, Free Margin, Margin Level, Floating P/L |
| **Open Positions** | Ticket, Symbol, Type, Volume, Open Price, Current Price, **SL, TP**, Profit, Swap, **Time Open**, Magic, Comment |
| **History Profit** | Hari Ini, Minggu Ini, Bulan Ini |
| **Statistik** | Total Trade, Win/Loss, Win Rate, Best/Worst Trade, Avg Profit |
| **Performance** | Growth %, Max Drawdown |
| **Recent Deals** | N deal terakhir (konfigurasi via `InpHistoryDeals`) |

## Perintah WhatsApp

| Command | Fungsi |
|---|---|
| `/stats` | Info akun & balance lengkap |
| `/profit` | Profit Hari/Minggu/Bulan |
| `/open` | Posisi open + SL/TP/Swap/TimeOpen |
| `/performance` | Win Rate, Drawdown, Growth |
| `/history` | N deal terakhir |
| `/menu` | Tampilkan semua perintah |

## Cara Install (Linux VPS)

```bash
# 1. Masuk ke folder project
cd ~/mt5-wabot

# 2. Install semua package (sekali saja)
npm install

# 3. Edit konfigurasi
nano config.js
# Wajib ganti: API_KEY

# 4. Terminal 1 - Jalankan Endpoint
npm run start:endpoint

# 5. Terminal 2 - Jalankan WA Bot (scan QR)
npm run start:bot

# Atau jalankan keduanya dalam 1 terminal:
npm run start:all
```

## Setup MT5 EA

1. Copy `MT5_WA_Monitor_V4.mq5` → folder `MQL5/Experts`
2. Compile di MetaEditor (F7)
3. **MT5 → Tools → Options → Expert Advisors:**
   - ✅ `Allow WebRequest for listed URL`
   - Tambahkan URL: `http://localhost:3000`
4. Pasang EA ke chart manapun, isi parameter:
   - `InpEndpointUrl` = `http://localhost:3000/api/mt5`
   - `InpApiKey` = isi **sama persis** dengan `API_KEY` di `config.js`
   - `InpSyncInterval` = interval sync dalam detik (default: 5)
   - `InpHistoryDeals` = jumlah recent deal di history (default: 10)

## Stop & Start WA Bot Tanpa Henti Endpoint

```bash
# Stop WA Bot:
Ctrl + C  (di terminal start:bot)

# Start lagi:
npm run start:bot

# Endpoint & MT5 sync TIDAK terganggu
```
