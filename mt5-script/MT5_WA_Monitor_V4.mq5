//+------------------------------------------------------------------+
//|                                     MT5_WA_Monitor_V4.mq5       |
//|                     Full FXBook-Style Data Sync to Endpoint      |
//|                           Copyright 2026, Gemini AI             |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Gemini AI"
#property version   "4.00"
#property strict

// ===================================================
// INPUT - Sesuaikan dengan config.js di Node.js
// ===================================================
input string   InpEndpointUrl  = "http://localhost:3000/api/mt5"; // URL Endpoint
input string   InpApiKey       = "MT5_RAHASIA_GANTI_INI_123";     // API Key (sama dg config.js)
input int      InpSyncInterval = 5;                               // Interval sync (detik)
input int      InpHistoryDeals = 10;                              // Jumlah deal history terakhir

int timer_count = 0;

//+------------------------------------------------------------------+
//| OnInit                                                           |
//+------------------------------------------------------------------+
int OnInit() {
   EventSetTimer(1);
   Print("✅ MT5 WA Monitor V4 Aktif | Endpoint: ", InpEndpointUrl);
   DoSync(); // Sync langsung saat EA dipasang
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason) { EventKillTimer(); }

//+------------------------------------------------------------------+
//| OnTimer - Sync periodik                                          |
//+------------------------------------------------------------------+
void OnTimer() {
   timer_count++;
   if(timer_count >= InpSyncInterval) {
      DoSync();
      timer_count = 0;
   }
}

//+------------------------------------------------------------------+
//| Helper: Escape karakter khusus JSON agar tidak error             |
//+------------------------------------------------------------------+
string EscapeJson(string s) {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
}

//+------------------------------------------------------------------+
//| Bagian 1: JSON Account Info Lengkap                              |
//+------------------------------------------------------------------+
string BuildAccountJson() {
   string j = "\"account\":{";
   j += "\"login\":"    + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))                + ",";
   j += "\"name\":\""   + EscapeJson(AccountInfoString(ACCOUNT_NAME))                      + "\",";
   j += "\"server\":\"" + EscapeJson(AccountInfoString(ACCOUNT_SERVER))                    + "\",";
   j += "\"company\":\"" + EscapeJson(AccountInfoString(ACCOUNT_COMPANY))                  + "\",";
   j += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY)                            + "\",";
   j += "\"leverage\":"  + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE))           + ",";
   j += "\"balance\":"   + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2)           + ",";
   j += "\"equity\":"    + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2)            + ",";
   j += "\"credit\":"    + DoubleToString(AccountInfoDouble(ACCOUNT_CREDIT), 2)            + ",";
   j += "\"margin\":"    + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2)            + ",";
   j += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_FREEMARGIN), 2)       + ",";
   j += "\"marginLevel\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2)   + ",";
   j += "\"profit\":"    + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2);
   j += "}";
   return j;
}

//+------------------------------------------------------------------+
//| Bagian 2: JSON Open Positions (Lengkap seperti FXBook)           |
//+------------------------------------------------------------------+
string BuildPositionsJson() {
   string j = "\"openPositions\":[";
   int total = PositionsTotal();
   for(int i = 0; i < total; i++) {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      
      string sym   = PositionGetString(POSITION_SYMBOL);
      int    dig   = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      string type  = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL");
      
      if(i > 0) j += ",";
      j += "{";
      j += "\"ticket\":"       + IntegerToString(ticket)                                        + ",";
      j += "\"symbol\":\""     + sym                                                            + "\",";
      j += "\"type\":\""       + type                                                           + "\",";
      j += "\"volume\":"       + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2)          + ",";
      j += "\"openPrice\":"    + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), dig)    + ",";
      j += "\"currentPrice\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), dig) + ",";
      j += "\"sl\":"           + DoubleToString(PositionGetDouble(POSITION_SL), dig)            + ",";
      j += "\"tp\":"           + DoubleToString(PositionGetDouble(POSITION_TP), dig)            + ",";
      j += "\"profit\":"       + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2)          + ",";
      j += "\"swap\":"         + DoubleToString(PositionGetDouble(POSITION_SWAP), 2)            + ",";
      j += "\"magic\":"        + IntegerToString(PositionGetInteger(POSITION_MAGIC))            + ",";
      j += "\"timeOpen\":"     + IntegerToString(PositionGetInteger(POSITION_TIME))             + ",";
      j += "\"comment\":\""    + EscapeJson(PositionGetString(POSITION_COMMENT))               + "\"";
      j += "}";
   }
   j += "]";
   return j;
}

//+------------------------------------------------------------------+
//| Bagian 3: JSON History Deals + Statistik Performa                |
//+------------------------------------------------------------------+
string BuildHistoryJson() {
   datetime now = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(now, dt);
   
   datetime startDay   = now - (long)(dt.hour*3600 + dt.min*60 + dt.sec);
   datetime startWeek  = now - (long)(dt.day_of_week * 86400);
   datetime startMonth = now - (long)((dt.day - 1) * 86400);

   double profitToday=0, profitWeek=0, profitMonth=0;
   double bestTrade=0, worstTrade=0, totalProfit=0;
   double sumWin=0;
   int    totalTrades=0, totalWins=0, totalLoss=0;
   
   // Array untuk recent deals
   string recentDealsJson = "\"recentDeals\":[";
   int dealsAdded = 0;

   HistorySelect(0, now);
   int totalHistDeals = HistoryDealsTotal();
   
   for(int i = totalHistDeals - 1; i >= 0; i--) {
      ulong tkt = HistoryDealGetTicket(i);
      if(!HistoryDealSelect(tkt)) continue;
      if(HistoryDealGetInteger(tkt, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
      
      datetime dealTime = (datetime)HistoryDealGetInteger(tkt, DEAL_TIME);
      double   p        = HistoryDealGetDouble(tkt, DEAL_PROFIT) +
                          HistoryDealGetDouble(tkt, DEAL_COMMISSION) +
                          HistoryDealGetDouble(tkt, DEAL_SWAP);
      double   vol      = HistoryDealGetDouble(tkt, DEAL_VOLUME);
      string   sym      = HistoryDealGetString(tkt, DEAL_SYMBOL);
      double   prc      = HistoryDealGetDouble(tkt, DEAL_PRICE);
      long     dealType = HistoryDealGetInteger(tkt, DEAL_TYPE);
      string   typeStr  = (dealType == DEAL_TYPE_BUY ? "BUY" : "SELL");
      int      dig      = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      
      // Hitung statistik performa
      totalTrades++;
      totalProfit += p;
      if(p >= 0) { totalWins++; sumWin += p; }
      else         totalLoss++;
      if(p > bestTrade)  bestTrade  = p;
      if(p < worstTrade) worstTrade = p;
      
      // Hitung profit per periode
      if(dealTime >= startDay)   profitToday  += p;
      if(dealTime >= startWeek)  profitWeek   += p;
      if(dealTime >= startMonth) profitMonth  += p;
      
      // Kumpulkan N deal terakhir
      if(dealsAdded < InpHistoryDeals) {
         if(dealsAdded > 0) recentDealsJson += ",";
         recentDealsJson += "{";
         recentDealsJson += "\"ticket\":"    + IntegerToString(tkt)                + ",";
         recentDealsJson += "\"symbol\":\"" + sym                                  + "\",";
         recentDealsJson += "\"type\":\""   + typeStr                              + "\",";
         recentDealsJson += "\"volume\":"   + DoubleToString(vol, 2)              + ",";
         recentDealsJson += "\"price\":"    + DoubleToString(prc, dig)            + ",";
         recentDealsJson += "\"profit\":"   + DoubleToString(p, 2)               + ",";
         recentDealsJson += "\"time\":"     + IntegerToString(dealTime);
         recentDealsJson += "}";
         dealsAdded++;
      }
   }
   recentDealsJson += "]";

   double winRate  = (totalTrades > 0 ? (double)totalWins / totalTrades * 100.0 : 0.0);
   double avgProfit = (totalTrades > 0 ? totalProfit / totalTrades : 0.0);

   // JSON History
   string histJson = "\"history\":{";
   histJson += "\"profitToday\":"  + DoubleToString(profitToday, 2)  + ",";
   histJson += "\"profitWeek\":"   + DoubleToString(profitWeek, 2)   + ",";
   histJson += "\"profitMonth\":"  + DoubleToString(profitMonth, 2)  + ",";
   histJson += "\"totalTrades\":"  + IntegerToString(totalTrades)    + ",";
   histJson += "\"totalWins\":"    + IntegerToString(totalWins)      + ",";
   histJson += "\"totalLoss\":"    + IntegerToString(totalLoss)      + ",";
   histJson += "\"winRate\":"      + DoubleToString(winRate, 2)      + ",";
   histJson += "\"bestTrade\":"    + DoubleToString(bestTrade, 2)    + ",";
   histJson += "\"worstTrade\":"   + DoubleToString(worstTrade, 2)   + ",";
   histJson += "\"avgProfit\":"    + DoubleToString(avgProfit, 2);
   histJson += "}";

   // JSON Performance
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   double growth   = (balance > 0 ? (equity - balance) / balance * 100.0 : 0.0);
   // Simple max drawdown (selisih equity vs balance sebagai pendekatan)
   double drawdown    = (equity < balance ? balance - equity : 0.0);
   double drawdownPct = (balance > 0 ? drawdown / balance * 100.0 : 0.0);

   string perfJson = "\"performance\":{";
   perfJson += "\"growth\":"         + DoubleToString(growth, 2)      + ",";
   perfJson += "\"maxDrawdown\":"    + DoubleToString(drawdown, 2)    + ",";
   perfJson += "\"maxDrawdownPct\":" + DoubleToString(drawdownPct, 2);
   perfJson += "}";

   return histJson + "," + perfJson + "," + recentDealsJson;
}

//+------------------------------------------------------------------+
//| Fungsi Utama: Gabungkan semua JSON dan kirim ke Endpoint         |
//+------------------------------------------------------------------+
void DoSync() {
   string json = "{";
   json += BuildAccountJson()  + ",";
   json += BuildPositionsJson() + ",";
   json += BuildHistoryJson();
   json += "}";

   char   post_data[], result[];
   string headers = "Content-Type: application/json\r\nx-api-key: " + InpApiKey + "\r\n";
   
   StringToCharArray(json, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post_data, ArraySize(post_data) - 1); // Hapus null terminator
   
   int httpCode = WebRequest("POST", InpEndpointUrl, headers, 5000, post_data, result, headers);
   
   if(httpCode != 200) {
      Print("⚠️ Sync GAGAL. HTTP: ", httpCode, " | Error MQL5: ", GetLastError());
   }
}
//+------------------------------------------------------------------+
