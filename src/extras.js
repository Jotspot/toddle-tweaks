/*
 * Toddle Tweaks — handy extras (each one has its own toggle in Settings):
 *  - Tab badge: "(3) …" in the tab title = missing + due today/tomorrow.
 *  - Command palette: Ctrl/⌘+K to jump to any class, assignment or page.
 *  - Keyboard shortcuts: g h / g t / g c / g s, and ? for help.
 *  - Relative due dates on Toddle's assignment pages.
 *  - Google Docs & co. (or every web link) open in a new tab instead of Toddle's viewer.
 *  - "Toddle Tweaks updated! See what's new" after an update.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const inGc = () => !!(TT.gc && TT.gc.active && TT.gc.active());
  const base = () => `/platform/${TT.cpId()}`;
  const go = (url) => (inGc() ? TT.gc.go(url) : TT.nav(url));
  TT.openSettings = (section) => { try { chrome.runtime.sendMessage({ type: 'openOptions', section: typeof section === 'string' ? section : undefined }); } catch {} };

  // ---------------- tab badge ----------------
  const urgentCount = () => {
    const d = TT.todoData();
    if (!d) return 0;
    const c = TT.categorize(d.items);
    return c.missing.length + c.todo.filter((x) => x.bucket === 'today' || x.bucket === 'tomorrow').length;
  };
  const syncTitle = () => {
    const raw = document.title || '';
    const bare = raw.replace(/^\(\d+\) /, '');
    const n = TT.settings.tabBadge === false ? 0 : urgentCount();
    const want = n ? `(${n}) ${bare}` : bare;
    if (raw !== want) document.title = want;
  };
  setInterval(syncTitle, 1500);
  TT.onTodo(syncTitle);

  // ---------------- command palette ----------------
  const courseList = () => {
    if (TT.gc && TT.gc.courses) return TT.gc.courses();
    return ((TT.api.cachedCourses() || {}).courses) || [];
  };
  // Settings you can flip from Ctrl/⌘+K (they only show up when you type).
  const TOGGLES = [
    ['heatmap', 'Workload heatmap'], ['nextClass', 'Next class in the top bar'],
    ['finalsMode', 'Finals in the menu'], ['classroomMode', 'Google Classroom mode'], ['gcCompact', 'Compact spacing'], ['gcDrawerHover', 'Open the collapsed menu on hover'], ['gradesOverview', 'Grades overview'],
    ['tabBadge', 'Count in the tab title'], ['relativeDates', 'Relative due dates'], ['docsNewTab', 'Open Google Docs in a new tab'],
    ['hidePastNoSubmission', 'Hide past "no submission" items'], ['gcCardInfo', "Class cards show what's due"], ['shortcuts', 'Keyboard shortcuts'],
  ];
  const view = (name) => (TT.openView ? () => TT.openView(name) : null);
  const entries = () => {
    const fs = TT.school ? TT.school.finalsStatus() : { show: false };
    const out = [
      { kind: 'Page', title: 'Home', icon: 'home', url: `${base()}/courses` },
      { kind: 'Page', title: 'To-do', icon: 'todo', url: `${base()}/courses?tt=todo`, action: inGc() ? null : () => TT.openTodoPage(), keys: 'g t' },
      { kind: 'Page', title: 'Calendar', icon: 'calendar', action: view('calendar'), sub: 'Due dates by week', keys: 'g c' },
      { kind: 'Page', title: 'Timetable', icon: 'event', action: view('timetable'), sub: 'Your whole week', keys: 'g w' },
      { kind: 'Page', title: 'Attendance', icon: 'attendance', action: view('attendance'), keys: 'g a' },
      { kind: 'Page', title: 'Grades', icon: 'grade', action: view('grades'), sub: 'Every graded assessment on one page', keys: 'g r' },
      { kind: 'Page', title: 'Finals', icon: 'summative', action: view('finals'), sub: fs.show ? (fs.daysUntil > 0 ? `Starts in ${fs.daysUntil} days` : fs.phase === 'during' ? 'Happening now' : '') : 'Exam schedule and checklist', boost: fs.show ? 2 : 0, quiet: !fs.show, keys: 'g f' },
      { kind: 'Page', title: 'School announcements', icon: 'campaign', url: `${base()}/circulars` },
      { kind: 'Page', title: 'School calendar', icon: 'schedule', url: `${base()}/courses/my-calendar`, quiet: true },
      { kind: 'Page', title: "Toddle's own timetable", icon: 'event', url: `${base()}/timetable?tt=classic`, quiet: true },
      { kind: 'Page', title: "Toddle's attendance page", icon: 'attendance', url: `${base()}/attendance-summary?tt=classic`, sub: 'Excusals and the full record', quiet: !inGc() },
      { kind: 'Page', title: 'Toddle Tweaks settings', icon: 'settings', action: TT.openSettings, keys: 'g s' },
      { kind: 'Action', title: 'Export timetable to Google Calendar', icon: 'download', sub: 'Every class meeting this semester', action: () => TT.gc && TT.gc.exportTimetable && TT.gc.exportTimetable() },
      { kind: 'Action', title: 'Export due dates to a calendar', icon: 'download', sub: 'Upcoming work as an .ics file', action: () => TT.gc && TT.gc.exportDue && TT.gc.exportDue(), quiet: true },
      { kind: 'Action', title: 'Keyboard shortcuts', icon: 'keyboard', action: () => toggleHelp(), keys: '?', quiet: true },
      { kind: 'Action', title: 'Refresh assignments', icon: 'todo', action: () => TT.refreshTodo(true), quiet: true },
      { kind: 'Action', title: 'Take a tour of Classroom mode', icon: 'help', action: () => TT.gc && TT.gc.startTour && TT.gc.startTour(), quiet: true, gcOnly: true },
    ].filter((x) => !x.gcOnly || inGc());
    // The class you're in now (or next) floats to the top, with when and where.
    let nowNext = null;
    if (TT.school) {
      const { cur, next } = TT.school.nextClass(new Date());
      const c = cur || next;
      if (c) {
        const t = TT.dates.fmtClock(TT.dates.at(c.date, cur ? c.end : c.start));
        const dayWord = c.date === TT.dates.iso(new Date()) ? '' : c.date === TT.dates.iso(TT.dates.addDays(new Date(), 1)) ? 'Tomorrow ' : TT.dates.parseIso(c.date).toLocaleDateString([], { weekday: 'long' }) + ' ';
        const when = cur ? `Now · until ${t}` : `Next · ${dayWord}${t}`;
        nowNext = { id: c.courseId, sub: [when, TT.school.block(c), c.room].filter(Boolean).join(' · '), kind: cur ? 'Now' : 'Next' };
      }
    }
    for (const c of courseList()) {
      const nn = nowNext && nowNext.id === c.id ? nowNext : null;
      out.push({ kind: nn ? nn.kind : 'Class', title: c.title, icon: nn ? 'event' : 'school', sub: nn ? nn.sub : null, top: !!nn, url: `${base()}/courses/${c.id}/${inGc() ? 'home' : 'classroom'}` });
      if (inGc()) {
        out.push({ kind: 'Classwork', title: c.title, icon: 'assignment', url: `${base()}/courses/${c.id}/classroom`, quiet: true });
        out.push({ kind: 'People', title: c.title, icon: 'people', url: `${base()}/courses/${c.id}/home?tt=people`, view: 'people', quiet: true });
      }
      out.push({ kind: 'Course plan', title: c.title, icon: 'folder', url: `${base()}/courses/${c.id}/course-plan/flow`, quiet: true });
    }
    for (const [k, label, type, vals] of TOGGLES) {
      const on = type === 'choice' ? TT.settings[k] === vals[1] : TT.settings[k] !== false && !!TT.settings[k];
      out.push({ kind: 'Setting', title: `${label}: ${on ? 'on' : 'off'}`, icon: 'settings', sub: `Turn ${on ? 'off' : 'on'}`, quiet: true, setting: true,
        action: () => TT.saveSettings({ [k]: type === 'choice' ? (on ? vals[0] : vals[1]) : !on }).then(() => { window.dispatchEvent(new CustomEvent('tt:settings')); if (TT.gc && TT.gc.toast) TT.gc.toast(`${label} ${on ? 'off' : 'on'}`); }) });
    }
    const d = TT.todoData();
    const urgentIds = new Set();
    if (d) {
      const c = TT.categorize(d.items);
      [...c.missing, ...c.todo.filter((x) => x.bucket === 'today' || x.bucket === 'tomorrow')].forEach((x) => urgentIds.add(x.id));
    }
    if (d) {
      const items = d.items.slice().sort((a, b) => (a.toddleDone - b.toddleDone) || ((b.publishedAt || 0) - (a.publishedAt || 0)));
      for (const it of items) {
        out.push({ due: it.deadline, settled: it.toddleDone || (!it.needsSubmission && it.deadline && it.deadline < Date.now() - 864e5), urgent: urgentIds.has(it.id),
          kind: it.toddleDone ? 'Done' : (it.kind || (it.needsSubmission ? 'Assignment' : 'Material')), title: it.title,
          sub: (TT.courseName ? TT.courseName(it.courseId, it.courseTitle) : it.courseTitle)
            + (!it.deadline ? '' : (it.toddleDone || (!it.needsSubmission && it.deadline < Date.now())) ? ' · Due ' + TT.fmtDate(it.deadline) : ' · ' + TT.fmtDue(it.deadline)),
          icon: 'assignment', url: it.url });
      }
    }
    return out;
  };
  const matches = (e, q) => { const hay = (e.title + ' ' + (e.sub || '') + ' ' + e.kind).toLowerCase(); return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w)); };
  const score = (e, q) => {
    if (e.top) return q && !matches(e, q) ? 0 : 100; // now / next class: always first
    if (!q) {
      if (e.quiet) return 0;
      if (e.urgent) return 5 + (e.due ? 1 - Math.min(1, Math.abs(e.due - Date.now()) / (3 * 864e5)) : 0);
      if (e.boost) return 3 + e.boost;
      if (e.kind === 'Page') return 2.5;
      if (e.kind === 'Action') return 2;
      if (e.kind === 'Class') return 1.5;
      return e.settled ? 0 : 1;
    }
    const hay = (e.title + ' ' + (e.sub || '') + ' ' + e.kind).toLowerCase();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.every((w) => hay.includes(w))) return 0;
    let s = 1;
    if (e.title.toLowerCase().startsWith(words[0])) s += 3;
    if (e.kind === 'Class' || e.kind === 'Page') s += 2;
    if (e.kind === 'Action' || e.kind === 'Now' || e.kind === 'Next class') s += 1.5;
    if (e.setting) s -= 0.5;
    if (e.urgent) s += 1;
    if (e.boost) s += e.boost / 2;
    if (e.settled) s -= 1.5;                                  // old / finished stuff sinks
    else if (e.due && e.due > Date.now()) s += 1.5 - Math.min(1, (e.due - Date.now()) / (30 * 864e5)); // sooner = higher
    return Math.max(s, 0.1);
  };

  let palette = null;
  const closePalette = () => { if (palette) { palette.remove(); palette = null; } };
  TT.openPalette = () => {
    if (palette) return closePalette();
    const all = entries();
    let sel = 0;
    let results = [];
    const input = h('input', { class: 'tt-pal-input', placeholder: 'Search classes, assignments, pages, actions and settings…', 'aria-label': 'Search' });
    const list = h('div', { class: 'tt-pal-list', role: 'listbox' });
    const pick = (e) => { closePalette(); if (e.action) e.action(); else if (e.view && inGc()) TT.gc.go(e.url, e.view); else go(e.url); };
    const draw = () => {
      const q = input.value.trim();
      results = all.map((e) => [score(e, q), e]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 9).map(([, e]) => e);
      sel = Math.min(sel, Math.max(0, results.length - 1));
      list.textContent = '';
      if (!results.length) list.append(h('div', { class: 'tt-pal-empty' }, 'No matches'));
      results.forEach((e, i) => {
        const row = h('button', { class: 'tt-pal-row' + (i === sel ? ' sel' : ''), role: 'option', onClick: () => pick(e), onMousemove: () => { if (sel !== i) { sel = i; draw(); } } },
          I(e.icon), h('span', { class: 'tt-pal-main' }, h('span', { class: 'tt-pal-title' }, e.title), e.sub ? h('span', { class: 'tt-pal-sub' }, e.sub) : null),
          e.keys ? h('kbd', { class: 'tt-pal-keys' }, e.keys) : null,
          h('span', { class: 'tt-pal-kind' + (e.urgent ? ' urgent' : '') }, e.urgent && e.kind !== 'Done' ? (e.due && e.due < Date.now() ? 'Missing' : 'Due soon') : e.kind));
        list.append(row);
      });
    };
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[sel]) pick(results[sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    });
    palette = h('div', { class: 'tt-pal-wrap', onMousedown: (e) => { if (e.target === palette) closePalette(); } },
      h('div', { class: 'tt-pal', role: 'dialog', 'aria-label': 'Jump to' },
        h('div', { class: 'tt-pal-head' }, I('search'), input, h('kbd', null, 'Esc')),
        list,
        h('div', { class: 'tt-pal-foot' }, '↑↓ to move · Enter to open · ', h('kbd', null, '?'), ' for all shortcuts')));
    document.body.append(palette);
    draw();
    input.focus();
  };

  // ---------------- shortcuts help ----------------
  let help = null;
  const toggleHelp = () => {
    if (help) { help.remove(); help = null; return; }
    const row = (keys, what) => h('div', { class: 'tt-help-row' }, h('span', null, keys.map((k) => h('kbd', null, k))), h('span', null, what));
    help = h('div', { class: 'tt-pal-wrap', onMousedown: (e) => { if (e.target === help) toggleHelp(); } },
      h('div', { class: 'tt-pal tt-help', role: 'dialog', 'aria-label': 'Keyboard shortcuts' },
        h('div', { class: 'tt-help-title' }, I('keyboard'), 'Keyboard shortcuts'),
        TT.settings.commandPalette !== false ? row(['Ctrl', 'K'], 'Jump to a class, assignment or page') : null,
        row(['Alt', 'T'], 'Open your to-do'),
        row(['g', 'h'], 'Go home'),
        inGc() ? row(['g', 't'], 'To-do') : null,
        inGc() ? row(['g', 'c'], 'Calendar') : null,
        row(['g', 'w'], 'Timetable (week)'),
        row(['g', 'r'], 'Grades'),
        row(['g', 'a'], 'Attendance'),
        row(['g', 'f'], 'Finals'),
        row(['g', 's'], 'Toddle Tweaks settings'),
        inGc() ? h('div', { class: 'tt-help-sub' }, 'In a class') : null,
        inGc() ? row(['[', ']'], 'Previous / next section (Stream, Classwork, People, Course plan, Portfolio)') : null,
        inGc() ? row(['1', '–', '5'], 'Go straight to a section') : null,
        inGc() ? row(['Shift', '[', ']'], 'Previous / next class, same section') : null,
        inGc() ? row(['g', '1–9'], 'Open class 1–9 (menu order)') : null,
        row(['?'], 'Show this help'),
        row(['Esc'], 'Close'),
        h('div', { class: 'tt-pal-foot' }, 'Turn these on or off in Toddle Tweaks settings.')));
    document.body.append(help);
  };

  const typing = (e) => {
    const t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  };
  let gPending = 0;
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      if (TT.settings.commandPalette === false) return;
      e.preventDefault(); e.stopPropagation();
      TT.openPalette();
      return;
    }
    if (e.key === 'Escape' && help) { toggleHelp(); return; }
    if (TT.settings.shortcuts === false || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') { e.preventDefault(); toggleHelp(); return; }
    if (e.key === 'g') { gPending = Date.now(); return; }
    if (gPending && Date.now() - gPending < 1200) {
      gPending = 0;
      const map = {
        h: () => go(`${base()}/courses`),
        t: () => (inGc() ? go(`${base()}/courses?tt=todo`) : TT.openTodoPage()),
        c: () => TT.openView('calendar'),
        w: () => TT.openView('timetable'),
        a: () => TT.openView('attendance'),
        f: () => TT.openView('finals'),
        r: () => TT.openView('grades'),
        s: () => TT.openSettings(),
      };
      if (map[e.key]) { e.preventDefault(); map[e.key](); return; }
      if (/^[1-9]$/.test(e.key) && inGc()) {
        const c = TT.gc.sortedCourses()[Number(e.key) - 1];
        if (c) { e.preventDefault(); go(`${base()}/courses/${c.id}/home`); }
      }
      return;
    }
    // Sections of a class: [ and ] step through, 1–5 jump; Shift+[ / ] (that's { and }) changes class.
    if (inGc()) {
      const r = TT.gc.route();
      if (!r || !r.courseId) return;
      const b = `${base()}/courses/${r.courseId}`;
      const secs = [['stream', `${b}/home`], ['classwork', `${b}/classroom`], ['people', `${b}/home?tt=people`, 'people'], ['course-plan', `${b}/course-plan/flow`], ['journal', `${b}/journal`]];
      const curKey = r.view || (r.sub === 'classroom' ? 'classwork' : r.sub);
      const i = Math.max(0, secs.findIndex(([k]) => k === curKey));
      const open = (j) => { const [, url, v] = secs[(j + secs.length) % secs.length]; e.preventDefault(); TT.gc.go(url, v); };
      if (e.key === ']') return open(i + 1);
      if (e.key === '[') return open(i - 1);
      if (/^[1-5]$/.test(e.key)) return open(Number(e.key) - 1);
      if (e.key === '}' || e.key === '{') {
        const list = TT.gc.sortedCourses();
        const ci = list.findIndex((c) => c.id === r.courseId);
        if (ci === -1 || !list.length) return;
        const nc = list[(ci + (e.key === '}' ? 1 : -1) + list.length) % list.length];
        const url = secs[i][1].replace(`/courses/${r.courseId}`, `/courses/${nc.id}`);
        e.preventDefault();
        TT.gc.go(url, secs[i][2]);
      }
    }
  }, true);

  // ---------------- pages in classic mode ----------------
  // Calendar, Timetable, Attendance and Finals are Classroom-mode pages. In regular Toddle they
  // open as a full-screen sheet over Toddle (Esc or ✕ closes it).
  const VIEW_URL = { calendar: '/courses?tt=calendar', timetable: '/timetable', attendance: '/attendance-summary', finals: '/courses?tt=finals', grades: '/courses?tt=grades' };
  const VIEW_TITLE = { calendar: 'Calendar', timetable: 'Timetable', attendance: 'Attendance', finals: 'Finals', grades: 'Grades' };
  let sheet = null;
  const closeSheet = () => { if (sheet) { sheet.cleanup(); sheet.el.remove(); sheet = null; } if (TT.gc) TT.gc.overlayRefresh = null; };
  TT.openView = (name) => {
    if (inGc()) return go(`${base()}${VIEW_URL[name]}`);
    if (!TT.gc || !TT.gc.views[name]) return;
    closeSheet();
    const body = h('div', { class: 'tt-sheet-body' });
    const el = h('div', { class: 'tt-sheet', role: 'dialog', 'aria-label': VIEW_TITLE[name] },
      h('div', { class: 'tt-sheet-bar' }, h('span', { class: 'tt-sheet-title' }, I(name === 'finals' ? 'summative' : name === 'grades' ? 'grade' : name === 'timetable' ? 'event' : name === 'attendance' ? 'attendance' : 'calendar'), VIEW_TITLE[name]),
        h('button', { class: 'tt-gc-iconbtn', title: 'Close (Esc)', 'aria-label': 'Close', onClick: closeSheet }, I('close'))),
      body);
    const draw = () => {
      if (!el.isConnected) return;
      const st = body.scrollTop;
      const tmp = h('div');
      TT.gc.views[name](tmp, {});
      if (tmp.innerHTML === body.innerHTML) return;
      body.replaceChildren(...tmp.childNodes);
      body.scrollTop = st;
    };
    const bgDraw = () => { const a = document.activeElement; if (a && body.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== 'checkbox') { setTimeout(bgDraw, 1500); return; } draw(); };
    const offs = [TT.onTodo(bgDraw), TT.school ? TT.school.on(bgDraw) : () => {}, TT.onRoute(() => closeSheet())];
    const onKey = (ev) => { if (ev.key === 'Escape' && !document.querySelector('.tt-gc-dialog-wrap, .tt-pal-wrap, .tt-gc-menu')) closeSheet(); };
    document.addEventListener('keydown', onKey);
    sheet = { el, cleanup: () => { offs.forEach((f) => f()); document.removeEventListener('keydown', onKey); } };
    TT.gc.overlayRefresh = () => { if (!sheet) return false; draw(); return true; };
    document.body.append(el);
    TT.gc.views[name](body, {});
  };

  // ---------------- relative due dates (both modes) ----------------
  const tick = TT.debounce(() => { if (/\/classroom-details\//.test(location.pathname) && TT.addRelativeDue) TT.addRelativeDue(); }, 200);
  TT.waitFor('body', 20000).then((b) => b && new MutationObserver(tick).observe(b, { childList: true, subtree: true }));
  // ---------------- links in a new tab (both modes) ----------------
  // Toddle opens links and Drive files in its full-screen "theatre" viewer. For Docs & co. that's a
  // cramped iframe (often signed out), so when the viewer opens on one of these we press Toddle's
  // own "Open in …" button (same window.open Toddle uses, still inside the click's user activation)
  // and close the viewer. Uploaded files (PDFs, images, video) keep using the viewer.
  const DOC_HOSTS = /(^|\.)((docs|drive|sheets|slides|forms|sites|jamboard|script|colab\.research|earth|maps|mail|calendar|classroom|meet|keep)\.google\.com|forms\.gle|sharepoint\.com|onedrive\.live\.com|1drv\.ms|office\.com|office365\.com|live\.com|canva\.com|figma\.com|padlet\.com|notion\.so|notion\.site|quizlet\.com|kahoot\.it|kahoot\.com|desmos\.com|geogebra\.org|edpuzzle\.com|nearpod\.com|flip\.com|wakelet\.com|miro\.com|prezi\.com|genial\.ly|dropbox\.com|box\.com)$/i;
  // Viewers Toddle (or Google) use to *render uploaded files*: never treat those as links.
  const FILE_VIEWERS = /docs\.google\.com\/(viewer|gview)|view\.officeapps\.live\.com|toddleapp\.com|amazonaws\.com|cloudfront\.net/i;
  const hostOf = (u) => { try { return new URL(u, location.href).hostname; } catch { return ''; } };
  const isDocUrl = (u) => !!u && /^https?:/i.test(u) && !FILE_VIEWERS.test(u) && DOC_HOSTS.test(hostOf(u));
  const isWebUrl = (u) => !!u && /^https?:/i.test(u) && !FILE_VIEWERS.test(u) && hostOf(u) !== location.hostname;
  const wantsNewTab = (u) => (TT.settings.linksNewTab === true ? isWebUrl(u) : TT.settings.docsNewTab !== false && isDocUrl(u));
  TT.wantsNewTab = wantsNewTab;

  const handled = new WeakSet();
  const checkTheatre = () => {
    if (TT.settings.docsNewTab === false && TT.settings.linksNewTab !== true) return;
    for (const box of document.querySelectorAll('[class*="TheatreModeV2__container"]')) {
      if (handled.has(box)) continue;
      const frame = box.querySelector('[class*="FileViewer__container"] iframe, [class*="TheatreModeV2__viewerContainer"] iframe');
      const src = frame && frame.src;
      // Sites that can't be embedded get Toddle's "Open in new tab" card instead of an iframe.
      const linkCard = box.querySelector('[class*="ViewerComponent__openNewTabViewContainer"]');
      if (!src && !linkCard) continue; // still loading; the next mutation will tell
      handled.add(box);
      // No iframe = a site Toddle can't embed, so its viewer is only an extra click: always skip it.
      const go = src ? wantsNewTab(src) : true;
      if (!go) continue;
      const openBtn = [...box.querySelectorAll('button')].find((b) => /^open in /i.test((b.innerText || '').trim()));
      const overlay = box.closest('.ReactModal__Overlay');
      if (overlay) overlay.style.visibility = 'hidden'; // no flash of the viewer
      if (openBtn) openBtn.click();
      else if (src) window.open(src, '_blank', 'noopener');
      const close = box.querySelector('[aria-label="Close theatre mode"]') || document.querySelector('[aria-label="Close theatre mode"]');
      if (close) close.click();
      else if (overlay) overlay.style.visibility = ''; // couldn't close it: at least don't leave it invisible
    }
  };
  // Plain <a> links Toddle renders (instructions, comments): give matching ones a new tab too.
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.defaultPrevented || e.button !== 0) return;
    if (!wantsNewTab(a.href)) return;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }, true);
  TT.waitFor('body', 20000).then((b) => {
    if (!b) return;
    // Cheap check: the viewer only exists while a ReactModal is open.
    new MutationObserver(() => { if (document.body.classList.contains('ReactModal__Body--open')) checkTheatre(); })
      .observe(b, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  });
  // ---------------- "what's new" after an update ----------------
  const CHANGELOG = 'https://jotspot.github.io/toddle-tweaks/changelog.html';
  const forgetWhatsNew = () => { try { chrome.storage.local.remove('whatsNew'); } catch {} };
  // Same quiet snackbar as Classroom mode's "Take a tour" offer: bottom centre, two text buttons.
  TT.showWhatsNew = (version) => {
    document.querySelectorAll('.tt-whatsnew').forEach((x) => x.remove());
    const close = () => { bar.remove(); forgetWhatsNew(); };
    const bar = h('div', { class: 'tt-gc-tour-offer tt-whatsnew', role: 'status' },
      h('span', null, `Toddle Tweaks updated to ${version}.`),
      h('button', { class: 'tt-gc-btn text light', type: 'button', onClick: close }, 'Dismiss'),
      h('a', { class: 'tt-gc-btn text light strong', href: `${CHANGELOG}#v${String(version).replace(/\./g, '-')}`, target: '_blank', rel: 'noopener', onClick: () => setTimeout(close, 50) }, "See what's new"));
    // Never stack on top of the tour offer; wait for it to go.
    const place = () => (document.querySelector('.tt-gc-tour-offer:not(.tt-whatsnew), .tt-tour') ? setTimeout(place, 1500) : document.body.append(bar));
    place();
    return bar;
  };
  try {
    chrome.storage.local.get('whatsNew', (r) => {
      const w = r && r.whatsNew;
      if (!w || !w.version) return;
      if (TT.settings.whatsNew === false || Date.now() - (w.t || 0) > 14 * 864e5) { forgetWhatsNew(); return; }
      // Give Toddle a moment to draw so the note doesn't land on a blank page.
      TT.waitFor('body', 20000).then((b) => b && setTimeout(() => TT.showWhatsNew(w.version), 2500));
    });
  } catch {}
})();
