/* Cấu hình riêng của máy này (không bắt buộc) — v2.3, nối Google Sheet.
 * Dùng khi ở booth không có bàn phím để nhập trong Admin / Control Center:
 *   1. Mở file này bằng TextEdit (Mac) hoặc Notepad (Windows).
 *   2. Dán link web app vào giữa hai dấu nháy của sheetUrl (dạng https://script.google.com/macros/s/…/exec).
 *   3. Gõ mã bí mật (giống TOKEN trong Code.gs) vào sheetToken; đặt tên máy vào kioskName (ví dụ LED-1), bỏ trống = LED-1.
 *   4. Lưu file, mở lại game.
 *   5. Chỉ dùng file này khi mở game từ máy (MO_GAME_Mac.command / MO_GAME_Windows.bat). Bản đưa lên web (Android):
 *      nhập link + mã trong Control Center, vì file đưa lên web thì ai có link cũng tải được (lộ mã bí mật).
 * Giá trị đã nhập trong Admin / Control Center được ưu tiên hơn file này. Ô để trống thì bỏ qua.
 * Hướng dẫn đầy đủ: tools/google_sheet/HUONG_DAN_GOOGLE_SHEET.md
 */
window.LOCAL_CONFIG = { sheetUrl: '', sheetToken: '', kioskName: '' };
