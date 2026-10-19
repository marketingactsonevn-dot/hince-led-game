/* Local storage layer — every access is wrapped so storage errors never crash the kiosk. */
(function () {
  'use strict';
  var K = { settings: 'hince_led_settings_v1', records: 'hince_led_records_v1', stock: 'hince_led_stock_v1', gifts: 'hince_led_gifts_v27', counter: 'hince_led_counter_v1', logs: 'hince_led_logs_v1' };
  // stock: v2.6 daily stock {date, tier1, tier2} (read once to migrate, then removed); gifts: v2.7 event stock {hairTie, mirror, mini, full}
  var memory = {}; // fallback if localStorage is unavailable

  function read(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      if (v === null || v === undefined) return memory[key] !== undefined ? memory[key] : fallback;
      return JSON.parse(v);
    } catch (e) { return memory[key] !== undefined ? memory[key] : fallback; }
  }
  function write(key, value) {
    memory[key] = value;
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { log('storage write failed: ' + key + ' ' + e.message); return false; }
  }
  function deepMerge(base, over) {
    var out = Array.isArray(base) ? base.slice() : {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (over && typeof over === 'object') Object.keys(over).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') out[k] = deepMerge(base[k], over[k]);
      else if (over[k] !== undefined) out[k] = over[k];
    });
    return out;
  }
  function log(msg) {
    try {
      var logs = JSON.parse(window.localStorage.getItem(K.logs) || '[]');
      logs.push(new Date().toISOString() + ' ' + msg);
      if (logs.length > 500) logs = logs.slice(-500);
      window.localStorage.setItem(K.logs, JSON.stringify(logs));
    } catch (e) { /* ignore */ }
  }

  // v2.3: src/config.local.js (optional) may fill these over DEFAULTS (non-empty strings only); a value saved in Admin wins.
  var LOCAL_KEYS = ['sheetUrl', 'sheetToken', 'kioskName'];
  function base() {
    var d = deepMerge(window.DEFAULTS, {}), L = window.LOCAL_CONFIG || {};
    LOCAL_KEYS.forEach(function (k) { if (typeof L[k] === 'string' && L[k].trim()) d[k] = L[k].trim(); });
    return d;
  }

  // v2.7: settings saved by v2.6 carry per-game % thresholds {umpah:{tier1,tier2}…}, dailyStock and tier1/tier2 gift names;
  // they are dropped once (the v2.7 defaults apply: 70 / 90, the four gift names). Other saved settings are kept.
  function migrate(saved) {
    if (!saved || typeof saved !== 'object') return saved;
    var ch = false, th = saved.thresholds;
    if (th && (typeof th.mid !== 'number' || typeof th.high !== 'number')) { delete saved.thresholds; ch = true; }
    if (saved.dailyStock) { delete saved.dailyStock; ch = true; }
    if (saved.gifts && ('tier1' in saved.gifts || 'tier2' in saved.gifts)) { delete saved.gifts; delete saved.giftsEn; ch = true; }
    if (ch) { write(K.settings, saved); log('settings migrated to v2.7 (thresholds 70/90, gift names)'); }
    return saved;
  }
  var GK = ['hairTie', 'mirror', 'mini', 'full'];

  var Store = {
    settings: function () { var o = deepMerge(base(), migrate(read(K.settings, {}))); o.appVersion = window.DEFAULTS.appVersion; return o; }, // version follows the code, never a stale saved value
    saveSettings: function (s) {
      // persist the whole object, except LOCAL_KEYS still equal to config.local.js/defaults (so a later config.local.js edit applies)
      var b = base(), o = {};
      Object.keys(s).forEach(function (k) { if (LOCAL_KEYS.indexOf(k) < 0 || s[k] !== b[k]) o[k] = s[k]; });
      return write(K.settings, o);
    },
    records: function () { var r = read(K.records, []); return Array.isArray(r) ? r : []; },
    addRecord: function (rec) {
      var all = Store.records(); all.push(rec);
      if (!write(K.records, all)) throw new Error(window.I18N ? I18N.t('store.err') : 'storage write failed');
      return rec;
    },
    updateRecord: function (id, patch) {
      var all = Store.records(), found = false;
      all.forEach(function (r) { if (r.id === id) { Object.keys(patch).forEach(function (k) { r[k] = patch[k]; }); found = true; } });
      if (found) write(K.records, all);
      return found;
    },
    clearRecords: function () { write(K.records, []); write(K.counter, {}); log('records cleared'); },
    // v2.3 Control Center "xoá lượt test": drops only testMode records (real records, stock, counters untouched)
    clearTestRecords: function () { var all = Store.records(), keep = all.filter(function (r) { return !r.testMode; }); write(K.records, keep); log('test records cleared ' + (all.length - keep.length)); return all.length - keep.length; },

    // v2.7 event gift stock {hairTie, mirror, mini, full}: no daily refill. First run of v2.7 (also on a v2.6 kiosk that has
    // {date, tier1, tier2}): starts from DEFAULTS.giftStock, the old counts are not carried over.
    giftStock: function () {
      var g = read(K.gifts, null), d = window.DEFAULTS.giftStock, o = {};
      if (!g || typeof g !== 'object') {
        var old = read(K.stock, null);
        g = {}; GK.forEach(function (k) { g[k] = d[k]; });
        write(K.gifts, g);
        if (old) { try { window.localStorage.removeItem(K.stock); } catch (e) { } delete memory[K.stock]; log('stock migrated v2.6 ' + JSON.stringify(old) + ' -> v2.7 ' + JSON.stringify(g)); }
      }
      GK.forEach(function (k) { o[k] = Math.max(0, (g[k] | 0)); });
      return o;
    },
    setGiftStock: function (k, n) { var g = Store.giftStock(); if (GK.indexOf(k) < 0) return g; g[k] = Math.max(0, n | 0); write(K.gifts, g); return g; },
    takeGift: function (k) { var g = Store.giftStock(); if (g[k] > 0) { g[k]--; write(K.gifts, g); } return g; },

    nextCode: function (prefix) {
      var today = Logic.localDate(), c = read(K.counter, {});
      if (c.date !== today) c = { date: today, n: 0 };
      c.n++; write(K.counter, c);
      var n = String(c.n); while (n.length < 4) n = '0' + n;
      return prefix + '-' + n;
    },
    logs: function () { return read(K.logs, []); },
    log: log
  };
  window.Store = Store;
})();
