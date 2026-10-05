// 팝업은 화면만 그린다. 시간 계산의 기준(endAt 등)은 백그라운드가 저장한 값을 읽는다.
const $ = id => document.getElementById(id);
const IH = 46;                        // 다이얼 한 칸 높이(px)
const RC = 2 * Math.PI * 80;          // 링 둘레
const send = m => chrome.runtime.sendMessage(m);

let timer = null, tab = 'at', settingsOpen = false;   // tab: 'at'(알람) | 'cd'(타이머)

localize();
document.querySelectorAll('[data-p]').forEach(b => {
  const m = b.dataset.p / 60;
  b.textContent = m % 60 ? t('chipMin', m) : t('chipHour', m / 60);
});
presetLabels();
function presetLabels() {
  ['p0', 'p1', 'p2', 'p3'].forEach((id, i) => $(id).setAttribute('aria-label', t('presetN', i + 1)));
}

/* ---------- 다이얼: 끝나는 시각(오전/오후 · 시 · 분) ----------
   휠: 큰 신호(마우스 한 칸)는 1줄. 칸 사이가 짧으면(빨리 돌림) 1·2·3줄로 가속하고, 멈추면 몇 줄 더 미끄러진다.
       작은 신호(트랙패드)는 모아서 STEP_PX마다 1줄.
   드래그: 손을 따라 움직이고, 놓을 때 속도만큼 조금 더 굴린 뒤 가까운 줄에 멈춘다.
   클릭: 누른 줄로. 두 칸짜리(오전/오후)는 가운데를 눌러도 바뀐다. 키보드: ↑↓ 1줄.
   set()은 조용히 움직이고, 사람이 움직였을 때만 onChange(prev, cur)를 부른다. */
const STEP_PX = 30, NOTCH_PX = 40, FAST_MS = 70;
let touched = false;

function makeWheel(el, items, onChange) {
  el.classList.add('drag');
  el.innerHTML = items.map(v => `<div>${v}</div>`).join('');
  const n = items.length, clamp = i => Math.max(0, Math.min(n - 1, i));
  let idx = 0, acc = 0, streak = 0, lastT = 0, lastDir = 0, glideT = 0, drag = null, lit = -1;
  // 가운데 줄 글자를 코랄로(H1)
  const mark = i => { if (i === lit) return; el.children[lit]?.classList.remove('on'); el.children[i]?.classList.add('on'); lit = i; };
  const go = (i, smooth) => { mark(i); el.scrollTo({ top: i * IH, behavior: smooth ? 'smooth' : 'auto' }); };
  function move(i) {
    i = clamp(i);
    if (i === idx) { go(idx, true); return; }
    const prev = idx;
    idx = i; go(idx, true); onChange(prev, idx);
  }
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * NOTCH_PX : e.deltaY;
    if (Math.abs(dy) >= NOTCH_PX) {
      const t = performance.now(), dir = Math.sign(dy);
      streak = t - lastT < FAST_MS && dir === lastDir ? streak + 1 : 0;
      lastT = t; lastDir = dir; acc = 0;
      move(idx + dir * (streak < 2 ? 1 : streak < 5 ? 2 : 3));
      clearTimeout(glideT);
      if (streak >= 3) glideT = setTimeout(() => { move(idx + dir * Math.min(5, Math.floor(streak / 2))); streak = 0; }, FAST_MS + 20);
      return;
    }
    acc += dy;
    if (Math.abs(acc) >= STEP_PX) { const k = Math.trunc(acc / STEP_PX); acc -= k * STEP_PX; move(idx + k); }
  }, { passive: false });
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId); el.classList.add('grabbing');
    drag = { y0: e.clientY, top0: el.scrollTop, moved: 0, ly: e.clientY, lt: performance.now(), v: 0 };
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    drag.moved = Math.max(drag.moved, Math.abs(dy));
    el.scrollTop = Math.max(0, Math.min((n - 1) * IH, drag.top0 - dy));
    mark(Math.round(el.scrollTop / IH));
    const t = performance.now();
    if (t > drag.lt) { drag.v = (e.clientY - drag.ly) / (t - drag.lt); drag.ly = e.clientY; drag.lt = t; }
  });
  const end = e => {
    if (!drag) return;
    el.classList.remove('grabbing');
    if (drag.moved < 5) {
      const r = el.getBoundingClientRect(), row = Math.floor((e.clientY - r.top + el.scrollTop - 92) / IH);
      move(row === idx && n === 2 ? 1 - idx : row);
    } else {
      const fling = performance.now() - drag.lt < 80 ? drag.v * -180 : 0;   // px/ms → 조금 더 굴리기
      move(Math.round((el.scrollTop + fling) / IH));
    }
    drag = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); move(idx - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(idx + 1); }
  });
  // refresh: 숨어 있던 다이얼은 스크롤이 안 먹으므로, 보일 때 제자리로 다시 맞춘다
  return { get: () => idx, set: (i, smooth) => { idx = clamp(i); go(idx, smooth); }, refresh: () => go(idx) };
}

const touch = () => { touched = true; renderEndline(); };
const wAp = makeWheel($('wap'), [t('am'), t('pm')], touch);
// 시 칸 순서는 1~12. 12에 들어가거나 12에서 나오면 오전/오후를 넘긴다(정오·자정 넘김)
const wH = makeWheel($('wh'), Array.from({ length: 12 }, (_, i) => i + 1), (p, c) => {
  if ((p === 11) !== (c === 11)) wAp.set(1 - wAp.get(), true);
  touch();
});
const wM = makeWheel($('wm'), Array.from({ length: 60 }, (_, i) => pad(i)), touch);

function setWheels(d, smooth) {
  wAp.set(d.getHours() < 12 ? 0 : 1, smooth);
  wH.set((d.getHours() % 12 || 12) - 1, smooth);
  wM.set(d.getMinutes(), smooth);
}
// 칩: 언제나 지금 시각(분) + N분. 누적하지 않는다. 실제로 울리는 시간은 최대 59초 짧을 수 있다
const nowMinute = () => Math.floor(Date.now() / 60000) * 60000;
document.querySelector('.chips').addEventListener('click', e => {
  const b = e.target.closest('[data-p]');
  if (!b) return;
  setWheels(new Date(nowMinute() + b.dataset.p * 1000), true);
  touch();
});

// 다이얼이 가리키는 시각. 이미 지났으면 내일
function wheelTarget() {
  const now = new Date(), d = new Date(now);
  d.setHours((wH.get() + 1) % 12 + wAp.get() * 12, wM.get(), 0, 0);
  const tomorrow = d <= now;
  if (tomorrow) d.setDate(d.getDate() + 1);
  return { d, tomorrow };
}

// 다이얼을 지금 시각으로 되돌리기(처음 연 상태와 같게)
$('rz').onclick = () => { touched = false; setWheels(new Date(), true); renderEndline(); };

function renderEndline() {
  $('rz').classList.toggle('off', !touched);
  $('rz').tabIndex = touched ? 0 : -1;
  if (!touched) {
    $('endline').textContent = '';
    $('go').disabled = true;
    return;
  }
  // 시계 숫자끼리의 분 차이(2:05 → 2:15면 10분). 초까지 정확한 남은 시간은 시작 후 링에 나온다
  const { d, tomorrow } = wheelTarget(), mins = Math.round((d - nowMinute()) / 60000);
  $('endline').innerHTML = (tomorrow ? `<span class="tmr">${t('tomorrow')}</span>` : '') + t('endIn', durText(mins * 60));
  $('go').disabled = false;
}

function start() {
  if (touched) send({ cmd: 'startAt', endAt: wheelTarget().d.getTime() });
}
$('go').onclick = start;

/* ---------- 타이머 탭: 시 : 분 : 초 다이얼 ----------
   칩은 그 시간으로 맞춘다(더하지 않음). 마지막에 시작한 시간(lastCd)을 기억했다가 다음에 그대로 보여 준다 */
const cdSecs = () => wCh.get() * 3600 + wCm.get() * 60 + wCs.get();
const renderCdGo = () => { $('cdgo').disabled = cdSecs() === 0; };
const sixty = Array.from({ length: 60 }, (_, i) => pad(i));
const wCh = makeWheel($('wch'), Array.from({ length: 24 }, (_, i) => pad(i)), renderCdGo);
const wCm = makeWheel($('wcm'), sixty, renderCdGo);
const wCs = makeWheel($('wcs'), sixty, renderCdGo);
function setCd(secs, smooth) {
  wCh.set(Math.min(23, Math.floor(secs / 3600)), smooth);
  wCm.set(Math.floor(secs % 3600 / 60), smooth);
  wCs.set(secs % 60, smooth);
  renderCdGo();
}
document.querySelectorAll('[data-c]').forEach(b => { b.textContent = durText(+b.dataset.c); });
$('cdchips').addEventListener('click', e => {
  const b = e.target.closest('[data-c]');
  if (b) setCd(+b.dataset.c, true);
});
function startCd() {
  if (cdSecs() > 0) send({ cmd: 'start', secs: cdSecs() });
}
$('cdgo').onclick = startCd;

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || settingsOpen || timer || e.target.closest('button, input')) return;
  e.preventDefault();
  tab === 'cd' ? startCd() : start();
});

/* ---------- 탭 ---------- */
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderPanes(); });
$('opts').onclick = () => { settingsOpen = true; renderPanes(); };
$('back').onclick = () => { settingsOpen = false; renderPanes(); };

// 지금 도는 타이머가 어느 탭 것인지. 예전 버전이 저장한 타이머(mode 없음)는 알람
const timerTab = () => timer && (timer.mode === 'cd' ? 'cd' : 'at');

function renderPanes() {
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  const main = !settingsOpen, running = main && timerTab() === tab;
  const setupAt = main && tab === 'at' && !running, setupCd = main && tab === 'cd' && !running;
  const wasHidden = { at: $('setup').hidden, cd: $('cdsetup').hidden };
  $('head').hidden = !main;
  $('sethead').hidden = $('set').hidden = main;
  $('setup').hidden = !setupAt;
  $('cdsetup').hidden = !setupCd;
  $('run').hidden = !running;
  if (setupAt && wasHidden.at) [wAp, wH, wM].forEach(w => w.refresh());
  if (setupCd && wasHidden.cd) [wCh, wCm, wCs].forEach(w => w.refresh());
  document.body.classList.toggle('done', timer?.status === 'done');
  document.body.classList.toggle('paused', timer?.status === 'paused');
  renderButtons();
}

/* ---------- 진행 중(R4a) ---------- */
function setBtn(id, label, msg, primary) {
  const b = $(id);
  b.textContent = label;
  b.classList.toggle('pri', !!primary);
  b.onclick = () => send(msg);
}
function renderButtons() {
  if (!timer) return;
  const done = timer.status === 'done';
  const cd = timerTab() === 'cd';
  if (done) {
    setBtn('ba', t('moreMin', 1), { cmd: 'snooze', secs: 60 });
    setBtn('bb', t('moreMin', 5), { cmd: 'snooze', secs: 300 });
    setBtn('bc', t('dismiss'), { cmd: 'dismiss' }, true);
  } else if (cd) {
    // 타이머: 일시정지/계속 · +1분 · +5분
    const paused = timer.status === 'paused';
    setBtn('ba', t(paused ? 'resume' : 'pause'), { cmd: paused ? 'resume' : 'pause' }, paused);
    setBtn('bb', t('addMin', 1), { cmd: 'add', secs: 60 });
    setBtn('bc', t('addMin', 5), { cmd: 'add', secs: 300 });
  } else {
    setBtn('ba', t('addMin', 1), { cmd: 'add', secs: 60 });
    setBtn('bb', t('addMin', 5), { cmd: 'add', secs: 300 });
  }
  // 진행 중 취소는 작은 아이콘(↶), 끝났을 때 끄기는 글자 버튼
  $('bc').hidden = !done && !cd;
  $('gap').hidden = $('bx').hidden = done;
}
$('bx').onclick = () => send({ cmd: 'cancel' });
$('pg').setAttribute('stroke-dasharray', RC);

function renderRun() {
  if (!timer) return;
  const rem = timer.status === 'running' ? Math.max(0, timer.endAt - Date.now()) : timer.status === 'paused' ? timer.remaining : 0;
  const end = new Date(timer.endAt);
  $('pg').setAttribute('stroke-dashoffset', RC * (1 - rem / (timer.total * 1000)));
  if (timerTab() === 'cd') {
    // 타이머: 남은 시간을 크게, 아래에 끝나는 시각(멈췄으면 「일시정지」)
    $('ampm').textContent = '';
    $('left').textContent = fmtDur(rem / 1000);
    $('sub').innerHTML = timer.status === 'done' ? t('timesUp') : timer.status === 'paused' ? t('pausedNow') : t('endsAt', fmtClock(end));
    return;
  }
  $('ampm').textContent = apText(end);
  $('left').textContent = `${end.getHours() % 12 || 12}:${pad(end.getMinutes())}`;
  $('sub').innerHTML = timer.status === 'done' ? t('timesUp') : t('left', fmtDur(rem / 1000));
}

/* ---------- 설정(팝업 안) ----------
   바꾸는 즉시 저장한다. 메뉴 시간이 바뀌면 백그라운드가 우클릭 메뉴를 다시 만든다.
   화면 색은 팝업이 열리자마자 칠할 수 있게 localStorage에 둔다(common.js의 readTheme). */
const presetIds = ['p0', 'p1', 'p2', 'p3'];
async function saveSettings() {
  const s = await getSettings();
  const presets = presetIds.map((id, i) => {
    const v = Math.round(+$(id).value);
    return v >= 1 && v <= 1439 ? v : s.presets[i];
  });
  await chrome.storage.local.set({ settings: { ...s, presets, alertWindow: $('alertWindow').checked, sound: $('sound').checked } });
}
(async () => {
  const s = await getSettings();
  presetIds.forEach((id, i) => { $(id).value = s.presets[i]; $(id).addEventListener('change', saveSettings); });
  $('alertWindow').checked = s.alertWindow;
  $('sound').checked = s.sound;
  $('alertWindow').addEventListener('change', saveSettings);
  $('sound').addEventListener('change', saveSettings);
})();
document.querySelectorAll('[name="theme"]').forEach(r => {
  r.checked = r.value === readTheme();
  r.addEventListener('change', () => {
    try { localStorage.setItem('theme', r.value); } catch {}
    applyTheme(r.value);
  });
});
let testAudio = null;
$('test').onclick = () => {
  if (testAudio) { testAudio.pause(); testAudio = null; $('test').textContent = t('preview'); return; }
  testAudio = new Audio('chime.wav');
  testAudio.play();
  testAudio.onended = () => { testAudio = null; $('test').textContent = t('preview'); };
  $('test').textContent = t('stopPreview');
};

/* ---------- 상태 읽기 ---------- */
async function reload() {
  const st = await chrome.storage.local.get(['timer', 'lastCd']);
  const hadTimer = !!timer;
  timer = st.timer || null;
  // 타이머가 끝나 설정 화면으로 돌아오면 알람 다이얼은 지금 시각, 타이머 다이얼은 마지막 시간으로
  if (hadTimer && !timer) {
    touched = false;
    requestAnimationFrame(() => { setWheels(new Date()); setCd(st.lastCd || DEFAULT_CD); });
  }
  renderPanes(); renderRun(); renderEndline();
}
chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.timer) reload(); });

function tick() {
  if (timer) renderRun(); else renderEndline();
}

(async () => {
  await reload();
  // 도는 타이머가 있으면 그 탭으로 연다
  if (timer) { tab = timerTab(); renderPanes(); }
  const { lastCd } = await chrome.storage.local.get('lastCd');
  // 팝업을 연 순간의 시각을 한 번만 보여 준다(계속 따라가지 않음)
  requestAnimationFrame(() => { setWheels(new Date()); setCd(lastCd || DEFAULT_CD); });
  tick();
  setInterval(tick, 200);
})();
