// 타이머의 실제 시간은 여기서만 관리한다. 팝업은 닫히면 사라지므로 화면 역할만 한다.
// 상태(chrome.storage.local)
//   timer: { total(초), status: 'running'|'done', endAt(ms), doneAt }
//   sw:    { acc(ms), start(ms), on, laps: [누적 ms] }
importScripts('common.js');

const COLORS = { running: '#FF6F5B', done: '#E2463A', sw: '#1E3A33' };
let secTimer = null, endTimer = null, tickTimer = null, finishing = false;

async function load() {
  const { timer = null, sw = null } = await chrome.storage.local.get(['timer', 'sw']);
  return { timer, sw: sw || { ...EMPTY_SW } };
}

// 상태가 바뀔 때마다 부른다: 알람·배지·메뉴를 상태에 맞춘다
async function sync() {
  clearInterval(secTimer); clearTimeout(endTimer); clearTimeout(tickTimer);
  secTimer = endTimer = tickTimer = null;
  await chrome.alarms.clearAll();
  const { timer, sw } = await load();
  const now = Date.now();
  if (timer && timer.status === 'running') {
    const rem = timer.endAt - now;
    if (rem <= 0) return finish();
    // 정식 배포판은 30초 미만 알람을 지키지 않으므로, 끝 알람은 예비용이다
    chrome.alarms.create('done', { when: timer.endAt });
    if (rem <= 61000) {
      // 마지막 1분: 매초 배지를 바꾼다. 이 호출이 백그라운드를 깨어 있게 한다
      secTimer = setInterval(updateBadge, 1000);
      endTimer = setTimeout(finish, rem);
    }
  }
  await updateBadge();
  await updateMenu();
  scheduleTick(timer, sw, now);
}

// 배지 글자가 다음에 바뀌는 순간에 다시 깨어난다
function scheduleTick(timer, sw, now) {
  let next = Infinity;
  if (timer && timer.status === 'running') {
    const rem = timer.endAt - now;
    if (rem > 61000) next = Math.min(next, rem % 60000 || 60000);
  }
  if (sw.on) {
    const el = sw.acc + now - sw.start;
    next = Math.min(next, 60000 - (el % 60000));
  }
  if (!isFinite(next)) return;
  chrome.alarms.create('tick', { when: now + next + 50 });
  if (next < 30000) tickTimer = setTimeout(sync, next + 50);
}

async function updateBadge() {
  const { timer, sw } = await load();
  const now = Date.now();
  let text = '', color = COLORS.running;
  if (timer) {
    if (timer.status === 'running') text = badgeText(timer.endAt - now);
    else { text = t('badgeDone'); color = COLORS.done; }
  } else if (sw.on) {
    text = Math.floor((sw.acc + now - sw.start) / 60000) + 'm';
    color = COLORS.sw;
  }
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
}

async function finish() {
  if (finishing) return;
  finishing = true;
  try {
    const { timer } = await load();
    if (!timer || timer.status !== 'running') return;
    if (timer.endAt - Date.now() > 1000) return sync();
    timer.status = 'done';
    timer.doneAt = Date.now();
    await chrome.storage.local.set({ timer });
    const s = await getSettings();
    chrome.notifications.create('timer-done', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: t('timesUp'),
      message: t('notifMsg', fmtClock(new Date(timer.endAt))),
      requireInteraction: true,
      priority: 2,
      silent: s.sound,
      buttons: [{ title: t('moreMin', 5) }, { title: t('dismiss') }]
    });
    if (s.alertWindow) await openAlert();
    if (s.sound) await playSound();
  } finally {
    finishing = false;
  }
  await sync();
}

/* ---------- 알림 창(N2) ---------- */
async function openAlert() {
  await closeAlert();
  const w = await chrome.windows.create({ url: 'alert.html', type: 'popup', width: 340, height: 340, focused: true });
  await chrome.storage.session.set({ alertWin: w.id });
}
async function closeAlert() {
  const { alertWin } = await chrome.storage.session.get('alertWin');
  if (alertWin == null) return;
  await chrome.storage.session.remove('alertWin');
  await chrome.windows.remove(alertWin).catch(() => {});
}

/* ---------- 소리(숨은 페이지에서 재생) ---------- */
async function playSound() {
  const ctx = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (!ctx.length) {
    await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: t('soundWhy') })
      .catch(() => {});
  }
  await chrome.runtime.sendMessage({ target: 'offscreen', cmd: 'play' }).catch(() => {});
}
async function stopSound() {
  await chrome.runtime.sendMessage({ target: 'offscreen', cmd: 'stop' }).catch(() => {});
  await chrome.offscreen.closeDocument().catch(() => {});
}

async function stopAlerts() {
  await chrome.notifications.clear('timer-done');
  await closeAlert();
  await stopSound();
}

/* ---------- 명령 처리 ---------- */
async function handle(m) {
  const { timer, sw } = await load();
  const now = Date.now();
  const startTimer = secs => ({ total: secs, endAt: now + secs * 1000, status: 'running' });
  switch (m.cmd) {
    case 'start':
      await stopAlerts();
      await chrome.storage.local.set({ timer: startTimer(m.secs) });
      break;
    case 'startAt':
      // 팝업 다이얼: 끝나는 시각을 직접 받는다(그 분의 0초)
      if (m.endAt > now) {
        await stopAlerts();
        await chrome.storage.local.set({ timer: { total: Math.round((m.endAt - now) / 1000), endAt: m.endAt, status: 'running' } });
      }
      break;
    case 'add':
      if (timer && timer.status === 'running')
        await chrome.storage.local.set({ timer: { ...timer, total: timer.total + m.secs, endAt: timer.endAt + m.secs * 1000 } });
      break;
    case 'snooze':
      await stopAlerts();
      await chrome.storage.local.set({ timer: startTimer(m.secs) });
      break;
    case 'cancel':
    case 'dismiss':
      await stopAlerts();
      await chrome.storage.local.remove('timer');
      break;
    case 'swToggle':
      await chrome.storage.local.set({ sw: sw.on ? { ...sw, on: false, acc: sw.acc + now - sw.start } : { ...sw, on: true, start: now } });
      break;
    case 'swLap':
      if (sw.on || sw.acc) await chrome.storage.local.set({ sw: { ...sw, laps: [...sw.laps, sw.acc + (sw.on ? now - sw.start : 0)] } });
      break;
    case 'swReset':
      await chrome.storage.local.set({ sw: { ...EMPTY_SW } });
      break;
  }
  await sync();
}

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.target === 'offscreen') return;
  handle(m).then(() => reply({ ok: true }), e => reply({ ok: false, error: String(e) }));
  return true;
});

/* ---------- 우클릭 메뉴(M1) ---------- */
const menuUpdate = (id, props) => new Promise(r => chrome.contextMenus.update(id, props, () => { void chrome.runtime.lastError; r(); }));

async function buildMenus() {
  const s = await getSettings();
  await new Promise(r => chrome.contextMenus.removeAll(r));
  const add = props => chrome.contextMenus.create({ contexts: ['action'], ...props }, () => void chrome.runtime.lastError);
  s.presets.forEach((min, i) => add({ id: 'p' + i, title: t('menuTimer', durText(min * 60)) }));
  add({ id: 'sw', title: t('menuSwStart') });
  add({ id: 'cancel', title: t('menuStop'), enabled: false });
  await updateMenu();
}

async function updateMenu() {
  const { timer, sw } = await load();
  await menuUpdate('sw', { title: t(sw.on ? 'menuSwPause' : sw.acc ? 'menuSwResume' : 'menuSwStart') });
  let title = t('menuStop');
  if (timer?.status === 'running') title = t('menuStopLeft', badgeText(timer.endAt - Date.now()));
  else if (timer?.status === 'done') title = t('menuDismiss');
  await menuUpdate('cancel', { title, enabled: !!timer });
}

chrome.contextMenus.onClicked.addListener(async info => {
  const id = String(info.menuItemId);
  if (id.startsWith('p')) {
    const s = await getSettings();
    const min = s.presets[+id.slice(1)];
    if (min) handle({ cmd: 'start', secs: min * 60 });
  } else if (id === 'sw') handle({ cmd: 'swToggle' });
  else if (id === 'cancel') handle({ cmd: 'dismiss' });
});

/* ---------- 이벤트 ---------- */
chrome.notifications.onButtonClicked.addListener((id, idx) => {
  if (id !== 'timer-done') return;
  handle(idx === 0 ? { cmd: 'snooze', secs: 300 } : { cmd: 'dismiss' });
});
chrome.notifications.onClicked.addListener(id => { if (id === 'timer-done') handle({ cmd: 'dismiss' }); });
chrome.notifications.onClosed.addListener((id, byUser) => { if (id === 'timer-done' && byUser) handle({ cmd: 'dismiss' }); });

chrome.windows.onRemoved.addListener(async winId => {
  const { alertWin } = await chrome.storage.session.get('alertWin');
  if (winId !== alertWin) return;
  await chrome.storage.session.remove('alertWin');
  const { timer } = await load();
  if (timer?.status === 'done') handle({ cmd: 'dismiss' });
});

chrome.alarms.onAlarm.addListener(() => sync());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  const a = changes.settings.oldValue?.presets, b = changes.settings.newValue?.presets;
  if (JSON.stringify(a) !== JSON.stringify(b)) buildMenus();
});
chrome.runtime.onInstalled.addListener(() => { buildMenus(); sync(); });
chrome.runtime.onStartup.addListener(() => { buildMenus(); sync(); });
