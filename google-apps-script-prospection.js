/**
 * commandeici Prospection — Google Sheets Tracking v1
 * Dashboard visuel + suivi envois email
 *
 * Actions webhook (doPost) :
 *   - track_send    : ajoute un envoi reussi
 *   - batch_summary : recap fin de batch (stats globales)
 *   - sync_all      : full sync du sent_log.json
 *
 * doGet : force rebuild Dashboard + formatage
 */

/* ═══════════════════════════════════════════════════════════
   STYLE
   ═══════════════════════════════════════════════════════════ */
var EMERALD  = "#065F46";
var WHITE    = "#FFFFFF";
var ALT_ROW  = "#F0FDF4";
var FONT_H   = "Montserrat";
var FONT_B   = "Arial";

var C_GREEN_BG  = "#D1FAE5"; var C_GREEN_FG  = "#065F46";
var C_RED_BG    = "#FEE2E2"; var C_RED_FG    = "#991B1B";
var C_BLUE_BG   = "#DBEAFE"; var C_BLUE_FG   = "#1E40AF";
var C_YELLOW_BG = "#FEF3C7"; var C_YELLOW_FG = "#92400E";
var C_MUTED     = "#6B7280";

var ENVOI_HEADERS = [
  "Date", "Restaurant", "Ville", "Email", "Type resto",
  "Rating", "Avis", "Status", "Resend ID", "Slot"
];
var ENVOI_W = [145, 220, 130, 250, 130, 70, 70, 100, 220, 80];

var RESTO_HEADERS = [
  "Restaurant", "Ville", "Email", "Telephone", "Site web",
  "Type", "Rating", "Avis", "Status"
];
var RESTO_W = [220, 130, 250, 140, 280, 130, 70, 70, 110];

/* ═══════════════════════════════════════════════════════════
   GET — Ouvrir l'URL du webhook pour forcer le rebuild
   ═══════════════════════════════════════════════════════════ */
function doGet(e) {
  manualFormat();
  return respond({status: "ok", message: "Dashboard rebuilt"});
}

function manualFormat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Envois");
  if (sheet) formatEnvois(sheet);
  buildDashboard(ss);
  SpreadsheetApp.flush();
}

/* ═══════════════════════════════════════════════════════════
   HANDLER
   ═══════════════════════════════════════════════════════════ */
function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "track_send";
    var result;

    if (action === "track_send")          result = trackSend(data);
    else if (action === "batch_summary") result = batchSummary(data);
    else if (action === "sync_all")      result = syncAll(data);
    else if (action === "sync_restaurants") result = syncRestaurants(data);
    else result = {status: "error", message: "Unknown action: " + action};

    lock.releaseLock();
    return respond(result);
  } catch (err) {
    return respond({status: "error", message: err.toString()});
  }
}

/* ═══════════════════════════════════════════════════════════
   TRACK SEND — un email envoye
   ═══════════════════════════════════════════════════════════ */
function trackSend(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, "Envois", ENVOI_HEADERS);

  // Anti-doublon par email
  var lr = sheet.getLastRow();
  if (lr > 1) {
    var emails = sheet.getRange(2, 4, lr - 1, 1).getValues().flat();
    if (emails.indexOf(data.email) !== -1) {
      return {status: "duplicate", email: data.email};
    }
  }

  sheet.appendRow([
    data.date || "",
    data.restaurant || "",
    data.city || "",
    data.email || "",
    data.type || "",
    data.rating || "",
    data.reviews || "",
    data.status || "Envoye",
    data.resend_id || "",
    data.slot || ""
  ]);

  formatEnvois(sheet);
  return {status: "ok", row: sheet.getLastRow()};
}

/* ═══════════════════════════════════════════════════════════
   BATCH SUMMARY — fin de batch, rebuild dashboard
   ═══════════════════════════════════════════════════════════ */
function batchSummary(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  buildDashboard(ss);
  SpreadsheetApp.flush();
  return {status: "ok", message: "Dashboard updated"};
}

/* ═══════════════════════════════════════════════════════════
   SYNC ALL — full sync du sent_log.json
   ═══════════════════════════════════════════════════════════ */
function syncAll(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, "Envois", ENVOI_HEADERS);

  // Get existing emails to avoid duplicates
  var existing = {};
  var lr = sheet.getLastRow();
  if (lr > 1) {
    var rows = sheet.getRange(2, 1, lr - 1, ENVOI_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      existing[rows[i][3]] = true; // email column
    }
  }

  var entries = data.entries || [];
  var added = 0;

  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (existing[e.email]) continue;

    sheet.appendRow([
      e.date || "",
      e.restaurant || "",
      e.city || "",
      e.email || "",
      e.type || "",
      e.rating || "",
      e.reviews || "",
      "Envoye",
      e.resend_id || "",
      e.slot || ""
    ]);
    added++;
  }

  formatEnvois(sheet);
  buildDashboard(ss);
  SpreadsheetApp.flush();
  return {status: "ok", added: added, total: (lr - 1) + added};
}

/* ═══════════════════════════════════════════════════════════
   SYNC RESTAURANTS — full CSV sync with status
   ═══════════════════════════════════════════════════════════ */
function syncRestaurants(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, "Restaurants", RESTO_HEADERS);

  // Clear existing data
  var lr = sheet.getLastRow();
  if (lr > 1) {
    sheet.getRange(2, 1, lr - 1, sheet.getMaxColumns()).clearContent();
  }

  var restaurants = data.restaurants || [];
  if (restaurants.length === 0) {
    return {status: "ok", count: 0};
  }

  var out = [];
  for (var i = 0; i < restaurants.length; i++) {
    var r = restaurants[i];
    out.push([
      r.name || "",
      r.city || "",
      r.email || "",
      r.phone || "",
      r.website || "",
      r.type || "",
      r.rating || "",
      r.reviews || "",
      r.status || "En attente"
    ]);
  }

  sheet.getRange(2, 1, out.length, RESTO_HEADERS.length).setValues(out);
  formatRestaurants(sheet);
  buildDashboard(ss);
  SpreadsheetApp.flush();
  return {status: "ok", count: out.length};
}

/* ═══════════════════════════════════════════════════════════
   FORMAT — RESTAURANTS
   ═══════════════════════════════════════════════════════════ */
function formatRestaurants(sheet) {
  var nc = RESTO_HEADERS.length;
  var lr = sheet.getLastRow();

  sheet.getRange(1, 1, 1, nc).setValues([RESTO_HEADERS]);
  styleHeader(sheet, nc);
  for (var c = 0; c < RESTO_W.length; c++) sheet.setColumnWidth(c + 1, RESTO_W[c]);

  if (lr <= 1) return;
  var rc = lr - 1;

  sheet.getRange(2, 1, rc, nc).setFontFamily(FONT_B).setFontSize(10).setVerticalAlignment("middle");

  for (var r = 0; r < rc; r++) {
    sheet.setRowHeight(r + 2, 28);
    sheet.getRange(r + 2, 1, 1, nc).setBackground(r % 2 === 0 ? WHITE : ALT_ROW);
  }

  sheet.getRange(2, 7, rc, 2).setHorizontalAlignment("center");
  sheet.getRange(2, 9, rc, 1).setHorizontalAlignment("center").setFontWeight("bold");

  var sR = sheet.getRange(2, 9, rc, 1);
  sheet.setConditionalFormatRules([
    cfExact(sR, "Envoye", C_GREEN_BG, C_GREEN_FG),
    cfExact(sR, "En attente", C_BLUE_BG, C_BLUE_FG),
    cfExact(sR, "Filtre", C_YELLOW_BG, C_YELLOW_FG)
  ]);
}

/* ═══════════════════════════════════════════════════════════
   FORMAT — ENVOIS
   ═══════════════════════════════════════════════════════════ */
function formatEnvois(sheet) {
  var nc = ENVOI_HEADERS.length;
  var lr = sheet.getLastRow();

  sheet.getRange(1, 1, 1, nc).setValues([ENVOI_HEADERS]);
  styleHeader(sheet, nc);
  for (var c = 0; c < ENVOI_W.length; c++) sheet.setColumnWidth(c + 1, ENVOI_W[c]);

  if (lr <= 1) return;
  var rc = lr - 1;

  sheet.getRange(2, 1, rc, nc).setFontFamily(FONT_B).setFontSize(10).setVerticalAlignment("middle");

  for (var r = 0; r < rc; r++) {
    sheet.setRowHeight(r + 2, 28);
    sheet.getRange(r + 2, 1, 1, nc).setBackground(r % 2 === 0 ? WHITE : ALT_ROW);
  }

  // Alignments
  sheet.getRange(2, 6, rc, 2).setHorizontalAlignment("center"); // Rating, Avis
  sheet.getRange(2, 8, rc, 1).setHorizontalAlignment("center").setFontWeight("bold"); // Status
  sheet.getRange(2, 9, rc, 1).setFontSize(9).setFontColor(C_MUTED); // Resend ID
  sheet.getRange(2, 10, rc, 1).setHorizontalAlignment("center"); // Slot

  // Conditional formatting on Status
  var sR = sheet.getRange(2, 8, rc, 1);
  sheet.setConditionalFormatRules([
    cfExact(sR, "Envoye", C_GREEN_BG, C_GREEN_FG),
    cfExact(sR, "Erreur", C_RED_BG, C_RED_FG),
    cfExact(sR, "Bounce", C_YELLOW_BG, C_YELLOW_FG)
  ]);
}

/* ═══════════════════════════════════════════════════════════
   SHARED HELPERS
   ═══════════════════════════════════════════════════════════ */
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function styleHeader(sheet, numCols) {
  sheet.getRange(1, 1, 1, numCols)
    .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(10)
    .setBackground(EMERALD).setFontColor(WHITE).setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
}

function cfExact(range, text, bg, fg) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(text).setBackground(bg).setFontColor(fg).setBold(true)
    .setRanges([range]).build();
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════ */
function buildDashboard(ss) {
  var envoisSheet = ss.getSheetByName("Envois");
  var restoSheet = ss.getSheetByName("Restaurants");

  var sheet = ss.getSheetByName("Dashboard");
  if (sheet) {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  } else {
    sheet = ss.insertSheet("Dashboard", 0);
  }
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
  sheet.setHiddenGridlines(true);

  // Layout: col A = margin, B-E = content, F = margin
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 230);
  sheet.setColumnWidth(3, 160);
  sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 380);
  sheet.setColumnWidth(6, 40);

  sheet.getRange(1, 1, 50, 6).setBackground(WHITE);

  // Read data
  var totalSent = 0, totalErrors = 0;
  var cityStats = {};
  var dayStats = {};
  var typeStats = {};
  var data = [];

  if (envoisSheet) {
    var lr = envoisSheet.getLastRow();
    if (lr > 1) {
      data = envoisSheet.getRange(2, 1, lr - 1, ENVOI_HEADERS.length).getValues();
      for (var i = 0; i < data.length; i++) {
        var status = String(data[i][7]);
        var city = String(data[i][2]).trim();
        var type = String(data[i][4]).trim();
        var rawDate = data[i][0];
        var dateStr = "";
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
          dateStr = Utilities.formatDate(rawDate, "Europe/Paris", "yyyy-MM-dd");
        } else {
          dateStr = String(rawDate).substring(0, 10);
        }

        if (status === "Envoye") totalSent++;
        else totalErrors++;

        // City stats
        if (city) {
          if (!cityStats[city]) cityStats[city] = 0;
          cityStats[city]++;
        }

        // Type stats
        if (type) {
          if (!typeStats[type]) typeStats[type] = 0;
          typeStats[type]++;
        }

        // Day stats
        if (dateStr && dateStr.length >= 10) {
          if (!dayStats[dateStr]) dayStats[dateStr] = 0;
          dayStats[dateStr]++;
        }
      }
    }
  }

  var C = 2;
  var r = 1;

  // Top margin
  sheet.setRowHeight(r, 16); r++;

  // TITLE
  sheet.getRange(r, C, 1, 4).merge()
    .setValue("commandeici - Prospection B2B")
    .setFontFamily(FONT_H).setFontSize(22).setFontWeight("bold").setFontColor(EMERALD);
  sheet.setRowHeight(r, 58);
  r++;

  var nowStr = Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy HH:mm");
  sheet.getRange(r, C, 1, 4).merge()
    .setValue("Derniere MAJ : " + nowStr)
    .setFontFamily(FONT_B).setFontSize(10).setFontColor(C_MUTED);
  r++;

  // Separator
  r = addSeparator(sheet, r, C);

  // ── KPIs GLOBAUX ──
  secTitle(sheet, r, C, "EMAILS ENVOYES"); r++;

  sheet.getRange(r, C).setValue("Total envoyes").setFontFamily(FONT_B).setFontSize(11);
  sheet.getRange(r, C + 1).setValue(totalSent)
    .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(24).setFontColor(C_GREEN_FG);
  sheet.setRowHeight(r, 42);
  r++;

  sheet.getRange(r, C).setValue("Erreurs").setFontFamily(FONT_B).setFontSize(11);
  sheet.getRange(r, C + 1).setValue(totalErrors)
    .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(18).setFontColor(totalErrors > 0 ? C_RED_FG : C_MUTED);
  r++;

  var totalCSV = totalSent + totalErrors;
  sheet.getRange(r, C).setValue("Taux de succes").setFontFamily(FONT_B).setFontSize(11);
  var successRate = totalCSV > 0 ? Math.round(totalSent / totalCSV * 100) : 0;
  sheet.getRange(r, C + 1, 1, 3).merge()
    .setValue(makeBar(successRate, 25) + " " + successRate + "%")
    .setFontFamily("monospace").setFontSize(11).setFontColor(C_GREEN_FG);
  r++;

  // Total restaurants and remaining
  var totalRestos = 0;
  if (restoSheet && restoSheet.getLastRow() > 1) {
    totalRestos = restoSheet.getLastRow() - 1;
  }
  var remaining = Math.max(totalRestos - totalSent, 0);

  sheet.getRange(r, C).setValue("Total contacts").setFontFamily(FONT_B).setFontSize(11);
  sheet.getRange(r, C + 1).setValue(totalRestos)
    .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(18).setFontColor(C_BLUE_FG);
  var progPct = totalRestos > 0 ? Math.round(totalSent / totalRestos * 100) : 0;
  sheet.getRange(r, C + 2, 1, 2).merge()
    .setValue(makeBar(progPct, 25) + " " + progPct + "%")
    .setFontFamily("monospace").setFontSize(10).setFontColor(C_GREEN_FG);
  r++;

  sheet.getRange(r, C).setValue("Restants").setFontFamily(FONT_B).setFontSize(11);
  sheet.getRange(r, C + 1).setValue(remaining)
    .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(18).setFontColor(C_BLUE_FG);
  if (remaining > 0) {
    var daysLeft = Math.ceil(remaining / 90);
    sheet.getRange(r, C + 2).setValue("~" + daysLeft + " jours restants")
      .setFontFamily(FONT_B).setFontSize(10).setFontColor(C_MUTED);
  }
  r++;

  sheet.getRange(r, C).setValue("Rythme").setFontFamily(FONT_B).setFontSize(11);
  sheet.getRange(r, C + 1).setValue("90 / jour (45 + 45)")
    .setFontFamily(FONT_B).setFontSize(11).setFontColor(C_BLUE_FG);
  r++;

  // Separator
  r = addSeparator(sheet, r, C);

  // ── PAR JOUR (7 derniers) ──
  secTitle(sheet, r, C, "ENVOIS PAR JOUR"); r++;

  sheet.getRange(r, C).setValue("Jour").setFontFamily(FONT_B).setFontSize(9).setFontColor(C_MUTED).setFontWeight("bold");
  sheet.getRange(r, C + 1).setValue("Envoyes").setFontFamily(FONT_B).setFontSize(9).setFontColor(C_MUTED).setFontWeight("bold");
  r++;

  // Sort days descending, show last 7
  var dayKeys = Object.keys(dayStats).sort().reverse().slice(0, 7);
  for (var d = 0; d < dayKeys.length; d++) {
    var dayLabel = formatDayFR(dayKeys[d]);
    sheet.getRange(r, C).setValue(dayLabel).setFontFamily(FONT_B).setFontSize(11);
    sheet.getRange(r, C + 1).setValue(dayStats[dayKeys[d]])
      .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(14).setHorizontalAlignment("center");
    var dayPct = Math.min(Math.round(dayStats[dayKeys[d]] / 90 * 100), 100);
    sheet.getRange(r, C + 2, 1, 2).merge()
      .setValue(makeBar(dayPct, 20) + " " + dayStats[dayKeys[d]] + "/90")
      .setFontFamily("monospace").setFontSize(10).setFontColor("#10B981");
    r++;
  }
  if (dayKeys.length === 0) {
    sheet.getRange(r, C, 1, 4).merge().setValue("Aucun envoi pour le moment")
      .setFontFamily(FONT_B).setFontSize(11).setFontColor(C_MUTED);
    r++;
  }
  r++;

  // Separator
  r = addSeparator(sheet, r, C);

  // ── TOP VILLES ──
  secTitle(sheet, r, C, "TOP VILLES"); r++;

  sheet.getRange(r, C).setValue("Ville").setFontFamily(FONT_B).setFontSize(9).setFontColor(C_MUTED).setFontWeight("bold");
  sheet.getRange(r, C + 1).setValue("Emails").setFontFamily(FONT_B).setFontSize(9).setFontColor(C_MUTED).setFontWeight("bold");
  r++;

  // Sort cities by count descending, show top 10
  var cityList = Object.keys(cityStats).map(function(k) { return {city: k, count: cityStats[k]}; });
  cityList.sort(function(a, b) { return b.count - a.count; });
  var topCities = cityList.slice(0, 10);

  for (var ci = 0; ci < topCities.length; ci++) {
    sheet.getRange(r, C).setValue(topCities[ci].city).setFontFamily(FONT_B).setFontSize(11);
    sheet.getRange(r, C + 1).setValue(topCities[ci].count)
      .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(14).setHorizontalAlignment("center");
    var cityPct = totalSent > 0 ? Math.round(topCities[ci].count / totalSent * 100) : 0;
    sheet.getRange(r, C + 2, 1, 2).merge()
      .setValue(makeBar(cityPct, 20) + " " + cityPct + "%")
      .setFontFamily("monospace").setFontSize(10).setFontColor("#6366F1");
    r++;
  }
  r++;

  // Separator
  r = addSeparator(sheet, r, C);

  // ── PAR TYPE DE RESTO ──
  secTitle(sheet, r, C, "PAR TYPE"); r++;

  sheet.getRange(r, C).setValue("Type").setFontFamily(FONT_B).setFontSize(9).setFontColor(C_MUTED).setFontWeight("bold");
  sheet.getRange(r, C + 1).setValue("Emails").setFontFamily(FONT_B).setFontSize(9).setFontColor(C_MUTED).setFontWeight("bold");
  r++;

  var typeList = Object.keys(typeStats).map(function(k) { return {type: k, count: typeStats[k]}; });
  typeList.sort(function(a, b) { return b.count - a.count; });
  var topTypes = typeList.slice(0, 8);

  for (var ti = 0; ti < topTypes.length; ti++) {
    sheet.getRange(r, C).setValue(topTypes[ti].type).setFontFamily(FONT_B).setFontSize(11);
    sheet.getRange(r, C + 1).setValue(topTypes[ti].count)
      .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(14).setHorizontalAlignment("center");
    var typePct = totalSent > 0 ? Math.round(topTypes[ti].count / totalSent * 100) : 0;
    sheet.getRange(r, C + 2, 1, 2).merge()
      .setValue(makeBar(typePct, 20) + " " + typePct + "%")
      .setFontFamily("monospace").setFontSize(10).setFontColor("#F59E0B");
    r++;
  }
}

/* ── Dashboard helpers ── */

var JOURS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function formatDayFR(dateStr) {
  if (!dateStr || dateStr.length < 10) return dateStr;
  var parts = dateStr.split("-");
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return JOURS_FR[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1);
}

function makeBar(pct, len) {
  var filled = Math.round(pct / 100 * len);
  var empty = len - filled;
  var bar = "";
  for (var i = 0; i < filled; i++) bar += "\u2588";
  for (var i = 0; i < empty; i++) bar += "\u2591";
  return bar;
}

function secTitle(sheet, row, col, text) {
  sheet.getRange(row, col, 1, 4).merge()
    .setValue(text)
    .setFontFamily(FONT_H).setFontWeight("bold").setFontSize(13).setFontColor(EMERALD);
  sheet.setRowHeight(row, 34);
}

function addSeparator(sheet, r, C) {
  sheet.setRowHeight(r, 8); r++;
  sheet.getRange(r, C, 1, 4).merge().setBackground("#D1FAE5");
  sheet.setRowHeight(r, 2); r++;
  sheet.setRowHeight(r, 12); r++;
  return r;
}

function cfContains(range, text, bg, fg) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains(text).setBackground(bg).setFontColor(fg).setBold(true)
    .setRanges([range]).build();
}
