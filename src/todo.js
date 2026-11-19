/*
 * Toddle Tweaks — Smart to-do.
 * Toddle's "Pending" list is every assignment since August, oldest first, including
 * dozens of in-class items that never take a submission. This sorts things the way
 * a human would: Missing → Today → Tomorrow → This week → Next week → Later.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;

  // ---------------- state ----------------
  const localDone = () => TT.lsGet('tt:localDone', {});
  const setLocalDone = (id, on) => {
    const m = localDone();
    if (on) m[id] = Date.now(); else delete m[id];
    TT.lsSet('tt:localDone', m);
    try { chrome.storage.local.set({ localDone: m }); } catch {}
  };

  const view = TT.lsGet('tt:todoView', { tab: 'todo', sort: 'smart', course: 'all' });
  const saveView = () => TT.lsSet('tt:todoView', view);

  // ---------------- time helpers ----------------
  const DAY = 864e5;
  const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const endOfWeek = (t) => { // weeks end Sunday night
    const d = new Date(startOfDay(t));
    const dow = d.getDay(); // 0 = Sun
    return d.getTime() + ((7 - dow) % 7 + 1) * DAY - 1;
  };

  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fmtDue = (t, now = Date.now()) => {
    if (!t) return 'No due date';
    const sod = startOfDay(now);
    const diffDays = Math.round((startOfDay(t) - sod) / DAY);
    if (t < now) {
      const late = Math.floor((now - t) / DAY);
      if (late === 0) return `Due ${fmtTime(t)} today`;
      return `${late} day${late === 1 ? '' : 's'} late`;
    }
    if (diffDays === 0) return `Due today, ${fmtTime(t)}`;
    if (diffDays === 1) return `Due tomorrow, ${fmtTime(t)}`;
    if (diffDays < 7) return `Due ${new Date(t).toLocaleDateString([], { weekday: 'long' })}, ${fmtTime(t)}`;
    return `Due ${new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };
  TT.fmtDue = fmtDue;

  // ---------------- categorisation ----------------
  const BUCKETS = [
    ['missing', 'Missing'],
    ['today', 'Today'],
    ['tomorrow', 'Tomorrow'],
    ['week', 'This week'],
    ['nextweek', 'Next week'],
    ['later', 'Later'],
    ['nodate', 'No due date'],
  ];

  const categorize = (items, now = Date.now()) => {
    const s = TT.settings;
    const ld = localDone();
    const sod = startOfDay(now);
    const eow = endOfWeek(now);
    const eonw = eow + 7 * DAY;
    const out = { todo: [], missing: [], done: [] };

    for (const it of items) {
      let doneReason = null;
      if (it.toddleDone) doneReason = 'toddle';
      else if (ld[it.id]) doneReason = 'you';
      else if (s.hidePastNoSubmission && !it.needsSubmission && it.status !== 'OVERDUE' && it.deadline && it.deadline < sod) doneReason = 'auto';

      if (doneReason) { out.done.push({ ...it, doneReason }); continue; }

      const d = it.deadline;
      let bucket;
      if (d && d < now && (it.status === 'OVERDUE' || it.needsSubmission)) bucket = 'missing';
      else if (!d) bucket = 'nodate';
      else if (d < sod + DAY) bucket = 'today';
      else if (d < sod + 2 * DAY) bucket = 'tomorrow';
      else if (d <= eow) bucket = 'week';
      else if (d <= eonw) bucket = 'nextweek';
      else bucket = 'later';
      const x = { ...it, bucket };
      if (bucket === 'missing') out.missing.push(x);
      out.todo.push(x);
    }

    const byDue = (a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity)
      || (b.needsSubmission - a.needsSubmission) || (b.isTest - a.isTest) || a.title.localeCompare(b.title);
    out.todo.sort(byDue);
    out.missing.sort((a, b) => b.deadline - a.deadline);
    out.done.sort((a, b) => (b.deadline ?? 0) - (a.deadline ?? 0));
    return out;
  };
  TT.categorize = categorize;

  // ---------------- data loading ----------------
  let data = TT.api.cachedTasks();
  let loading = false;
  let lastError = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((f) => f());

  TT.todoData = () => data;
  TT.onTodo = (f) => { listeners.add(f); return () => listeners.delete(f); };

  TT.refreshTodo = async (force) => {
    if (loading) return;
    if (!force && data && Date.now() - data.t < 60e3) return;
    loading = true; notify();
    try {
      data = await TT.api.getTasks();
      lastError = null;
      updateBadge();
    } catch (e) {
      lastError = e.message;
    } finally {
      loading = false; notify();
    }
  };

  const updateBadge = () => {
    if (!data) return;
    const c = categorize(data.items);
    const urgent = c.missing.length + c.todo.filter((x) => x.bucket === 'today' || x.bucket === 'tomorrow').length;
    try { chrome.runtime.sendMessage({ type: 'badge', count: urgent, missing: c.missing.length }); } catch {}
  };

  // Toddle changed something (submission, mark as done…) → refresh.
  window.addEventListener('tt:page', (e) => {
    try {
      const { type } = JSON.parse(e.detail);
      if (type === 'mutation') setTimeout(() => TT.refreshTodo(true), 800);
    } catch {}
  });
  window.addEventListener('focus', () => TT.refreshTodo(false));

  // ---------------- rendering ----------------
  const courseColor = (id, title) => (TT.courseColor ? TT.courseColor(id, title) : TT.colorFor(id));

  const chip = (text, cls) => h('span', { class: 'tt-chip ' + (cls || '') }, text);

  const icon = (name) => {
    const P = {
      assignment: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
      quiz: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7.01 15c-.7 0-1.26-.56-1.26-1.26 0-.71.56-1.25 1.26-1.25.71 0 1.25.54 1.25 1.25-.01.69-.54 1.26-1.25 1.26zm3.01-7.4c-.76 1.11-1.48 1.46-1.87 2.17-.16.29-.22.48-.22 1.41h-1.82c0-.49-.08-1.29.31-1.98.49-.87 1.42-1.39 1.96-2.16.57-.81.25-2.33-1.37-2.33-1.06 0-1.58.8-1.8 1.48l-1.65-.7C9.95 7.15 10.8 6 12.36 6c1.3 0 2.2.59 2.65 1.33.39.63.61 1.82-.01 2.27z',
      material: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
      check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
      refresh: 'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
      close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
      expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
      todo: 'M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8c1.57 0 3.04.46 4.28 1.25l1.45-1.45A10.02 10.02 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.73 0 3.36-.44 4.78-1.22l-1.5-1.5c-1 .46-2.11.72-3.28.72zm7-5h-3v2h3v3h2v-3h3v-2h-3v-3h-2v3z',
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'tt-ico');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', P[name] || P.assignment);
    svg.appendChild(p);
    return svg;
  };
  TT.icon = icon;

  const itemRow = (it, rerender) => {
    const ld = localDone();
    const done = !!it.doneReason;
    const color = courseColor(it.courseId, it.courseTitle);
    const kind = it.isTest ? 'quiz' : it.needsSubmission ? 'assignment' : 'material';

    const box = h('button', {
      class: 'tt-check' + (done ? ' on' : ''),
      title: done ? (it.doneReason === 'you' ? 'Mark as not done' : it.doneReason === 'toddle' ? 'Done in Toddle' : 'Auto-done: past, no submission needed') : 'Mark as done (just for you)',
      'aria-label': done ? 'Mark as not done' : 'Mark as done',
      disabled: it.doneReason === 'toddle' ? true : null,
      onClick: (e) => {
        e.preventDefault(); e.stopPropagation();
        if (it.doneReason === 'auto') {
          // un-auto: force it back into the list
          const m = TT.lsGet('tt:forceShow', {}); m[it.id] = 1; TT.lsSet('tt:forceShow', m);
        } else setLocalDone(it.id, !ld[it.id]);
        rerender();
      },
    }, icon('check'));

    const meta = [
      h('span', { class: 'tt-course', style: { color } }, TT.courseName ? TT.courseName(it.courseId, it.courseTitle) : it.courseTitle),
      h('span', { class: 'tt-sep' }, '·'),
      h('span', { class: 'tt-due' + (it.bucket === 'missing' ? ' late' : '') }, fmtDue(it.deadline)),
    ];
    const chips = [
      it.kind && chip(it.kind, 'test'),
      it.needsSubmission && !done && chip('Turn in', 'submit'),
      !it.needsSubmission && !done && chip('In class', 'muted'),
      it.isNew && !done && chip('New', 'new'),
      it.doneReason === 'auto' && chip('Auto-done', 'muted'),
      it.doneReason === 'toddle' && chip(it.isEvaluated ? 'Graded' : 'Turned in', 'ok'),
    ];

    const a = TT.spaLink(h('a', { class: 'tt-item' + (done ? ' done' : ''), href: it.url, 'data-id': it.id },
      h('span', { class: 'tt-item-icon', style: { background: color } }, icon(kind)),
      h('span', { class: 'tt-item-main' },
        h('span', { class: 'tt-item-title' }, it.title),
        h('span', { class: 'tt-item-meta' }, meta)),
      h('span', { class: 'tt-item-chips' }, chips),
      box));
    a.addEventListener('click', () => { if (TT.closeTodoPage) setTimeout(TT.closeTodoPage, 50); });
    return a;
  };

  const group = (key, title, items, rerender, opts = {}) => {
    const collapsedMap = TT.lsGet('tt:collapsed', {});
    const collapsed = opts.defaultCollapsed ? collapsedMap[key] !== false : !!collapsedMap[key];
    const sec = h('section', { class: 'tt-group' + (collapsed ? ' collapsed' : '') + ' tt-g-' + key });
    const head = h('button', {
      class: 'tt-group-head',
      onClick: () => {
        const m = TT.lsGet('tt:collapsed', {});
        m[key] = !sec.classList.contains('collapsed');
        TT.lsSet('tt:collapsed', m);
        sec.classList.toggle('collapsed');
      },
    }, h('span', { class: 'tt-group-title' }, title), h('span', { class: 'tt-group-count' }, String(items.length)), icon('expand'));
    sec.append(head, h('div', { class: 'tt-group-body' }, items.map((it) => itemRow(it, rerender)), opts.footer || null));
    return sec;
  };

  // Main renderer. mode: 'panel' (home widget) or 'page' (full Classroom-style page)
  TT.renderTodo = (container, mode = 'panel', opts = {}) => {
    const rerender = () => draw();
    const draw = () => {
      container.textContent = '';
      container.classList.add('tt-todo', 'tt-todo-' + mode);
      const courseFilter = opts.courseId || view.course;

      const header = h('div', { class: 'tt-todo-header' });
      const title = h('div', { class: 'tt-todo-title' }, mode === 'page' || mode === 'gc' ? 'To-do' : opts.courseId ? 'Smart to-do · this class' : 'Smart to-do');
      const refreshBtn = h('button', { class: 'tt-icon-btn' + (loading ? ' spin' : ''), title: 'Refresh', onClick: () => TT.refreshTodo(true) }, icon('refresh'));
      header.append(title, refreshBtn);
      if (mode === 'page' && TT.closeTodoPage) header.append(h('button', { class: 'tt-icon-btn', title: 'Close (Esc)', onClick: TT.closeTodoPage }, icon('close')));
      container.append(header);

      if (!data) {
        container.append(h('div', { class: 'tt-empty' },
          lastError === 'NEED_HOME_VISIT' ? 'Open your Toddle home page once so Toddle Tweaks can learn your classes.'
            : lastError ? `Couldn't load assignments: ${lastError}` : 'Loading your assignments…'));
        return;
      }

      // Re-apply "force show" overrides for auto-done items.
      const force = TT.lsGet('tt:forceShow', {});
      const items = data.items.map((x) => (force[x.id] ? { ...x, needsSubmission: true, _forced: true } : x));
      let cat = categorize(items);
      const courses = [...new Map(data.items.map((x) => [x.courseId, TT.courseName ? TT.courseName(x.courseId, x.courseTitle) : x.courseTitle])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
      if (courseFilter !== 'all') {
        const f = (arr) => arr.filter((x) => x.courseId === courseFilter);
        cat = { todo: f(cat.todo), missing: f(cat.missing), done: f(cat.done) };
      }

      // tabs
      const tabs = h('div', { class: 'tt-tabs', role: 'tablist' },
        [['todo', 'Assigned', cat.todo.length - cat.missing.length], ['missing', 'Missing', cat.missing.length], ['done', 'Done', cat.done.length]]
          .map(([k, label, n]) => h('button', {
            class: 'tt-tab' + (view.tab === k ? ' active' : '') + (k === 'missing' && n ? ' alert' : ''),
            role: 'tab',
            onClick: () => { view.tab = k; saveView(); draw(); },
          }, label, n ? h('span', { class: 'tt-tab-n' }, String(n)) : null)));
      container.append(tabs);

      // filters
      const courseSel = h('select', { class: 'tt-select', 'aria-label': 'Class', onChange: (e) => { view.course = e.target.value; saveView(); draw(); } },
        h('option', { value: 'all' }, 'All classes'),
        courses.map(([id, t]) => h('option', { value: id, selected: view.course === id ? true : null }, t)));
      const sortSel = h('select', { class: 'tt-select', 'aria-label': 'Sort', onChange: (e) => { view.sort = e.target.value; saveView(); draw(); } },
        [['smart', 'Smart (Today, This week…)'], ['due-asc', 'Due date — soonest first'], ['due-desc', 'Due date — latest first'],
          ['recent', 'Recently assigned'], ['class', 'By class'], ['type', 'By type (tests first)'], ['az', 'Title A–Z']]
          .map(([v, t]) => h('option', { value: v, selected: view.sort === v ? true : null }, t)));
      const showSort = view.tab === 'todo' && !opts.courseId;
      if (!opts.courseId || showSort) container.append(h('div', { class: 'tt-filters' }, opts.courseId ? null : courseSel, showSort ? sortSel : null));

      const body = h('div', { class: 'tt-todo-body' });
      container.append(body);

      if (view.tab === 'todo') {
        const list = cat.todo.filter((x) => x.bucket !== 'missing');
        if (!list.length) body.append(h('div', { class: 'tt-empty' }, '🎉 Nothing assigned. Enjoy it.'));
        if (view.sort === 'smart') {
          for (const [k, label] of BUCKETS.slice(1)) {
            const g = list.filter((x) => x.bucket === k);
            if (g.length) body.append(group(k, label, g, rerender, { defaultCollapsed: k === 'later' && g.length > 6 }));
          }
        } else if (view.sort === 'class') {
          for (const [id, t] of courses) {
            const g = list.filter((x) => x.courseId === id);
            if (g.length) body.append(group('c' + id, t, g, rerender));
          }
        } else if (view.sort === 'type') {
          const kinds = [
            ['t-test', 'Tests, quizzes & summatives', (x) => x.isTest],
            ['t-submit', 'Needs turning in', (x) => !x.isTest && x.needsSubmission],
            ['t-class', 'In class / nothing to turn in', (x) => !x.isTest && !x.needsSubmission],
          ];
          for (const [k, label, f] of kinds) {
            const g = list.filter(f);
            if (g.length) body.append(group(k, label, g, rerender));
          }
        } else {
          const sorters = {
            'due-asc': ['Soonest due first', (a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity)],
            'due-desc': ['Latest due first', (a, b) => (b.deadline ?? -Infinity) - (a.deadline ?? -Infinity)],
            az: ['A–Z', (a, b) => a.title.localeCompare(b.title)],
            recent: ['Newest first', (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0)],
          };
          const [label, fn] = sorters[view.sort] || sorters.recent;
          const g = list.slice().sort(fn);
          if (g.length) body.append(group('flat-' + view.sort, label, g, rerender));
        }
      } else if (view.tab === 'missing') {
        if (!cat.missing.length) body.append(h('div', { class: 'tt-empty' }, 'No missing work. 👏'));
        else body.append(group('missingAll', 'Past due — still needs you', cat.missing, rerender));
      } else {
        const auto = cat.done.filter((x) => x.doneReason === 'auto');
        const rest = cat.done.filter((x) => x.doneReason !== 'auto');
        if (auto.length) {
          const footer = h('div', { class: 'tt-hint' });
          footer.append('These are past items that never took a submission, so Toddle Tweaks already treats them as done. You can also clear them out of Toddle itself:');
          const targets = auto.filter((x) => !x.needsSubmission && x.submissionId);
          const btn = h('button', { class: 'tt-btn', onClick: async () => {
            if (!confirm(`Mark ${targets.length} past "no submission needed" items as done in Toddle?\n\nThis is the same as clicking Toddle's "Mark as done" on each one. Your teachers will see them as done.`)) return;
            btn.disabled = true;
            let ok = 0;
            for (const it of targets) {
              btn.textContent = `Marking… ${ok}/${targets.length}`;
              try { await TT.api.markDone(it); ok++; } catch (e) { console.warn('[TT] markDone', e); }
            }
            btn.textContent = `Marked ${ok} of ${targets.length} as done in Toddle`;
            TT.refreshTodo(true);
          } }, `Mark all ${targets.length} as done in Toddle`);
          footer.append(h('div', null, btn));
          body.append(group('auto', 'Auto-done (past, nothing to turn in)', auto, rerender, { defaultCollapsed: true, footer }));
        }
        if (rest.length) body.append(group('doneAll', 'Turned in / done', rest, rerender, { defaultCollapsed: false }));
        if (!cat.done.length) body.append(h('div', { class: 'tt-empty' }, 'Nothing here yet.'));
      }

      const age = Math.round((Date.now() - data.t) / 60000);
      container.append(h('div', { class: 'tt-foot' }, loading ? 'Refreshing…' : `Updated ${age < 1 ? 'just now' : age + ' min ago'}`, lastError ? ` · ${lastError}` : ''));
    };

    draw();
    // Auto-unsubscribe once Toddle re-renders and throws our container away.
    const off = TT.onTodo(() => { if (!container.isConnected) { off(); return; } draw(); });
    TT.refreshTodo(false);
    return () => off();
  };

  // ---------------- full-page view (Classroom style) ----------------
  TT.openTodoPage = () => {
    if (document.getElementById('tt-todo-page')) return;
    const page = h('div', { id: 'tt-todo-page', role: 'dialog', 'aria-label': 'To-do' });
    const inner = h('div', { class: 'tt-todo-page-inner' });
    page.append(inner);
    document.body.append(page);
    const cleanup = TT.renderTodo(inner, 'page');
    const onKey = (e) => { if (e.key === 'Escape') TT.closeTodoPage(); };
    document.addEventListener('keydown', onKey);
    page.addEventListener('click', (e) => { if (e.target === page) TT.closeTodoPage(); });
    TT.closeTodoPage = () => {
      cleanup();
      document.removeEventListener('keydown', onKey);
      page.remove();
      TT.closeTodoPage = null;
    };
  };

  updateBadge();
})();
