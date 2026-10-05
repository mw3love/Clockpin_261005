"""스토어 스크린샷용: 확장을 올리고 화면 상태를 만들어 1.5배로 캡처한다. 사용: python shots.py <ext폴더> <출력폴더>"""
import asyncio, json, subprocess, sys, time, base64, os, urllib.request, tempfile, shutil
import websockets

CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
EXT, OUT = sys.argv[1], sys.argv[2]
PORT = 9334
SCALE = 1.5
os.makedirs(OUT, exist_ok=True)


class CDP:
    def __init__(self, ws): self.ws, self.n = ws, 0

    async def send(self, method, params=None, sid=None):
        self.n += 1
        msg = {'id': self.n, 'method': method, 'params': params or {}}
        if sid: msg['sessionId'] = sid
        await self.ws.send(json.dumps(msg))
        while True:
            r = json.loads(await self.ws.recv())
            if r.get('id') == self.n:
                if 'error' in r: raise RuntimeError(f'{method}: {r["error"]}')
                return r.get('result', {})


async def main():
    prof = tempfile.mkdtemp(prefix='cp-shot-')
    proc = subprocess.Popen([CHROME, f'--remote-debugging-port={PORT}', f'--user-data-dir={prof}',
                             '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check',
                             '--headless=new', '--hide-scrollbars', 'about:blank'])
    try:
        for _ in range(50):
            try: ver = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/version')); break
            except Exception: time.sleep(0.2)
        async with websockets.connect(ver['webSocketDebuggerUrl'], max_size=2**26) as ws:
            c = CDP(ws)
            ext = (await c.send('Extensions.loadUnpacked', {'path': EXT}))['id']
            await asyncio.sleep(1)

            async def open_page(path, w, h):
                tid = (await c.send('Target.createTarget', {'url': f'chrome-extension://{ext}/{path}'}))['targetId']
                sid = (await c.send('Target.attachToTarget', {'targetId': tid, 'flatten': True}))['sessionId']
                await c.send('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': SCALE, 'mobile': False}, sid)
                await asyncio.sleep(1.2)
                return tid, sid

            async def ev(sid, js):
                r = await c.send('Runtime.evaluate', {'expression': js, 'awaitPromise': True, 'returnByValue': True}, sid)
                if 'exceptionDetails' in r: raise RuntimeError(json.dumps(r['exceptionDetails'])[:600])
                return r['result'].get('value')

            async def shot(sid, name, w, fit=True):
                await asyncio.sleep(0.8)
                h = await ev(sid, 'Math.ceil(document.body.getBoundingClientRect().height)') if fit else None
                if fit: await c.send('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': SCALE, 'mobile': False}, sid)
                await asyncio.sleep(0.4)
                d = await c.send('Page.captureScreenshot', {'format': 'png'}, sid)
                open(os.path.join(OUT, name + '.png'), 'wb').write(base64.b64decode(d['data']))
                print('shot', name, h)

            async def theme(sid, t):
                await ev(sid, f"localStorage.setItem('theme','{t}'); 1")
                await c.send('Page.reload', {}, sid); await asyncio.sleep(1.2)

            # 1 알람 다이얼(어둡게): +10분 칩
            tid, sid = await open_page('popup.html', 320, 600)
            await theme(sid, 'dark')
            await ev(sid, "document.querySelector('[data-p=\"600\"]').click(); 1")
            await shot(sid, '1-alarm', 320)
            # 2 타이머 다이얼(밝게): 25분
            await theme(sid, 'light')
            await ev(sid, "document.querySelector('[data-tab=cd]').click(); 1"); await asyncio.sleep(0.3)
            await ev(sid, "document.querySelector('[data-c=\"1500\"]').click(); 1")
            await shot(sid, '2-timer', 320)
            # 3 타이머 진행(어둡게)
            await ev(sid, "chrome.runtime.sendMessage({cmd:'start', secs:1500}).then(()=>1)")
            await asyncio.sleep(3)
            await theme(sid, 'dark')
            await shot(sid, '3-timer-run', 320)
            # 4 알람 진행(밝게): 42분 뒤 정각 분
            await ev(sid, "chrome.runtime.sendMessage({cmd:'startAt', endAt: Math.floor(Date.now()/60000)*60000 + 42*60000}).then(()=>1)")
            await asyncio.sleep(1.5)
            await theme(sid, 'light')
            await shot(sid, '4-alarm-run', 320)
            # 5 시간 됐을 때 알림 창(어둡게)
            await ev(sid, "chrome.runtime.sendMessage({cmd:'start', secs:2}).then(()=>1)")
            await asyncio.sleep(4)
            await theme(sid, 'dark')
            tid2, sid2 = await open_page('alert.html', 340, 340)
            await shot(sid2, '5-alert', 340, fit=False)
            await shot(sid, '5-popup-done', 320)
    finally:
        proc.kill(); time.sleep(0.5); shutil.rmtree(prof, ignore_errors=True)

asyncio.run(main())
