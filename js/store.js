/* Local storage layer — every access is wrapped so storage errors never crash the kiosk. */
(function () {
  'use strict';
  var K = { settings: 'hince_led_settings_v1', records: 'hince_led_records_v1', stock: 'hince_led_stock_v1', counter: 'hince_led_counter_v1', logs: 'hince_led_logs_v1' };
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

  var Store = {
    settings: function () { var o = deepMerge(base(), read(K.settings, {})); o.appVersion = window.DEFAULTS.appVersion; return o; }, // version follows the code, never a stale saved value
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

    // stock for today; auto refills to daily default when the date changes
    stock: function () {
      var today = Logic.localDate(), s = read(K.stock, null), def = Store.settings().dailyStock;
      if (!s || s.date !== today) { s = { date: today, tier1: def.tier1, tier2: def.tier2 }; write(K.stock, s); }
      return s;
    },
    setStock: function (t1, t2) { var s = Store.stock(); s.tier1 = Math.max(0, t1 | 0); s.tier2 = Math.max(0, t2 | 0); write(K.stock, s); return s; },
    takeStock: function (tier) { var s = Store.stock(); var k = 'tier' + tier; if (s[k] > 0) s[k]--; write(K.stock, s); return s; },

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
