// 타이머의 실제 시간은 여기서만 관리한다. 팝업은 닫히면 사라지므로 화면 역할만 한다.
// 상태(chrome.storage.local)
//   timer:  { mode: 'at'(알람)|'cd'(타이머), total(초), status: 'running'|'paused'|'done', endAt(ms), remaining(멈췄을 때 남은 ms), doneAt }
//   lastCd: 타이머 탭에서 마지막으로 시작한 시간(초)
importScripts('common.js');

const COLORS = { running: '#FF6F5B', done: '#E2463A', paused: '#56706A' };
let secTimer = null, endTimer = null, tickTimer = null, finishing = false;

async function load() {
  const { timer = null } = await chrome.storage.local.get('timer');
  return { timer };
}

// 상태가 바뀔 때마다 부른다: 알람·배지·메뉴를 상태에 맞춘다
async function sync() {
  clearInterval(secTimer); clearTimeout(endTimer); clearTimeout(tickTimer);
  secTimer = endTimer = tickTimer = null;
  await chrome.alarms.clearAll();
  const { timer } = await load();
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
  scheduleTick(timer, now);
}

// 배지 글자가 다음에 바뀌는 순간에 다시 깨어난다
function scheduleTick(timer, now) {
  if (!timer || timer.status !== 'running') return;
  const rem = timer.endAt - now;
  if (rem <= 61000) return;
  const next = rem % 60000 || 60000;
  chrome.alarms.create('tick', { when: now + next + 50 });
  if (next < 30000) tickTimer = setTimeout(sync, next + 50);
}

async function updateBadge() {
  const { timer } = await load();
  const now = Date.now();
  let text = '', color = COLORS.running;
  if (timer) {
    if (timer.status === 'running') text = badgeText(timer.endAt - now);
    else if (timer.status === 'paused') { text = badgeText(timer.remaining); color = COLORS.paused; }
    else { text = t('badgeDone'); color = COLORS.done; }
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
      message: timer.mode === 'cd' ? t('notifCd', durText(timer.total)) : t('notifMsg', fmtClock(new Date(timer.endAt))),
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
  const { timer } = await load();
  const now = Date.now();
  const startTimer = (secs, mode) => ({ mode, total: secs, endAt: now + secs * 1000, status: 'running' });
  switch (m.cmd) {
    case 'start':
      // 타이머(팝업 타이머 탭·우클릭 메뉴). 이 시간을 다음에도 쓰도록 기억한다
      await stopAlerts();
      await chrome.storage.local.set({ timer: startTimer(m.secs, 'cd'), lastCd: m.secs });
      break;
    case 'startAt':
      // 팝업 다이얼: 끝나는 시각을 직접 받는다(그 분의 0초)
      if (m.endAt > now) {
        await stopAlerts();
        await chrome.storage.local.set({ timer: { mode: 'at', total: Math.round((m.endAt - now) / 1000), endAt: m.endAt, status: 'running' } });
      }
      break;
    case 'add':
      if (timer?.status === 'running')
        await chrome.storage.local.set({ timer: { ...timer, total: timer.total + m.secs, endAt: timer.endAt + m.secs * 1000 } });
      else if (timer?.status === 'paused')
        await chrome.storage.local.set({ timer: { ...timer, total: timer.total + m.secs, remaining: timer.remaining + m.secs * 1000 } });
      break;
    case 'pause':
      if (timer?.status === 'running')
        await chrome.storage.local.set({ timer: { ...timer, status: 'paused', remaining: Math.max(0, timer.endAt - now) } });
      break;
    case 'resume':
      if (timer?.status === 'paused')
        await chrome.storage.local.set({ timer: { ...timer, status: 'running', endAt: now + timer.remaining } });
      break;
    case 'snooze':
      // 끝난 탭(알람/타이머)에 그대로 남는다
      await stopAlerts();
      await chrome.storage.local.set({ timer: startTimer(m.secs, timer?.mode || 'at') });
      break;
    case 'cancel':
    case 'dismiss':
      await stopAlerts();
      await chrome.storage.local.remove('timer');
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
  add({ id: 'cancel', title: t('menuStop'), enabled: false });
  await updateMenu();
}

async function updateMenu() {
  const { timer } = await load();
  let title = t('menuStop');
  if (timer?.status === 'running') title = t('menuStopLeft', badgeText(timer.endAt - Date.now()));
  else if (timer?.status === 'paused') title = t('menuStopLeft', badgeText(timer.remaining));
  else if (timer?.status === 'done') title = t('menuDismiss');
  await menuUpdate('cancel', { title, enabled: !!timer });
}

chrome.contextMenus.onClicked.addListener(async info => {
  const id = String(info.menuItemId);
  if (id.startsWith('p')) {
    const s = await getSettings();
    const min = s.presets[+id.slice(1)];
    if (min) handle({ cmd: 'start', secs: min * 60 });
  } else if (id === 'cancel') handle({ cmd: 'dismiss' });
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
// 예전 버전의 스톱워치 기록(sw)은 지운다
chrome.runtime.onInstalled.addListener(() => { chrome.storage.local.remove('sw'); buildMenus(); sync(); });
chrome.runtime.onStartup.addListener(() => { buildMenus(); sync(); });
