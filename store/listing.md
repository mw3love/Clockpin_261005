# Clockpin — 웹스토어 등록 자료

2026-10-05 버전 0.1.0을 검토 제출했다(사용자가 실제 크롬에서 동작 확인 후). 다음 버전은 `manifest.json`의 `version`을 올리고 zip을 다시 만든다.

개발자 대시보드에 그대로 붙여 넣을 내용이다. 영어가 기본 언어이고, 한국어는 대시보드의 「언어 추가」로 넣는다.

## 파일

- 아이콘 128×128: `extension/icons/icon128.png` (zip 안에도 들어 있음)
- 스크린샷 1280×800 5장: `store/screenshots/en/1~5.png`, 한국어판 `store/screenshots/ko/1~5.png`
- 작은 홍보 타일 440×280(필수): `store/promo-small-440x280.png`. 홍보 이미지는 언어별로 못 나누므로 영어로 만들었다.
- 큰 홍보 타일 1400×560: 선택 사항이라 만들지 않았다.
- 제출용 zip: `store/clockpin-0.1.0.zip` (`extension/` 내용, `manifest.json`이 맨 위). `.gitignore`가 `*.zip`을 무시하므로 git에는 안 올라간다.

스크린샷을 다시 찍을 때: `python store/tools/shots.py <확장 폴더> store/tools/raw_ko`(영어는 `_locales/ko`를 지운 사본으로 `raw_en`), 이어서 `python store/tools/compose.py`. 크롬 실행 파일 경로와 파이썬 `websockets`·`Pillow`가 필요하다.

스크린샷 순서: 1 알람 다이얼 · 2 타이머 다이얼 · 3 타이머 진행 · 4 알람 진행 · 5 시간이 됐을 때 알림 창.

## 스토어 등록정보

- 카테고리: 확인 필요. 공식 문서에 목록이 없어 대시보드 드롭다운에서 고른다. 생산성(Productivity) 쪽의 도구(Tools) 또는 작업 흐름·계획(Workflow & Planning)이 맞다.
- 언어: English(기본), 한국어

### 요약(manifest에서 자동으로 들어감, 132자 이내)

- en(100자): Pick the exact time on a dial and get alerted right then — from your toolbar. A countdown timer too.
- ko: 툴바에서 다이얼로 끝나는 시각을 골라 그때 딱 알려 주는 알람. 거꾸로 세는 타이머도 함께.

### 자세한 설명 — English

```
Clockpin is an alarm and countdown timer that lives in your toolbar. Spin a dial to the exact time you want to be reminded, or set a countdown — and get a clear alert when time is up.

Alarm
• Spin the dial to the time you want (hour, minute, AM/PM), or tap +1m, +5m, +10m, +25m or +1h.
• The ring shows the exact end time and how much time is left.

Timer
• Count down with an hours : minutes : seconds dial, or pick 1, 5, 10, 25 minutes or 1 hour.
• Pause and resume, or add 1 or 5 minutes while it runs.
• Clockpin remembers the last time you used, so a 25-minute timer is one click away next time.

When time is up
• A sound, a desktop notification and a small alert window (each can be turned off).
• Snooze for 1 or 5 more minutes, or dismiss, in one click.

Also
• The toolbar badge shows the time left (for example 24m, then 45s).
• Right-click the toolbar icon to start a preset timer (5, 10, 25, 60 minutes by default — change them in Settings).
• Light and dark themes, or follow your computer.
• English and Korean.

Privacy: Clockpin does not collect, send or share any data. Your timer and settings are stored only in your browser.
```

### 자세한 설명 — 한국어

```
Clockpin은 툴바에 있는 알람·타이머예요. 다이얼을 돌려 알려 줄 시각을 딱 고르거나, 거꾸로 세는 타이머를 맞추면 시간이 됐을 때 확실하게 알려 줘요.

알람
• 다이얼로 시각(오전/오후·시·분)을 고르거나 +1분, +5분, +10분, +25분, +1시간을 누르세요.
• 링에 끝나는 시각과 남은 시간이 함께 보여요.

타이머
• 시 : 분 : 초 다이얼로 맞추거나 1분, 5분, 10분, 25분, 1시간을 고르세요.
• 일시정지·계속, 도는 중에 +1분·+5분.
• 마지막에 쓴 시간을 기억해서, 25분 타이머는 다음에도 클릭 한 번이에요.

시간이 됐을 때
• 알림음, 바탕화면 알림, 작은 알림 창으로 알려 줘요(각각 끌 수 있어요).
• 「1분 더」「5분 더」「끄기」를 한 번에.

그 밖에
• 툴바 아이콘 위에 남은 시간이 보여요(예: 24m, 45s).
• 툴바 아이콘을 우클릭하면 정해 둔 시간(기본 5·10·25·60분)으로 바로 타이머를 시작해요. 시간은 설정에서 바꿀 수 있어요.
• 밝게·어둡게, 또는 컴퓨터 설정 따라가기.
• 영어·한국어 화면.

개인정보: Clockpin은 어떤 데이터도 수집하거나 보내거나 공유하지 않아요. 타이머와 설정은 내 브라우저 안에만 저장돼요.
```

## 개인정보 보호 탭

### 단일 목적(Single purpose)

```
Clockpin is an alarm and countdown timer: the user sets a time or duration in the toolbar popup and is alerted when it is up.
```

### 권한 사용 이유(Permission justification)

| 권한 | 붙여 넣을 문장 |
|---|---|
| `alarms` | Schedules the moment an alarm or timer ends, so the alert fires even when the popup is closed. |
| `notifications` | Shows a desktop notification with Snooze and Dismiss buttons when time is up. |
| `storage` | Saves the running timer, the last timer length and the user's settings locally in the browser. |
| `contextMenus` | Adds preset timers (5, 10, 25, 60 minutes) and Stop to the toolbar icon's right-click menu. |
| `offscreen` | Plays the alarm sound when time is up; a service worker cannot play audio by itself. |

- 호스트 권한: 없음
- 원격 코드 사용: 아니요(No, I am not using remote code). 모든 코드는 패키지 안에 있다.

### 데이터 사용

- 수집하는 사용자 데이터: 모두 체크하지 않음(없음).
- 아래 세 항목 인증에 모두 체크: 승인된 용도 외 판매·전송 안 함 / 핵심 기능과 무관한 용도로 사용·전송 안 함 / 신용도 판단·대출 목적 사용 안 함.
- 개인정보처리방침 URL: 데이터를 수집하지 않으면 필수는 아니다(확인 필요 — 대시보드가 요구하면 GitHub 저장소에 `PRIVACY.md`를 두고 그 주소를 쓴다).

## 제출 전 확인

0.1.0은 사용자가 실제 크롬에서 확인했다. 다음 버전도 제출 전에 아래를 본다.

- 바탕화면 알림이 실제로 뜨는지, 알림음이 들리는지
- 툴바 아이콘 우클릭 메뉴가 동작하는지
- 다이얼 휠·드래그 손맛
