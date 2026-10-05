// 시간이 됐을 때 뜨는 작은 창(N2). 버튼을 누르면 백그라운드가 이 창을 닫는다.
const send = m => chrome.runtime.sendMessage(m);
let doneAt = Date.now();

localize();
document.title = t('timesUp');
document.querySelectorAll('[data-snooze]').forEach(b => { b.textContent = t('moreMin', b.dataset.snooze / 60); });

document.querySelectorAll('[data-snooze]').forEach(b => b.onclick = () => send({ cmd: 'snooze', secs: +b.dataset.snooze }));
document.getElementById('off').onclick = () => send({ cmd: 'dismiss' });
document.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter') send({ cmd: 'dismiss' }); });

chrome.storage.local.get('timer').then(({ timer }) => {
  if (!timer) return;
  doneAt = timer.doneAt || doneAt;
  document.getElementById('info').innerHTML = `<b>${fmtClock(new Date(timer.endAt))}</b>`;
});

setInterval(() => {
  const s = Math.floor((Date.now() - doneAt) / 1000);
  document.getElementById('since').textContent = s >= 5 ? t('since', fmtDur(s)) : '';
}, 500);
