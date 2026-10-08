/* v2.3 Control Center (replaces the v2.2 Admin panel). Ways in: ATTRACT ⚙ (#cc-btn) or the 3 s top-left hotspot, then PIN.
   Full-screen window CONTROL.EXE in #o-admin; #admin-panel is the scroll container (app.js allowScroll: .admin-panel).
   Every v2.2 Admin function is kept (production/tasks/v23/admin_checklist.md). Changes save at once (Store + App.applySettings). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var CLOSE_MS = 120000; // auto-close after 2 min without a touch → ATTRACT
  var ov, panel, mode = 'pin', pin = '', newPin = '', msg = '', closeTimer = 0, arm = '', armTimer = 0, back = 0;
  var DIFF = ['easy', 'normal', 'hard']; // labels: I18N cc.easy / cc.normal / cc.hard
  function T(k, v) { return I18N.t(k, v); } // v2.4: the Control Center follows the current language
  var PIC = { // row image: packshots (no filter); v2.6: Um-Pah! 1 = the Nu Rose packshot of its card backs (no 8-bit tube)
    umpah: '<img src="assets/img/products/nu_blur_tint/06_nu_rose.png" style="transform:rotate(-14deg)" alt="">',
    umpah2: '<img src="assets/img/products/nu_blur_tint/06_nu_rose.png" alt="">',
    taptap: '<img src="assets/img/products/radiance_balm/shelly_pink.png" alt="">',
    taptap2: '<img src="assets/img/products/radiance_balm/gleaming.png" alt="">'
  };
  var BKSP = '<svg viewBox="0 0 12 9"><path d="M3 0h9v9H3V8H2V7H1V6H0V3h1V2h1V1h1zM5 2v1h1v1h1v1H6v1H5v1h1V6h1V5h1v1h1v1h1V6H9V5H8V4h1V3h1V2H9v1H8v1H7V3H6V2z"/></svg>';
  var EYE = '<svg viewBox="0 0 13 8"><path d="M4 0h5v1H4zM2 1h2v1H2zM9 1h2v1H9zM1 2h1v1H1zM11 2h1v1h-1zM5 2h3v1H5zM0 3h1v2H0zM12 3h1v2h-1zM4 3h5v2H4zM1 5h1v1H1zM11 5h1v1h-1zM5 5h3v1H5zM2 6h2v1H2zM9 6h2v1H9zM4 7h5v1H4z"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function S() { return Store.settings(); }
  function store(mut) { var s = S(); mut(s); Store.saveSettings(s); App.applySettings(); }
  function save(mut) { store(mut); render(); }

  function download(name, text, type) {
    try {
      var blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
    } catch (e) { Store.log('download failed ' + e.message); }
  }
  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return Logic.localDate(d).replace(/-/g, '') + '_' + p(d.getHours()) + p(d.getMinutes()); }

  // the screen underneath stops (.active first: App.home skips its auto-reload while the CC is open); re-entry (keyboard) is ignored
  function open() { if (ov.classList.contains('active')) return; mode = 'pin'; pin = ''; msg = ''; arm = ''; ov.classList.add('active'); if (App.screen !== 'attract') App.home(); renderPin(); armClose(); }
  function close() { var f = document.activeElement; if (f && ov.contains(f)) f.blur(); ov.classList.remove('active'); clearTimeout(closeTimer); clearTimeout(armTimer); arm = ''; mode = 'pin'; App.home(); }
  function armClose() { clearTimeout(closeTimer); if (ov.classList.contains('active')) closeTimer = setTimeout(close, CLOSE_MS); }

  // ---------- PIN pad (open, and đổi PIN: 4 digits entered twice) ----------
  function renderPin() {
    ov.classList.add('pin');
    var t = T(mode === 'new1' ? 'cc.pinNew1' : mode === 'new2' ? 'cc.pinNew2' : 'cc.pinEnter');
    var n = Math.max(pin.length, mode === 'pin' ? String(S().adminPin).length : 4), dots = '';
    for (var i = 0; i < n; i++) dots += '<i' + (i < pin.length ? ' class="on"' : '') + '></i>';
    var h = '<div class="cc-pin"><div class="cc-pin-t">' + t + '</div><div class="pin-dots">' + dots + '</div><div class="cc-msg">' + esc(msg) + '</div><div class="pinpad">';
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'X', '0', '⌫'].forEach(function (k) {
      h += '<button class="cc-key' + (k === 'X' ? ' vn' : '') + '" data-pin="' + k + '">' + (k === 'X' ? T(mode === 'pin' ? 'cc.exit' : 'cc.cancel') : k === '⌫' ? BKSP : k) + '</button>';
    });
    panel.innerHTML = h + '</div></div>';
    panel.scrollTop = 0;
  }
  function onPin(k) {
    if (k === 'X') { if (mode === 'pin') return close(); mode = 'panel'; msg = ''; render(); panel.scrollTop = back; return; }
    if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 8) pin += k;
    var P = String(S().adminPin);
    if (mode === 'pin') {
      if (pin === P) { mode = 'panel'; pin = ''; msg = ''; render(); return; }
      if (pin.length >= P.length) { pin = ''; msg = T('cc.pinWrong'); } else msg = '';
    } else if (pin.length === 4) {
      if (mode === 'new1') { newPin = pin; pin = ''; mode = 'new2'; msg = ''; }
      else if (pin === newPin) { var np = newPin; pin = newPin = ''; mode = 'panel'; msg = T('cc.pinChanged'); save(function (s) { s.adminPin = np; }); panel.scrollTop = back; return; }
      else { pin = newPin = ''; mode = 'new1'; msg = T('cc.pinMismatch'); }
    }
    renderPin();
  }

  // ---------- panel building blocks ----------
  function sec(title, body) { return '<section class="cc-sec"><h3>' + title + '</h3>' + body + '</section>'; }
  function box(rows) { return '<div class="cc-box">' + rows + '</div>'; }
  function row(label, right, cls) { return '<div class="cc-row' + (cls ? ' ' + cls : '') + '"><div class="lbl">' + label + '</div><div class="cc-r">' + (right || '') + '</div></div>'; }
  function tg(on, attr) { return '<button class="cc-tg' + (on ? '' : ' off') + '" ' + attr + '>' + T(on ? 'cc.on' : 'cc.off') + '</button>'; }
  function btn(a, label, cls) { return '<button class="btn vn cc-mb' + (cls ? ' ' + cls : '') + '" data-a="' + a + '">' + label + '</button>'; }
  function stp(key, value, deltas) {
    var one = deltas.length === 2, b = function (d) { return '<button class="cc-st" data-step="' + key + '" data-d="' + d + '">' + (one ? (d < 0 ? '-' : '+') : (d < 0 ? d : '+' + d)) + '</button>'; };
    return '<div class="cc-stp' + (one ? ' one' : '') + '">' + deltas.filter(function (d) { return d < 0; }).map(b).join('') + '<span class="v">' + value + '</span>' + deltas.filter(function (d) { return d > 0; }).map(b).join('') + '</div>';
  }
  // ≈ points needed for a threshold at the game's current difficulty (only Tap-Tap! 1's max depends on it: registry maxBy)
  function pts(g, v, d) { var G = App.GAME[g], m = (G.maxBy || {})[d] || G.max; return Math.ceil(v * m / 100); }

  function render() {
    if (mode !== 'panel') { renderPin(); return; }
    ov.classList.remove('pin');
    var keep = panel.scrollTop;
    var s = S(), st = Store.stock(), recs = Store.records(), today = Logic.localDate(), G = App.GAME, order = App.GAME_ORDER;
    var real = recs.filter(function (r) { return !r.testMode; }), tests = recs.length - real.length;
    var todayR = real.filter(function (r) { return r.date === today; });
    var cnt = function (arr, f) { return arr.filter(f).length; };
    var pending = todayR.filter(function (r) { return r.tier > 0 && !r.redeemed; });
    var diff = s.difficulty || {}, h = '';

    // 1 HÔM NAY
    h += sec(T('cc.today') + ' · ' + today, '<div class="cc-stat">' +
      '<div><b>' + todayR.length + '</b><span>' + T('cc.plays') + '</span></div>' +
      '<div><b>' + cnt(todayR, function (r) { return r.tier === 1; }) + '</b><span>' + T('cc.giftsGiven', { n: 1, left: st.tier1 }) + '</span></div>' +
      '<div><b>' + cnt(todayR, function (r) { return r.tier === 2; }) + '</b><span>' + T('cc.giftsGiven', { n: 2, left: st.tier2 }) + '</span></div></div>');

    // 2 GAME · ĐỘ KHÓ (applies from the next game; the last playable game cannot be switched off)
    h += sec(T('cc.games'), box(order.map(function (g) {
      var on = !!s.games[g], d = diff[g] || 'normal';
      return '<div class="cc-row g"><div class="lbl">' + PIC[g] + G[g].name + '</div><div class="cc-seg">' +
        DIFF.map(function (o) { return '<button data-g="' + g + '" data-diff="' + o + '"' + (d === o ? ' class="on"' : '') + '>' + T('cc.' + o) + '</button>'; }).join('') +
        '</div>' + tg(on, 'data-game-toggle="' + g + '"') + '</div>';
    }).join('') + row(T('cc.intro'), tg(s.productIntro !== false, 'data-toggle="productIntro"'), 'intro')) + '<p class="cc-note">' + T('cc.gamesNote') + '</p>');

    // 3 QUÀ
    var q = '';
    order.forEach(function (g) {
      [1, 2].forEach(function (n) {
        var v = s.thresholds[g]['tier' + n];
        q += row(G[g].name + ' · ' + T('cc.level', { n: n }) + ' <span class="cc-pts" data-pts="' + g + '_' + n + '">' + T('cc.pts', { n: pts(g, v, diff[g]) }) + '</span>', stp('th_' + g + '_' + n, v + '%', [-5, -1, 1, 5]));
      });
    });
    q += row(T('cc.stockToday', { n: 1 }), stp('stock1', st.tier1, [-10, -1, 1, 10]));
    q += row(T('cc.stockToday', { n: 2 }), stp('stock2', st.tier2, [-10, -1, 1, 10]));
    q += row(T('cc.daily', { n: 1 }), stp('daily1', s.dailyStock.tier1, [-10, -1, 1, 10]));
    q += row(T('cc.daily', { n: 2 }), stp('daily2', s.dailyStock.tier2, [-10, -1, 1, 10]));
    var ge = s.giftsEn || {};
    q += row(T('cc.giftName', { n: 1 }), '<input class="cc-in" id="a-g1" maxlength="60" autocomplete="off" value="' + esc(s.gifts.tier1) + '">', 'f');
    q += row(T('cc.giftNameEn', { n: 1 }), '<input class="cc-in" id="a-g1en" maxlength="60" autocomplete="off" value="' + esc(ge.tier1) + '">', 'f');
    q += row(T('cc.giftName', { n: 2 }), '<input class="cc-in" id="a-g2" maxlength="60" autocomplete="off" value="' + esc(s.gifts.tier2) + '">', 'f');
    q += row(T('cc.giftNameEn', { n: 2 }), '<input class="cc-in" id="a-g2en" maxlength="60" autocomplete="off" value="' + esc(ge.tier2) + '">' + btn('saveGifts', T('cc.save')), 'f');
    q += row(T('cc.perPhone'), '<div class="cc-seg w">' + [['perEvent', T('cc.perEvent')], ['perDay', T('cc.perDay')], ['none', T('cc.unlimited')]].map(function (o) {
      return '<button data-rule="' + o[0] + '"' + (s.duplicateRule === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>';
    }).join('') + '</div>');
    q += row(T('cc.formNoTier'), tg(s.requireFormForNoTier, 'data-toggle="requireFormForNoTier"'));
    var hist = order.map(function (g) {
      var arr = todayR.filter(function (r) { return r.game === g; }), b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      arr.forEach(function (r) { b[Math.min(9, Math.floor((r.scorePct || 0) / 10))]++; });
      var mx = Math.max.apply(null, b.concat([1]));
      var t1 = cnt(arr, function (r) { return r.tierByScore >= 1; }), t2 = cnt(arr, function (r) { return r.tierByScore === 2; });
      return row(G[g].name + ' · ' + T('cc.playsN', { n: arr.length }) + '<span class="cc-pts">' + (arr.length ? T('cc.reach', { a: Math.round(100 * t1 / arr.length), b: Math.round(100 * t2 / arr.length) }) : T('cc.noPlays')) + '</span>',
        '<div class="cc-hist">' + b.map(function (v) { return '<i style="height:' + Math.round(100 * v / mx) + '%"></i>'; }).join('') + '</div>', 'h');
    }).join('');
    var pend = pending.length ? pending.slice().reverse().map(function (r) {
      return row(esc(r.rewardCode) + ' · ' + esc(r.name) + ' · ' + esc(r.giftName), '<button class="btn vn cc-mb" data-redeem="' + esc(r.id) + '">' + T('cc.redeem') + '</button>');
    }).join('') : '<p class="cc-note">' + T('cc.none') + '</p>';
    h += sec(T('cc.gifts'), box(q) + '<p class="cc-note">' + T('cc.giftsNote') + '</p>' +
      '<h4>' + T('cc.hist') + '</h4>' + box(hist) + '<h4>' + T('cc.pending', { n: pending.length, d: cnt(todayR, function (r) { return r.reason === 'duplicate'; }) }) + '</h4>' + box(pend));

    // 4 ÂM THANH
    h += sec(T('cc.sound'), box(
      row(T('cc.sfx'), tg(s.sound, 'data-toggle="sound"') + stp('vol', Math.round(s.volume * 100) + '%', [-10, 10])) +
      row(T('cc.music'), tg(s.bgm, 'data-toggle="bgm"') + stp('bgmvol', Math.round(s.bgmVolume * 100) + '%', [-10, 10])) +
      row(esc(T('cc.latency')), stp('lat', s.latencyMs + 'ms', [-10, 10]))) +
      '<p class="cc-note">' + T('cc.latencyNote') + '</p>');

    // 5 DỮ LIỆU · GOOGLE SHEET (item B)
    var lv = cnt(todayR, function (r) { return r.lang === 'en'; });
    h += sec(T('cc.sheet'), box(
      row('<span id="a-sheet-status">' + sheetLine() + '</span>', btn('sheetSend', T('cc.sendNow'))) +
      row('<input class="cc-in url" id="a-sheet-url" type="url" autocomplete="off" spellcheck="false" maxlength="300" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(s.sheetUrl) + '">', btn('sheetPing', T('cc.test')), 'in') +
      row(T('cc.secret'), '<input class="cc-in" id="a-sheet-token" type="password" autocomplete="off" spellcheck="false" maxlength="100" value="' + esc(s.sheetToken) + '"><button class="cc-eye" data-a="eye" aria-label="' + T('cc.showSecret') + '">' + EYE + '</button>', 'f') +
      row(T('cc.kiosk'), '<input class="cc-in" id="a-sheet-kiosk" autocomplete="off" maxlength="30" value="' + esc(s.kioskName) + '">' + btn('sheetSave', T('cc.save')), 'f') +
      row(T('cc.pingResult'), '<span class="a-ping" id="a-sheet-ping"></span>') +
      row(T('cc.langToday'), '<span class="cc-val" id="a-lang-count">' + T('cc.langCount', { vi: todayR.length - lv, en: lv }) + '</span>')) +
      '<p class="cc-note">' + T('cc.sheetNote') + '</p>');

    // 6 MÀN CHỜ (read-only: the v2.2 Admin could not edit them)
    var I = s.idleSec;
    var dl = s.defaultLang === 'en' ? 'en' : 'vi';
    h += sec(T('cc.idle'), box(
      row(T('cc.defaultLang'), '<div class="cc-seg">' + ['vi', 'en'].map(function (l) { return '<button data-deflang="' + l + '"' + (dl === l ? ' class="on"' : '') + '>' + l.toUpperCase() + '</button>'; }).join('') + '</div>') +
      row(T('cc.promo'), '<span class="cc-val">' + T(App.promoReady ? 'cc.yes' : 'cc.no') + '</span>') +
      row(T('cc.idleAfter'), '') +
      '<p class="cc-note in">' + T('cc.idleList', I) + '</p>' +
      row(T('cc.reloadIdle'), '<span class="cc-val">' + T('cc.hours', { n: s.autoReloadHours }) + '</span>')));

    // 7 XUẤT DỮ LIỆU
    h += sec(T('cc.export'), '<div class="cc-btns">' + btn('csvToday', T('cc.csvToday')) + btn('csvAll', T('cc.csvAll')) + btn('logs', T('cc.log')) + '</div>' +
      '<p class="cc-note">' + T('cc.exportNote') + '</p>');

    // 8 NÂNG CAO
    h += sec(T('cc.advanced'), box(
      row(T('cc.testMode'), tg(s.testMode, 'data-toggle="testMode"')) +
      row(T('cc.pin') + (msg ? ' <span class="cc-pts">' + esc(msg) + '</span>' : ''), btn('pinChange', T('cc.pinChange'))) +
      row(T('cc.testPlays', { n: tests }), btn('clearTest', T(arm === 'clearTest' ? 'cc.tapAgain' : 'cc.delTest'), 'danger')) +
      row(T('cc.allData', { n: recs.length }), btn('clear', T(arm === 'clear' ? 'cc.tapAgainAll' : 'cc.delAll'), 'danger')) +
      row(T('cc.version'), '<span class="cc-val">v' + esc(s.appVersion) + ' · ' + T('cc.clock') + ' ' + new Date().toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'vi-VN') + '</span>')) +
      '<div class="cc-btns">' + btn('reload', T('cc.reload')) + btn('exit', T('cc.exit')) + '</div>');

    panel.innerHTML = h;
    panel.scrollTop = keep;
  }

  function sheetLine() { var st = Sheet.status(); return '<i class="a-dot' + (st.ok ? ' ok' : '') + '"></i>' + esc(st.text); }
  function paintSheet() { var el = $('a-sheet-status'); if (el) el.innerHTML = sheetLine(); }
  function val(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function saveSheet() {
    var su = val('a-sheet-url').slice(0, 300), stk = val('a-sheet-token').slice(0, 100), skn = val('a-sheet-kiosk').slice(0, 30) || 'LED-1';
    store(function (s) { s.sheetUrl = su; s.sheetToken = stk; s.kioskName = skn; });
    paintSheet(); // status depends on link + token; inputs and focus stay
  }
  function saveGifts() {
    var V = I18N.dict.vi, g1 = val('a-g1') || V['gift.t1'], g2 = val('a-g2') || V['gift.t2'], e1 = val('a-g1en'), e2 = val('a-g2en'); // empty EN = fall back to VI
    store(function (s) { s.gifts.tier1 = g1.slice(0, 60); s.gifts.tier2 = g2.slice(0, 60); s.giftsEn = { tier1: e1.slice(0, 60), tier2: e2.slice(0, 60) }; });
  }
  // two-tap confirm (4 s) for destructive buttons
  function armed(name, fn) {
    if (arm !== name) { arm = name; render(); clearTimeout(armTimer); armTimer = setTimeout(function () { arm = ''; var b = panel.querySelector('[data-a="' + name + '"]'); if (b) b.textContent = T(name === 'clear' ? 'cc.delAll' : 'cc.delTest'); }, 4000); return; } // label only: a re-render would drop text being typed
    arm = ''; clearTimeout(armTimer); fn(); render();
  }

  function onClick(e) {
    armClose();
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-pin')) return onPin(t.getAttribute('data-pin'));
    if (t.hasAttribute('data-step')) {
      var key = t.getAttribute('data-step'), d = +t.getAttribute('data-d');
      if (key === 'stock1' || key === 'stock2') { var st = Store.stock(); Store.setStock(st.tier1 + (key === 'stock1' ? d : 0), st.tier2 + (key === 'stock2' ? d : 0)); render(); return; }
      save(function (s) {
        if (key === 'daily1') s.dailyStock.tier1 = Math.max(0, s.dailyStock.tier1 + d);
        if (key === 'daily2') s.dailyStock.tier2 = Math.max(0, s.dailyStock.tier2 + d);
        if (key.indexOf('th_') === 0) {
          var p = key.split('_'), g = p[1], tier = 'tier' + p[2];
          s.thresholds[g][tier] = Logic.clamp(s.thresholds[g][tier] + d, 5, 100);
          if (s.thresholds[g].tier2 <= s.thresholds[g].tier1) { if (tier === 'tier1') s.thresholds[g].tier2 = Math.min(100, s.thresholds[g].tier1 + 5); else s.thresholds[g].tier1 = Math.max(5, s.thresholds[g].tier2 - 5); }
        }
        if (key === 'vol') s.volume = Logic.clamp(Math.round((s.volume + d / 100) * 100) / 100, 0, 1);
        if (key === 'bgmvol') s.bgmVolume = Logic.clamp(Math.round((s.bgmVolume + d / 100) * 100) / 100, 0, 1);
        if (key === 'lat') s.latencyMs = Logic.clamp(s.latencyMs + d, -150, 250);
      });
      return;
    }
    if (t.hasAttribute('data-diff')) { var dg = t.getAttribute('data-g'), dv = t.getAttribute('data-diff'); save(function (s) { s.difficulty = s.difficulty || {}; s.difficulty[dg] = dv; }); return; }
    if (t.hasAttribute('data-deflang')) { var dfl = t.getAttribute('data-deflang'); save(function (s) { s.defaultLang = dfl; }); return; }
    if (t.hasAttribute('data-rule')) { var rule = t.getAttribute('data-rule'); save(function (s) { s.duplicateRule = rule; }); return; }
    if (t.hasAttribute('data-game-toggle')) {
      var gk = t.getAttribute('data-game-toggle');
      if (App.selectable(gk) && App.GAME_ORDER.filter(App.selectable).length <= 1) return; // keep the last playable game ON
      save(function (s) { s.games[gk] = !s.games[gk]; }); return;
    }
    if (t.hasAttribute('data-toggle')) { var tgk = t.getAttribute('data-toggle'); save(function (s) { s[tgk] = !s[tgk]; }); return; }
    if (t.hasAttribute('data-redeem')) { var rid = t.getAttribute('data-redeem'); if (Store.updateRecord(rid, { redeemed: true, redeemedAt: new Date().toISOString() })) Sheet.enqueue(rid); render(); return; }
    var a = t.getAttribute('data-a');
    if (a === 'close' || a === 'exit') return close();
    if (a === 'reload') { location.reload(); return; }
    if (a === 'saveGifts') { saveGifts(); render(); return; }
    if (a === 'eye') { var tk = $('a-sheet-token'); tk.type = tk.type === 'password' ? 'text' : 'password'; t.classList.toggle('on', tk.type === 'text'); return; }
    if (a === 'sheetSave' || a === 'sheetPing') {
      saveSheet();
      if (a === 'sheetPing') {
        $('a-sheet-ping').textContent = T('cc.checking'); $('a-sheet-ping').className = 'a-ping';
        Sheet.ping(function (r) { var el = $('a-sheet-ping'); if (el) { el.textContent = r.text; el.className = 'a-ping ' + (r.ok ? 'ok' : 'bad'); } paintSheet(); if (r.ok) Sheet.sendNow(paintSheet); });
      }
      return;
    }
    if (a === 'sheetSend') { Sheet.sendNow(paintSheet); return; }
    if (a === 'csvToday') { var td = Logic.localDate(); download('hince_game_' + stamp() + '_today.csv', Logic.toCSV(Store.records().filter(function (r) { return r.date === td; }))); return; }
    if (a === 'csvAll') { download('hince_game_' + stamp() + '_all.csv', Logic.toCSV(Store.records())); return; }
    if (a === 'logs') { download('hince_game_log_' + stamp() + '.txt', Store.logs().join('\n'), 'text/plain;charset=utf-8'); return; }
    if (a === 'pinChange') { back = panel.scrollTop; mode = 'new1'; pin = newPin = msg = ''; renderPin(); return; }
    if (a === 'clearTest') return armed('clearTest', function () { Store.clearTestRecords(); });
    if (a === 'clear') return armed('clear', function () { Store.clearRecords(); });
  }
  // native inputs: typing keeps the panel open; leaving a field saves it without re-rendering (focus stays where the staff tabbed)
  function onChange(e) {
    var id = e.target.id || '';
    if (id === 'a-g1' || id === 'a-g2' || id === 'a-g1en' || id === 'a-g2en') saveGifts();
    else if (id.indexOf('a-sheet-') === 0) saveSheet();
  }

  function init() {
    ov = $('o-admin'); panel = $('admin-panel');
    ov.addEventListener('click', onClick);
    ov.addEventListener('change', onChange);
    ov.addEventListener('input', armClose);
    ov.addEventListener('keydown', armClose);
    panel.addEventListener('scroll', armClose, { passive: true });
  }
  window.Admin = { init: init, open: open, close: close, render: render, CLOSE_MS: CLOSE_MS };
})();
