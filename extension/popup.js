// 팝업은 화면만 그린다. 시간 계산의 기준(endAt 등)은 백그라운드가 저장한 값을 읽는다.
const $ = id => document.getElementById(id);
const IH = 46;                        // 다이얼 한 칸 높이(px)
const RC = 2 * Math.PI * 80;          // 링 둘레
const send = m => chrome.runtime.sendMessage(m);

let timer = null, sw = { ...EMPTY_SW }, tab = 'timer';

/* ---------- 다이얼 ---------- */
const cols = { h: $('wh'), m: $('wm'), s: $('ws') };
const fill = (el, n) => { el.innerHTML = Array.from({ length: n }, (_, i) => `<div>${pad(i)}</div>`).join(''); };
fill(cols.h, 24); fill(cols.m, 60); fill(cols.s, 60);
const val = c => Math.round(c.scrollTop / IH);
const wheelSecs = () => val(cols.h) * 3600 + val(cols.m) * 60 + val(cols.s);
function setWheels(sec, smooth) {
  const v = { h: Math.floor(sec / 3600), m: Math.floor(sec % 3600 / 60), s: sec % 60 };
  for (const k in cols) cols[k].scrollTo({ top: v[k] * IH, behavior: smooth ? 'smooth' : 'auto' });
}
Object.values(cols).forEach(c => c.addEventListener('scroll', renderEndline, { passive: true }));
document.querySelector('.chips').addEventListener('click', e => {
  const b = e.target.closest('[data-p]');
  if (b) setWheels(+b.dataset.p, true);
});

function renderEndline() {
  const s = wheelSecs();
  if (s > 0) {
    const end = new Date(Date.now() + s * 1000);
    $('endline').innerHTML = `${durKo(s)} 후 · <b>${fmtClock(end, s % 60 !== 0)}</b>에 알림`;
  } else {
    $('endline').textContent = '시간을 정해 주세요';
  }
  $('go').disabled = !(s > 0);
}

function start() {
  const secs = wheelSecs();
  if (secs > 0) send({ cmd: 'start', secs, remember: true });
}
$('go').onclick = start;
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && tab === 'timer' && !timer && !e.target.closest('button')) { e.preventDefault(); start(); }
});

/* ---------- 탭 ---------- */
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderPanes(); });
$('opts').onclick = () => chrome.runtime.openOptionsPage();

function renderPanes() {
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $('setup').hidden = !(tab === 'timer' && !timer);
  $('run').hidden = !(tab === 'timer' && timer);
  $('sw').hidden = tab !== 'sw';
  document.body.classList.toggle('done', timer?.status === 'done');
  renderButtons();
}

/* ---------- 진행 중(R1) ---------- */
function setBtn(id, label, msg, primary) {
  const b = $(id);
  b.textContent = label;
  b.classList.toggle('pri', !!primary);
  b.onclick = () => send(msg);
}
function renderButtons() {
  if (!timer) return;
  if (timer.status === 'done') {
    setBtn('ba', '1분 더', { cmd: 'snooze', secs: 60 });
    setBtn('bb', '5분 더', { cmd: 'snooze', secs: 300 });
    setBtn('bc', '끄기', { cmd: 'dismiss' }, true);
  } else {
    setBtn('ba', '+1분', { cmd: 'add', secs: 60 });
    setBtn('bb', timer.status === 'paused' ? '계속' : '일시정지', { cmd: timer.status === 'paused' ? 'resume' : 'pause' });
    setBtn('bc', '취소', { cmd: 'cancel' });
  }
}
$('pg').setAttribute('stroke-dasharray', RC);

function renderRun() {
  if (!timer) return;
  const now = Date.now();
  const rem = timer.status === 'running' ? Math.max(0, timer.endAt - now) : timer.status === 'paused' ? timer.remain : 0;
  $('left').textContent = fmtDur(rem / 1000);
  $('pg').setAttribute('stroke-dashoffset', RC * (1 - rem / (timer.total * 1000)));
  $('sub').textContent =
    timer.status === 'done' ? '시간이 됐어요' :
    timer.status === 'paused' ? '일시정지됨' :
    fmtClock(new Date(timer.endAt), timer.total % 60 !== 0) + '에 알림';
}

/* ---------- 스톱워치(S1) ---------- */
const swNow = () => sw.acc + (sw.on ? Date.now() - sw.start : 0);
const fmtMs = ms => fmtDur(Math.floor(ms / 1000)) + '.' + Math.floor(ms % 1000 / 100);
$('swgo').onclick = () => send({ cmd: 'swToggle' });
$('swlap').onclick = () => send({ cmd: 'swLap' });
$('swreset').onclick = () => send({ cmd: 'swReset' });
function renderSw() {
  const ms = swNow();
  $('swt').innerHTML = fmtDur(Math.floor(ms / 1000)) + '<small>.' + Math.floor(ms % 1000 / 100) + '</small>';
}
function renderSwStatic() {
  $('swgo').textContent = sw.on ? '정지' : sw.acc ? '계속' : '시작';
  $('laps').innerHTML = sw.laps.map((t, i) => `<li><span>랩 ${i + 1}</span><span>${fmtMs(t)}</span></li>`).reverse().join('');
}

/* ---------- 상태 읽기 ---------- */
async function reload() {
  const st = await chrome.storage.local.get(['timer', 'sw']);
  timer = st.timer || null;
  sw = st.sw || { ...EMPTY_SW };
  renderPanes(); renderRun(); renderSwStatic(); renderSw();
}
chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && (c.timer || c.sw)) reload(); });

function tick() {
  $('clock').textContent = fmtClock(new Date(), true);
  if (timer) renderRun(); else renderEndline();
  if (sw.on) renderSw();
}

(async () => {
  const s = await getSettings();
  await reload();
  if (!timer && sw.on) { tab = 'sw'; renderPanes(); }
  requestAnimationFrame(() => { setWheels(s.lastSecs); renderEndline(); });
  tick();
  setInterval(tick, 200);
})();
