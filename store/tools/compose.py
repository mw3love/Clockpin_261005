"""raw_{en,ko}/*.png → store/screenshots/{en,ko}/N.png (1280x800) + store/promo-small-440x280.png"""
import os, subprocess, pathlib
from PIL import Image

S = pathlib.Path(__file__).parent
STORE = pathlib.Path(r'C:/Users/7make/Dev/Clockpin_261005/store')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
ICON = pathlib.Path(r'C:/Users/7make/Dev/Clockpin_261005/extension/icons/icon128.png')

CAP = {
    'en': [('Pick the exact time', 'Spin the dial to when you want the alarm — or tap +5m, +10m, +1h.'),
           ('Count down, too', 'Hours, minutes and seconds. Clockpin remembers the last time you used.'),
           ('Pause, add, cancel', 'A big countdown ring, with +1 min and +5 min a click away.'),
           ('Know when it ends', 'Alarms show the exact end time and how much is left.'),
           ("Hard to miss", 'A sound, a notification and a small window when time is up. Snooze in one click.')],
    'ko': [('끝나는 시각을 바로 고르기', '다이얼을 돌려 알람 시각을 맞추거나 +5분, +10분, +1시간을 누르세요.'),
           ('거꾸로 세는 타이머도', '시·분·초로 맞추고, 마지막에 쓴 시간을 기억해요.'),
           ('일시정지, 1분 더, 취소', '남은 시간이 링에 크게 보이고, +1분·+5분은 클릭 한 번이에요.'),
           ('언제 끝나는지 한눈에', '알람은 끝나는 시각과 남은 시간을 함께 보여 줘요.'),
           ('시간이 되면 확실하게', '알림음, 알림, 작은 창으로 알려 줘요. 「5분 더」도 한 번에.')],
}
RAW = ['1-alarm', '2-timer', '3-timer-run', '4-alarm-run', '5-alert']

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@500;700&display=block">
<style>
html,body{margin:0;width:1280px;height:800px;overflow:hidden}
body{background:#C4DACF;word-break:keep-all;font-family:"IBM Plex Sans KR","Malgun Gothic","Segoe UI",sans-serif;color:#1E3A33;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box}
.t{flex:1;display:flex;flex-direction:column;gap:20px}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:22px;color:#56706A}
.brand img{width:40px;height:40px}
h1{margin:0;font-size:54px;line-height:1.15;font-weight:700;letter-spacing:-.01em}
p{margin:0;font-size:24px;line-height:1.5;color:#3F5A53;max-width:520px}
.shot{flex:none;border-radius:18px;overflow:hidden;box-shadow:0 30px 60px rgba(30,58,51,.25),0 6px 16px rgba(30,58,51,.12)}
.shot img{display:block;width:__W__px}
</style></head><body>
<div class="t"><div class="brand"><img src="__ICON__">Clockpin</div><h1>__H__</h1><p>__P__</p></div>
<div class="shot"><img src="__IMG__"></div>
</body></html>"""

PROMO = """<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@700&display=block">
<style>html,body{margin:0;width:440px;height:280px;overflow:hidden}
body{background:#DDEBE5;font-family:"IBM Plex Sans KR","Segoe UI",sans-serif;color:#1E3A33;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
img{width:96px;height:96px}
h1{margin:0;font-size:40px;font-weight:700;letter-spacing:-.01em}
p{margin:0;font-size:17px;color:#56706A;font-weight:700}</style></head><body>
<img src="__ICON__"><h1>Clockpin</h1><p>Alarm &amp; timer on a dial</p></body></html>"""


def render(html, out, w, h):
    tmp = S / '_page.html'
    tmp.write_text(html, encoding='utf-8')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--window-size={w},{h}',
                    '--virtual-time-budget=5000', f'--screenshot={out}', tmp.as_uri()], capture_output=True)
    im = Image.open(out).convert('RGB')     # 스토어는 알파 없는 이미지를 권장
    assert im.size == (w, h), im.size
    im.save(out)


for L in ['en', 'ko']:
    d = STORE / 'screenshots' / L
    d.mkdir(parents=True, exist_ok=True)
    for i, (name, (hd, p)) in enumerate(zip(RAW, CAP[L]), 1):
        img = S / f'raw_{L}' / f'{name}.png'
        w = Image.open(img).width / 1.5     # 캡처가 1.5배라 CSS 크기로 되돌린 뒤 키운다
        html = PAGE.replace('__H__', hd).replace('__P__', p).replace('__IMG__', img.as_uri()) \
                   .replace('__ICON__', ICON.as_uri()).replace('__W__', str(int(w * 1.35)))
        render(html, str(d / f'{i}.png'), 1280, 800)
        print(L, i)
render(PROMO.replace('__ICON__', ICON.as_uri()), str(STORE / 'promo-small-440x280.png'), 440, 280)
print('promo')
