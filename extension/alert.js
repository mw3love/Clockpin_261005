// 시간이 됐을 때 뜨는 작은 창(N2). 버튼을 누르면 백그라운드가 이 창을 닫는다.
const send = m => chrome.runtime.sendMessage(m);
let doneAt = Date.now();

document.querySelectorAll('[data-snooze]').forEach(b => b.onclick = () => send({ cmd: 'snooze', secs: +b.dataset.snooze }));
document.getElementById('off').onclick = () => send({ cmd: 'dismiss' });
document.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter') send({ cmd: 'dismiss' }); });

chrome.storage.local.get('timer').then(({ timer }) => {
  if (!timer) return;
  doneAt = timer.doneAt || doneAt;
  document.getElementById('info').innerHTML = `${durKo(timer.total)} 타이머 · <b>${fmtClock(new Date(doneAt))}</b>에 끝남`;
});

setInterval(() => {
  const s = Math.floor((Date.now() - doneAt) / 1000);
  document.getElementById('since').textContent = s >= 5 ? `${fmtDur(s)} 지남` : '';
}, 500);
