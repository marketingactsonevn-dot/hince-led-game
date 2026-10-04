/* v2.4 C: VI | EN. Every visible string goes through I18N.t(key, vars); English copy = production/I18N_COPY_v2_4.md word for word.
   HTML: data-i18n="key" (textContent) + data-i18n-attr="attr:key;attr:key". I18N.set(lang) updates the DOM, <html lang>,
   body.lang-vi / body.lang-en, then fires document 'langchange' (JS-built screens re-render on it).
   I18N.fitIn(root): shrink-to-fit for [data-i18n] / [data-fit] text (font-size down to a 70 % floor, never overflow, words never split). */
(function () {
  'use strict';
  var vi = {
    // customer flow
    'attract.line': 'Chạm để chơi & nhận quà',
    'intro.skip': 'Chạm để bỏ qua',
    'ready.memo.label': 'LẬT 2 Ô', 'ready.memo.line': 'Lật 2 ô giống nhau',
    'ready.kiss.label': 'KÉO', 'ready.kiss.line': 'Kéo son đúng màu lên môi',
    'ready.tap.label': 'CHẠM', 'ready.tap.gold': 'Thỏi vàng: chạm 2 lần',
    'ready.grab.label': 'GẮP!', 'ready.grab.line': 'Chạm để gắp đúng màu',
    'ready.ok': 'ĐÃ HIỂU', 'common.continue': 'TIẾP TỤC', 'common.next': 'TIẾP',
    'memo.peek': 'Nhớ vị trí nhé!', 'memo.hint': 'Lật 2 ô giống nhau',
    'game.close': 'Suýt nữa rồi!',
    'result.need': 'Cần thêm {n} điểm', 'result.pts': '{n} điểm', 'result.tier': 'QUÀ MỨC {n}', 'result.gift': 'Quà',
    'result.youGet': 'Bạn nhận được', 'result.claim': 'NHẬN QUÀ', 'result.save': 'LƯU KẾT QUẢ',
    'result.soldOut': 'HẾT QUÀ HÔM NAY', 'result.end': 'KẾT THÚC',
    'form.title': 'THÔNG TIN NHẬN QUÀ', 'form.name': 'TÊN (KHÔNG DẤU)', 'form.phone': 'SỐ ĐIỆN THOẠI', 'form.send': 'GỬI',
    'form.del': 'XOÁ', 'form.done': 'XONG', 'form.policyLink': 'Chính sách dữ liệu', 'form.close': 'ĐÓNG ×',
    'form.err.name': 'Vui lòng nhập họ tên (ít nhất 2 chữ cái).',
    'form.err.phone': 'Số điện thoại chưa đúng (10 số, bắt đầu bằng 03/05/07/08/09).',
    'form.err.consent': 'Vui lòng tick ô đồng ý (bắt buộc) để tiếp tục.',
    'form.onePerPhone': 'Mỗi SĐT nhận quà 1 lần', 'form.err.save': 'Lỗi lưu dữ liệu – vui lòng báo nhân viên',
    'store.err': 'Không lưu được dữ liệu',
    'reward.congrats': 'CHÚC MỪNG!', 'reward.you': 'BẠN', 'reward.code': 'MÃ NHẬN QUÀ', 'reward.show': 'Đưa màn hình này cho nhân viên',
    'reward.staff': 'NHÂN VIÊN · GIỮ 2 GIÂY', 'reward.done': 'ĐÃ NHẬN QUÀ', 'reward.downgrade': 'Quà Mức 2 đã hết – bạn nhận Quà Mức 1',
    'reward.tomorrow': 'Hẹn bạn ngày mai nhé!', 'reward.finish': 'HOÀN TẤT', 'reward.test': 'TEST MODE · không lưu kho',
    'thanks.title': 'CẢM ƠN BẠN!', 'thanks.name': 'CẢM ƠN {name}!',
    'thanks.nb': 'Ghé tường tester để thử Nu Blur Tint nhé', 'thanks.rb': 'Ghé MUA station để glow cùng Radiance Balm nhé',
    'thanks.back': 'Tự về sau {s}s', 'thanks.home': 'VỀ TRANG ĐẦU',
    'idle.q': 'Bạn còn ở đây không?',
    'gift.t1': 'Quà Mức 1', 'gift.t2': 'Quà Mức 2',
    // Control Center (staff)
    'cc.close': 'ĐÓNG ×', 'cc.today': 'HÔM NAY', 'cc.plays': 'lượt chơi', 'cc.giftsGiven': 'quà mức {n} · còn {left}',
    'cc.games': 'GAME · ĐỘ KHÓ', 'cc.easy': 'DỄ', 'cc.normal': 'VỪA', 'cc.hard': 'KHÓ', 'cc.on': 'BẬT', 'cc.off': 'TẮT',
    'cc.intro': 'Intro sản phẩm 3D', 'cc.gamesNote': 'Bấm DỄ / VỪA / KHÓ hoặc BẬT / TẮT: áp dụng từ lượt sau. Luôn còn ít nhất 1 game bật.',
    'cc.gifts': 'QUÀ', 'cc.level': 'mức {n}', 'cc.pts': '≈{n} điểm',
    'cc.stockToday': 'Kho hôm nay · mức {n}', 'cc.daily': 'Mặc định mỗi ngày · mức {n}',
    'cc.giftName': 'Tên quà mức {n}', 'cc.giftNameEn': 'Tên quà mức {n} (EN)', 'cc.save': 'LƯU',
    'cc.perPhone': 'Mỗi SĐT nhận quà', 'cc.perEvent': '1 lần / event', 'cc.perDay': '1 lần / ngày', 'cc.unlimited': 'không giới hạn',
    'cc.formNoTier': 'Không đạt quà vẫn phải nhập thông tin',
    'cc.playsN': '{n} lượt', 'cc.reach': 'đạt mức 1+: {a}% · mức 2: {b}%', 'cc.noPlays': 'chưa có lượt',
    'cc.redeem': 'ĐÃ TRAO', 'cc.none': 'Không có',
    'cc.giftsNote': 'Ngưỡng = % điểm tối đa của game (≈ số điểm cần). Ngày mới: kho hôm nay tự nạp lại theo số mặc định.',
    'cc.hist': 'Phân bố điểm hôm nay (0% → 100%)', 'cc.pending': 'Quà chưa trao hôm nay ({n}) · SĐT trùng {d}',
    'cc.sound': 'ÂM THANH', 'cc.sfx': 'Hiệu ứng', 'cc.music': 'Nhạc nền', 'cc.latency': 'Bù trễ chạm · Tap-Tap! 1 & 2',
    'cc.latencyNote': 'Bù trễ: tăng nếu khách chạm đúng nhịp mà vẫn bị tính trễ.',
    'cc.sheet': 'DỮ LIỆU · GOOGLE SHEET', 'cc.sendNow': 'GỬI NGAY', 'cc.test': 'KIỂM TRA', 'cc.secret': 'Mã bí mật', 'cc.showSecret': 'hiện mã',
    'cc.kiosk': 'Tên máy', 'cc.pingResult': 'Kết quả kiểm tra', 'cc.checking': 'Đang kiểm tra…',
    'cc.langToday': 'Ngôn ngữ hôm nay', 'cc.langCount': 'Tiếng Việt {vi} · English {en}',
    'cc.sheetNote': 'Cắm bàn phím để dán link nhanh. Mất mạng vẫn chơi bình thường, máy tự gửi bù khi có mạng.',
    'cc.idle': 'MÀN CHỜ', 'cc.promo': 'Video quảng cáo (nút VIDEO)', 'cc.yes': 'CÓ', 'cc.no': 'KHÔNG',
    'cc.defaultLang': 'Ngôn ngữ mặc định', 'cc.idleAfter': 'Tự về màn chờ sau (giây)',
    'cc.idleList': 'chọn game {select} · hướng dẫn {howto} · kết quả {result} · nhập thông tin {form} · nhận quà {reward} · cảm ơn {thanks} · cảnh báo {warn}',
    'cc.reloadIdle': 'Tự tải lại app khi rảnh', 'cc.hours': '{n} giờ',
    'cc.export': 'XUẤT DỮ LIỆU', 'cc.csvToday': 'CSV HÔM NAY', 'cc.csvAll': 'CSV TẤT CẢ', 'cc.log': 'NHẬT KÝ',
    'cc.exportNote': 'Cuối ngày: CSV TẤT CẢ → lưu USB / gửi email. Không xoá dữ liệu trình duyệt của máy.',
    'cc.advanced': 'NÂNG CAO', 'cc.testMode': 'Test mode (không trừ kho, không gửi Sheet)', 'cc.pin': 'Mã PIN', 'cc.pinChange': 'ĐỔI PIN',
    'cc.testPlays': 'Lượt test trong máy: {n}', 'cc.tapAgain': 'BẤM LẦN NỮA ĐỂ XOÁ', 'cc.delTest': 'XOÁ LƯỢT TEST',
    'cc.allData': 'Toàn bộ dữ liệu: {n} bản ghi', 'cc.tapAgainAll': 'BẤM LẦN NỮA ĐỂ XOÁ HẾT', 'cc.delAll': 'XOÁ HẾT',
    'cc.version': 'Phiên bản', 'cc.clock': 'giờ máy', 'cc.reload': 'TẢI LẠI APP', 'cc.exit': 'THOÁT', 'cc.cancel': 'HUỶ',
    'cc.pinEnter': 'Nhập mã PIN', 'cc.pinNew1': 'Nhập PIN mới (4 số)', 'cc.pinNew2': 'Nhập lại PIN mới',
    'cc.pinWrong': 'Sai mã PIN · nhập lại', 'cc.pinChanged': 'Đã đổi PIN', 'cc.pinMismatch': 'Hai lần không khớp · nhập lại',
    // Google Sheet status (sheet.js)
    'sheet.net': 'Chưa có mạng hoặc sai link', 'sheet.token': 'Sai mã bí mật', 'sheet.url': 'Chưa cài link',
    'sheet.notSaved': 'Google trả lỗi: chưa lưu được', 'sheet.gerr': 'Google trả lỗi: {e}', 'sheet.last': 'gửi lần cuối {t}',
    'sheet.waiting': 'chờ gửi {n}', 'sheet.sent': 'Đã gửi hôm nay {d} · tổng {t}', 'sheet.connected': 'Đã kết nối · {n} dòng'
  };
  var en = {
    'attract.line': 'Tap to play & win a gift',
    'intro.skip': 'Tap to skip',
    'ready.memo.label': 'FLIP 2', 'ready.memo.line': 'Flip 2 matching cards',
    'ready.kiss.label': 'DRAG', 'ready.kiss.line': 'Drag the matching shade onto the lips',
    'ready.tap.label': 'TAP', 'ready.tap.gold': 'Gold tile: tap twice',
    'ready.grab.label': 'GRAB!', 'ready.grab.line': 'Tap to grab the right shade',
    'ready.ok': 'GOT IT', 'common.continue': 'CONTINUE', 'common.next': 'NEXT',
    'memo.peek': 'Remember where they are!', 'memo.hint': 'Flip 2 matching cards',
    'game.close': 'So close!',
    'result.need': '{n} more points to the next gift', 'result.pts': '{n} pts', 'result.tier': 'GIFT LEVEL {n}', 'result.gift': 'Gift',
    'result.youGet': 'You get', 'result.claim': 'CLAIM GIFT', 'result.save': 'SAVE MY SCORE',
    'result.soldOut': "TODAY'S GIFTS ARE ALL GONE", 'result.end': 'FINISH',
    'form.title': 'YOUR DETAILS', 'form.name': 'NAME', 'form.phone': 'PHONE NUMBER', 'form.send': 'SUBMIT',
    'form.del': 'DEL', 'form.done': 'DONE', 'form.policyLink': 'Data policy', 'form.close': 'CLOSE ×',
    'form.err.name': 'Please enter your name (at least 2 letters).',
    'form.err.phone': 'Please check your phone number: 10 digits starting with 03/05/07/08/09, or an international number starting with +.',
    'form.err.consent': 'Please tick the required box to continue.',
    'form.onePerPhone': 'One gift per phone number', 'form.err.save': 'Something went wrong – please ask our staff',
    'store.err': "Couldn't save the data",
    'reward.congrats': 'CONGRATS!', 'reward.you': 'YOU', 'reward.code': 'GIFT CODE', 'reward.show': 'Show this screen to our staff',
    'reward.staff': 'STAFF · HOLD 2 SEC', 'reward.done': 'GIFT RECEIVED', 'reward.downgrade': 'Level 2 gifts are gone, so you get a Level 1 gift',
    'reward.tomorrow': 'See you tomorrow!', 'reward.finish': 'DONE', 'reward.test': 'TEST MODE · stock not counted',
    'thanks.title': 'THANK YOU!', 'thanks.name': 'THANK YOU, {name}!',
    'thanks.nb': 'Visit the tester wall to try Nu Blur Tint', 'thanks.rb': 'Visit the MUA station to glow with Radiance Balm',
    'thanks.back': 'Back to start in {s}s', 'thanks.home': 'BACK TO START',
    'idle.q': 'Still there?',
    'gift.t1': 'Level 1 gift', 'gift.t2': 'Level 2 gift',
    'cc.close': 'CLOSE ×', 'cc.today': 'TODAY', 'cc.plays': 'plays', 'cc.giftsGiven': 'level {n} gifts · {left} left',
    'cc.games': 'GAMES · DIFFICULTY', 'cc.easy': 'EASY', 'cc.normal': 'NORMAL', 'cc.hard': 'HARD', 'cc.on': 'ON', 'cc.off': 'OFF',
    'cc.intro': '3D product intro', 'cc.gamesNote': 'Tap EASY / NORMAL / HARD or ON / OFF: applies from the next game. At least 1 game stays on.',
    'cc.gifts': 'GIFTS', 'cc.level': 'level {n}', 'cc.pts': '≈{n} pts',
    'cc.stockToday': 'Stock today · level {n}', 'cc.daily': 'Daily default · level {n}',
    'cc.giftName': 'Level {n} gift name', 'cc.giftNameEn': 'Level {n} gift name (EN)', 'cc.save': 'SAVE',
    'cc.perPhone': 'Gifts per phone', 'cc.perEvent': 'once per event', 'cc.perDay': 'once per day', 'cc.unlimited': 'unlimited',
    'cc.formNoTier': 'No gift won: still ask for details',
    'cc.playsN': '{n} plays', 'cc.reach': 'level 1+: {a}% · level 2: {b}%', 'cc.noPlays': 'no plays yet',
    'cc.redeem': 'GIVEN', 'cc.none': 'None',
    'cc.giftsNote': 'Threshold = % of the game\'s max score (≈ points needed). New day: stock today refills to the daily default.',
    'cc.hist': 'Score spread today (0% → 100%)', 'cc.pending': 'Gifts not given yet today ({n}) · repeat phones {d}',
    'cc.sound': 'SOUND', 'cc.sfx': 'Effects', 'cc.music': 'Music', 'cc.latency': 'Touch delay offset · Tap-Tap! 1 & 2',
    'cc.latencyNote': 'Touch delay offset: raise it if on-beat taps are still judged late.',
    'cc.sheet': 'DATA · GOOGLE SHEET', 'cc.sendNow': 'SEND NOW', 'cc.test': 'TEST', 'cc.secret': 'Secret code', 'cc.showSecret': 'show code',
    'cc.kiosk': 'Kiosk name', 'cc.pingResult': 'Test result', 'cc.checking': 'Checking…',
    'cc.langToday': 'Languages today', 'cc.langCount': 'Vietnamese {vi} · English {en}',
    'cc.sheetNote': 'Plug in a keyboard to paste the link fast. Without internet the game still runs; the kiosk sends later.',
    'cc.idle': 'IDLE SCREEN', 'cc.promo': 'Promo video (VIDEO button)', 'cc.yes': 'YES', 'cc.no': 'NO',
    'cc.defaultLang': 'Default language', 'cc.idleAfter': 'Back to idle after (s)',
    'cc.idleList': 'select {select} · how to {howto} · result {result} · details {form} · gift {reward} · thanks {thanks} · warning {warn}',
    'cc.reloadIdle': 'Auto-reload when idle', 'cc.hours': '{n} h',
    'cc.export': 'EXPORT', 'cc.csvToday': 'CSV TODAY', 'cc.csvAll': 'CSV ALL', 'cc.log': 'LOG',
    'cc.exportNote': 'End of day: CSV ALL → save to USB / email. Do not clear the browser data on this kiosk.',
    'cc.advanced': 'ADVANCED', 'cc.testMode': 'Test mode (no stock used, not sent to Sheet)', 'cc.pin': 'PIN', 'cc.pinChange': 'CHANGE PIN',
    'cc.testPlays': 'Test plays on this kiosk: {n}', 'cc.tapAgain': 'TAP AGAIN TO DELETE', 'cc.delTest': 'DELETE TEST PLAYS',
    'cc.allData': 'All data: {n} records', 'cc.tapAgainAll': 'TAP AGAIN TO DELETE ALL', 'cc.delAll': 'DELETE ALL',
    'cc.version': 'Version', 'cc.clock': 'kiosk clock', 'cc.reload': 'RELOAD APP', 'cc.exit': 'EXIT', 'cc.cancel': 'CANCEL',
    'cc.pinEnter': 'Enter PIN', 'cc.pinNew1': 'New PIN (4 digits)', 'cc.pinNew2': 'New PIN again',
    'cc.pinWrong': 'Wrong PIN · try again', 'cc.pinChanged': 'PIN changed', 'cc.pinMismatch': 'The two PINs differ · try again',
    'sheet.net': 'No internet or wrong link', 'sheet.token': 'Wrong secret code', 'sheet.url': 'No link set',
    'sheet.notSaved': 'Google error: not saved', 'sheet.gerr': 'Google error: {e}', 'sheet.last': 'last sent {t}',
    'sheet.waiting': 'waiting {n}', 'sheet.sent': 'Sent today {d} · total {t}', 'sheet.connected': 'Connected · {n} rows'
  };
  var D = { vi: vi, en: en };

  function t(key, vars) {
    var s = D[I18N.lang][key];
    if (s == null) s = vi[key];
    if (s == null) return key;
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : s;
  }
  function apply(root) {
    root = root || document;
    [].forEach.call(root.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    [].forEach.call(root.querySelectorAll('[data-i18n-attr]'), function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (p) { var kv = p.split(':'); if (kv[1]) el.setAttribute(kv[0].trim(), t(kv[1].trim())); });
    });
  }
  // shrink-to-fit: font-size from the element's own size down to 70 %, until the text no longer overflows its box
  function fit(el) {
    if (!el.offsetWidth) return;
    if (el._fs0 == null) { el._fsInline = el.style.fontSize; el._fs0 = 0; }
    el.style.fontSize = el._fsInline;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    var base = parseFloat(getComputedStyle(el).fontSize), fs = base;
    while (fs > base * 0.7 && el.scrollWidth > el.clientWidth + 1) { fs = Math.max(base * 0.7, fs - Math.max(1, base * 0.04)); el.style.fontSize = fs.toFixed(1) + 'px'; }
  }
  function fitIn(root) { try { [].forEach.call((root || document).querySelectorAll('[data-i18n], [data-fit]'), fit); } catch (e) { } }
  function set(lang) {
    if (!D[lang]) lang = 'vi';
    I18N.lang = lang;
    try {
      document.documentElement.lang = lang;
      document.body.classList.toggle('lang-vi', lang === 'vi'); document.body.classList.toggle('lang-en', lang === 'en');
      apply(document);
      var ev; try { ev = new CustomEvent('langchange', { detail: { lang: lang } }); } catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('langchange', false, false, { lang: lang }); }
      document.dispatchEvent(ev);
    } catch (e) { }
  }
  var I18N = { lang: 'vi', dict: D, t: t, set: set, apply: apply, fit: fit, fitIn: fitIn };
  window.I18N = I18N;
})();
