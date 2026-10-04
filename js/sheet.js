/* hince LED Game — v2.3 Google Sheet sync (offline-first). The ONLY file that talks to the network.
 * Records are saved by Store first; their ids wait in a localStorage queue and are sent in the background
 * to the Apps Script web app of tools/google_sheet/Code.gs (contract in its header). Every public function
 * swallows its own errors: the game never sees a throw, a wait or an error message from here.
 *
 * window.Sheet:
 *   enqueue(id)   queue a record id (new record or an update, e.g. redeemed = upsert); test-mode records are never queued
 *   sendNow(cb)   send the queue now (GỬI NGAY); cb(status()) when this round is over
 *   status()      { configured, mode, waiting, sentToday, sentTotal, lastOkAt, lastError, ok, text }
 *   ping(cb)      KIỂM TRA: cb({ ok:true, rows, text }) or cb({ ok:false, text })
 *   _setTimingForTest({ first, every, confirm, timeout, jsonp })  tests only (ms); also unlocks a http://127.0.0.1|localhost mock URL
 */
(function () {
  'use strict';
  var QK = 'hince_led_sheetq_v1', SK = 'hince_led_sheetst_v1', BATCH = 20;
  var T = { first: 2000, every: 30000, confirm: 3000, timeout: 12000, jsonp: 10000 };
  var GOOGLE = /^https:\/\/script\.google\.com\//, MOCK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, allowMock = false; // MOCK = local test server, only after _setTimingForTest
  // v2.4: errors are kept as i18n keys ('sheet.*', or 'g:' + Google's text) and translated when shown; older stored plain text shows as is
  var E_NET = 'sheet.net', E_TOKEN = 'sheet.token', E_URL = 'sheet.url', E_SAVE = 'sheet.notSaved';
  function L(k, v) { return window.I18N ? I18N.t(k, v) : k; } // (T is the timing table)
  function tr(e) { return !e ? '' : e.indexOf('sheet.') === 0 ? L(e) : e.indexOf('g:') === 0 ? L('sheet.gerr', { e: e.slice(2) }) : e; }
  var busy = false, want = false, inFlight = {}, again = {}, soon = 0, iv = 0, cbN = 0, jsonpBase = '', jsonpPending = 0, waiters = [];

  function get(k, d) { try { var v = JSON.parse(window.localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function log(m) { try { Store.log('sheet: ' + m); } catch (e) { } }
  function queue() { var q = get(QK, []); return Array.isArray(q) ? q : []; }
  function stats() {
    var s = get(SK, {}), today = Logic.localDate();
    if (s.day !== today) { s.day = today; s.sentToday = 0; }
    return s;
  }
  function conf() {
    var s = Store.settings();
    return { url: String(s.sheetUrl || '').trim(), token: String(s.sheetToken || '').trim(), on: s.sheetSync !== false };
  }
  function usable(c) { return !!(c.on && c.token && (GOOGLE.test(c.url) || (allowMock && MOCK.test(c.url)))); }
  function gErr(j) { return j && j.error === 'token' ? E_TOKEN : 'g:' + String(j && j.error || '?').slice(0, 80); }

  // ---- transport ----
  // POST the batch; cb(err, json). nocors: opaque response, cb(null, null) once the request went through.
  function post(c, body, nocors, cb) {
    var done = false, ac = null, t = 0;
    function fin(e, j) { if (done) return; done = true; clearTimeout(t); try { cb(e, j); } catch (x) { log('cb ' + x.message); } }
    try {
      try { ac = window.AbortController ? new AbortController() : null; } catch (e) { ac = null; }
      t = setTimeout(function () { try { if (ac) ac.abort(); } catch (e) { } fin('timeout'); }, T.timeout); // no AbortController: the timer alone
      var o = { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
      if (nocors) o.mode = 'no-cors';
      if (ac) o.signal = ac.signal;
      window.fetch(c.url, o).then(function (res) { return nocors ? null : res.json(); })
        .then(function (j) { fin(null, j); }, function (e) { fin(e || 'fail'); });
    } catch (e) { fin(e); }
  }
  // JSONP GET (?token&<q>&callback=…); cb(json) or cb(null) on network error / timeout / not-JSONP answer
  function jsonp(c, q, cb) {
    var name = '__hinceSheetCb' + (++cbN), s = null, done = false, settled = false, t = 0;
    function fin(j) {
      if (done) return; done = true; clearTimeout(t);
      window[name] = function () { }; // a late answer must still find a function
      try { cb(j); } catch (x) { log('cb ' + x.message); }
    }
    // the <script> has run or failed: only now drop the error guard and clean up (a removed script that is loading still runs)
    function settle() {
      fin(null); // first: fin() parks a no-op under the name, deleted right below
      if (!settled) { settled = true; jsonpPending--; try { delete window[name]; } catch (e) { } try { if (s && s.parentNode) s.parentNode.removeChild(s); } catch (e) { } }
    }
    jsonpPending++;
    try {
      window[name] = function (j) { fin(j || {}); };
      s = document.createElement('script');
      s.onerror = settle;
      s.onload = function () { setTimeout(settle, 0); }; // ran without calling back: not a JSONP answer
      t = setTimeout(function () { fin(null); }, T.jsonp); // ends the round; the <script> + guard stay until it settles
      jsonpBase = c.url.split('?')[0];
      s.src = c.url + (c.url.indexOf('?') < 0 ? '?' : '&') + 'token=' + encodeURIComponent(c.token) + '&' + q + '&callback=' + name;
      document.head.appendChild(s);
    } catch (e) { settle(); }
  }
  // a JSONP answer that is not JavaScript (HTML login page, JSON…) throws a global error; keep it away from app.js onError → App.home()
  window.addEventListener('error', function (ev) {
    try {
      if (!jsonpPending || ev.target !== window) return;
      var f = ev.filename || '';
      if (!f || (jsonpBase && f.indexOf(jsonpBase) === 0)) { ev.stopImmediatePropagation(); ev.preventDefault(); log('jsonp answer was not JavaScript'); }
    } catch (e) { }
  }, true);

  // ---- sender ----
  function row(r) { var o = {}; Logic.CSV_COLS.forEach(function (k) { o[k] = r[k] === undefined ? '' : r[k]; }); return o; }
  function finish(saved, err, mode) {
    var n = 0; // ids of this batch really dropped from the queue
    try {
      var s = stats(), drop = {}, prev = s.lastError || '';
      (saved || []).forEach(function (id) { if (inFlight[id] && !again[id]) { drop[id] = 1; n++; } });
      if (n) put(QK, queue().filter(function (id) { return !drop[id]; }));
      if (n) { s.sentToday = (s.sentToday || 0) + n; s.sentTotal = (s.sentTotal || 0) + n; s.lastOkAt = new Date().toISOString(); s.lastError = ''; }
      if (mode) s.mode = mode;
      // log changes only (Store.log keeps 500 lines): an outage once, its recovery once, normal sends never
      if (err) { s.lastError = err; if (err !== prev) log(tr(err)); }
      else if (n && prev) log('sent ' + n + ' (' + (mode || s.mode || 'cors') + ') after: ' + tr(prev));
      put(SK, s);
    } catch (e) { }
    busy = false; inFlight = {}; again = {};
    // next batch (one request at a time), or one fresh round for a GỬI NGAY pressed while this one was on the way
    if ((!err && n && queue().length) || want) { want = false; return send(); }
    var w = waiters; waiters = [];
    w.forEach(function (cb) { try { cb(api.status()); } catch (e) { } });
  }
  function send() {
    if (busy) return;
    var c = conf(), q = queue();
    if (!usable(c) || !q.length) return finish(null, null);
    var by = {}; Store.records().forEach(function (r) { by[r.id] = r; });
    var keep = q.filter(function (id) { return by[id] && !by[id].testMode; }); // deleted / test records leave the queue
    if (keep.length !== q.length) put(QK, keep);
    var ids = keep.slice(0, BATCH);
    if (!ids.length) return finish(null, null);
    busy = true; ids.forEach(function (id) { inFlight[id] = 1; });
    var body = JSON.stringify({ token: c.token, records: ids.map(function (id) { return row(by[id]); }) });
    if (stats().mode === 'nocors') return viaNoCors(c, ids, body);
    post(c, body, false, function (e, j) {
      if (!e && j && j.ok) return finish(j.saved || [], null, 'cors');
      if (!e && j) return finish(null, gErr(j));
      if (e === 'timeout') return finish(null, E_NET);
      viaNoCors(c, ids, body); // could not read the answer (CORS from file://, opaque, not JSON): no-cors + JSONP confirm
    });
  }
  function viaNoCors(c, ids, body) {
    post(c, body, true, function (e) {
      if (e) return finish(null, E_NET);
      setTimeout(function () {
        jsonp(c, 'action=has&ids=' + ids.map(encodeURIComponent).join(','), function (j) {
          if (!j) return finish(null, E_NET);
          if (!j.ok) return finish(null, gErr(j));
          var has = Array.isArray(j.has) ? j.has : [];
          if (!has.length) return finish(null, E_SAVE); // the opaque POST failed on Google's side (lock timeout, quota…)
          finish(has, null, 'nocors');
        });
      }, T.confirm);
    });
  }
  function later(ms) { clearTimeout(soon); soon = setTimeout(function () { try { send(); } catch (e) { busy = false; } }, ms); }
  function arm() { clearInterval(iv); iv = setInterval(function () { try { if (queue().length) send(); } catch (e) { } }, T.every); }

  var api = {
    enqueue: function (id) {
      try {
        var r = null; Store.records().forEach(function (x) { if (x.id === id) r = x; });
        if (!r || r.testMode) return;
        var q = queue();
        if (q.indexOf(id) < 0) { q.push(id); put(QK, q); }
        if (inFlight[id]) { again[id] = 1; want = true; } // changed while its batch is on the way: send it again right after
        later(T.first);
      } catch (e) { log('enqueue ' + e.message); }
    },
    sendNow: function (cb) {
      try { if (typeof cb === 'function') waiters.push(cb); if (busy) want = true; else send(); } catch (e) { busy = false; }
    },
    status: function () {
      try {
        var s = stats(), on = usable(conf()), waiting = queue().length, err = on ? s.lastError || '' : E_URL, last = '';
        if (s.lastOkAt) { // last success time (HH:MM, + d/m when not today)
          var d = new Date(s.lastOkAt), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
          last = ' · ' + L('sheet.last', { t: (d.toDateString() === new Date().toDateString() ? '' : d.getDate() + '/' + (d.getMonth() + 1) + ' ') + p2(d.getHours()) + ':' + p2(d.getMinutes()) });
        }
        return {
          configured: on, mode: s.mode || 'cors', waiting: waiting, sentToday: s.sentToday || 0, sentTotal: s.sentTotal || 0,
          lastOkAt: s.lastOkAt || '', lastError: tr(err), ok: on && !err,
          text: err ? tr(err) + last + (waiting ? ' · ' + L('sheet.waiting', { n: waiting }) : '') : L('sheet.sent', { d: s.sentToday || 0, t: s.sentTotal || 0 }) + last + ' · ' + L('sheet.waiting', { n: waiting })
        };
      } catch (e) { return { configured: false, mode: 'cors', waiting: 0, sentToday: 0, sentTotal: 0, lastOkAt: '', lastError: tr(E_URL), ok: false, text: tr(E_URL) }; }
    },
    ping: function (cb) {
      function out(o) { try { if (typeof cb === 'function') cb(o); } catch (e) { } }
      try {
        var c = conf();
        if (!usable(c)) return out({ ok: false, text: tr(E_URL) });
        jsonp(c, 'action=ping', function (j) {
          if (!j) return out({ ok: false, text: tr(E_NET) });
          if (!j.ok) return out({ ok: false, text: tr(gErr(j)) });
          try { var st = stats(); st.lastError = ''; put(SK, st); } catch (e) { } // link + token proven good; the catch-up round below reports anew
          out({ ok: true, rows: j.rows, text: L('sheet.connected', { n: j.rows | 0 }) });
          if (queue().length) send();
        });
      } catch (e) { out({ ok: false, text: tr(E_NET) }); }
    },
    _setTimingForTest: function (o) {
      allowMock = true;
      try { Object.keys(o || {}).forEach(function (k) { if (T[k] && o[k] >= 10) T[k] = o[k]; }); arm(); } catch (e) { }
    }
  };
  window.Sheet = api;

  try {
    window.addEventListener('online', function () { try { send(); } catch (e) { busy = false; } });
    arm(); later(T.first); // boot
  } catch (e) { }
})();
