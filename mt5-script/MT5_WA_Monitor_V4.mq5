//+------------------------------------------------------------------+
//|                                     MT5_WA_Monitor_V4.mq5       |
//|           Full FXBook-Style Sync + Bidirectional Commands        |
//|                           Copyright 2026, Gemini AI             |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Gemini AI"
#property version   "4.10"
#property strict

// ===================================================
// INPUT
// ===================================================
input string   InpEndpointUrl  = "http://103.127.133.64:3000/api/mt5";       // URL Endpoint Data
input string   InpCmdUrl       = "http://103.127.133.64:3000/api/commands";  // URL Command Queue
input string   InpApiKey       = "$2a$12$Axpyj12ftthYV.kXIE1leeVD/GrfYVOkt7OHWSdBfxbsRL/lTO6m."; // API Key
input int      InpSyncInterval = 5;   // Interval sync data (detik)
input int      InpCmdInterval  = 2;   // Interval cek command (detik)
input int      InpHistoryDeals = 10;  // Jumlah deal history terakhir
input int      InpDeviation    = 10;  // Slippage default (points)

int  timer_sync = 0;
int  timer_cmd  = 0;

//+------------------------------------------------------------------+
//| OnInit                                                           |
//+------------------------------------------------------------------+
int OnInit() {
   EventSetTimer(1);
   Print("✅ MT5 WA Monitor V4.10 Aktif | ", InpEndpointUrl);
   DoSync();
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason) { EventKillTimer(); }

//+------------------------------------------------------------------+
//| OnTimer                                                          |
//+------------------------------------------------------------------+
void OnTimer() {
   timer_sync++;
   timer_cmd++;
   
   if(timer_sync >= InpSyncInterval) { DoSync(); timer_sync = 0; }
   if(timer_cmd  >= InpCmdInterval)  { CheckCommands(); timer_cmd = 0; }
}

//+------------------------------------------------------------------+
//| JSON Helper: Escape special chars                                |
//+------------------------------------------------------------------+
string EscapeJson(string s) {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
}

//+------------------------------------------------------------------+
//| HTTP Helper: Kirim GET request ke URL                            |
//+------------------------------------------------------------------+
string HttpGet(string url) {
   char post[], result[];
   string headers     = "x-api-key: " + InpApiKey + "\r\n";
   string resHeaders;
   ArrayResize(post, 0); // POST body kosong untuk GET
   int code = WebRequest("GET", url, headers, 3000, post, result, resHeaders);
   if(code == 200) return CharArrayToString(result);
   return "";
}

//+------------------------------------------------------------------+
//| HTTP Helper: Kirim PATCH request (update command status)        |
//+------------------------------------------------------------------+
void HttpPatch(string url, string body) {
   char post[], result[];
   string headers = "Content-Type: application/json\r\nx-api-key: " + InpApiKey + "\r\n";
   StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, ArraySize(post) - 1);
   WebRequest("PATCH", url, headers, 3000, post, result, headers);
}

//+------------------------------------------------------------------+
//| JSON Extractor sederhana (cari nilai setelah key)               |
//+------------------------------------------------------------------+
string ExtractJsonString(string json, string key) {
   string search = "\"" + key + "\":\"";
   int pos = StringFind(json, search);
   if(pos == -1) return "";
   int start = pos + StringLen(search);
   int end   = StringFind(json, "\"", start);
   if(end == -1) return "";
   return StringSubstr(json, start, end - start);
}

string ExtractJsonNumber(string json, string key) {
   string search = "\"" + key + "\":";
   int pos = StringFind(json, search);
   if(pos == -1) return "0";
   int start = pos + StringLen(search);
   // Carilah sampai koma atau kurung kurawal penutup
   int end = start;
   while(end < StringLen(json)) {
      ushort c = StringGetCharacter(json, end);
      if(c == ',' || c == '}' || c == ']') break;
      end++;
   }
   return StringSubstr(json, start, end - start);
}

//+------------------------------------------------------------------+
//| Laporan hasil ke endpoint                                       |
//+------------------------------------------------------------------+
void ReportResult(string cmdId, string status, string result) {
   string url  = InpCmdUrl + "/" + cmdId;
   string body = "{\"status\":\"" + status + "\",\"result\":\"" + EscapeJson(result) + "\"}";
   HttpPatch(url, body);
   Print("[CMD] ", cmdId, " → ", status, ": ", result);
}

//+------------------------------------------------------------------+
//| Eksekusi: Open Position (BUY / SELL)                            |
//+------------------------------------------------------------------+
void ExecOrder(string cmdId, string type, string symbol, double volume, double sl, double tp) {
   if(symbol == "") { ReportResult(cmdId, "failed", "Symbol kosong"); return; }
   if(volume <= 0)  { ReportResult(cmdId, "failed", "Volume tidak valid"); return; }
   
   ENUM_ORDER_TYPE orderType = (type == "BUY" ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
   
   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};
   
   request.action    = TRADE_ACTION_DEAL;
   request.symbol    = symbol;
   request.volume    = volume;
   request.type      = orderType;
   request.price     = (type == "BUY" ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID));
   request.sl        = sl;
   request.tp        = tp;
   request.deviation = InpDeviation;
   request.magic     = 20260101; // Magic number khusus untuk order dari WA Bot
   request.comment   = "WA Bot Order";
   
   if(OrderSend(request, result)) {
      ReportResult(cmdId, "executed", "Order #" + IntegerToString(result.order) + " berhasil dibuka pada " + DoubleToString(result.price, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)));
   } else {
      ReportResult(cmdId, "failed", "OrderSend gagal | Error: " + IntegerToString(GetLastError()) + " | Retcode: " + IntegerToString(result.retcode));
   }
}

//+------------------------------------------------------------------+
//| Eksekusi: Close Position by Ticket                              |
//+------------------------------------------------------------------+
void ExecClose(string cmdId, long ticket) {
   if(!PositionSelectByTicket(ticket)) {
      ReportResult(cmdId, "failed", "Posisi #" + IntegerToString(ticket) + " tidak ditemukan");
      return;
   }
   
   string sym  = PositionGetString(POSITION_SYMBOL);
   double vol  = PositionGetDouble(POSITION_VOLUME);
   ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   
   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = sym;
   request.volume = vol;
   request.type   = (posType == POSITION_TYPE_BUY ? ORDER_TYPE_SELL : ORDER_TYPE_BUY);
   request.price  = (posType == POSITION_TYPE_BUY ? SymbolInfoDouble(sym, SYMBOL_BID) : SymbolInfoDouble(sym, SYMBOL_ASK));
   request.position  = ticket;
   request.deviation = InpDeviation;
   request.comment   = "WA Bot Close";
   
   if(OrderSend(request, result)) {
      ReportResult(cmdId, "executed", "Posisi #" + IntegerToString(ticket) + " berhasil ditutup");
   } else {
      ReportResult(cmdId, "failed", "Close gagal | Error: " + IntegerToString(GetLastError()));
   }
}

//+------------------------------------------------------------------+
//| Eksekusi: Close All Positions                                   |
//+------------------------------------------------------------------+
void ExecCloseAll(string cmdId) {
   int total   = PositionsTotal();
   int success = 0;
   int failed  = 0;
   
   // Loop mundur agar index tidak bergeser setelah close
   for(int i = total - 1; i >= 0; i--) {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) { failed++; continue; }
      
      string sym  = PositionGetString(POSITION_SYMBOL);
      double vol  = PositionGetDouble(POSITION_VOLUME);
      ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      
      MqlTradeRequest request = {};
      MqlTradeResult  result  = {};
      request.action    = TRADE_ACTION_DEAL;
      request.symbol    = sym;
      request.volume    = vol;
      request.type      = (posType == POSITION_TYPE_BUY ? ORDER_TYPE_SELL : ORDER_TYPE_BUY);
      request.price     = (posType == POSITION_TYPE_BUY ? SymbolInfoDouble(sym, SYMBOL_BID) : SymbolInfoDouble(sym, SYMBOL_ASK));
      request.position  = ticket;
      request.deviation = InpDeviation;
      request.comment   = "WA Bot CloseAll";
      
      if(OrderSend(request, result)) success++;
      else                           failed++;
   }
   
   ReportResult(cmdId, (failed == 0 ? "executed" : "failed"),
                "Close All: " + IntegerToString(success) + " sukses, " + IntegerToString(failed) + " gagal");
}

//+------------------------------------------------------------------+
//| Eksekusi: Modify SL/TP                                         |
//+------------------------------------------------------------------+
void ExecModify(string cmdId, long ticket, double sl, double tp) {
   if(!PositionSelectByTicket(ticket)) {
      ReportResult(cmdId, "failed", "Posisi #" + IntegerToString(ticket) + " tidak ditemukan");
      return;
   }
   
   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};
   request.action   = TRADE_ACTION_SLTP;
   request.position = ticket;
   request.symbol   = PositionGetString(POSITION_SYMBOL);
   request.sl       = sl;
   request.tp       = tp;
   
   if(OrderSend(request, result)) {
      ReportResult(cmdId, "executed", "SL/TP posisi #" + IntegerToString(ticket) + " berhasil diubah");
   } else {
      ReportResult(cmdId, "failed", "Modify gagal | Error: " + IntegerToString(GetLastError()));
   }
}

//+------------------------------------------------------------------+
//| Polling: Cek Command Pending dari Endpoint                      |
//+------------------------------------------------------------------+
void CheckCommands() {
   string response = HttpGet(InpCmdUrl + "/pending");
   if(response == "") return;
   
   // Cek apakah ada command
   if(StringFind(response, "\"count\":0") != -1) return;
   
   // Ambil setiap command (parsing sederhana per blok { ... })
   int pos = 0;
   while(true) {
      int start = StringFind(response, "{\"id\":", pos);
      if(start == -1) break;
      
      // Cari akhir object JSON ini
      int depth = 0;
      int end   = start;
      while(end < StringLen(response)) {
         ushort c = StringGetCharacter(response, end);
         if(c == '{') depth++;
         else if(c == '}') { depth--; if(depth == 0) { end++; break; } }
         end++;
      }
      
      string cmdObj = StringSubstr(response, start, end - start);
      
      // Parse field
      string cmdId  = ExtractJsonString(cmdObj, "id");
      string type   = ExtractJsonString(cmdObj, "type");
      string symbol = ExtractJsonString(cmdObj, "symbol");
      double volume = StringToDouble(ExtractJsonNumber(cmdObj, "volume"));
      double sl     = StringToDouble(ExtractJsonNumber(cmdObj, "sl"));
      double tp     = StringToDouble(ExtractJsonNumber(cmdObj, "tp"));
      long   ticket = StringToInteger(ExtractJsonNumber(cmdObj, "ticket"));
      
      if(cmdId == "") { pos = end; continue; }
      
      Print("[CMD] Mengeksekusi: ", type, " | ID: ", cmdId);
      
      if(type == "BUY" || type == "SELL") {
         ExecOrder(cmdId, type, symbol, volume, sl, tp);
      } else if(type == "CLOSE") {
         ExecClose(cmdId, ticket);
      } else if(type == "CLOSEALL") {
         ExecCloseAll(cmdId);
      } else if(type == "MODIFY") {
         ExecModify(cmdId, ticket, sl, tp);
      } else {
         ReportResult(cmdId, "failed", "Type command tidak dikenal: " + type);
      }
      
      pos = end;
   }
}

//+------------------------------------------------------------------+
//| BAGIAN DATA SYNC - Account, Positions, History                  |
//+------------------------------------------------------------------+
string BuildAccountJson() {
   string j = "\"account\":{";
   j += "\"login\":"      + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))             + ",";
   j += "\"name\":\""     + EscapeJson(AccountInfoString(ACCOUNT_NAME))                    + "\",";
   j += "\"server\":\""   + EscapeJson(AccountInfoString(ACCOUNT_SERVER))                  + "\",";
   j += "\"company\":\""  + EscapeJson(AccountInfoString(ACCOUNT_COMPANY))                 + "\",";
   j += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY)                            + "\",";
   j += "\"leverage\":"   + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE))          + ",";
   j += "\"balance\":"    + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2)          + ",";
   j += "\"equity\":"     + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2)           + ",";
   j += "\"credit\":"     + DoubleToString(AccountInfoDouble(ACCOUNT_CREDIT), 2)           + ",";
   j += "\"margin\":"     + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2)           + ",";
   j += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_FREEMARGIN), 2)       + ",";
   j += "\"marginLevel\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2)   + ",";
   j += "\"profit\":"     + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2);
   j += "}";
   return j;
}

string BuildPositionsJson() {
   string j = "\"openPositions\":[";
   int total = PositionsTotal();
   for(int i = 0; i < total; i++) {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      string sym  = PositionGetString(POSITION_SYMBOL);
      int    dig  = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      string type = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL");
      if(i > 0) j += ",";
      j += "{";
      j += "\"ticket\":"       + IntegerToString(ticket)                                          + ",";
      j += "\"symbol\":\""     + sym                                                              + "\",";
      j += "\"type\":\""       + type                                                             + "\",";
      j += "\"volume\":"       + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2)            + ",";
      j += "\"openPrice\":"    + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), dig)      + ",";
      j += "\"currentPrice\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), dig)   + ",";
      j += "\"sl\":"           + DoubleToString(PositionGetDouble(POSITION_SL), dig)              + ",";
      j += "\"tp\":"           + DoubleToString(PositionGetDouble(POSITION_TP), dig)              + ",";
      j += "\"profit\":"       + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2)            + ",";
      j += "\"swap\":"         + DoubleToString(PositionGetDouble(POSITION_SWAP), 2)              + ",";
      j += "\"magic\":"        + IntegerToString(PositionGetInteger(POSITION_MAGIC))              + ",";
      j += "\"timeOpen\":"     + IntegerToString(PositionGetInteger(POSITION_TIME))               + ",";
      j += "\"comment\":\""    + EscapeJson(PositionGetString(POSITION_COMMENT))                 + "\"";
      j += "}";
   }
   j += "]";
   return j;
}

string BuildHistoryJson() {
   datetime now = TimeCurrent();
   MqlDateTime dt; TimeToStruct(now, dt);
   datetime startDay   = now - (long)(dt.hour*3600 + dt.min*60 + dt.sec);
   datetime startWeek  = now - (long)(dt.day_of_week * 86400);
   datetime startMonth = now - (long)((dt.day - 1) * 86400);

   double dPft=0, wPft=0, mPft=0, bestTrade=0, worstTrade=0, totalProfit=0;
   int    totalTrades=0, totalWins=0, totalLoss=0, dealsAdded=0;
   string recentDealsJson = "\"recentDeals\":[";

   HistorySelect(0, now);
   int totalDeals = HistoryDealsTotal();
   for(int i = totalDeals - 1; i >= 0; i--) {
      ulong tkt = HistoryDealGetTicket(i);
      if(!HistoryDealSelect(tkt)) continue;
      if(HistoryDealGetInteger(tkt, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
      datetime dealTime = (datetime)HistoryDealGetInteger(tkt, DEAL_TIME);
      double p  = HistoryDealGetDouble(tkt, DEAL_PROFIT) + HistoryDealGetDouble(tkt, DEAL_COMMISSION) + HistoryDealGetDouble(tkt, DEAL_SWAP);
      double vol= HistoryDealGetDouble(tkt, DEAL_VOLUME);
      string sym= HistoryDealGetString(tkt, DEAL_SYMBOL);
      double prc= HistoryDealGetDouble(tkt, DEAL_PRICE);
      int    dig= (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      string typeStr = (HistoryDealGetInteger(tkt, DEAL_TYPE) == DEAL_TYPE_BUY ? "BUY" : "SELL");
      
      totalTrades++; totalProfit += p;
      if(p >= 0) totalWins++; else totalLoss++;
      if(p > bestTrade) bestTrade = p;
      if(p < worstTrade) worstTrade = p;
      if(dealTime >= startDay)   dPft += p;
      if(dealTime >= startWeek)  wPft += p;
      if(dealTime >= startMonth) mPft += p;
      
      if(dealsAdded < InpHistoryDeals) {
         if(dealsAdded > 0) recentDealsJson += ",";
         recentDealsJson += "{";
         recentDealsJson += "\"ticket\":"   + IntegerToString(tkt)      + ",";
         recentDealsJson += "\"symbol\":\"" + sym                        + "\",";
         recentDealsJson += "\"type\":\""   + typeStr                    + "\",";
         recentDealsJson += "\"volume\":"   + DoubleToString(vol, 2)     + ",";
         recentDealsJson += "\"price\":"    + DoubleToString(prc, dig)   + ",";
         recentDealsJson += "\"profit\":"   + DoubleToString(p, 2)       + ",";
         recentDealsJson += "\"time\":"     + IntegerToString(dealTime);
         recentDealsJson += "}";
         dealsAdded++;
      }
   }
   recentDealsJson += "]";

   double winRate    = (totalTrades > 0 ? (double)totalWins / totalTrades * 100.0 : 0.0);
   double avgProfit  = (totalTrades > 0 ? totalProfit / totalTrades : 0.0);
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double growth     = (balance > 0 ? (equity - balance) / balance * 100.0 : 0.0);
   double drawdown   = (equity < balance ? balance - equity : 0.0);
   double ddPct      = (balance > 0 ? drawdown / balance * 100.0 : 0.0);

   string h = "\"history\":{";
   h += "\"profitToday\":"  + DoubleToString(dPft, 2)      + ",";
   h += "\"profitWeek\":"   + DoubleToString(wPft, 2)      + ",";
   h += "\"profitMonth\":"  + DoubleToString(mPft, 2)      + ",";
   h += "\"totalTrades\":"  + IntegerToString(totalTrades) + ",";
   h += "\"totalWins\":"    + IntegerToString(totalWins)   + ",";
   h += "\"totalLoss\":"    + IntegerToString(totalLoss)   + ",";
   h += "\"winRate\":"      + DoubleToString(winRate, 2)   + ",";
   h += "\"bestTrade\":"    + DoubleToString(bestTrade, 2) + ",";
   h += "\"worstTrade\":"   + DoubleToString(worstTrade, 2)+ ",";
   h += "\"avgProfit\":"    + DoubleToString(avgProfit, 2);
   h += "}";
   
   string p = "\"performance\":{";
   p += "\"growth\":"         + DoubleToString(growth, 2) + ",";
   p += "\"maxDrawdown\":"    + DoubleToString(drawdown, 2) + ",";
   p += "\"maxDrawdownPct\":" + DoubleToString(ddPct, 2);
   p += "}";
   
   return h + "," + p + "," + recentDealsJson;
}

void DoSync() {
   string json = "{" + BuildAccountJson() + "," + BuildPositionsJson() + "," + BuildHistoryJson() + "}";
   
   char   post[], result[];
   string headers = "Content-Type: application/json\r\nx-api-key: " + InpApiKey + "\r\n";
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, ArraySize(post) - 1);
   
   int code = WebRequest("POST", InpEndpointUrl, headers, 5000, post, result, headers);
   if(code != 200) Print("⚠️ Sync GAGAL. HTTP: ", code, " | Error: ", GetLastError());
}
//+------------------------------------------------------------------+
