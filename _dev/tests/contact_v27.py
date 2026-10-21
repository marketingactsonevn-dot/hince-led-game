# v2.7 report: side-by-side contact sheets from _dev/report_v2_7/shots (run after shots_v27.js). python3 _dev/tests/contact_v27.py
from PIL import Image, ImageDraw, ImageFont
D = '_dev/report_v2_7/'
def font(n):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',):
        try: return ImageFont.truetype(f, n)
        except Exception: pass
    return ImageFont.load_default()
def sheet(out, cols, w=432):
    h = round(w * 1920 / 1080); top = 56
    im = Image.new('RGB', (w * len(cols) + 12 * (len(cols) - 1), h + top), '#2E1C1F'); d = ImageDraw.Draw(im)
    for i, (f, label) in enumerate(cols):
        x = i * (w + 12)
        im.paste(Image.open(D + 'shots/' + f + '.jpg').convert('RGB').resize((w, h), Image.LANCZOS), (x, top))
        d.text((x + 12, 14), label, fill='#EDD7D4', font=font(24))
    im.save(D + out, quality=86); print(D + out, im.size)
sheet('compare_theme.jpg', [('before_v26_01_attract', 'TRƯỚC v2.6'), ('01_attract', 'SAU v2.7'), ('before_v26_03_play_taptap2', 'TRƯỚC v2.6'), ('03_play_taptap2', 'SAU v2.7')])
sheet('compare_result.jpg', [('before_v26_04_result_t2', 'TRƯỚC: điểm thô + Mức 2'), ('04_result_full', 'SAU: 96/100 + Nu Blur Tint'), ('before_v26_06_reward_t2', 'TRƯỚC: phiếu quà'), ('06_reward_full', 'SAU: phiếu có ảnh quà')])
sheet('compare_keyboard.jpg', [('before_v26_05_form_name_vi', 'TRƯỚC: phím tràn'), ('05_form_name_vi', 'SAU: tên VI'), ('05_form_name_en', 'SAU: tên EN'), ('05_form_phone_vi', 'SAU: số ĐT')])
sheet('gifts_result.jpg', [('04_result_hairTie', '52 → Hair Tie'), ('04_result_mirror', '61 → Heart Mirror'), ('04_result_mini', '78 → Nu Blur Mini'), ('04_result_full', '96 → Nu Blur Tint')])
sheet('gifts_effect.jpg', [('04_result_anim_hairTie', 'Hiệu ứng: Hair Tie (nhẹ)'), ('04_result_anim_mini', 'Mini (vừa)'), ('04_result_anim_full', 'Full-size (mạnh nhất)'), ('04_result_soldout', 'Hết sạch quà')])
sheet('gifts_receipt.jpg', [('06_reward_hairTie', 'Phiếu: Hair Tie'), ('06_reward_mirror', 'Heart Mirror'), ('06_reward_mini', 'Nu Blur Mini'), ('06_reward_full', 'Nu Blur Tint')])
sheet('control_center.jpg', [('before_v26_08_cc_gifts', 'TRƯỚC: khu Quà v2.6'), ('08_cc_gifts', 'SAU v2.7.1: tab Quà'), ('08_cc_overview', 'SAU v2.7.1: tab Tổng quan')])
