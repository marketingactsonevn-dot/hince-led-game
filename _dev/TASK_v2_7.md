# TASK v2.7 – hince LED Game: theme hồng + thang điểm 100 + 3 mức quà + kho quà + màn trúng quà + sửa bàn phím

Ngày: 19/10/2026 · Owner: đại ca Sói (Mr. Le, PM Actsone Vietnam) · Spec viết bởi Claude (Cowork)
Repo: `marketingactsonevn-dot/hince-led-game` (đang chạy GitHub Pages từ nhánh `main` – **bản web đang live**).

## 0. Bối cảnh – đọc trước
- Đây là game cảm ứng chạy trên màn LED đứng 43" (dọc, 1080×1920) tại hince Pop-Up Takashimaya HCMC, 27/11 – 03/12/2026. 4 game: **Um-Pah! 1**, **Um-Pah! 2** (Nu Blur Tint), **Tap-Tap! 1**, **Tap-Tap! 2** (Radiance Balm). Sau khi chơi: màn kết quả → form tên + SĐT (bàn phím trên màn hình) → phiếu quà (receipt + barcode) → màn cảm ơn.
- Repo này = bản web chạy thật (HTML + CSS + JS thuần, ES5, **không build step, không framework, không CDN**, phải chạy offline và chạy được từ `file://`). Code chính: `index.html`, `css/style.css`, `js/*.js` (`logic.js`, `logic2.js` không đụng DOM; `app.js` điều khiển màn; `admin.js` = Control Center; `store.js` lưu máy; `sheet.js` gửi Google Sheet; `i18n.js` chữ VI/EN; `config.js` mặc định), `sw.js` (bộ nhớ offline), `assets/`.
- Design hiện tại v2.6 "giấy & sticker": nền giấy kraft màu toffee, thẻ giấy kem, băng keo, sticker, chữ serif nghiêng (Noto Serif Display), Be Vietnam Pro, IBM Plex Mono. **Giữ nguyên toàn bộ phong cách giấy & sticker**, chỉ đổi màu theo §1.
- Test logic có sẵn: `_dev/tests/logic.test.js`, `_dev/tests/logic2.test.js` (chạy `node _dev/tests/logic.test.js`). Tài liệu tham khảo: `_dev/ref/`.
- `config.local.js` trong repo là file **trống có chủ đích** (bản web không chứa link/mã Google Sheet). **Tuyệt đối không ghi link hay mã bí mật nào vào repo.**

## 1. Đổi màu chủ đạo sang hồng hince (theme "Rose")
Ảnh mẫu: `_dev/ref/theme_rose_reference.png` (nền hồng phấn có vân nhẹ, chữ hince màu hồng sáng).

**Mô tả màu mẫu (đã đo từ ảnh):**
- Nền chính: hồng đất phấn **#C99196** (giữa ảnh #CA9297), góc trên-trái tối nhẹ **#B78387**, góc dưới-phải tối nhẹ **#B27F83**, góc trên-phải / dưới-trái sáng **#CB9297** → một gradient chéo rất nhẹ (vignette 2 góc), mặt nền mịn như giấy mỹ thuật.
- Chữ logo trên nền: hồng sáng **#EDD7D4**.

**Bảng màu mới** (thay biến trong `:root` của `css/style.css`; tìm và thay cả các mã màu viết cứng như `rgba(76,54,43,…)`, `#B6845D`, `#2B1D16`):

| Biến | Cũ (v2.6) | Mới (v2.7) | Dùng cho |
|---|---|---|---|
| `--bg` | `#B6845D` + `bg_toffee_paper.jpg` | `#C99196` + **`assets/v27/bg/bg_rose_paper.jpg`** (mới, xem dưới) | nền mọi màn |
| `--ink`, `--cocoa` | `#4C362B` | **`#4A2F33`** (mauve cocoa) | chữ chính, nút đậm (tương phản 4,6:1 trên nền hồng; 11:1 trên giấy) |
| `--ink2` | `#7D6458` | **`#7A5A5E`** | chữ phụ |
| `--ink3` | `#B19C91` | **`#B39A9C`** | chữ rất phụ, nét đứt |
| `--paper`, `--cream` | `#FBF4EC` | **`#FBF3F0`** (kem ánh hồng) | thẻ giấy |
| `--white` | `#FFFBF7` | **`#FFFBF9`** | |
| `--rose` (nhấn Um-Pah!, stamp, badge) | `#B8728D` | **`#9C4A5E`** (berry) | gần màu nền cũ quá → đậm lên để nổi trên giấy (5,4:1) |
| `--rose-soft`, `--azalea` | `#DFA6BB` | **`#EDD7D4`** (blush – đúng màu chữ logo mẫu) | điểm nhấn sáng đặt trên nền hồng |
| `--champ`, `--butter`, `--lilac-soft` | `#F8D8B9` | **`#F6DDCC`** (champagne ấm) | highlight, sticker |
| `--tap`, `--lilac` (nhấn Tap-Tap!) | `#C99A72` | **`#8E6A88`** (plum lilac – Radiance Balm) | badge/nhấn Tap-Tap! |
| `--tapText` | `#9C6A44` | **`#6E4E69`** | chữ nhấn Tap-Tap! |
| bóng đổ | `rgba(76,54,43,x)` | **`rgba(74,47,51,x)`** | mọi box-shadow |
| nền ngoài khung (`html, body`) | `#2B1D16` | **`#2E1C1F`** | |

- **Nền giấy hồng `bg_rose_paper.jpg`**: tạo bằng Python (Pillow có sẵn hoặc `pip install pillow`) từ `assets/v26/bg/bg_toffee_paper.jpg`: lấy độ sáng (luminance) của ảnh cũ để giữ vân giấy, map lên màu #C99196 (vân giữ biên độ nhẹ ±4%), thêm gradient chéo theo 4 góc như mô tả ở trên. Cùng kích thước 1080×1920, JPG q≈84, ≤ 600 KB. Chụp so sánh với ảnh mẫu để màu khớp.
- Sticker / ảnh có nền toffee "nướng" sẵn trong ảnh (vd. video intro sản phẩm 3D `assets/video/reveal/*`, ảnh trong `assets/v26/`): kiểm tra từng cái. Nếu viền toffee lộ rõ trên nền hồng thì đặt ảnh/video vào khung "ảnh polaroid / thẻ giấy" (paper card + băng keo) để phần nền cũ trông như nền ảnh chụp, **không** cố tách nền video. Liệt kê các file như vậy trong báo cáo.
- Được phép tinh chỉnh ±1 bậc sáng/tối các màu trên nếu chụp màn hình thấy chưa hài hoà, nhưng giữ đúng tinh thần: nền hồng phấn, chữ mauve-cocoa, giấy kem ánh hồng, nhấn berry / plum. Ghi lại mã cuối cùng trong báo cáo.

## 2. Thang điểm 100 + 3 mức quà (đã chốt)
**Điểm**
- Mỗi game giữ cách tính điểm gốc nội bộ, nhưng **mọi chỗ khách nhìn thấy** (HUD trong game, màn kết quả, phiếu quà) hiển thị **điểm 0–100**: `score100 = clamp(round(100 × raw / maxScore), 0, 100)` (dùng `umpahMax()`, `chartMax()`… hiện có cho từng game). 100 chỉ đạt được khi chơi hoàn hảo.
- Bỏ ngưỡng % riêng từng game (`thresholds` per game). Thay bằng ngưỡng chung (chỉnh được trong Control Center): **mid = 70**, **high = 90**.
- Không đổi luật chơi, thời gian, độ khó (easy/normal/hard vẫn như cũ).

**Mức quà** (mọi người chơi đều có quà – bỏ trường hợp "không đạt quà"):

| Điểm (thang 100) | Quà | Ghi chú |
|---|---|---|
| 0 – 69 | **hince Hair Tie** hoặc **hince Heart Mirror** | **ngẫu nhiên** – xác suất theo số còn lại trong kho (vd. còn 500 Hair Tie / 200 Mirror → ~71% / 29%) để 2 món hết cùng lúc |
| 70 – 89 | **hince Nu Blur Tint Mini** | màu ngẫu nhiên |
| 90 – 100 | **hince Nu Blur Tint** (full-size) | màu ngẫu nhiên |

**Kho quà** (tổng cả sự kiện, **không** tự nạp lại mỗi ngày – bỏ `dailyStock`):

| Quà | Số lượng tối đa |
|---|---|
| hince Hair Tie | **500** |
| hince Heart Mirror | **200** |
| hince Nu Blur Tint Mini | **100** |
| hince Nu Blur Tint (full-size) | **50** |

- Quy tắc khi hết hàng: Full-size hết → tặng Mini; Mini hết → tặng Hair Tie / Mirror; một trong hai món Hair Tie / Mirror hết → chỉ tặng món còn; cả hai hết → báo "Quà đã hết – vui lòng liên hệ nhân viên" (reason `outOfStock`). Không bao giờ tặng quà cao hơn mức điểm. Quà bị hạ mức → reason `downgraded`, phiếu quà vẫn in quà thực nhận.
- Giữ nguyên luật **mỗi SĐT chỉ nhận 1 quà** (`duplicateRule` hiện có).
- Thời điểm trừ kho: giữ như hiện tại (trừ khi phiếu quà được phát). Món quà (vd. Hair Tie hay Mirror) được **chọn 1 lần ở màn kết quả** và giữ nguyên tới phiếu quà.
- Tên quà (VI/EN) chỉnh được trong Control Center như hiện nay, mặc định như bảng trên (EN giữ nguyên tên sản phẩm).
- **Control Center** (`admin.js`): thay khu "Quà" cũ bằng: 4 dòng kho (còn lại / đã phát hôm nay / đã phát cả sự kiện, nút −10 −1 +1 +10), 2 ô ngưỡng 70 / 90, tên quà. Thống kê theo 4 món quà.
- **Dữ liệu**: bản ghi lưu `score` (gốc), `maxScore`, `scorePct` = **score100 (số nguyên)**, `tier` (1 = Hair Tie/Mirror, 2 = Mini, 3 = Full-size), `giftKey` (`hairTie` | `mirror` | `mini` | `full`), `giftName`. **Không thêm/bớt/đổi thứ tự cột gửi Google Sheet** (`CSV_COLS` / `sheet.js`) – chỉ đổi giá trị trong các cột sẵn có; nếu thật sự cần thêm cột thì thêm vào CUỐI và ghi rõ trong báo cáo để cập nhật Apps Script.
- **Chuyển dữ liệu máy cũ**: máy đã chạy v2.6 có `stock {tier1,tier2}` trong bộ nhớ → lần đầu mở v2.7 tự chuyển sang kho mới với số mặc định ở bảng trên (không cộng dồn số cũ). Ghi `appVersion` = `2.7.0`.
- Cập nhật `logic.js` (giữ không đụng DOM) + test: `score100`, `tierFor100`, `pickGift(tier, stock, rng)` (fallback + random theo kho), `resolveReward` mới. Sửa đường dẫn trong `_dev/tests/*.test.js` thành `../../js/...` và cho chạy pass; thêm test cho mọi quy tắc ở mục này (kể cả random theo kho: chạy 10.000 lần với rng có seed, tỉ lệ khớp ±3%).

## 3. Màn trúng quà – ảnh quà + hiệu ứng
Ảnh gốc: `_dev/gifts_input/` (PNG nền trong suốt): `hince Hair Tie.png`, `hince Heart Mirror.png`, `hince Nu Blur Tint Mini.png`, `hince Nu Blur Tint.png`.
- Tối ưu sang `assets/v27/gifts/` (`hair_tie.png`, `mirror.png`, `nu_blur_mini.png`, `nu_blur_full.png`; cạnh dài ≤ 900 px, giữ nền trong suốt, mỗi file ≤ 350 KB; WebP + PNG dự phòng nếu muốn). Không đưa ảnh gốc 1–2 MB vào app.
- **Khi màn kết quả hiện điểm** (sau khi số đếm lên xong): hiện quà đã trúng:
  1. Một **thẻ giấy kiểu polaroid** (giấy kem + băng keo trên đỉnh, đúng style v2.6) rơi từ trên xuống, xoay nhẹ −6° → 2° → −1° rồi đứng yên (spring, ~700 ms).
  2. Ảnh quà trong thẻ **nảy** 0.6 → 1.06 → 1 kèm bóng mềm; một vệt sáng lướt chéo qua ảnh 1 lần.
  3. **Pháo giấy**: 12–24 mảnh giấy nhỏ / sticker tim / lấp lánh màu blush #EDD7D4, berry #9C4A5E, champagne #F6DDCC, trắng – bung ra rồi rơi chậm (~1,2 s).
  4. Dưới ảnh: tên quà (serif nghiêng) + con dấu kiểu `.stamp` ("TRÚNG QUÀ!" / EN "YOU WIN!").
  5. **Mức độ ăn mừng theo quà**: Hair Tie / Mirror nhẹ nhàng (ít pháo giấy) · Mini vừa · Full-size mạnh nhất (nhiều pháo giấy + vệt sáng + sticker lấp lánh quanh thẻ).
- **Hai quà son (Mini và Full-size)**: ngay dưới tên quà có ghi chú nhỏ (mono, ~22 px, màu `--ink2`): **"*Màu son ngẫu nhiên"** / EN **"*Shade is random"**.
- Phiếu quà (receipt) hiện ảnh quà nhỏ (~160 px) cạnh tên quà để nhân viên đối chiếu; quà son cũng có dòng ghi chú màu ngẫu nhiên.
- Chỉ dùng CSS animation / Canvas 2D có sẵn, không thư viện ngoài. Phải mượt 60 fps trên màn LED (ưu tiên `transform` / `opacity`). Bấm vào màn trong lúc hiệu ứng → bỏ qua tới trạng thái cuối. Vẫn giữ hẹn giờ tự quay về màn chờ.
- Thêm các ảnh mới vào danh sách `FILES` trong `sw.js`.

## 4. Sửa lỗi bàn phím tràn khung (màn nhập thông tin)
Ảnh lỗi: `_dev/ref/bug_keyboard_overflow.jpg` – hàng phím Q…P và các phím XOÁ / TIẾP tràn ra ngoài 2 mép tờ giấy.
- Nguyên nhân dự kiến: `#s-form .kb` (left 140, width 800) + phím có độ rộng cố định nên tổng hàng 10 phím + gap rộng hơn khung.
- Sửa: khung bàn phím nằm **gọn trong lề tờ giấy** (cách mép trong tờ giấy ≥ 32 px mỗi bên); độ rộng phím tính theo khung (`flex: 1 1 0` hoặc grid 10 cột, có `max-width`, `box-sizing: border-box`), giữ vùng chạm ≥ 64 px cao, chữ không bị cắt. Áp dụng cho: bàn phím tên (VI), bàn phím EN, bàn phím số (SĐT).
- Kiểm tra bằng ảnh chụp 1080×1920 cả 3 bàn phím.

## 5. Chung
- `config.js`: `appVersion: '2.7.0'`; `sw.js`: `VERSION = 'hince-led-v2.7'` (để máy LED tự nhận bản mới) + đủ file mới trong `FILES`.
- Không đổi: luật chơi 4 game, Google Sheet / Apps Script, ngôn ngữ VI | EN, icon app, Control Center PIN, cấu trúc màn chơi.
- i18n: mọi chữ mới có đủ VI + EN trong `js/i18n.js`.
- Không đụng `config.local.js` (giữ file trống).

## 6. Kiểm tra & nghiệm thu (tự làm, không hỏi)
1. `node _dev/tests/logic.test.js && node _dev/tests/logic2.test.js` pass.
2. Chạy server tĩnh (`python3 -m http.server`) + Playwright (Chromium) ở viewport 1080×1920, chụp vào `_dev/report_v2_7/shots/`:
   - Màn chờ, chọn game, hướng dẫn, đang chơi (1 game mỗi loại), kết quả cho **cả 4 món quà** (ép điểm bằng Test mode / tham số), form với **3 kiểu bàn phím**, phiếu quà (4 món), màn cảm ơn, Control Center khu Quà.
   - Ảnh trước/sau theme (lấy "trước" từ commit cũ).
3. Kiểm tra mở được qua `file://` (không lỗi console), offline (service worker cache bản mới).
4. Viết `_dev/report_v2_7/REPORT.md` bằng **tiếng Việt dễ hiểu** (người đọc là PM, không phải dev): đã làm gì · bảng màu cuối cùng · ảnh chụp (link file) · checklist mục 1–5 ✅/❌ · việc cần đại ca làm sau khi merge (vd. Google Sheet Dashboard nếu cần sửa công thức đếm theo tier 3 mức) · rủi ro / giả định đã tự quyết.

## 7. Giao nộp
- Làm trên **nhánh mới** (vd. `v2.7`), commit theo từng phần (theme / scoring+stock / gift reveal / keyboard / tests+report), push, **mở Pull Request vào `main`** với mô tả = tóm tắt REPORT + 6–8 ảnh chụp chính.
- **KHÔNG merge vào `main`** – `main` đang là bản live; đại ca duyệt rồi tự bấm Merge.
