// 팝업·알림 창·설정·백그라운드가 같이 쓰는 도구
const pad = n => String(n).padStart(2, '0');

function fmtClock(d, withSec) {
  let h = d.getHours();
  const ap = h < 12 ? '오전' : '오후';
  h = h % 12 || 12;
  return `${ap} ${h}:${pad(d.getMinutes())}` + (withSec ? ':' + pad(d.getSeconds()) : '');
}

// 초 → "24:13" 또는 "1:05:00"
function fmtDur(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
}

// 초 → "1시간 5분"
function durKo(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
  const p = [];
  if (h) p.push(h + '시간');
  if (m) p.push(m + '분');
  if (x) p.push(x + '초');
  return p.join(' ') || '0초';
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

const DEFAULTS = { presets: [5, 10, 25, 60], alertWindow: true, sound: true, lastSecs: 600 };
const EMPTY_SW = { acc: 0, start: 0, on: false, laps: [] };

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}
