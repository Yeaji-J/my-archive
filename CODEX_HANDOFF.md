# Archive — Codex handoff

Last handoff refresh: 2026-08-11

This document condenses the long ChatGPT design/development thread for the personal web app **Archive / my-archive**. It is intentionally product-oriented: use it to understand what the user means without replaying the entire old conversation.

## 1. Project identity

- Product: a personal archive/notebook web app with folders, five purpose-built writing templates, calendar, favorites, 1:1 chat, and a disguise-like quick chat.
- Original deployment context: GitHub Pages (`Yeaji-J/my-archive`) with Supabase for account/cloud/chat data.
- Current working copy in this handoff: `archive-refactored`.
- Architecture: static SPA using one `index.html`, modular CSS/JS, local browser persistence, Supabase, and a hash/history router.
- The user previously asked why everything lived in one `index.html`. The current compromise is intentional: common markup remains in one SPA shell, while behavior/styles are split into feature files. Browser history is handled by `js/router.js`, so separate HTML files or PHP are not required for back navigation.

## 2. Current file map

### App shell

- `index.html` — shared markup, all views/modals/editor panels, stylesheet/script order.
- `assets/favicon.png` — Archive favicon.

### CSS

- `css/base.css` — global variables, shell, sidebar, top bar.
- `css/home.css` — dashboard, recent content, template file board, quick chat.
- `css/notes.css` — folders, archive lists, editors, template list/detail visuals, moodboard.
- `css/template-paper-board.css` — free-layout / paper-board presentation for template overview.
- `css/chat.css` — full chat, attachment preview, drawing UI, responsive chat behavior.
- `css/calendar.css` — calendar.
- `css/todo.css` — post-it / legacy todo-related presentation.
- `css/responsive-theme.css` — responsive and final theme corrections.
- `css/theme.css` — global `pastel` / `paper` skin switch.
- `css/fonts.css` — locally hosted font faces.

### JavaScript

- `js/core.js` — shared state, image ingestion helpers, localStorage, IndexedDB durable snapshots, Supabase cloud save/pull.
- `js/router.js` — hash/history navigation and Archive-safe back behavior.
- `js/notes.js` — navigation, folders/archive rendering, editor open/close, note persistence.
- `js/memo.js` — template 01 rich memo behavior.
- `js/todo.js` — template 02 post-it behavior including trackers.
- `js/moodboard.js` — template 03 canvas/items/drawing/history/tools.
- `js/templates.js` — templates 04/05 and shared template list/search/preview behavior.
- `js/note-view.js` — read/detail presentation.
- `js/template-overview-drag.js` — free placement and 5-column auto-align for template `전체` overview.
- `js/font-system.js` — common font selection and template-specific font sync.
- `js/chat.js` — 1:1 chat, attachments, drawing, realtime and quick-chat support.
- `js/calendar.js`, `js/home.js`, `js/folders.js`, `js/auth.js`, `js/theme.js`, `js/events.js` — named responsibilities.
- `supabase-chat-images.sql` — chat-image storage/policy setup helper; relevant whenever chat images fail.

`index.html` script order is a dependency chain. Do not alphabetize it casually.

## 3. Product navigation

### Sidebar

Primary navigation:

- 전체 자료
- 즐겨찾기
- 채팅
- 캘린더
- folder list
- template shortcuts: `ALL`, 01 메모, 02 포스트잇, 03 무드보드, 04 링크, 05 컬렉션

The old separate “할 일” sidebar entry was intentionally removed. Template 02 now owns that use case.

The top utility button that used to look like a four-square/grid button was repurposed as a **home** shortcut to the dashboard.

### Browser back

`js/router.js` maps state to hash routes such as `/home`, `/notes`, `/starred`, `/calendar`, `/chat`, `/folder/:id`, `/note/:id`, `/note/:id/edit`. Back/forward must remain inside the Archive flow instead of leaving the site unexpectedly.

## 4. Global visual direction

The target is not “faded pastel”. It is clean white/editorial UI with clear text contrast and pastel objects.

Core palette supplied by the user and treated as the Archive palette:

| Role | Hex |
| --- | --- |
| Deep brown | `#5C3621` |
| Neutral gray | `#959595` |
| Muted green | `#9CA078` |
| Pastel blue | `#ACBCCD` |
| Pastel purple | `#C3C2D9` |
| Pastel pink | `#F0C7D9` |
| Butter cream | `#FEF7CB` |

Use lighter mixes/tints for large surfaces so content remains legible. Folder colors can be more visible; content cards/paper backgrounds should be lighter.

Fonts:

- default: Pretendard
- chat: 이서윤체 (`IsYun`)
- locally bundled optional fonts: 고운돋움, 고운바탕, 나눔펜, 개구체, 동글체, 검은고딕, 송명체
- common font switching lives in `js/font-system.js`; user wants text-entry surfaces to expose font choice where practical.

Global skins:

- `pastel`: current bright archive skin
- `paper`: warmer vintage-paper alternative

## 5. Dashboard / folders / archive browsing

### Dashboard intent

The dashboard was redesigned from the original folder grid to feel like a desk/archive board:

- folders and recent notes displayed horizontally near the top without a giant enclosing rounded box
- no ugly horizontal scrollbar; use constrained recent items/controls
- compact calendar area showing dates and whether a note/record exists
- five indexed template tabs/file-folder visual
- show 2–3 recent notes beneath the selected template when available so the lower area is not empty
- right-side fixed memo/quote area with rotating quotes or Bible verses; text should be restrained rather than oversized
- quick-chat fixed at bottom right on normal screens

### Folder visual

Folders should resemble real file folders: larger, wider than earlier icons, pastel, horizontally arranged, with the folder name below. When a folder is selected, the context should visually read as an opened folder.

Folder visuals share the same compact, softly irregular silhouette across the dashboard, archive folder grid, selected-folder context, and compact sidebar. Their target proportion is close to `1.2:1`, like the supplied mint folder reference, rather than a long horizontal icon. Corners should have restrained radii and must not look pill-shaped or cushion-like. Keep the rear index/tab low and compact. The front panel is a flat, lighter solid tint: do not add translucent glass styling, borders, inset highlights, gradients, or dimensional shadows. An unselected folder appears closed; selecting a folder that actually contains notes reveals a subtle white paper sheet between the muted rear panel and pale front panel. Empty selected folders remain closed so the visual state reflects real content.

Folder contents support multiple view styles:

- mixed/object view
- preview/card view (image/preview + text)
- text/notice-board view

Folders now support nested hierarchy through an optional `parentId` on each folder. Existing folders without `parentId` remain top-level without migration or data reset. The sidebar renders the hierarchy with expand/collapse controls and a per-folder child-add action. Opening a parent folder includes notes from all descendants; opening a child folder narrows to that branch. The writing-page toolbar exposes separate `상위 폴더` and conditional `하위 폴더` selectors, restoring both values from an existing note and saving the selected child folder through the normal note save path. Detail-view folder movement retains a compact hierarchical selector. Deleting a folder moves its direct notes and child folders one level upward instead of discarding them.

The folder `미리보기` list mode no longer rebuilds each template with unrelated miniature font rules. All five templates render inside the same `720 × 680` canonical snapshot canvas and are scaled uniformly to the card width, preserving each template's own content proportions while preventing page-level horizontal overflow.

When inside one folder, show a back control to “전체 자료” and only the selected folder context at the top.

### All archive — folder vs template browsing

There are two axes:

- 폴더별
- 템플릿별

Template filters: 전체 / 메모 / 포스트잇 / 무드보드 / 링크 / 컬렉션.

For the template `전체` board, the user's desired interaction is a free desk-like composition, not a fixed 4-column grid:

- initial placement can be lightly irregular
- every object must be draggable by the user
- overlap/stacking should happen only because the user places objects that way; do not aggressively auto-stack items into a messy pile
- `자동정렬` produces a clean `5 × n` arrangement
- the last manual/aligned positions must restore after leaving the view and after reload
- persistence currently uses `archive.template-overview-layout.v2`, `state.templateOverviewLayouts`, and per-note `overviewLayout`

Do not put every object into the same rounded card box. It should visually read as its template object: memo paper, post-it, moodboard sheet, link item, book/poster.

Template-specific list pages retain their own designed list style rather than inheriting the free-board layout.

## 6. Template contracts

### 01 — 메모 (`template: "memo"`)

Writing/editor requirements already represented in the UI:

- contenteditable rich memo
- paragraph/body vs subtitle styles; a selected existing range should be convertible in both directions
- left / center alignment
- selected-text font family and font-size controls
- the size control reflects the computed size at the clicked caret/text location, including a temporary value such as the 19px subtitle size
- text color defaults to Archive brown but can be changed with the memo color control; safe colors persist in sanitized HTML
- selected text can become a hyperlink by pasting an `http`, `https`, or `mailto` URL; saved memo links are bold + underlined and open safely in a new tab
- `Ctrl/Cmd+B` bold, `Ctrl/Cmd+Shift+X` strikethrough, and `Ctrl/Cmd+K` link shortcuts
- `Ctrl/Cmd+Z` undo and `Ctrl/Cmd+Y` / `Ctrl/Cmd+Shift+Z` redo; bold and strikethrough are true toggles from both shortcuts and toolbar buttons
- `Alt+183` inserts `·`; the former dedicated `· 기호` toolbar button is intentionally removed
- numeric token behavior: number followed by Space can become a subtle rounded/gray number marker
- Notion-style block handles: drag vertically to reorder, or to the left/right edge of another block to create any number of columns
- when a non-collapsed selection intersects multiple blocks, dragging the handle of one selected block moves the selected block group together
- the former global 1-column / 2-column toolbar is intentionally removed; saved `.memo-block-row` / `.memo-block-column` structure is the layout source of truth
- memo body line-height is intentionally tightened to about two-thirds of the earlier value
- four paper skins: pink micro-grid, yellow line, blue dot, purple grid
- image insertion
- general file attachments are available only in template 01; each memo stores up to 12 files, with a 3MB per-file and 8MB total limit. Attachments use the normal memo/archive persistence paths and remain downloadable after reopening or from the detail view.
- each memo supports up to 12 comma-separated tags; tags auto-save with the memo, appear on album/detail views, participate in search, and become multi-value filters on the template 01 list page
- toolbar should remain reachable when the memo gets long (sticky/fixed behavior)
- editor may scroll; long content must not trap the user
- auto-save, no completion button required
- the editor title input uses the full available heading width; long titles must not be constrained by the browser's default text-input width

Memo list page:

- use width generously; target five columns on desktop
- maintain album/paper feeling rather than a generic rounded SaaS card
- content preview does not need to expose the entire long note via internal scrolling
- title/date/star controls should stay clear
- search/filter belongs on list pages, not inside the writing canvas

### 02 — 포스트잇 (`template: "todo"`)

This replaced the old standalone “할 일” concept.

Types currently exposed:

- 해빗 트래커
- 투두 리스트
- 위클리 플랜
- 위시 리스트
- 쇼핑 리스트
- 타임 트래커

Design/behavior:

- paper texture / long vertical note proportion
- five paper skins: cream, blue, purple, pink, green
- font selection + font size
- tags
- configurable marking/block color
- todo/wish/shopping use checkable rows
- todo-list rows include an optional second-line memo for URLs, file locations, or context; detected `http(s)`/`www` addresses are safe clickable links in read-only views and expose a direct link action while editing
- habit tracker uses per-item day dots; month-day counts should respect 30/31-day context where applicable
- time tracker colors time blocks. Clicking a filled block again should clear it. Switching selected color must not recolor or erase blocks already painted with other colors.
- default color chips use lighter Archive-compatible tints; legacy darker block colors remain valid and retain their color names in summaries
- the time tracker alone shows a live color-by-color duration summary and a final total; every painted block counts as exactly 10 minutes, and the summary is derived from saved block colors rather than stored separately
- all tracker state must auto-save and restore
- right-side controls are intentionally more readable/larger than the first tiny version

Post-it list page:

- album/post-it preview
- target five columns on desktop and use available width
- pagination controls where required
- shared select / select-all / bulk-delete behavior remains available

### 03 — 무드보드 (`template: "moodboard"`)

This is the most canvas-like template. The writing screen gives the board as much space as practical while keeping a compact normal title field above the canvas. The title uses the shared note auto-save path and is visible on list/detail views.

Tools/features:

- upload images
- paste clipboard images with Ctrl/Cmd+V where image paste is supported
- drag/drop image ingestion where browser CORS permits it
- add text
- move tool
- pen tool
- eraser
- element delete / drawing clear
- undo / redo history
- resize selected text/images
- newly uploaded images start at `0deg`; existing saved rotations remain unchanged
- rotate selected text/images with either the range control or the numeric `-30` to `30` degree field
- select text font
- select text weight: `400` / `600` / `700`
- moodboard text item background is intentionally **transparent**, including editor/detail/list preview
- text weight is stored per text item and must restore in editor/detail/list preview

Skins:

- paper
- pink stripe split
- pink dot split
- blue stripe split
- green stripe split
- purple dot split
- yellow dot split

Pattern skins were requested to be lighter and denser, with roughly 50:50 pattern vs light/white working area so placed photos/text remain dominant. Overall board ratio should feel like a real notebook/scrapbook page.

Moodboard list page:

- larger album previews than other template lists; roughly 6 per page/screen
- show the saved moodboard title and update date below the preview without exposing canvas text as extra card copy
- use shadows/depth so each looks like an actual sheet/scrapbook object, not a generic card

### 04 — 링크 (`template: "links"`)

Editor fields:

- URL
- category
- site name/title
- one-line memo/description

The older “상세 메모” area was intentionally removed.

List page should look like a clean notice-board/link directory: one row per link, title on the left, direct/open action on the right. Avoid oversized album cards.

All link field changes must auto-save. This was previously a recurring data-loss bug and is explicitly wired through `scheduleTemplateDataSave` now.

### 05 — 컬렉션 (`template: "collection"`)

Intended uses: books, films, music, restaurants, other collections.

Editor:

- representative image
- type: 책 / 영화 / 음악 / 맛집 / 기타
- title uses the note title
- one-line review
- tags
- dynamically addable label/value information fields (so schema is not hard-coded to “author”, etc.)
- content/body
- extra “add/edit field” controls belong in edit state, not read-only presentation

List page:

- object-first album view: book cover / film poster feel
- avoid a generic card box around the object
- show minimal text: collection type + title
- more items may fit per page than moodboard
- user likes a slightly retro editorial font feeling here
- representative image must persist and appear in list preview

## 7. Detail/read behavior

Terminology correction from the old conversation:

- The user initially called the template list/album screens “뷰페이지”.
- Later they corrected this. In future conversation, use **리스트 페이지** for the collection of posts/items.
- Use **상세/보기 페이지** for one saved note/item being viewed.
- Editors are “작성화면” or “쓰기 페이지”.

Editing is intentionally lightweight: there is no mandatory completion state. Saved content can be opened and immediately edited. Do not introduce an artificial draft/completed status unless explicitly requested.

All five list pages should retain search/filter controls and support select / select-all / bulk delete. Selection controls should be compact and on the same top row as search when possible, without extra duplicated template-name bars that waste vertical space.

## 8. Chat contract

The 1:1 chat implementation is active again with `CHAT_FEATURE_VISIBLE = true`: the sidebar chat entry, full chat route, and global quick chat are visible, and the preserved Supabase conversation history is loaded through the existing chat paths. Hiding chat again must remain a presentation/routing change only and must never reset or delete chat tables. Group chat was discussed once but the user later explicitly said to ignore group chat; do not build it implicitly.

Full chat page:

- grid-paper background
- default chat handwriting uses 이서윤체, with the header selector able to switch among the bundled Archive fonts
- current requested message text size settled around 17px
- messages should be dense enough to show more history but not overlap
- text-message rows are fixed to a 20px content line with zero list gap and only a 1px sender-change break, so a short conversation never stretches messages across the full viewport
- the full-chat header provides a locally persisted font selector; the selected bundled font applies to full chat and quick chat without changing message data
- `나가기` removes only the current user's `chat_members` row after confirmation; it does not delete the room or message history for the other participant
- time and message alignment must remain visually coherent on narrow screens
- other-user profile/avatar is less prominent: colored outline treatment rather than a filled blob where applicable
- when the window narrows, the room/new-chat wing should fold/collapse and the conversation should remain usable
- quick-chat floating button must be hidden on the full chat page so it never covers the send button

Image/drawing functionality requested and represented in UI:

- file image attach
- Ctrl/Cmd+V clipboard image paste
- browser image drag/drop when accessible
- preview before send with X/removal
- sent image shown as a small thumbnail, click to enlarge
- drawing/pencil modal, attach drawing as an image
- adequate vertical space between image messages and surrounding text so rows never overlap

Historical warning: Supabase chat image uploads repeatedly produced `StorageApiError: Object not found` and raw archive-media JSON text appeared in chat during earlier iterations. `supabase-chat-images.sql` exists because bucket/policy/message-format setup matters. When touching chat media, test sender + receiver + reload + quick-chat, and do not mark the bug fixed based only on the sender preview.

Quick chat:

- fixed bottom-right on all normal app screens
- intentionally looks like a discreet yellowish memo/quick note rather than a conventional messenger window
- earlier decorative tape was removed
- it must show the same underlying room/messages as the full chat view and update in realtime
- hidden while `currentView === 'chat'`

## 9. Calendar contract

- Apple-inspired compact calendar styling, but matched to Archive palette
- day number at the **top-left** of each day cell, not center
- calendar page should fit within viewport height without creating unnecessary page-level vertical scrolling
- dashboard uses a compact version focused on date + whether a record exists
- date entry may include a note and photo

## 10. Image input contract

The user asked for clipboard paste and web-image drag/drop anywhere image upload is supported.

`js/core.js` contains shared helpers for:

- clipboard image files
- drag/drop files
- extracting dragged image URLs
- fetching a remote image when CORS allows it

Browser security/CORS means arbitrary third-party web images cannot always be fetched directly. Keep the friendly fallback that tells the user to copy/paste or save the image when direct drag/drop is blocked.

Do not silently convert a failed remote drag/drop into lost content.

## 11. Persistence architecture and critical regression history

The user has repeatedly reported “썼던 게 날아갔어 / 저장이 안 돼”. Data persistence therefore has higher priority than cosmetic changes.

Current strategy in `js/core.js`:

1. `state` serialized to `localStorage` (`archive.data.v1`)
2. timestamp stored separately
3. IndexedDB durable snapshot (`archive-durable-storage`)
4. when signed in, delayed Supabase `archive_data` upsert
5. mutation revision + timestamps prevent stale cloud pulls from overwriting newer local edits
6. `beforeunload`, `visibilitychange`, and `pagehide` flush paths in `js/events.js`
7. local and cloud archive states merge by item id instead of replacing the whole local archive; local-only and cloud-only records are retained
8. note/folder deletion tombstones prevent intentionally deleted records from returning during a merge
9. IndexedDB keeps the current snapshot plus the five most recent rolling backups, so a cloud reconciliation does not immediately erase the last known-good local state

Do not simplify this back to one storage mechanism without the user's explicit agreement.

Template save paths that must remain connected:

- memo: `scheduleMemoSave`
- post-it: `schedulePostitSave`
- moodboard: `scheduleMoodboardSave`
- link/collection: `scheduleTemplateDataSave`
- generic note metadata/title: `persistCurrentNote` / `saveData`

Switching an existing note between the five editor template tabs must preserve every template-specific payload already stored on that note. Flush the active editor before changing `note.template`; returning to a previously used template restores its prior data instead of resetting it. Full template-data reset is only appropriate while initializing an intentionally new note.

For any save-related change, regression-test at least:

1. create new note
2. choose template
3. enter template-specific content
4. navigate to another Archive view
5. return to the item
6. reload page
7. if logged in, verify after cloud pull as well

## 12. Template-overview free layout

This area had several rounds of bugs: cards initially collapsed into a pile, drag did nothing, auto-align did nothing, then positions failed to restore after navigating away.

Current implementation: `js/template-overview-drag.js`.

Key expectations:

- desktop auto-align uses 5 columns
- manual drag updates absolute position and z-index
- layout survives rerender/navigation/reload
- saved positions scale horizontally when board width changes using `xRatio`
- storage is redundant on purpose: dedicated localStorage plus archive state/per-note copy
- never regress to “all items stacked at the upper-left” on re-entry

If this feature changes, test all four states: initial irregular layout, manual drag, auto-align, leave + return/reload.

## 13. Deletion contract

The user previously reported deleted items reappearing. All five template list pages must allow:

- single selection
- select all
- bulk deletion

Deletion must remove data from the actual `state.notes`, persist it, and avoid a subsequent stale cloud pull resurrecting deleted items. Treat deletion as a persistence operation, not just a DOM removal.

## 14. Authentication / cloud / Supabase

Accounts and profiles use Supabase. Cloud archive state lives in `archive_data`. 1:1 chat uses profile/chat member/message tables and realtime subscriptions. Calendar records and image storage also use Supabase resources.

Do not add service-role credentials to browser code. The existing browser client uses a publishable key. Any storage/RLS problem should be solved with the appropriate bucket/table policy and authenticated-user rules rather than by weakening browser-side security.

## 15. Things explicitly not to resurrect

- standalone sidebar “할 일” navigation as the main todo product
- mandatory 완료/저장 button for normal note editing
- group chat without a new request
- giant rounded box wrapping folders + notes on the dashboard
- full-page redirects for internal navigation
- overly pale/washed-out UI with low contrast
- quick-chat floating over the full chat composer
- generic identical rounded cards for every template list
- huge duplicated headers/filter rows that create avoidable scrolling

## 16. Latest completed changes before this handoff

Template 02 time-tracker persistence was repaired:

- `ensurePostitData` now normalizes time slots in place. Replacing the entire `timeSlots` array during every save had left rendered event handlers pointing at stale slot objects, so only the first edit after a render survived.
- every time block keeps its own color string; changing the selected accent no longer collapses saved blocks to one color
- a small per-note `archive.postit-time.v1.<note-id>` recovery snapshot supplements the normal localStorage, IndexedDB, and Supabase paths
- finishing a paint gesture immediately flushes the durable IndexedDB snapshot
- legacy boolean/object block values are normalized without discarding valid color data

Related UI improvements:

- post-it paper skins and other large pastel template surfaces use lighter surface tints while preserving the Archive palette for accents
- each specific template list page now has a `새 자료` button beside search; it creates a note with the currently viewed template already selected
- `closeSidebarMobile` moved into `js/core.js` so hash-route restoration cannot call it before it exists

The previous moodboard transparent text background and per-item 400 / 600 / 700 weight behavior remains in place.

Template 01 memo editor was expanded:

- selected text supports nine inline fonts and seven inline sizes; the markup is sanitized into safe `data-memo-font` / `data-memo-size` spans and restores after reload
- pasting a safe URL onto a non-collapsed text selection creates a bold, underlined link; unsafe protocols are rejected
- bold, strikethrough, link, and `Alt+183` shortcuts were added while the dedicated middle-dot button was removed
- Enter creates durable paragraph blocks with draggable `⋮⋮` handles; left/right drop zones create n-column grid rows, and the layout survives save + reload
- the previous global 1단/2단 control and CSS column-count rendering were removed
- memo editor, detail, and album-preview line spacing were tightened

Template 01 input/formatting regressions were then repaired:

- Korean IME composition no longer triggers font-tag normalization or handle injection on every input event; composition is allowed to finish before any block decoration, preventing the body from intermittently rejecting Hangul
- drag handles are now CSS pseudo-elements rather than `contenteditable=false` children, so they no longer corrupt caret, Home/End, or dragged-text selection boundaries
- paragraph/subtitle conversion resolves exactly the blocks intersecting the preserved selection, including a collapsed caret block, instead of falling through to a stale lower range
- bold/strikethrough toolbar states follow the caret and toggle off correctly; undo/redo shortcuts are integrated with the browser editing history
- left-aligned memo images use zero side auto-margins, while centered blocks still center their images
- memo paper grids/dots are lighter and denser; the lined skin has no red margin and uses an 18.45px repeat matched to the 15px body line-height
- text color and click-location font-size inspection persist across save/reload
- a selected multi-block group moves together when its handle is dragged

## 17. Recommended first Codex prompt

After opening the project in Codex, use:

> `AGENTS.md와 CODEX_HANDOFF.md를 먼저 읽고 현재 Archive 프로젝트를 파악해줘. 아직 코드는 수정하지 말고, 현재 구현된 기능 / 저장 구조 / 템플릿 01~05 / 남아 있는 회귀 위험을 짧게 정리한 다음 내가 다음 수정사항을 줄 때까지 기다려줘.`

This forces a context check before the next design iteration and reduces the chance of an old requirement overriding the current implementation.

## 18. Verification baseline for future work

There is no project build step in this static version. At minimum after JS edits:

```bash
node --check js/core.js
node --check js/router.js
node --check js/notes.js
node --check js/memo.js
node --check js/todo.js
node --check js/moodboard.js
node --check js/templates.js
node --check js/note-view.js
node --check js/template-overview-drag.js
node --check js/chat.js
node --check js/events.js
```

When possible, supplement syntax checks with browser behavior verification because the high-risk failures in this project are state/realtime/layout regressions, not parser errors.
