// 알림음 전용 숨은 페이지. 끌 때까지 최대 30초 반복한다.
let audio = null, stopTimer = null;

function stop() {
  if (audio) { audio.pause(); audio = null; }
  clearTimeout(stopTimer);
}

chrome.runtime.onMessage.addListener(m => {
  if (m.target !== 'offscreen') return;
  if (m.cmd === 'play') {
    stop();
    audio = new Audio('chime.wav');
    audio.loop = true;
    audio.play().catch(() => {});
    stopTimer = setTimeout(stop, 30000);
  } else if (m.cmd === 'stop') {
    stop();
  }
});
