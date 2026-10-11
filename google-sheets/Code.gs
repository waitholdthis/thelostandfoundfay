/**
 * The Lost and Found Thrift Shoppe: Google Sheet backend for the website and the Shoppe Office (admin.html).
 *
 * Tabs in the Sheet:
 *   "New Finds"          items the shoppe adds (shown in "Catch New Finds First")
 *   "Drawer of the Day"  the daily featured find
 *   "St Jude Total"      the running total shown in the St. Jude section
 *   "Shop Map"           descriptions for each corner of the map + this week's corner
 *   "Lost Board"         wish-list cards shoppers post (approve, hide, or mark found)
 *
 * Setup steps are in SETUP.md (next to this file).
 */

const SHOP_NAME = 'The Lost and Found Thrift Shoppe';
const SHOP_ADDRESS = '236 Dunn Road, Fayetteville, NC 28312';
const SHOP_HOURS = 'Monday - Saturday, 10:00 AM - 4:00 PM';
const TIME_ZONE = 'America/New_York';
// Who hears about new Lost Board cards and receives the admin passcode.
// Leave blank to use the Google account that owns this script.
const OWNER_EMAIL = '';
const PHOTO_FOLDER = 'Lost and Found Website Photos';
const MAX_FINDS_ON_SITE = 6;

const SHEETS = {
  finds: 'New Finds',
  drawer: 'Drawer of the Day',
  impact: 'St Jude Total',
  map: 'Shop Map',
  lost: 'Lost Board'
};

const FIND_HEADERS = ['Added', 'Title', 'Label', 'Description', 'Price', 'Photo URL', 'Sketch', 'Show on website', 'ID (do not edit)'];
const FIND_COL = { added: 1, title: 2, label: 3, description: 4, price: 5, photo: 6, sketch: 7, show: 8, id: 9 };

const DRAWER_HEADERS = ['Date (optional)', 'Title', 'Era', 'Description', 'Price', 'Sketch', 'Photo URL', 'ID (do not edit)'];
const DRAWER_COL = { date: 1, title: 2, era: 3, description: 4, price: 5, sketch: 6, photo: 7, id: 8 };

const LOST_HEADERS = ['Posted', 'Name on board', 'Email (private)', 'Looking for', 'Details', 'Status', 'Found note', 'Shopper emailed', 'ID (do not edit)'];
const LOST_COL = { posted: 1, name: 2, email: 3, item: 4, details: 5, status: 6, foundNote: 7, notified: 8, id: 9 };

const STATUSES = ['pending', 'looking', 'found', 'hidden'];
const SKETCHES = ['lamp', 'denim', 'books', 'ceramics', 'glass', 'vinyl', 'teacups', 'chair'];
const LABELS = ['New arrival', 'Restock', 'Featured', 'Just in', 'Weekly drop', 'Handmade', 'Vintage'];
const ZONES = ['window', 'glassware', 'linens', 'furniture', 'donations', 'books', 'clothing', 'counter'];
const CACHE_KEY = 'site-data';

/* ================================================================== */
/* One-time setup: run this once from the Apps Script editor.         */
/* Safe to run again (it keeps your data).                            */
/* ================================================================== */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const finds = sheet_(ss, SHEETS.finds, FIND_HEADERS);
  // (Checkboxes are added row by row as finds are saved; pre-filling them would count as content.)
  finds.getRange(2, FIND_COL.sketch, finds.getMaxRows() - 1, 1).setDataValidation(list_(SKETCHES));
  finds.setColumnWidth(FIND_COL.description, 320);

  const drawer = sheet_(ss, SHEETS.drawer, DRAWER_HEADERS);
  drawer.getRange(2, DRAWER_COL.sketch, drawer.getMaxRows() - 1, 1).setDataValidation(list_(SKETCHES));
  drawer.getRange(2, DRAWER_COL.date, drawer.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
  drawer.setColumnWidth(DRAWER_COL.description, 360);

  const impact = sheet_(ss, SHEETS.impact, ['Total given to St. Jude ($)', 'Updated on', 'Next milestone ($)']);
  if (impact.getLastRow() < 2) impact.getRange(2, 1, 1, 3).setValues([[0, new Date(), 1000]]);
  impact.getRange('A2').setNumberFormat('$#,##0');
  impact.getRange('B2').setNumberFormat('mmmm d, yyyy');
  impact.getRange('C2').setNumberFormat('$#,##0');

  const map = sheet_(ss, SHEETS.map, ['Zone (do not change)', 'Title', 'Description', "This week's corner"]);
  if (map.getLastRow() < 2) {
    map.getRange(2, 1, 8, 4).setValues([
      ['window', 'The Front Window', 'Our little stage on Dunn Road. Whatever is catching the afternoon light this week is usually the first thing to go.', false],
      ['glassware', 'Glassware & Kitchen', 'Vintage glassware, pressed-glass goblets, mixing bowls and the odd treasured casserole dish, sorted by hand one cup at a time.', false],
      ['linens', 'Linens & Textiles', 'Textured linens, quilts, tablecloths and throws, folded and stacked for an unhurried browse.', false],
      ['furniture', 'Furniture & Décor', 'Heirloom wooden pieces, chairs with stories in their joints, lamps and eclectic home accents.', false],
      ['donations', 'Donation Drop-off', 'Bring pre-loved pieces to the back during regular open hours. Every donation gets a dignified second act, and helps us give to St. Jude.', false],
      ['books', 'Books & Records', 'Rare books, well-loved paperbacks and a crate of vinyl worth flipping through twice.', false],
      ['clothing', 'Clothing & Denim', 'Racks of vintage denim, everyday essentials and one-of-a-kind finds, restocked constantly.', false],
      ['counter', 'Checkout & Coffee', 'Pay with cash, card, Cash App or Venmo, and say hello. This is where found treasures wait for their new homes.', false]
    ]);
  }
  map.getRange(2, 4, 8, 1).insertCheckboxes();
  map.setColumnWidth(3, 460);

  const lost = sheet_(ss, SHEETS.lost, LOST_HEADERS);
  lost.getRange(2, LOST_COL.status, lost.getMaxRows() - 1, 1).setDataValidation(list_(STATUSES));
  lost.setColumnWidth(LOST_COL.item, 260);
  lost.setColumnWidth(LOST_COL.details, 320);

  // Edit trigger: refreshes the website and emails shoppers when a card is marked found in the Sheet
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'onSheetEdit'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();

  photoFolder_(); // create the Drive folder now so permission is granted during setup

  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

  if (!PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE')) resetPasscode();
}

/** Makes a new Shoppe Office passcode and emails it to the owner. Run any time to change it. */
function resetPasscode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    if (i === 3 || i === 7) code += '-';
  }
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSCODE', code);
  const owner = ownerEmail_();
  if (owner) {
    MailApp.sendEmail(owner, 'Your Shoppe Office passcode',
      'Here is the passcode for the website\'s Shoppe Office (admin.html):\n\n    ' + code +
      '\n\nKeep it private. To change it, run "resetPasscode" in Apps Script.');
  }
  Logger.log('Shoppe Office passcode: ' + code);
}

function sheet_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#efe6da');
  sh.setFrozenRows(1);
  return sh;
}

function list_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).build();
}

function ownerEmail_() {
  return OWNER_EMAIL || Session.getEffectiveUser().getEmail();
}

/* ================================================================== */
/* Public: the website reads everything here (no private data!)       */
/* ================================================================== */
function doGet() {
  const cache = CacheService.getScriptCache();
  let out = cache.get(CACHE_KEY);
  if (!out) {
    out = JSON.stringify(publicData_());
    try { cache.put(CACHE_KEY, out, 300); } catch (err) { /* too large to cache, serve directly */ }
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function publicData_() {
  return {
    impact: readImpact_(),
    finds: readFinds_().filter(function (f) { return f.show; }).slice(0, MAX_FINDS_ON_SITE)
      .map(function (f) { return { title: f.title, label: f.label, description: f.description, price: f.price, image: f.photo, sketch: f.sketch }; }),
    drawer: readDrawer_().map(function (d) {
      return { date: d.date, title: d.title, era: d.era, description: d.description, price: d.price, sketch: d.sketch, image: d.photo };
    }),
    map: readMap_(),
    // Only approved cards ("looking" or "found"). Email addresses are never included.
    lost: readLost_().filter(function (c) { return c.status === 'looking' || c.status === 'found'; })
      .map(function (c) { return { name: c.name, item: c.item, details: c.details, status: c.status, posted: c.posted, foundNote: c.foundNote }; })
  };
}

function adminData_() {
  return { impact: readImpact_(), finds: readFinds_(), drawer: readDrawer_(), map: readMap_(), lost: readLost_() };
}

/* ---------- Readers ---------- */
function sh_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function rows_(name) {
  const sh = sh_(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

function day_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TIME_ZONE, 'yyyy-MM-dd');
  return String(v || '').trim();
}

function str_(v) { return v == null ? '' : String(v); }

function readImpact_() {
  const r = rows_(SHEETS.impact)[0] || [0, '', 0];
  return { total: Number(r[0]) || 0, asOf: day_(r[1]), nextMilestone: Number(r[2]) || 0 };
}

function readFinds_() {
  function time(r) { const v = r[FIND_COL.added - 1]; return v instanceof Date ? v.getTime() : 0; }
  return rows_(SHEETS.finds)
    .filter(function (r) { return str_(r[FIND_COL.title - 1]).trim(); })
    .sort(function (a, b) { return time(b) - time(a); }) // newest first, to the minute
    .map(function (r) {
      return {
        id: str_(r[FIND_COL.id - 1]), added: day_(r[FIND_COL.added - 1]),
        title: str_(r[FIND_COL.title - 1]), label: str_(r[FIND_COL.label - 1]),
        description: str_(r[FIND_COL.description - 1]), price: str_(r[FIND_COL.price - 1]),
        photo: str_(r[FIND_COL.photo - 1]), sketch: str_(r[FIND_COL.sketch - 1]),
        show: r[FIND_COL.show - 1] === true
      };
    });
}

function readDrawer_() {
  return rows_(SHEETS.drawer)
    .filter(function (r) { return str_(r[DRAWER_COL.title - 1]).trim(); })
    .map(function (r) {
      return {
        id: str_(r[DRAWER_COL.id - 1]), date: day_(r[DRAWER_COL.date - 1]),
        title: str_(r[DRAWER_COL.title - 1]), era: str_(r[DRAWER_COL.era - 1]),
        description: str_(r[DRAWER_COL.description - 1]), price: str_(r[DRAWER_COL.price - 1]),
        sketch: str_(r[DRAWER_COL.sketch - 1]) || 'teacups', photo: str_(r[DRAWER_COL.photo - 1])
      };
    });
}

function readMap_() {
  return rows_(SHEETS.map)
    .filter(function (r) { return str_(r[0]).trim(); })
    .map(function (r) { return { zone: str_(r[0]).trim(), title: str_(r[1]), blurb: str_(r[2]), featured: r[3] === true }; });
}

function readLost_() {
  return rows_(SHEETS.lost)
    .filter(function (r) { return str_(r[LOST_COL.item - 1]).trim(); })
    .map(function (r) {
      return {
        id: str_(r[LOST_COL.id - 1]), posted: day_(r[LOST_COL.posted - 1]),
        name: str_(r[LOST_COL.name - 1]), email: str_(r[LOST_COL.email - 1]),
        item: str_(r[LOST_COL.item - 1]), details: str_(r[LOST_COL.details - 1]),
        status: str_(r[LOST_COL.status - 1]).toLowerCase() || 'pending',
        foundNote: str_(r[LOST_COL.foundNote - 1]), notified: Boolean(r[LOST_COL.notified - 1])
      };
    });
}

/* ================================================================== */
/* POST: public Lost Board cards, and Shoppe Office (admin) actions   */
/* ================================================================== */
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request' }); }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ ok: false, error: 'The shoppe is busy, please try again.' });
  try {
    if (!req.action || req.action === 'lostCard') return json_(postLostCard_(req));

    const auth = checkPasscode_(req.passcode);
    if (auth) return json_({ ok: false, error: auth, auth: true });

    const handler = ADMIN_ACTIONS[req.action];
    if (!handler) return json_({ ok: false, error: 'Unknown action' });
    const result = handler(req) || {};
    if (req.action !== 'adminLoad' && req.action !== 'uploadPhoto') CacheService.getScriptCache().remove(CACHE_KEY);
    return json_(Object.assign({ ok: true }, result));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function checkPasscode_(given) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('admin-fails') || 0);
  if (fails >= 10) return 'Too many wrong passcodes. Please wait 15 minutes and try again.';
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE');
  if (!real) return 'No passcode set yet. Run "setup" in Apps Script.';
  if (String(given || '').trim().toUpperCase() !== real) {
    cache.put('admin-fails', String(fails + 1), 900);
    return 'That passcode doesn\'t match.';
  }
  return '';
}

const ADMIN_ACTIONS = {
  adminLoad: function () { return { data: adminData_() }; },

  saveFind: function (req) {
    const f = req.item || {};
    const title = clean_(f.title, 80);
    if (!title) throw new Error('Please give the find a title.');
    const row = [
      null, safe_(title), safe_(oneOf_(f.label, LABELS, 'New arrival')), safe_(clean_(f.description, 300)),
      safe_(clean_(f.price, 20)), url_(f.photo), oneOf_(f.sketch, SKETCHES, ''), f.show !== false, null
    ];
    upsert_(SHEETS.finds, FIND_COL, f.id, row);
    return { data: adminData_() };
  },

  deleteFind: function (req) { removeById_(SHEETS.finds, FIND_COL.id, req.id); return { data: adminData_() }; },

  saveDrawer: function (req) {
    const d = req.item || {};
    const title = clean_(d.title, 80);
    if (!title) throw new Error('Please give the drawer find a title.');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')) ? d.date : '';
    const row = [
      date, safe_(title), safe_(clean_(d.era, 40)), safe_(clean_(d.description, 240)),
      safe_(clean_(d.price, 20)), oneOf_(d.sketch, SKETCHES, 'teacups'), url_(d.photo), null
    ];
    upsert_(SHEETS.drawer, DRAWER_COL, d.id, row);
    return { data: adminData_() };
  },

  deleteDrawer: function (req) { removeById_(SHEETS.drawer, DRAWER_COL.id, req.id); return { data: adminData_() }; },

  saveImpact: function (req) {
    const total = Math.max(0, Math.round(Number(req.total) || 0));
    const next = Math.max(0, Math.round(Number(req.nextMilestone) || 0));
    const sh = sh_(SHEETS.impact);
    sh.getRange(2, 1, 1, 3).setValues([[total, new Date(), next]]);
    return { data: adminData_() };
  },

  saveMap: function (req) {
    const sh = sh_(SHEETS.map);
    const zones = Array.isArray(req.zones) ? req.zones : [];
    const rows = rows_(SHEETS.map);
    zones.forEach(function (z) {
      const i = rows.findIndex(function (r) { return str_(r[0]).trim() === z.zone; });
      if (i < 0 || ZONES.indexOf(z.zone) < 0) return;
      sh.getRange(i + 2, 2, 1, 3).setValues([[safe_(clean_(z.title, 60)), safe_(clean_(z.blurb, 300)), z.featured === true]]);
    });
    return { data: adminData_() };
  },

  setLostStatus: function (req) {
    const status = oneOf_(req.status, STATUSES, '');
    if (!status) throw new Error('Unknown status');
    const sh = sh_(SHEETS.lost);
    const row = rowById_(sh, LOST_COL.id, req.id);
    if (!row) throw new Error('That card no longer exists.');
    sh.getRange(row, LOST_COL.status).setValue(status);
    if (req.foundNote != null) sh.getRange(row, LOST_COL.foundNote).setValue(safe_(clean_(req.foundNote, 120)));
    if (status === 'found') notifyFound_(sh, row);
    return { data: adminData_() };
  },

  deleteLost: function (req) { removeById_(SHEETS.lost, LOST_COL.id, req.id); return { data: adminData_() }; },

  uploadPhoto: function (req) {
    const mime = String(req.mimeType || '');
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new Error('Please choose a JPG, PNG or WebP photo.');
    const bytes = Utilities.base64Decode(String(req.data || ''));
    if (bytes.length > 8 * 1024 * 1024) throw new Error('That photo is too large (8 MB max).');
    const name = clean_(req.name, 60).replace(/[^\w.\- ]/g, '') || 'photo';
    const file = photoFolder_().createFile(Utilities.newBlob(bytes, mime, Date.now() + '-' + name));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600' };
  }
};

/* ---------- Row helpers ---------- */
function newId_() { return Utilities.getUuid().slice(0, 8); }

function rowById_(sh, idCol, id) {
  if (!id || sh.getLastRow() < 2) return 0;
  const ids = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

// Insert a new row, or update the row with this id. Keeps the original "Added" date on updates.
function upsert_(sheetName, cols, id, row) {
  const sh = sh_(sheetName);
  const existing = rowById_(sh, cols.id, id);
  if (existing) {
    row[cols.id - 1] = id;
    if (cols.added) row[cols.added - 1] = sh.getRange(existing, cols.added).getValue() || new Date();
    sh.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    row[cols.id - 1] = newId_();
    if (cols.added) row[cols.added - 1] = new Date();
    sh.appendRow(row);
    if (cols.show) sh.getRange(sh.getLastRow(), cols.show).insertCheckboxes().setValue(row[cols.show - 1]);
  }
}

function removeById_(sheetName, idCol, id) {
  const sh = sh_(sheetName);
  const row = rowById_(sh, idCol, id);
  if (row) sh.deleteRow(row);
}

function photoFolder_() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}

/* ---------- Public Lost Board submission ---------- */
function postLostCard_(card) {
  if (card.website) return { ok: true }; // honeypot: bots fill the hidden field

  const firstName = clean_(card.firstName, 30);
  const lastInitial = clean_(card.lastInitial, 1).toUpperCase();
  const email = clean_(card.email, 120);
  const item = clean_(card.item, 80);
  const details = clean_(card.details, 240);
  if (!firstName || !item) return { ok: false, error: 'Please add your name and what you are looking for.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please check your email address.' };

  const sh = sh_(SHEETS.lost);
  if (!sh) return { ok: false, error: 'Board not set up yet.' };

  // Gentle rate limit: at most 5 cards per email per day
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const recent = rows_(SHEETS.lost).filter(function (r) {
    return String(r[LOST_COL.email - 1]).toLowerCase() === email.toLowerCase() &&
           r[LOST_COL.posted - 1] instanceof Date && r[LOST_COL.posted - 1].getTime() > dayAgo;
  }).length;
  if (recent >= 5) return { ok: false, error: 'You have pinned several cards today. Please try again tomorrow.' };

  const name = firstName + (/^[A-Z]$/.test(lastInitial) ? ' ' + lastInitial + '.' : '');
  sh.appendRow([new Date(), safe_(name), safe_(email), safe_(item), safe_(details), 'pending', '', '', newId_()]);

  const owner = ownerEmail_();
  if (owner) {
    MailApp.sendEmail(owner, 'New Lost & Found card: ' + item,
      name + ' is looking for: ' + item + (details ? '\n\nDetails: ' + details : '') +
      '\n\nApprove it in the Shoppe Office (admin.html) under "Lost Board", or in the "' + SHEETS.lost +
      '" tab by changing Status from "pending" to "looking".');
  }
  return { ok: true };
}

/* ---------- Text safety ---------- */
function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Stop text from being treated as a spreadsheet formula
function safe_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function oneOf_(v, allowed, fallback) {
  return allowed.indexOf(v) >= 0 ? v : fallback;
}

function url_(v) {
  const s = String(v || '').trim();
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s.slice(0, 500) : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ================================================================== */
/* Edits made directly in the Sheet                                   */
/* ================================================================== */
function onSheetEdit(e) {
  CacheService.getScriptCache().remove(CACHE_KEY);
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEETS.lost) return;
  if (e.range.getColumn() > LOST_COL.status || e.range.getLastColumn() < LOST_COL.status) return;
  for (let row = Math.max(2, e.range.getRow()); row <= e.range.getLastRow(); row++) {
    if (!sh.getRange(row, LOST_COL.id).getValue()) sh.getRange(row, LOST_COL.id).setValue(newId_());
    notifyFound_(sh, row);
  }
}

// Emails the shopper once, the first time their card is marked found
function notifyFound_(sh, row) {
  const r = sh.getRange(row, 1, 1, LOST_HEADERS.length).getValues()[0];
  const status = String(r[LOST_COL.status - 1]).toLowerCase();
  const email = String(r[LOST_COL.email - 1]).trim();
  if (status !== 'found' || r[LOST_COL.notified - 1] || !email) return;

  const first = String(r[LOST_COL.name - 1]).split(' ')[0];
  const item = String(r[LOST_COL.item - 1]);
  const note = String(r[LOST_COL.foundNote - 1]).trim();
  MailApp.sendEmail({
    to: email,
    subject: 'We found it! ' + item,
    name: SHOP_NAME,
    body: 'Hi ' + first + ',\n\nGood news from ' + SHOP_NAME + ': something matching your Lost & Found card just came through our doors.\n\n' +
      '    ' + item + '\n' + (note ? '    ' + note + '\n' : '') +
      '\nFinds go quickly, so come see it soon:\n' + SHOP_ADDRESS + ' (look for the blue awning)\n' + SHOP_HOURS +
      '\n\nCurated with care. Given with purpose.\n' + SHOP_NAME
  });
  sh.getRange(row, LOST_COL.notified).setValue(new Date());
}
