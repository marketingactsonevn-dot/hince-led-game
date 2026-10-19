# Prompt dán vào Claude Code (Cloud) – repo hince-led-game

Đọc và thực hiện TOÀN BỘ file `_dev/TASK_v2_7.md` trong repo này (hince LED Game v2.7: theme hồng, thang điểm 100 + 3 mức quà, kho quà 500/200/100/50, màn trúng quà có ảnh + hiệu ứng, sửa bàn phím tràn khung).

Cách làm:
- Làm hết mục 1 → 6 trong MỘT lần chạy, KHÔNG dừng lại hỏi hay chờ duyệt. Chỗ nào chưa rõ: tự chọn phương án hợp lý nhất theo đúng tinh thần spec và ghi vào mục "giả định đã tự quyết" của báo cáo.
- Đọc code hiện có trước khi sửa (index.html, css/style.css, js/*.js, sw.js). Giữ nguyên phong cách giấy & sticker, chỉ đổi màu theo spec. Vanilla JS ES5, không framework, không CDN, phải chạy offline và qua file://.
- Không ghi bất kỳ link / mã bí mật Google Sheet nào vào repo; giữ config.local.js trống.
- Tự kiểm tra bằng test Node + Playwright chụp màn hình 1080×1920 theo mục 6.
- Làm trên nhánh mới `v2.7`, commit theo từng phần, push, mở Pull Request vào `main` kèm tóm tắt báo cáo + ảnh chụp. KHÔNG merge vào main (main đang là bản live).
- Kết thúc: viết `_dev/report_v2_7/REPORT.md` bằng tiếng Việt dễ hiểu cho PM.
