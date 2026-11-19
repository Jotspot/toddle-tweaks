/*
 * Toddle Tweaks — handy extras (each one has its own toggle in Settings):
 *  - Tab badge: "(3) …" in the tab title = missing + due today/tomorrow.
 *  - Command palette: Ctrl/⌘+K to jump to any class, assignment or page.
 *  - Keyboard shortcuts: g h / g t / g c / g s, and ? for help.
 *  - Relative due dates on Toddle's assignment pages.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const inGc = () => !!(TT.gc && TT.gc.active && TT.gc.active());
  const base = () => `/platform/${TT.cpId()}`;
  const go = (url) => (inGc() ? TT.gc.go(url) : TT.nav(url));
  TT.openSettings = () => { try { chrome.runtime.sendMessage({ type: 'openOptions' }); } catch {} };

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
  const entries = () => {
    const out = [
      { kind: 'Page', title: 'Home', icon: 'home', url: `${base()}/courses` },
      { kind: 'Page', title: 'To-do', icon: 'todo', url: `${base()}/courses?tt=todo`, gcOnly: true },
      { kind: 'Page', title: 'Calendar', icon: 'calendar', url: `${base()}/courses?tt=calendar`, gcOnly: true },
      { kind: 'Page', title: 'School announcements', icon: 'campaign', url: `${base()}/circulars` },
      { kind: 'Page', title: 'Timetable', icon: 'schedule', url: `${base()}/timetable` },
      { kind: 'Page', title: 'Attendance', icon: 'attendance', url: `${base()}/attendance-summary` },
      { kind: 'Page', title: 'Toddle Tweaks settings', icon: 'settings', action: TT.openSettings },
    ].filter((x) => !x.gcOnly || inGc());
    for (const c of courseList()) {
      out.push({ kind: 'Class', title: c.title, icon: 'school', url: `${base()}/courses/${c.id}/${inGc() ? 'home' : 'classroom'}` });
      out.push({ kind: 'Course plan', title: c.title, icon: 'folder', url: `${base()}/courses/${c.id}/course-plan/flow`, quiet: true });
    }
    const d = TT.todoData();
    if (d) {
      const items = d.items.slice().sort((a, b) => (a.toddleDone - b.toddleDone) || ((b.publishedAt || 0) - (a.publishedAt || 0)));
      for (const it of items) {
        out.push({ due: it.deadline, settled: it.toddleDone || (!it.needsSubmission && it.deadline && it.deadline < Date.now() - 864e5),
          kind: it.toddleDone ? 'Done' : (it.kind || (it.needsSubmission ? 'Assignment' : 'Material')), title: it.title,
          sub: (TT.courseName ? TT.courseName(it.courseId, it.courseTitle) : it.courseTitle)
            + (!it.deadline ? '' : (it.toddleDone || (!it.needsSubmission && it.deadline < Date.now())) ? ' · Due ' + TT.fmtDate(it.deadline) : ' · ' + TT.fmtDue(it.deadline)),
          icon: 'assignment', url: it.url });
      }
    }
    return out;
  };
  const score = (e, q) => {
    if (!q) return e.quiet ? 0 : 1;
    const hay = (e.title + ' ' + (e.sub || '') + ' ' + e.kind).toLowerCase();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.every((w) => hay.includes(w))) return 0;
    let s = 1;
    if (e.title.toLowerCase().startsWith(words[0])) s += 3;
    if (e.kind === 'Class' || e.kind === 'Page') s += 2;
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
    const input = h('input', { class: 'tt-pal-input', placeholder: 'Jump to a class, assignment or page…', 'aria-label': 'Search' });
    const list = h('div', { class: 'tt-pal-list', role: 'listbox' });
    const pick = (e) => { closePalette(); if (e.action) e.action(); else go(e.url); };
    const draw = () => {
      const q = input.value.trim();
      results = all.map((e) => [score(e, q), e]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 9).map(([, e]) => e);
      sel = Math.min(sel, Math.max(0, results.length - 1));
      list.textContent = '';
      if (!results.length) list.append(h('div', { class: 'tt-pal-empty' }, 'No matches'));
      results.forEach((e, i) => {
        const row = h('button', { class: 'tt-pal-row' + (i === sel ? ' sel' : ''), role: 'option', onClick: () => pick(e), onMousemove: () => { if (sel !== i) { sel = i; draw(); } } },
          I(e.icon), h('span', { class: 'tt-pal-main' }, h('span', { class: 'tt-pal-title' }, e.title), e.sub ? h('span', { class: 'tt-pal-sub' }, e.sub) : null),
          h('span', { class: 'tt-pal-kind' }, e.kind));
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
        row(['g', 's'], 'Toddle Tweaks settings'),
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
        c: () => (inGc() ? go(`${base()}/courses?tt=calendar`) : go(`${base()}/courses/my-calendar`)),
        s: TT.openSettings,
      };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    }
  }, true);

  // ---------------- relative due dates (both modes) ----------------
  const tick = TT.debounce(() => { if (/\/classroom-details\//.test(location.pathname) && TT.addRelativeDue) TT.addRelativeDue(); }, 200);
  TT.waitFor('body', 20000).then((b) => b && new MutationObserver(tick).observe(b, { childList: true, subtree: true }));
})();
