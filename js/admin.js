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
  function open() { if (ov.classList.contains('active')) return; mode = 'pin'; pin = ''; msg = ''; arm = ''; tab = 'overview'; ov.classList.add('active'); if (App.screen !== 'attract') App.home(); renderPin(); armClose(); }
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
  function tg(on, attr) { return '<button class="cc-tg' + (on ? ' on' : ' off') + '" ' + attr + ' aria-label="' + T(on ? 'cc.on' : 'cc.off') + '"><i></i></button>'; } // v2.7.1: switch
  function btn(a, label, cls) { return '<button class="btn vn cc-mb' + (cls ? ' ' + cls : '') + '" data-a="' + a + '">' + label + '</button>'; }
  function stp(key, value, deltas) {
    var one = deltas.length === 2, b = function (d) { return '<button class="cc-st" data-step="' + key + '" data-d="' + d + '">' + (one ? (d < 0 ? '-' : '+') : (d < 0 ? d : '+' + d)) + '</button>'; };
    return '<div class="cc-stp' + (one ? ' one' : '') + '">' + deltas.filter(function (d) { return d < 0; }).map(b).join('') + '<span class="v">' + value + '</span>' + deltas.filter(function (d) { return d > 0; }).map(b).join('') + '</div>';
  }
  // v2.7 gifts: key order = Logic.GIFT_KEYS; row picture = the gift photo
  var GK = ['hairTie', 'mirror', 'mini', 'full'];
  function gpic(k) { return '<img class="cc-gimg" src="' + ASSETS.gift(k) + '" alt="">'; }
  function gname(k) { var s = S(); return (s.gifts && s.gifts[k]) || window.DEFAULTS.gifts[k]; }

  // v2.7.1: the panel is split into tabs (one screen each, no long scroll). tab survives re-renders while the CC is open.
  var TABS = ['overview', 'gifts', 'games', 'data', 'system'], tab = 'overview';
  function tabs() {
    $('cc-tabs').innerHTML = TABS.map(function (t) { return '<button data-tab="' + t + '"' + (t === tab ? ' class="on"' : '') + '>' + T('cc.tab.' + t) + '</button>'; }).join('');
    [].forEach.call($('cc-lang').children, function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === I18N.lang); });
  }
  function render() {
    if (mode !== 'panel') { renderPin(); return; }
    ov.classList.remove('pin');
    var keep = panel.scrollTop;
    var s = S(), st = Store.giftStock(), recs = Store.records(), today = Logic.localDate(), G = App.GAME, order = App.GAME_ORDER;
    var real = recs.filter(function (r) { return !r.testMode; }), tests = recs.length - real.length;
    var todayR = real.filter(function (r) { return r.date === today; });
    var cnt = function (arr, f) { return arr.filter(f).length; };
    var pending = todayR.filter(function (r) { return r.tier > 0 && !r.redeemed; });
    var diff = s.difficulty || {}, h = '';
    var given = function (arr, k) { return cnt(arr, function (r) { return r.tier > 0 && r.giftKey === k; }); }; // stock is taken when the receipt prints
    var D = window.DEFAULTS.giftStock;
    tabs();

    if (tab === 'overview') {
      // today: plays + gifts given per gift (+ left in stock), Google Sheet health, gifts not handed over yet, score spread
      h += sec(T('cc.today') + ' · ' + today, '<div class="cc-stat">' +
        '<div class="pl"><b>' + todayR.length + '</b><span>' + T('cc.plays') + '</span></div>' +
        GK.map(function (k) {
          var pct = Math.min(100, Math.round(100 * st[k] / Math.max(1, D[k])));
          return '<div>' + gpic(k) + '<b>' + given(todayR, k) + '</b><span>' + T('cc.giftLbl.' + k) + '</span><em>' + T('cc.leftOf', { n: st[k], t: D[k] }) + '</em><i class="cc-bar' + (pct < 10 ? ' low' : '') + '"><i style="width:' + pct + '%"></i></i></div>';
        }).join('') + '</div>');
      h += sec(T('cc.sheet'), box(row('<span id="a-sheet-status">' + sheetLine() + '</span>', btn('sheetSend', T('cc.sendNow')))));
      var pend = pending.length ? pending.slice().reverse().map(function (r) {
        return row('<span class="mono">' + esc(r.rewardCode) + '</span> · ' + esc(r.name) + '<span class="cc-pts">' + esc(r.giftName) + '</span>', '<button class="btn vn cc-mb" data-redeem="' + esc(r.id) + '">' + T('cc.redeem') + '</button>');
      }).join('') : row('<span class="cc-pts">' + T('cc.none') + '</span>', '');
      h += sec(T('cc.pending', { n: pending.length, d: cnt(todayR, function (r) { return r.reason === 'duplicate'; }) }), box(pend));
      var hist = order.map(function (g) {
        var arr = todayR.filter(function (r) { return r.game === g; }), b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        arr.forEach(function (r) { b[Math.min(9, Math.floor((r.scorePct || 0) / 10))]++; }); // scorePct = score 0–100
        var mx = Math.max.apply(null, b.concat([1]));
        var t1 = cnt(arr, function (r) { return r.tierByScore >= 2; }), t2 = cnt(arr, function (r) { return r.tierByScore === 3; }); // v2.7 tiers 1 / 2 / 3
        return row(G[g].name + ' · ' + T('cc.playsN', { n: arr.length }) + '<span class="cc-pts">' + (arr.length ? T('cc.reach', { a: Math.round(100 * t1 / arr.length), b: Math.round(100 * t2 / arr.length) }) : T('cc.noPlays')) + '</span>',
          '<div class="cc-hist">' + b.map(function (v) { return '<i style="height:' + Math.round(100 * v / mx) + '%"></i>'; }).join('') + '</div>', 'h');
      }).join('');
      h += sec(T('cc.hist'), box(hist));
    }

    if (tab === 'gifts') {
      // event stock per gift (−10 −1 +1 +10), thresholds on the 0–100 score, rules, gift names VI / EN
      h += sec(T('cc.stockHead'), box(GK.map(function (k) {
        return row(gpic(k) + '<span class="cc-gl">' + esc(gname(k)) + '<span class="cc-pts">' + T('cc.given', { d: given(todayR, k), e: given(real, k) }) + '</span></span>',
          stp('gs_' + k, st[k], [-10, -1, 1, 10]), 'gs');
      }).join('')));
      h += sec(T('cc.thHead'), box(
        row(T('cc.thMid') + '<span class="cc-pts">' + T('cc.thRange', { a: s.thresholds.mid, b: s.thresholds.high - 1 }) + ' · ' + T('cc.thLow', { n: s.thresholds.mid }) + '</span>', stp('th_mid', s.thresholds.mid, [-5, -1, 1, 5])) +
        row(T('cc.thHigh') + '<span class="cc-pts">' + T('cc.thRange', { a: s.thresholds.high, b: 100 }) + '</span>', stp('th_high', s.thresholds.high, [-5, -1, 1, 5]))) +
        '<p class="cc-note">' + T('cc.giftsNote') + '</p>');
      h += sec(T('cc.rules'), box(
        row(T('cc.perPhone'), '<div class="cc-seg">' + [['perEvent', T('cc.perEvent')], ['perDay', T('cc.perDay')], ['none', T('cc.unlimited')]].map(function (o) {
          return '<button data-rule="' + o[0] + '"' + (s.duplicateRule === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>';
        }).join('') + '</div>') +
        row(T('cc.formNoTier'), tg(s.requireFormForNoTier, 'data-toggle="requireFormForNoTier"'))));
      var ge = s.giftsEn || {};
      h += sec(T('cc.namesHead'), box(GK.map(function (k) { // one row per gift: VI name | EN name (empty EN = the VI name)
        return row(T('cc.giftLbl.' + k), '<input class="cc-in" id="a-gn-' + k + '" maxlength="60" autocomplete="off" placeholder="VI" value="' + esc(gname(k)) + '">' +
          '<input class="cc-in" id="a-ge-' + k + '" maxlength="60" autocomplete="off" placeholder="EN" value="' + esc(ge[k]) + '">', 'nm');
      }).join('') + row('<span class="cc-pts">' + T('cc.namesNote') + '</span>', btn('saveGifts', T('cc.save')))));
    }

    if (tab === 'games') {
      // games on / off + difficulty (applies from the next game; the last playable game cannot be switched off), intro, sound
      h += sec(T('cc.games'), box(order.map(function (g) {
        var on = !!s.games[g], d = diff[g] || 'normal';
        return '<div class="cc-row g"><div class="lbl">' + PIC[g] + '<span>' + G[g].name + '<span class="cc-pts">' + G[g].product + '</span></span></div><div class="cc-r"><div class="cc-seg">' +
          DIFF.map(function (o) { return '<button data-g="' + g + '" data-diff="' + o + '"' + (d === o ? ' class="on"' : '') + '>' + T('cc.' + o) + '</button>'; }).join('') +
          '</div>' + tg(on, 'data-game-toggle="' + g + '"') + '</div></div>';
      }).join('') + row(T('cc.intro'), tg(s.productIntro !== false, 'data-toggle="productIntro"'))) + '<p class="cc-note">' + T('cc.gamesNote') + '</p>');
      h += sec(T('cc.sound'), box(
        row(T('cc.sfx'), stp('vol', Math.round(s.volume * 100) + '%', [-10, 10]) + tg(s.sound, 'data-toggle="sound"')) +
        row(T('cc.music'), stp('bgmvol', Math.round(s.bgmVolume * 100) + '%', [-10, 10]) + tg(s.bgm, 'data-toggle="bgm"')) +
        row(esc(T('cc.latency')) + '<span class="cc-pts">' + T('cc.latencyNote') + '</span>', stp('lat', s.latencyMs + 'ms', [-10, 10]))));
    }

    if (tab === 'data') {
      var lv = cnt(todayR, function (r) { return r.lang === 'en'; });
      h += sec(T('cc.sheet'), box(
        row('<span id="a-sheet-status">' + sheetLine() + '</span>', btn('sheetSend', T('cc.sendNow'))) +
        row('<input class="cc-in url" id="a-sheet-url" type="url" autocomplete="off" spellcheck="false" maxlength="300" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(s.sheetUrl) + '">', btn('sheetPing', T('cc.test')), 'in') +
        row(T('cc.secret'), '<input class="cc-in" id="a-sheet-token" type="password" autocomplete="off" spellcheck="false" maxlength="100" value="' + esc(s.sheetToken) + '"><button class="cc-eye" data-a="eye" aria-label="' + T('cc.showSecret') + '">' + EYE + '</button>', 'f') +
        row(T('cc.kiosk'), '<input class="cc-in" id="a-sheet-kiosk" autocomplete="off" maxlength="30" value="' + esc(s.kioskName) + '">' + btn('sheetSave', T('cc.save')), 'f') +
        row(T('cc.pingResult'), '<span class="a-ping" id="a-sheet-ping"></span>') +
        row(T('cc.langToday'), '<span class="cc-val" id="a-lang-count">' + T('cc.langCount', { vi: todayR.length - lv, en: lv }) + '</span>')) +
        '<p class="cc-note">' + T('cc.sheetNote') + '</p>');
      h += sec(T('cc.export'), box(row('<span class="cc-pts">' + T('cc.exportNote') + '</span>', '') +
        '<div class="cc-btns">' + btn('csvToday', T('cc.csvToday')) + btn('csvAll', T('cc.csvAll')) + btn('logs', T('cc.log')) + '</div>'));
    }

    if (tab === 'system') {
      var I = s.idleSec, dl = s.defaultLang === 'vi' ? 'vi' : 'en';
      h += sec(T('cc.idle'), box(
        row(T('cc.defaultLang') + '<span class="cc-pts">' + T('cc.defaultLangNote') + '</span>', '<div class="cc-seg">' + ['en', 'vi'].map(function (l) { return '<button data-deflang="' + l + '"' + (dl === l ? ' class="on"' : '') + '>' + l.toUpperCase() + '</button>'; }).join('') + '</div>') +
        row(T('cc.promo'), '<span class="cc-val">' + T(App.promoReady ? 'cc.yes' : 'cc.no') + '</span>') +
        row(T('cc.idleAfter') + '<span class="cc-pts">' + T('cc.idleList', I) + '</span>', '') +
        row(T('cc.reloadIdle'), '<span class="cc-val">' + T('cc.hours', { n: s.autoReloadHours }) + '</span>')));
      h += sec(T('cc.advanced'), box(
        row(T('cc.testMode'), tg(s.testMode, 'data-toggle="testMode"')) +
        row(T('cc.pin') + (msg ? '<span class="cc-pts">' + esc(msg) + '</span>' : ''), btn('pinChange', T('cc.pinChange'))) +
        row(T('cc.testPlays', { n: tests }), btn('clearTest', T(arm === 'clearTest' ? 'cc.tapAgain' : 'cc.delTest'), 'danger')) +
        row(T('cc.allData', { n: recs.length }), btn('clear', T(arm === 'clear' ? 'cc.tapAgainAll' : 'cc.delAll'), 'danger')) +
        row(T('cc.version'), '<span class="cc-val">v' + esc(s.appVersion) + ' · ' + T('cc.clock') + ' ' + new Date().toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'vi-VN') + '</span>')) +
        '<div class="cc-btns">' + btn('reload', T('cc.reload')) + btn('exit', T('cc.exit'), 'ghost') + '</div>');
    }

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
  function saveGifts() { // empty VI name = the default name; empty EN = falls back to VI
    var D = window.DEFAULTS.gifts, g = {}, e = {};
    GK.forEach(function (k) { g[k] = (val('a-gn-' + k) || D[k]).slice(0, 60); e[k] = val('a-ge-' + k).slice(0, 60); });
    store(function (s) { s.gifts = g; s.giftsEn = e; });
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
    if (t.hasAttribute('data-tab')) { tab = t.getAttribute('data-tab'); arm = ''; render(); panel.scrollTop = 0; return; }
    if (t.hasAttribute('data-lang') && t.parentNode.id === 'cc-lang') { I18N.set(t.getAttribute('data-lang')); return; } // langchange → Admin.render()
    if (t.hasAttribute('data-step')) {
      var key = t.getAttribute('data-step'), d = +t.getAttribute('data-d');
      if (key.indexOf('gs_') === 0) { var gk = key.slice(3), st = Store.giftStock(); Store.setGiftStock(gk, st[gk] + d); Store.log('stock ' + gk + ' ' + st[gk] + ' -> ' + Store.giftStock()[gk]); render(); return; }
      save(function (s) {
        if (key === 'th_mid' || key === 'th_high') { // 5 ≤ mid < high ≤ 100: the other one moves to keep 5 points apart
          var t = { mid: s.thresholds.mid, high: s.thresholds.high };
          if (key === 'th_mid') { t.mid = Logic.clamp(t.mid + d, 5, 95); if (t.high <= t.mid) t.high = Math.min(100, t.mid + 5); }
          else { t.high = Logic.clamp(t.high + d, 10, 100); if (t.mid >= t.high) t.mid = Math.max(5, t.high - 5); }
          s.thresholds = t;
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
    if (id.indexOf('a-gn-') === 0 || id.indexOf('a-ge-') === 0) saveGifts();
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
