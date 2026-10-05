// 팝업·알림 창·백그라운드가 같이 쓰는 도구
const pad = n => String(n).padStart(2, '0');

// 화면 글자는 _locales/{en,ko}/messages.json에서 읽는다. 브라우저 언어가 한국어면 ko, 그 밖은 en
const t = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String));
const isKo = t('lang') === 'ko';
const apText = d => t(d.getHours() < 12 ? 'am' : 'pm');

// 한국어 "오후 2:30", 영어 "2:30 PM"
function fmtClock(d, withSec) {
  const hm = `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}` + (withSec ? ':' + pad(d.getSeconds()) : '');
  return isKo ? `${apText(d)} ${hm}` : `${hm} ${apText(d)}`;
}

// 초 → "24:13" 또는 "1:05:00"
function fmtDur(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
}

// 초 → "1시간 5분" / "1 hr 5 min"
function durText(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
  const p = [];
  if (h) p.push(t('durH', h));
  if (m) p.push(t('durM', m));
  if (x) p.push(t('durS', x));
  return p.join(' ') || t('durS', 0);
}

// 아이콘 위 글자(B1): 24m / 1h5 / 45s — 4글자 이내
function badgeText(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.ceil(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60), r = m % 60;
  return h + 'h' + (r || '');
}

const DEFAULTS = { presets: [5, 10, 25, 60], alertWindow: true, sound: true };
const DEFAULT_CD = 300;   // 타이머 탭을 처음 열 때 시간(초)

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}

// 화면 색: 'auto'(컴퓨터 설정 따라) | 'light' | 'dark'.
// 페이지가 열리자마자 칠해야 깜빡이지 않으므로, 바로 읽히는 localStorage에 둔다(백그라운드는 화면이 없어 건너뜀)
function readTheme() {
  try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; }
}
function applyTheme(t = readTheme()) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
// 페이지의 고정 글자: data-i18n(글자), data-i18n-title(툴팁), data-i18n-aria(화면 낭독용 이름)
function localize() {
  document.documentElement.lang = t('lang');
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(e => { e.title = t(e.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach(e => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
}

if (typeof document !== 'undefined') {
  applyTheme();
  addEventListener('storage', e => { if (e.key === 'theme') applyTheme(); });
}
