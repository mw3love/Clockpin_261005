// 바꾸는 즉시 저장한다. 메뉴 시간이 바뀌면 백그라운드가 우클릭 메뉴를 다시 만든다.
const $ = id => document.getElementById(id);
const ids = ['p0', 'p1', 'p2', 'p3'];

async function save() {
  const s = await getSettings();
  const presets = ids.map((id, i) => {
    const v = Math.round(+$(id).value);
    return v >= 1 && v <= 1439 ? v : s.presets[i];
  });
  await chrome.storage.local.set({ settings: { ...s, presets, alertWindow: $('alertWindow').checked, sound: $('sound').checked } });
  $('saved').textContent = '저장했어요';
}

(async () => {
  const s = await getSettings();
  ids.forEach((id, i) => { $(id).value = s.presets[i]; $(id).addEventListener('change', save); });
  $('alertWindow').checked = s.alertWindow;
  $('sound').checked = s.sound;
  $('alertWindow').addEventListener('change', save);
  $('sound').addEventListener('change', save);
})();

let testAudio = null;
$('test').onclick = () => {
  if (testAudio) { testAudio.pause(); testAudio = null; $('test').textContent = '알림음 들어 보기'; return; }
  testAudio = new Audio('chime.wav');
  testAudio.play();
  testAudio.onended = () => { testAudio = null; $('test').textContent = '알림음 들어 보기'; };
  $('test').textContent = '멈추기';
};
