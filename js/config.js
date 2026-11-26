/* hince LED Game — default settings. Most values can be changed in Admin (saved on the device). */
window.DEFAULTS = {
  appVersion: '2.8.7',
  adminPin: '2026',

  // v2.7: every game shows a score 0–100 (Logic.score100); one pair of thresholds for all games (Control Center):
  // 0 … mid-1 = tier 1 (Heart Mirror), mid … high-1 = tier 2 (Raw Glow Gel Tint Mini), high … 100 = tier 3 (Nu Blur Tint)
  thresholds: { mid: 70, high: 90 },
  // game nào hiện ở màn chọn game (bật/tắt trong Admin; luôn còn ít nhất 1 game)
  games: { umpah: true, umpah2: true, taptap: true, taptap2: true },
  // v2.3 độ khó từng game: 'easy' | 'normal' | 'hard' (Control Center; áp dụng từ lượt sau; normal = như v2.2)
  difficulty: { umpah: 'hard', umpah2: 'hard', taptap: 'hard', taptap2: 'hard' }, // v2.8.2: owner 25/11 — default Hard for all 4 games
  defaultLang: 'vi',                       // v2.8.6: VI again (owner 25/11; v2.7.1 had EN); ngôn ngữ mặc định của màn chờ ('vi' | 'en'); khách chọn VI | EN cho lượt của mình, về màn chờ là trở lại mặc định
  productIntro: true,                     // v2.4: video giới thiệu sản phẩm 3D giữa màn chọn game và màn hướng dẫn (tắt = vào thẳng màn hướng dẫn)
  // v2.7 gift names (Control Center can rename; key = Logic.GIFT_KEYS)
  gifts: { mirror: 'hince Heart Mirror', mini: 'hince Raw Glow Gel Tint Mini', full: 'hince Nu Blur Tint' },
  // v2.7 event stock: the starting count of each gift for the whole event (NO daily refill). The live count is in Store.giftStock().
  giftStock: { mirror: 500, mini: 80, full: 50 }, // v2.8.5: Hair Tie dropped, Mirror 500; v2.8.7: mini = Raw Glow Gel Tint Mini, 80 (owner 26/11)
  miniShades: ['R002 Raw Rose', 'R006 Raw Grape', 'R015 Bite'], // v2.8.7: the receipt names one at random
  duplicateRule: 'perEvent',               // perEvent | perDay | none
  requireFormForNoTier: true,              // v2.7: gifts all gone (outOfStock) → still ask for name + phone

  sound: true,
  volume: 0.8,
  bgm: true,                               // nhạc nền (Âm thanh TẮT thì nhạc nền cũng tắt)
  bgmVolume: 0.35,
  latencyMs: 0,                            // bù trễ cảm ứng cho Tap-Tap (ms)
  testMode: false,

  // v2.3 Google Sheet (tools/google_sheet/HUONG_DAN_GOOGLE_SHEET.md): nhập trong Admin, hoặc điền src/config.local.js
  sheetUrl: '',                            // https://script.google.com/macros/s/…/exec
  sheetToken: '',                          // mã bí mật, giống TOKEN trong Code.gs
  kioskName: 'LED-1',                      // tên máy, lưu kèm mỗi lượt chơi (cột kiosk)
  sheetSync: true,                         // false = không gửi lên Sheet (vẫn lưu trên máy)

  idleSec: { select: 15, howto: 40, result: 45, form: 90, reward: 90, thanks: 12, warn: 10 }, // v2.8.3: select = flyer over the attract video → video again after 15 s idle (owner 25/11)
  autoReloadHours: 4,
  promoVideo: 'assets/video/promo.mp4',    // video quảng cáo cho nhân viên (nút ▶ VIDEO góc trên-phải màn chờ); không có file thì ẩn nút

  consentGiftText: 'Tôi đồng ý cho Actsone Vietnam (nhà phân phối hince tại Việt Nam) lưu họ tên, số điện thoại và kết quả chơi để xác nhận và trao quà tại hince Pop-Up Store. (bắt buộc)',
  consentMarketingText: 'Tôi đồng ý nhận thông tin ưu đãi từ hince Việt Nam. (không bắt buộc)',
  // v2.4 English twins (shown when the customer picks EN; empty = fall back to the Vietnamese text)
  giftsEn: { mirror: 'hince Heart Mirror', mini: 'hince Raw Glow Gel Tint Mini', full: 'hince Nu Blur Tint' },
  consentGiftTextEn: "I agree that Actsone Vietnam (hince's distributor in Vietnam) may keep my name, phone number and game result to confirm and hand over my gift at the hince Pop-Up Store. (required)",
  consentMarketingTextEn: "I'd like to receive offers from hince Vietnam. (optional)",
  policyText: 'Dữ liệu (họ tên, số điện thoại, điểm số) chỉ được dùng cho mục đích đã đồng ý ở trên, lưu trữ bởi Actsone Vietnam và không chia sẻ cho bên thứ ba. Bạn có thể yêu cầu xem, sửa hoặc xoá dữ liệu bằng cách liên hệ hince Việt Nam. [Nội dung chờ pháp chế duyệt]',
  policyTextEn: 'Your data (name, phone number, score) is only used for the purposes you agreed to above. It is kept by Actsone Vietnam and never shared with third parties. You can ask hince Vietnam to see, correct or delete it at any time. [Pending legal review]'
};
