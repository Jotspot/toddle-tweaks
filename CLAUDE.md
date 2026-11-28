# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Toddle Tweaks is a Manifest V3 browser extension (Chrome + Firefox) for the Toddle LMS at `web.toddleapp.com`. Plain JavaScript and CSS: no bundler, no framework, no dependencies, no test suite. The source folder is loadable as-is via `chrome://extensions` → Load unpacked.

## Commands

```
node scripts/build.mjs                      # dist/chrome, dist/firefox + upload zips; strips // @dev-start … // @dev-end blocks
npx web-ext lint -s dist/firefox            # Mozilla linter; keep it at 0 errors / 0 warnings
node scripts/render-promo.mjs               # store images via headless Chrome → store/images/{chrome,firefox}
for f in src/*.js src/gc/*.js background.js popup/*.js options/*.js; do node --check "$f"; done   # quick syntax check
```

There are no automated tests. Verify changes in a real browser on a signed-in Toddle account. In an **unpacked** install, page code can reload the extension and change settings (these hooks are stripped from store builds):
```js
window.postMessage('tt:dev-reload', '*');                                   // background calls chrome.runtime.reload()
window.postMessage({ type: 'tt:dev-set', patch: { classroomMode: false } }, '*'); // TT.saveSettings(patch)
```
After `tt:dev-reload`, reload the tab so new content scripts inject.

## Architecture

**Two JS worlds.**
- `src/page-hook.js` runs in the page's own context (`"world": "MAIN"`, document_start). It wraps `window.fetch` for Toddle's GraphQL endpoint (stale-while-revalidate cache in IndexedDB `toddle-tweaks`, loaded into memory once), records the filters Toddle uses for its task queries into `localStorage['tt:taskFilters']`, patches `history.pushState/replaceState` to fire a `tt:route` event, and dispatches `tt:page` events (string `detail`) after mutations.
- Everything else is an isolated content script sharing one global, `window.TT`, loaded in manifest order: `common → api → school → todo → heatmap → gc/themes → gc/shell → gc/home → gc/course → gc/plan → gc/pages → gc/timetable → gc/finals → gc/attendance → gc/grades → gc/toddle-pages → gc/tour → boot → snapshot → classroom → app → extras`. All run at `document_start`; code that needs Toddle's DOM waits (`TT.waitFor('#root')`).

The two worlds communicate only through the shared DOM: `localStorage` keys prefixed `tt:`, IndexedDB, and DOM events.

**Settings.** `TT.DEFAULTS` in `src/common.js` is the source of truth. It is duplicated in `options/options.js` and `popup/popup.js` (extension pages can't load content scripts), so keep all three in sync. Settings live in `chrome.storage.sync` and are mirrored into `localStorage['tt:settings']` so `page-hook.js` and `boot.js` can read them synchronously before storage answers. CSS-only toggles become classes on `<html>` in `boot.js` (`tt-gc`, `tt-gc-compact`, `tt-cp-*`, …). Tracker/Intercom/redirect blocking are static `declarativeNetRequest` rulesets in `rules/`, enabled or disabled by `background.js` from settings.

**Data.** `src/api.js` calls Toddle's GraphQL directly with the session JWT from `localStorage.userInfo` (endpoint taken from what the hook observed). Results are cached in `localStorage` (`tt:todoCache`, `tt:coursesCache`, `tt:teachers`, `tt:cw:<courseId>`, `tt:ann:<courseId>`, `tt:people:<courseId>`) and rendered from cache first, then refreshed. `TT.categorize` in `src/todo.js` is the smart-to-do logic shared by every view.

**School data (`src/school.js`).** `TT.school` reads the timetable (`enrolledPeriodsV2`, per week in `tt:ttw:<monday>`), school calendar (holidays), grading periods (semester dates), bell-schedule names (`routineDates`, e.g. "Final Exams-Periods3&4", which is how finals are found); `TT.school.dayLetter` combines the rotation (A/B) with the bell name ("Day: C/D …") into the school's A/B/C/D day and attendance, all cache-then-refresh; `TT.school.on(fn)` fires when something arrives. `TT.dates` has the local-date helpers. `src/heatmap.js` is `TT.heatmap({ week, place })`, shown where `TT.heatmapOn(place)` says (`hm_*` settings).

**Classroom mode (`src/gc/`).** `shell.js` draws a top bar, drawer and `#tt-gc-view` at document_start and routes on `location`:
- *Native views* (`gc.views.home/stream/classwork/people/todo/calendar/finals/grades`, `timetable` (`/timetable`), `attendance` (`/attendance-summary`), and `course-plan` in `gc/plan.js`, built from one `ttCoursePlan` query; `?tt=classic` shows Toddle's own page) replace Toddle's page: `html.tt-gc-native` hides `#root`. Custom pages use query params on real Toddle routes (`/courses?tt=todo`, `/courses/<id>/home?tt=people`) so a reload still works.
- *Grades* (`gc/grades.js`, `/courses?tt=grades`, also takes over Toddle's `/student-progress-summary/...`): `api.getGrades` reads every evaluated assessment via `Student.assignments` (ratings, `toolResponsesV2`, remarks; standard/behavior names from `fields(uids: atlsUBD, learningStandardUBD)`) plus one aliased request for rubric/checklist definitions (`tt:gradeTools`). Response `rowId`/`columnId` = rubric indicator/criteria, checklist item/option, standard-rubric criteria/descriptor.
- *Assignments* (`/courses/<id>/classroom/classroom-details/...`) are a ReactModal portal over Toddle's old Assignments page; the route draws our Classwork underneath (`tt-gc-under`, same view key, so closing it shows the page instantly) and `shell.js` redirects Toddle's "go back" arrow to the page you came from.
- *Passthrough* routes show Toddle's own page inside the shell: `#root` is repositioned with CSS, and `gc/toddle-pages.js` restyles or augments it (course plan, assignment page "Add or create").
- `gc.rerender()` renders off-screen and only swaps the DOM if the HTML changed, which avoids flicker and image reloads.
- In regular Toddle, `TT.openView(name)` (extras.js) draws the same views in a full-screen sheet; views call `gc.refreshView()` so they redraw in either place.
- Dark mode is switched off (`DARK_MODE = false` in `boot.js`, not in Settings). When on, it is `html.tt-dark`: one `filter: invert()` on the root element (the only element where a filter doesn't break `position: fixed`), with media flipped back, in `styles/v26.css`.
- Per-user customizations (order, hidden, themes, overrides from Advanced class settings) live in `localStorage['tt:gc']`. Banner themes and their colours are in `gc/themes.js`; `googleBanners` switches between Google's hotlinked art and generated SVG patterns.

**Welcome page.** `onboarding/welcome.html` opens once on install (`background.js`, `reason === 'install'`) and is linked from Settings; it only writes `classroomMode`.

**Store tooling.** `store/promo/frame.html` runs the real extension modules with fake data from `store/promo/frame.js` (stubbed `TT.api`) to produce the screenshots; `store/LISTING.md` has the listing copy, permission justifications and reviewer notes. `scripts/build.mjs` derives the Firefox manifest (`background.scripts`, `options_ui`, gecko id, `data_collection_permissions`).

## Toddle quirks that matter

- Toddle's DOM uses CSS-module classes like `SideBar__container___hash`. Select them with `[class*="SideBar__container"]`, never the hashed name.
- Toddle ships Tailwind. Don't give our elements class names that are Tailwind utilities (`outline`, `hidden`, `block`, `flex`…); `outline` already broke a button once.
- Toddle's GraphQL server crashes ("Cannot read properties of undefined (reading 'name')") if `operationName` doesn't match the name declared in the query text.
- Introspection is disabled. Discover fields by probing small queries or by searching the loaded JS bundles for `value:"<operationName>"`.
- A class's Assignments page calls `getStudentTasks` with a single `courseId`; only save task filters when more than one course is present (see `page-hook.js`). `api.getTasks` also rebuilds `courseIds` from the cached course list.
- "Mark as done" is `editStudentAssignmentSubmission` with `status: SUBMITTED` on the **submission** id. `api.markDone` deliberately omits `response` (the same mutation saves written answers) and refuses items that take a real submission. Never replay captured mutations generically.
- The course plan is a virtualized list: toggle rows one at a time and wait for `aria-expanded` to flip (`toggleAll` in `gc/toddle-pages.js`).
- `#root` is `position: fixed` in shell mode, so it creates its own stacking context. Toddle's side panels live inside it and full-screen modals (ReactModal) are portals in `<body>`; the z-index ladder in `styles/gc.css` (view 970 < root 975 < docked modal 978 < drawer 980 < bar 990) depends on this.
- Never cache anything that reflects live student work (`NEVER_RE` in `page-hook.js`); config-type queries and course plans only.

## Conventions

- Build DOM with `TT.h(tag, attrs, ...children)` and icons with `TT.gIcon(name)` (Material paths in `TT.ICONS`). Don't use `innerHTML`: the Firefox linter flags it. Use `TT.sanitize()` for Toddle-provided HTML and `DOMParser` for our own static markup.
- Most user-facing CSS is scoped under `html.tt-gc` / `html.tt-gc-shell` so turning a mode off is instant without a reload.
- Bump `version` in `manifest.json` and add a line to `CHANGELOG.md` before each store upload. Pushing a tag `v<version>` runs `.github/workflows/release.yml`, which builds both zips and publishes a GitHub release with that version's changelog section as notes.
