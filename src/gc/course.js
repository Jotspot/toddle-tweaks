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

  // The class's own home page in Toddle: description, quick links, the teacher's banner picture.
  const homeOf = (id) => {
    const c = TT.api.cachedCourseHome(id);
    if (!fresh(c, 6 * 3600e3)) load('home', id, TT.api.getCourseHome);
    return c;
  };

  gc.courseData = { work, fresh, load, failedAt };

  // ---------------- remembered UI state (this browser tab) ----------------
  // Announcements you expanded and Classwork rows you opened stay that way when the page redraws
  // (new data, switching browser tabs) and when you come back from somewhere else in Toddle.
  const sessionSet = (key) => {
    let s;
    try { s = new Set(JSON.parse(sessionStorage.getItem(key) || '[]')); } catch { s = new Set(); }
    const save = () => { try { sessionStorage.setItem(key, JSON.stringify([...s].slice(-300))); } catch {} };
    return { has: (k) => s.has(k), toggle: (k) => { if (s.has(k)) s.delete(k); else s.add(k); save(); return s.has(k); } };
  };
  const expandedPosts = sessionSet('tt:openPosts');
  const longPosts = new Map(); // post id → taller than the clamp (measured once)

  // ---------------- Stream layout (Customize → Layout) ----------------
  const MODULES = { upcoming: 'Upcoming', about: 'About this class', links: 'Quick links' };
  gc.streamLayout = () => {
    const s = TT.gcPrefs().stream || {};
    const order = (s.order || []).filter((k) => MODULES[k]);
    for (const k of Object.keys(MODULES)) if (!order.includes(k)) order.push(k);
    return {
      order,
      hidden: new Set(s.hidden || []),
      place: s.place === 'top' ? 'top' : 'side',              // About & links: left column, or a strip above the posts
      banner: ['theme', 'teacher', 'slim'].includes(s.banner) ? s.banner : 'theme',
      filter: s.filter !== false,                              // the All / Announcements / Classwork chips
      workPosts: s.workPosts !== false,                        // "posted a new assignment" cards in the feed
    };
  };
  const saveLayout = (patch) => {
    const p = TT.gcPrefs();
    p.stream = { ...(p.stream || {}), ...patch };
    TT.gcSavePrefs(p);
    gc.refreshView();
  };

  gc.customizeStream = (course) => {
    const dlg = h('div', { class: 'tt-gc-dialog-wrap', onClick: (e) => { if (e.target === dlg) dlg.remove(); } });
    const body = h('div');
    const draw = () => {
      const L = gc.streamLayout();
      const rows = L.order.map((k, i) => h('div', { class: 'tt-gc-layout-row' },
        h('label', null, h('input', { type: 'checkbox', checked: L.hidden.has(k) ? null : true, onChange: (e) => {
          const hid = new Set(L.hidden); if (e.target.checked) hid.delete(k); else hid.add(k);
          saveLayout({ hidden: [...hid] }); draw();
        } }), MODULES[k]),
        h('button', { class: 'tt-gc-iconbtn', title: 'Move up', 'aria-label': `Move ${MODULES[k]} up`, disabled: i === 0 ? true : null, onClick: () => {
          const o = L.order.slice(); [o[i - 1], o[i]] = [o[i], o[i - 1]]; saveLayout({ order: o }); draw();
        } }, I('up')),
        h('button', { class: 'tt-gc-iconbtn', title: 'Move down', 'aria-label': `Move ${MODULES[k]} down`, disabled: i === L.order.length - 1 ? true : null, onClick: () => {
          const o = L.order.slice(); [o[i + 1], o[i]] = [o[i], o[i + 1]]; saveLayout({ order: o }); draw();
        } }, I('down'))));
      const choice = (key, val, opts) => h('div', { class: 'tt-gc-layout-choice' }, opts.map(([v, label]) => h('button', {
        class: 'tt-gc-chip-f' + (val === v ? ' on' : ''), 'aria-pressed': val === v ? 'true' : 'false', onClick: () => { saveLayout({ [key]: v }); draw(); },
      }, label)));
      const toggle = (key, val, label) => h('div', { class: 'tt-gc-layout-row' }, h('label', null,
        h('input', { type: 'checkbox', checked: val ? true : null, onChange: (e) => { saveLayout({ [key]: e.target.checked }); draw(); } }), label));
      body.replaceChildren(
        h('div', { class: 'tt-gc-layout-sec' }, 'Side panels'),
        h('div', { class: 'tt-gc-layout-list' }, rows),
        h('div', { class: 'tt-gc-layout-sec' }, 'About & quick links'),
        choice('place', L.place, [['side', 'In the left column'], ['top', 'Above the posts']]),
        h('div', { class: 'tt-gc-layout-sec' }, 'Banner'),
        choice('banner', L.banner, [['theme', 'Theme'], ['teacher', "Teacher's picture"], ['slim', 'Slim']]),
        h('div', { class: 'tt-gc-layout-sec' }, 'Posts'),
        h('div', { class: 'tt-gc-layout-list' },
          toggle('filter', L.filter, 'Show the All / Announcements / Classwork filter'),
          toggle('workPosts', L.workPosts, 'Show "posted a new assignment" cards')));
    };
    draw();
    dlg.append(h('div', { class: 'tt-gc-dialog', role: 'dialog', 'aria-label': 'Customize the Stream' },
      h('div', { class: 'tt-gc-dialog-title' }, 'Customize the Stream'),
      h('div', { class: 'tt-gc-dialog-sub' }, 'Applies to every class. The theme picker changes this class\'s colours.'),
      body,
      h('div', { class: 'tt-gc-dialog-actions' },
        h('button', { class: 'tt-gc-btn text', onClick: () => { dlg.remove(); gc.pickTheme(course); } }, 'Change theme'),
        h('button', { class: 'tt-gc-btn text', onClick: () => dlg.remove() }, 'Done'))));
    document.body.append(dlg);
  };

  // ---------------- shared pieces ----------------
  const banner = (course, big, home) => {
    const theme = TT.themes.forCourse(course);
    const t = gc.teachers(course.id)[0];
    const L = gc.streamLayout();
    const teacherPic = big && L.banner === 'teacher' && home && home.banner;
    const slim = big && L.banner === 'slim';
    return h('div', { class: 'tt-gc-banner' + (big ? '' : ' small') + (teacherPic ? ' teacher' : '') + (slim ? ' slim' : ''),
      style: { backgroundImage: `url("${teacherPic ? home.banner.replace(/"/g, '%22') : TT.themes.url(theme)}")`, backgroundColor: TT.themes.color(course) } },
    h('div', { class: 'tt-gc-banner-title' }, course.title),
    course.section ? h('div', { class: 'tt-gc-banner-sub' }, course.section) : null,
    t ? h('div', { class: 'tt-gc-banner-sub small' }, TT.personName(t)) : null,
    h('div', { class: 'tt-gc-banner-btns' },
      h('button', { class: 'tt-gc-banner-btn', title: 'Change theme', onClick: () => gc.pickTheme(course) }, I('palette'), h('span', null, 'Theme')),
      big ? h('button', { class: 'tt-gc-banner-btn', title: 'Choose what the Stream shows', onClick: () => gc.customizeStream(course) }, I('tune'), h('span', null, 'Customize')) : null));
  };

  // "About this class" and "Quick links", from the class's Toddle home page.
  const aboutCard = (home, place) => {
    if (!home || !home.description) return null;
    const body = TT.sanitize(home.description);
    body.className = 'tt-gc-about-body';
    // The teacher's widget starts with its own "Course description" heading; the card has a title.
    const first = body.firstElementChild;
    if (first && /^H\d$/.test(first.tagName) && /course description|about/i.test(first.textContent)) first.remove();
    if (!body.textContent.trim()) return null;
    const key = 'about:' + place;
    const long = body.textContent.length > (place === 'top' ? 520 : 260);
    const card = h('section', { class: 'tt-gc-mod tt-gc-about' }, h('div', { class: 'tt-gc-mod-title' }, 'About this class'), body);
    if (long) {
      const open = expandedPosts.has(key);
      body.classList.toggle('clamped', !open);
      const more = h('button', { class: 'tt-gc-btn text', 'aria-expanded': open ? 'true' : 'false', onClick: () => {
        const now = expandedPosts.toggle(key);
        body.classList.toggle('clamped', !now);
        more.textContent = now ? 'Show less' : 'Read more';
        more.setAttribute('aria-expanded', now ? 'true' : 'false');
      } }, open ? 'Show less' : 'Read more');
      card.append(more);
    }
    return card;
  };
  const linksCard = (home) => {
    if (!home || !home.links || !home.links.length) return null;
    const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
    return h('section', { class: 'tt-gc-mod tt-gc-qlinks' }, h('div', { class: 'tt-gc-mod-title' }, 'Quick links'),
      home.links.map((l) => h('a', { class: 'tt-gc-qlink', href: l.url, target: '_blank', rel: 'noopener noreferrer', title: l.description || l.url },
        h('span', { class: 'tt-gc-qlink-txt' }, h('b', null, l.title), h('small', null, l.description || host(l.url))))));
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
    const upcomingCard = h('div', { class: 'tt-gc-upcoming' },
      h('div', { class: 'tt-gc-upcoming-title' }, 'Upcoming'),
      missing.length ? gc.link(`${gc.base()}/courses/${r.courseId}/classroom`, { class: 'tt-gc-upcoming-missing', onClick: () => TT.lsSet('tt:cwView', { ...(TT.lsGet('tt:cwView', {}) || {}), show: 'missing' }) },
        `${missing.length} missing assignment${missing.length > 1 ? 's' : ''}`) : null,
      list == null ? h('div', { class: 'tt-gc-upcoming-none' }, 'Loading…')
        : upItems.length ? upItems : h('div', { class: 'tt-gc-upcoming-none' }, 'Woohoo, no work due soon!'),
      h('div', { class: 'tt-gc-upcoming-foot' }, gc.link(`${gc.base()}/courses/${r.courseId}/classroom`, { class: 'tt-gc-btn text' }, 'View all')));

    // Side panels / About strip, in the order you chose (Customize → Layout).
    const L = gc.streamLayout();
    const home = homeOf(r.courseId);
    const sideMods = [];
    const topMods = [];
    for (const k of L.order) {
      if (L.hidden.has(k)) continue;
      if (k === 'upcoming') sideMods.push(upcomingCard);
      else {
        const card = k === 'about' ? aboutCard(home, L.place) : linksCard(home);
        if (card) (L.place === 'top' ? topMods : sideMods).push(card);
      }
    }
    const side = sideMods.length ? h('div', { class: 'tt-gc-stream-side' }, sideMods) : null;

    // Merge announcements + "posted a new assignment" items, newest first.
    const items = [];
    for (const p of posts || []) items.push({ t: Date.parse(p.publishedAt), kind: 'ann', p });
    if (L.workPosts) for (const it of list || []) if (it.publishedAt) items.push({ t: it.publishedAt, kind: 'work', it });
    items.sort((a, b) => b.t - a.t);

    // Dedicated Announcements view: All / Announcements / Classwork posts (remembered).
    const show = (L.filter && L.workPosts && TT.lsGet('tt:streamShow', 'all')) || 'all';
    const nAnn = items.filter((x) => x.kind === 'ann').length;
    const nUnread = (posts || []).filter((p) => !p.isRead).length;
    const nWork = items.length - nAnn;
    const chip = (k, label, n, extra) => h('button', {
      class: 'tt-gc-chip-f' + (show === k ? ' on' : ''), 'aria-pressed': show === k ? 'true' : 'false',
      onClick: () => { TT.lsSet('tt:streamShow', k); gc.rerender(); },
    }, k === 'ann' ? I('campaign') : k === 'work' ? I('assignment') : null, label, h('span', { class: 'n' }, String(n)), extra || null);
    const filters = L.filter && L.workPosts ? h('div', { class: 'tt-gc-stream-filters', role: 'group', 'aria-label': 'Show' },
      chip('all', 'All', items.length),
      chip('ann', 'Announcements', nAnn, nUnread ? h('span', { class: 'dot', title: `${nUnread} unread` }) : null),
      chip('work', 'Classwork posts', nWork)) : null;
    const shown = show === 'ann' ? items.filter((x) => x.kind === 'ann') : show === 'work' ? items.filter((x) => x.kind === 'work') : items;

    const feed = h('div', { class: 'tt-gc-feed' }, topMods.length ? h('div', { class: 'tt-gc-about-strip' }, topMods) : null, filters);
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
        // Long announcements collapse like Classroom's. Whether a post is long is measured once;
        // after that every redraw builds it the same way, and one you expanded stays expanded.
        feed.append(card);
        const clampUi = () => {
          const open = expandedPosts.has(p.id);
          body.classList.toggle('clamped', !open);
          const more = h('button', { class: 'tt-gc-btn text', 'aria-expanded': open ? 'true' : 'false', onClick: () => {
            const now = expandedPosts.toggle(p.id);
            body.classList.toggle('clamped', !now);
            more.textContent = now ? 'Show less' : 'Show more';
            more.setAttribute('aria-expanded', now ? 'true' : 'false');
          } }, open ? 'Show less' : 'Show more');
          card.append(more);
        };
        if (longPosts.get(p.id)) clampUi();
        else if (!longPosts.has(p.id)) {
          requestAnimationFrame(() => {
            if (!body.isConnected || longPosts.has(p.id)) return;
            longPosts.set(p.id, body.scrollHeight > 260);
            if (longPosts.get(p.id)) clampUi();
          });
        }
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

    const wide = sideMods.some((m) => m !== upcomingCard);
    el.append(h('div', { class: 'tt-gc-course' }, banner(course, true, home),
      h('div', { class: 'tt-gc-stream' + (side ? (wide ? ' side-wide' : '') : ' no-side') }, side, feed),
      h('div', { class: 'tt-gc-stream-foot' }, h('button', { class: 'tt-gc-btn text', onClick: () => gc.customizeStream(course) }, I('tune'), 'Customize this page'))));
  };

  // ---------------- Classwork ----------------
  // Rows you opened stay open (this browser tab), through redraws and coming back to the page.
  const openRows = sessionSet('tt:openRows');
  const open = { has: (id) => openRows.has(id), add: (id) => { if (!openRows.has(id)) openRows.toggle(id); }, delete: (id) => { if (openRows.has(id)) openRows.toggle(id); } };
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
