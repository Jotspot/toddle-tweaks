/* Toddle Tweaks — Classroom class pages: Stream, Classwork, People. */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;

  // ---------------- per-class data (cached → refreshed) ----------------
  const loading = {};
  const failedAt = {};
  const fresh = (entry, ms) => entry && Date.now() - entry.t < ms;
  const load = (kind, id, fn) => {
    const k = kind + id;
    if (loading[k] || Date.now() - (failedAt[k] || 0) < 30e3) return; // back off after a failure
    loading[k] = true;
    fn(id)
      .then(() => { delete failedAt[k]; })
      .catch((e) => { failedAt[k] = Date.now(); console.warn('[TT]', kind, e); })
      .finally(() => { loading[k] = false; gc.rerender(); });
  };
  const work = (id) => {
    const c = TT.api.cachedCourseWork(id);
    if (!fresh(c, 60e3)) load('cw', id, TT.api.getCourseWork);
    return c && c.list;
  };
  const anns = (id) => {
    const c = TT.api.cachedAnnouncements(id);
    if (!fresh(c, 60e3)) load('ann', id, TT.api.getAnnouncements);
    return c && c.list;
  };
  const people = (id) => {
    const c = TT.api.cachedPeople(id);
    if (!fresh(c, 6 * 3600e3)) load('ppl', id, TT.api.getPeople);
    return c;
  };

  gc.courseData = { work, fresh, load, failedAt };

  // ---------------- shared pieces ----------------
  const banner = (course, big) => {
    const theme = TT.themes.forCourse(course);
    const t = gc.teachers(course.id)[0];
    return h('div', { class: 'tt-gc-banner' + (big ? '' : ' small'), style: { backgroundImage: `url("${TT.themes.url(theme)}")`, backgroundColor: TT.themes.color(course) } },
      h('div', { class: 'tt-gc-banner-title' }, course.title),
      course.section ? h('div', { class: 'tt-gc-banner-sub' }, course.section) : null,
      t ? h('div', { class: 'tt-gc-banner-sub small' }, TT.personName(t)) : null,
      h('div', { class: 'tt-gc-banner-btns' },
        h('button', { class: 'tt-gc-banner-btn', title: 'Change theme', onClick: () => gc.pickTheme(course) }, I('palette'), h('span', null, 'Customize'))));
  };

  const statusOf = (it) => {
    if (it.toddleDone) return it.isEvaluated ? ['Graded', 'ok'] : it.needsSubmission ? ['Turned in', 'ok'] : ['Done', 'ok'];
    if (it.deadline && it.deadline < Date.now() && it.needsSubmission) return ['Missing', 'late'];
    if (!it.needsSubmission) return ['No submission', ''];
    return ['Assigned', ''];
  };

  const kindIcon = (it) => (it.isTest ? TT.workIcon(it) : it.needsSubmission ? 'assignment' : 'description');

  const loadingNote = (txt) => h('div', { class: 'tt-gc-empty small' }, txt);

  // ---------------- Stream ----------------
  gc.views.stream = (el, r) => {
    const course = gc.course(r.courseId);
    const color = TT.themes.color(course);
    const list = work(r.courseId);
    const posts = anns(r.courseId);
    const now = Date.now();

    // Classroom-style "Upcoming": grouped by day, next two weeks, plus anything missing.
    const DAY = 864e5;
    const sod = new Date().setHours(0, 0, 0, 0);
    const missing = (list || []).filter((x) => !x.toddleDone && x.needsSubmission && x.deadline && x.deadline < now);
    const upcoming = (list || []).filter((x) => !x.toddleDone && x.deadline && x.deadline >= now && x.deadline < sod + 15 * DAY)
      .sort((a, b) => a.deadline - b.deadline).slice(0, 6);
    const dayLabel = (t) => {
      const d = Math.round((new Date(t).setHours(0, 0, 0, 0) - sod) / DAY);
      if (d === 0) return 'Due today';
      if (d === 1) return 'Due tomorrow';
      if (d < 7) return 'Due ' + new Date(t).toLocaleDateString([], { weekday: 'long' });
      return 'Due ' + new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    };
    const upItems = [];
    let lastLabel = null;
    for (const it of upcoming) {
      const label = dayLabel(it.deadline);
      if (label !== lastLabel) { upItems.push(h('div', { class: 'tt-gc-upcoming-day' }, label)); lastLabel = label; }
      upItems.push(gc.link(it.url, { class: 'tt-gc-upcoming-item' },
        h('span', { class: 'what' }, new Date(it.deadline).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' – ' + it.title)));
    }
    const side = h('div', { class: 'tt-gc-upcoming' },
      h('div', { class: 'tt-gc-upcoming-title' }, 'Upcoming'),
      missing.length ? gc.link(`${gc.base()}/courses/${r.courseId}/classroom`, { class: 'tt-gc-upcoming-missing', onClick: () => TT.lsSet('tt:cwView', { ...(TT.lsGet('tt:cwView', {}) || {}), show: 'missing' }) },
        `${missing.length} missing assignment${missing.length > 1 ? 's' : ''}`) : null,
      list == null ? h('div', { class: 'tt-gc-upcoming-none' }, 'Loading…')
        : upItems.length ? upItems : h('div', { class: 'tt-gc-upcoming-none' }, 'Woohoo, no work due soon!'),
      h('div', { class: 'tt-gc-upcoming-foot' }, gc.link(`${gc.base()}/courses/${r.courseId}/classroom`, { class: 'tt-gc-btn text' }, 'View all')));

    // Merge announcements + "posted a new assignment" items, newest first.
    const items = [];
    for (const p of posts || []) items.push({ t: Date.parse(p.publishedAt), kind: 'ann', p });
    for (const it of list || []) if (it.publishedAt) items.push({ t: it.publishedAt, kind: 'work', it });
    items.sort((a, b) => b.t - a.t);

    // Dedicated Announcements view: All / Announcements / Classwork posts (remembered).
    const show = TT.lsGet('tt:streamShow', 'all') || 'all';
    const nAnn = items.filter((x) => x.kind === 'ann').length;
    const nUnread = (posts || []).filter((p) => !p.isRead).length;
    const nWork = items.length - nAnn;
    const chip = (k, label, n, extra) => h('button', {
      class: 'tt-gc-chip-f' + (show === k ? ' on' : ''), 'aria-pressed': show === k ? 'true' : 'false',
      onClick: () => { TT.lsSet('tt:streamShow', k); gc.rerender(); },
    }, k === 'ann' ? I('campaign') : k === 'work' ? I('assignment') : null, label, h('span', { class: 'n' }, String(n)), extra || null);
    const filters = h('div', { class: 'tt-gc-stream-filters', role: 'group', 'aria-label': 'Show' },
      chip('all', 'All', items.length),
      chip('ann', 'Announcements', nAnn, nUnread ? h('span', { class: 'dot', title: `${nUnread} unread` }) : null),
      chip('work', 'Classwork posts', nWork));
    const shown = show === 'ann' ? items.filter((x) => x.kind === 'ann') : show === 'work' ? items.filter((x) => x.kind === 'work') : items;

    const feed = h('div', { class: 'tt-gc-feed' }, filters);
    if (list == null && posts == null) feed.append(loadingNote('Loading stream…'));
    else if (!shown.length) feed.append(h('div', { class: 'tt-gc-feed-empty' }, show === 'ann' ? 'No announcements from your teacher yet.' : show === 'work' ? 'Nothing has been posted yet.' : 'This is where you can talk to your class. Nothing posted yet.'));
    for (const x of shown.slice(0, show === 'ann' ? 200 : 60)) {
      if (x.kind === 'ann') {
        const p = x.p;
        const who = p.createdBy || {};
        const body = h('div', { class: 'tt-gc-post-body' });
        if (p.title) body.append(h('div', { class: 'tt-gc-post-title' }, p.title));
        body.append(TT.sanitize(p.description));
        const card = h('div', { class: 'tt-gc-post' + (p.isRead ? '' : ' unread') },
          h('div', { class: 'tt-gc-post-head' },
            TT.avatar(who, 40, color),
            h('div', null, h('div', { class: 'tt-gc-post-who' }, TT.personName(who)), h('div', { class: 'tt-gc-post-when' }, TT.fmtDate(x.t)))),
          body);
        // Long announcements collapse like Classroom's.
        feed.append(card);
        requestAnimationFrame(() => {
          if (body.scrollHeight > 260) {
            body.classList.add('clamped');
            const more = h('button', { class: 'tt-gc-btn text', onClick: () => { body.classList.toggle('clamped'); more.textContent = body.classList.contains('clamped') ? 'Show more' : 'Show less'; } }, 'Show more');
            card.append(more);
          }
        });
      } else {
        const it = x.it;
        const who = it.by ? it.by.name : 'Your teacher';
        feed.append(gc.link(it.url, { class: 'tt-gc-post work' },
          h('span', { class: 'tt-gc-work-ico', style: { background: it.toddleDone ? '#5f6368' : color } }, I(kindIcon(it))),
          h('div', { class: 'tt-gc-work-text' },
            h('div', null, `${who} posted a new ${it.isTest ? 'assessment' : it.needsSubmission ? 'assignment' : 'material'}: `, h('b', null, it.title)),
            h('div', { class: 'tt-gc-post-when' }, TT.fmtDate(x.t) + (it.deadline ? ` · Due ${TT.fmtDate(it.deadline)}` : '')))));
      }
    }

    el.append(h('div', { class: 'tt-gc-course' }, banner(course, true), h('div', { class: 'tt-gc-stream' }, side, feed)));
  };

  // ---------------- Classwork ----------------
  const open = new Set();
  gc.views.classwork = (el, r) => {
    const course = gc.course(r.courseId);
    const color = TT.themes.color(course);
    const list = work(r.courseId);
    const wrap = h('div', { class: 'tt-gc-course narrow' });
    wrap.append(h('div', { class: 'tt-gc-cw-top' },
      gc.link(`${gc.base()}/courses?tt=todo`, { class: 'tt-gc-btn outlined', onClick: () => { const v = TT.lsGet('tt:todoView', {}) || {}; v.course = r.courseId; TT.lsSet('tt:todoView', v); } }, I('yourwork'), 'View your work'),
      gc.link(`${gc.base()}/courses/${r.courseId}/course-plan/flow`, { class: 'tt-gc-btn outlined' }, I('folder'), 'Course plan'),
      gc.link(`${gc.base()}/courses/${r.courseId}/classroom?tt=classic`, { class: 'tt-gc-btn text', title: "Toddle's original Assignments page" }, 'Classic view')));

    if (!list) { wrap.append(loadingNote(failedAt['cw' + r.courseId] ? 'Couldn\'t load classwork — retrying shortly. "Classic view" still works.' : 'Loading classwork…')); el.append(wrap); return; }
    if (!list.length) { wrap.append(h('div', { class: 'tt-gc-feed-empty' }, 'Your teacher hasn\'t assigned any work yet.')); el.append(wrap); return; }

    // Controls: order/grouping, show filter, collapse all.
    const cw = { sort: 'smart', show: 'all', ...(TT.lsGet('tt:cwView', {}) || {}) };
    const setCw = (patch) => { TT.lsSet('tt:cwView', { ...cw, ...patch }); gc.rerender(); };
    const collapsedKey = 'tt:cwCollapsed:' + r.courseId;
    const collapsed = new Set(TT.lsGet(collapsedKey, null) || ['s-done']);
    const saveCollapsed = () => TT.lsSet(collapsedKey, [...collapsed]);

    const now = Date.now();
    const DAY = 864e5;
    const isMissing = (x) => !x.toddleDone && x.needsSubmission && x.deadline && x.deadline < now;
    // "Done" for sorting purposes: done in Toddle, or past + nothing to turn in.
    const isSettled = (x) => x.toddleDone || (!x.needsSubmission && x.deadline && x.deadline < now - DAY);
    let items = list.slice();
    if (cw.show === 'todo') items = items.filter((x) => !isSettled(x));
    else if (cw.show === 'missing') items = items.filter(isMissing);
    else if (cw.show === 'done') items = items.filter(isSettled);
    else if (cw.show === 'tests') items = items.filter((x) => x.isTest);

    const byDue = (a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity);
    const sorters = {
      topic: (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
      newest: (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
      oldest: (a, b) => (a.publishedAt || 0) - (b.publishedAt || 0),
      due: byDue,
      az: (a, b) => a.title.localeCompare(b.title),
    };

    // Build sections.
    let sections = [];
    if (cw.sort === 'smart') {
      const buckets = [
        ['s-missing', 'Missing', isMissing, byDue],
        ['s-soon', 'Due in the next 7 days', (x) => !isSettled(x) && !isMissing(x) && x.deadline && x.deadline >= now - DAY && x.deadline < now + 7 * DAY, byDue],
        ['s-later', 'Coming up later', (x) => !isSettled(x) && !isMissing(x) && x.deadline && x.deadline >= now + 7 * DAY, byDue],
        ['s-nodate', 'No due date', (x) => !isSettled(x) && !x.deadline, sorters.newest],
        ['s-done', 'Done & past', isSettled, (a, b) => (b.deadline || b.publishedAt || 0) - (a.deadline || a.publishedAt || 0)],
      ];
      const used = new Set();
      for (const [k, title, f, s] of buckets) {
        const g = items.filter((x) => !used.has(x.id) && f(x)).sort(s);
        g.forEach((x) => used.add(x.id));
        if (g.length) sections.push({ k, title, items: g, smart: true });
      }
      const rest = items.filter((x) => !used.has(x.id));
      if (rest.length) sections.push({ k: 's-other', title: 'Other', items: rest, smart: true });
    } else if (cw.sort === 'topic') {
      const groups = new Map();
      for (const it of items) {
        const k = it.unitId || '';
        if (!groups.has(k)) groups.set(k, { k, title: it.unitTitle || '', items: [], latest: 0 });
        const g = groups.get(k);
        g.items.push(it);
        g.latest = Math.max(g.latest, it.publishedAt || 0);
      }
      sections = [...groups.values()].sort((a, b) => (a.k === '' ? -1 : b.k === '' ? 1 : b.latest - a.latest));
      sections.forEach((g) => g.items.sort(sorters.topic));
    } else {
      sections = [{ k: '', title: '', items: items.slice().sort(sorters[cw.sort] || sorters.newest) }];
    }

    const sel = (val, opts, on) => h('select', { class: 'tt-gc-select small', onChange: (e) => on(e.target.value) },
      opts.map(([v, t]) => h('option', { value: v, selected: v === val ? true : null }, t)));
    const collapsible = sections.filter((g) => g.title).map((g) => g.k);
    wrap.append(h('div', { class: 'tt-gc-cw-controls' },
      sel(cw.sort, [['smart', 'Smart (what needs you first)'], ['topic', 'Group by topic'], ['due', 'Due date'], ['newest', 'Newest first'], ['oldest', 'Oldest first'], ['az', 'Title A–Z']], (v) => setCw({ sort: v })),
      sel(cw.show, [['all', 'All work'], ['todo', 'Not done'], ['missing', 'Missing'], ['done', 'Done & past'], ['tests', 'Tests & quizzes']], (v) => setCw({ show: v })),
      collapsible.length ? h('button', { class: 'tt-gc-btn text', onClick: () => {
        const allCollapsed = collapsible.every((k) => collapsed.has(k));
        collapsible.forEach((k) => (allCollapsed ? collapsed.delete(k) : collapsed.add(k)));
        saveCollapsed(); gc.rerender();
      } }, collapsible.every((k) => collapsed.has(k)) ? 'Expand all' : 'Collapse all') : null));

    const relDue = (t) => {
      if (!t) return '';
      const d = Math.round((new Date(t).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY);
      if (d === 0) return 'Due today';
      if (d === 1) return 'Due tomorrow';
      if (d === -1) return 'Due yesterday';
      if (d > 1 && d < 7) return 'Due ' + new Date(t).toLocaleDateString([], { weekday: 'long' });
      return 'Due ' + TT.fmtDate(t);
    };

    if (!items.length) wrap.append(h('div', { class: 'tt-gc-feed-empty' }, 'Nothing matches this filter.'));
    for (const g of sections) {
      const isCollapsed = g.title && collapsed.has(g.k);
      const sec = h('section', { class: 'tt-gc-topic' + (isCollapsed ? ' collapsed' : '') + (g.smart ? ' smart ' + g.k : '') });
      if (g.title) {
        sec.append(h('button', { class: 'tt-gc-topic-title', style: { color: g.k === 's-missing' ? '#c5221f' : g.smart ? '#3c4043' : color }, 'aria-expanded': isCollapsed ? 'false' : 'true', onClick: () => {
          if (collapsed.has(g.k)) collapsed.delete(g.k); else collapsed.add(g.k);
          saveCollapsed(); gc.rerender();
        } }, h('span', null, g.title), h('span', { class: 'tt-gc-topic-n' }, String(g.items.length)), I('expand', 'tt-gc-topic-caret')));
      }
      if (isCollapsed) { wrap.append(sec); continue; }
      for (const it of g.items) {
        const [st, stCls] = statusOf(it);
        const isOpen = open.has(it.id);
        const row = h('div', { class: 'tt-gc-cw' + (isOpen ? ' open' : '') + (isSettled(it) ? ' settled' : '') });
        const sub = [
          (g.smart || cw.sort !== 'topic') && it.unitTitle ? it.unitTitle : null,
          it.kind || (it.needsSubmission ? 'Assignment' : 'Material'),
        ].filter(Boolean).join(' · ');
        const head = h('button', { class: 'tt-gc-cw-head', onClick: () => { if (open.has(it.id)) open.delete(it.id); else open.add(it.id); row.classList.toggle('open'); } },
          h('span', { class: 'tt-gc-work-ico', style: { background: isSettled(it) ? '#80868b' : color } }, I(kindIcon(it))),
          h('span', { class: 'tt-gc-cw-main' },
            h('span', { class: 'tt-gc-cw-title' }, it.title),
            h('span', { class: 'tt-gc-cw-sub' }, sub)),
          h('span', { class: 'tt-gc-cw-right' },
            st && st !== 'Assigned' && st !== 'No submission' ? h('span', { class: 'tt-gc-pillst ' + stCls }, st) : null,
            h('span', { class: 'tt-gc-cw-due' + (stCls === 'late' ? ' late' : '') }, it.deadline ? relDue(it.deadline) : 'Posted ' + TT.fmtDate(it.publishedAt))));
        const detail = h('div', { class: 'tt-gc-cw-detail' },
          h('div', { class: 'tt-gc-cw-meta' },
            h('span', null, 'Posted ' + TT.fmtDate(it.publishedAt) + (it.by ? ' by ' + it.by.name : '') + (it.deadline ? ' · ' + TT.fmtDue(it.deadline) : '')),
            h('span', { class: 'tt-gc-status ' + stCls }, st)),
          it.description ? h('div', { class: 'tt-gc-cw-desc' }, TT.sanitize(it.description)) : h('div', { class: 'tt-gc-cw-desc muted' }, 'No instructions.'),
          h('div', { class: 'tt-gc-cw-actions' }, gc.link(it.url, { class: 'tt-gc-btn text' }, it.needsSubmission ? 'View assignment' : 'View material')));
        row.append(head, detail);
        sec.append(row);
      }
      wrap.append(sec);
    }
    el.append(wrap);
  };

  // ---------------- People ----------------
  gc.views.people = (el, r) => {
    const course = gc.course(r.courseId);
    const color = TT.themes.color(course);
    const p = people(r.courseId);
    const wrap = h('div', { class: 'tt-gc-course narrow tt-gc-people' });
    if (!p) { wrap.append(loadingNote('Loading people…')); el.append(wrap); return; }
    const me = (TT.lsGet('userInfo', {}) || {}).id;
    const section = (title, list, count) => h('section', null,
      h('div', { class: 'tt-gc-people-head', style: { color, borderColor: color } }, h('span', null, title), count ? h('span', { class: 'n' }, count) : null),
      list.map((x) => h('div', { class: 'tt-gc-person' }, TT.avatar(x, 32, color), h('span', null, TT.personName(x), x.id === me ? h('small', null, ' (you)') : null))));
    const students = p.students.slice().sort((a, b) => TT.personName(a).localeCompare(TT.personName(b)));
    wrap.append(section('Teachers', p.teachers), section('Classmates', students, `${students.length} student${students.length === 1 ? '' : 's'}`));
    el.append(wrap);
  };
})();
