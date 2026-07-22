# Archive refactored

기존 화면과 기능을 유지하면서 CSS와 JavaScript를 기능별로 분리한 버전입니다.

## 파일 구성

- `index.html`: 공통 마크업
- `css/base.css`: 전역 변수, 앱 골격, 사이드바, 상단바
- `css/notes.css`: 폴더, 자료 목록, 편집기
- `css/chat.css`: 채팅 및 관련 모달
- `css/todo.css`: 할 일
- `css/calendar.css`: 캘린더 및 기록 모달
- `css/home.css`: 메인 대시보드, 템플릿 파일철, 퀵채팅
- `css/responsive-theme.css`: 반응형과 최종 파스텔 테마 보정
- `js/core.js`: 저장소, 공통 상태, DOM 참조
- `js/notes.js`: 화면 렌더링과 메모 편집
- `js/todo.js`: 할 일
- `js/folders.js`: 폴더
- `js/auth.js`: 로그인과 프로필
- `js/chat.js`: 1:1 채팅
- `js/calendar.js`: 캘린더
- `js/home.js`: 메인 보드, 템플릿 미리보기, 명언 순환, 퀵채팅
- `js/events.js`: 이벤트 연결과 앱 초기화

JavaScript 파일은 `index.html`에 적힌 순서를 유지해야 합니다. 공통 상태를 먼저 선언한 뒤 기능과 이벤트를 연결하는 구조입니다.

로고를 누르면 메인 보드로 이동하고, 사이드바의 `전체 자료`를 누르면 기존 자료 목록이 열립니다. `assets/favicon.png`가 브라우저 파비콘으로 연결되어 있습니다.
