/*
 * Toddle Tweaks — Google Classroom shell.
 * A Classroom-style top bar + navigation drawer that wraps all of Toddle. On routes we
 * have a native Classroom view for (home, to-do, calendar, class stream/classwork/people)
 * Toddle's own page is hidden and ours is drawn instead — from cache, at document_start,
 * so there's no flash of the old UI. Everything else shows Toddle (restyled) inside the shell.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = (TT.gc = TT.gc || { views: {} });
  const html = document.documentElement;

  // ---------------- routing ----------------
  let forced = null; // { path, view } — for tabs Toddle has no route for (People)

  gc.route = () => {
    const p = location.pathname.replace(/\/+$/, '');
    const q = new URLSearchParams(location.search);
    const m0 = p.match(/^\/platform\/(\d+)/);
    if (!m0) return null;
    const cp = m0[1];
    let m;
    if (/^\/platform\/\d+\/courses$/.test(p)) {
      const tt = q.get('tt');
      return { cp, view: tt === 'todo' ? 'todo' : tt === 'calendar' ? 'calendar' : 'home', key: 'home:' + (tt || '') };
    }
    if ((m = p.match(/^\/platform\/\d+\/courses\/(\d+)(?:\/(home|classroom))?$/))) {
      const courseId = m[1];
      let view = m[2] === 'classroom' ? 'classwork' : 'stream';
      if (q.get('tt') === 'people' || (forced && forced.path === p && forced.view === 'people')) view = 'people';
      if (q.get('tt') === 'classic') return { cp, courseId, view: null, sub: 'classroom', key: 'pass:' + p };
      return { cp, courseId, view, key: view + ':' + courseId };
    }
    if ((m = p.match(/^\/platform\/\d+\/courses\/(\d+)\//))) {
      const sub = p.split('/')[5] || '';
      return { cp, courseId: m[1], view: null, sub, key: 'pass:' + p };
    }
    return { cp, view: null, key: 'pass:' + p };
  };

  gc.go = (url, view) => {
    const u = new URL(url, location.origin);
    forced = view ? { path: u.pathname.replace(/\/+$/, ''), view } : null;
    TT.nav(u.pathname + u.search);
    gc.render();
  };

  const link = (href, attrs, ...kids) => {
    const a = h('a', { href, ...attrs }, ...kids);
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      gc.go(href, attrs && attrs['data-view']);
    });
    return a;
  };
  gc.link = link;

  // ---------------- data helpers ----------------
  // Your own edits (Edit class…): renamed classes, a section line, which teacher to show.
  gc.override = (id) => ((TT.gcPrefs().overrides || {})[id]) || {};
  const applyOverride = (c) => {
    const o = gc.override(c.id);
    return { ...c, originalTitle: c.title, title: o.title || c.title, section: o.section || '' };
  };
  gc.courses = () => {
    const c = TT.api.cachedCourses();
    if (c && c.courses && c.courses.length) return c.courses.map(applyOverride);
    const d = TT.todoData();
    if (!d) return [];
    return [...new Map(d.items.map((x) => [x.courseId, { id: x.courseId, title: x.courseTitle }])).values()].map(applyOverride);
  };
  TT.courseName = (id, fallback) => gc.override(id).title || fallback;
  gc.course = (id) => gc.courses().find((c) => c.id === id) || applyOverride({ id, title: (TT.todoData() && (TT.todoData().items.find((x) => x.courseId === id) || {}).courseTitle) || 'Class' });
  gc.sortedCourses = (includeHidden) => {
    const p = TT.gcPrefs();
    const order = p.order || [];
    const hidden = new Set(p.hidden || []);
    const list = gc.courses().filter((c) => includeHidden || !hidden.has(c.id));
    return list.sort((a, b) => {
      const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.title.localeCompare(b.title);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };
  gc.allTeachers = (courseId) => {
    const t = TT.api.cachedTeachers();
    return (t && t.map && t.map[courseId]) || [];
  };
  // Primary teacher first — or the one you picked / typed in Edit class.
  gc.teachers = (courseId) => {
    const list = gc.allTeachers(courseId);
    const o = gc.override(courseId);
    if (o.teacherName) return [{ id: 'custom', firstName: o.teacherName, lastName: '', profileImage: null }, ...list];
    if (o.teacherId) {
      const pick = list.find((x) => x.id === o.teacherId);
      if (pick) return [pick, ...list.filter((x) => x !== pick)];
    }
    return list;
  };
  gc.base = () => `/platform/${TT.cpId()}`;

  let loadingShared = false;
  gc.loadShared = async () => {
    if (loadingShared) return;
    loadingShared = true;
    try {
      const c = TT.api.cachedCourses();
      if (!c || Date.now() - c.t > 30 * 60e3) { await TT.api.getCourses().catch(() => {}); gc.rerender(); }
      const t = TT.api.cachedTeachers();
      const ids = gc.courses().map((x) => x.id);
      if (ids.length && (!t || Date.now() - t.t > 24 * 3600e3 || ids.some((id) => !(id in t.map)))) {
        await TT.api.getTeachers(ids).catch(() => {});
        gc.rerender();
      }
    } finally { loadingShared = false; }
  };

  // ---------------- shell DOM ----------------
  let shell, barEl, drawerEl, view;

  const logo = () => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Toddle's own "t" logo, in Classroom blue.
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('class', 'tt-gc-logo');
    s.append(...[...new DOMParser().parseFromString("<svg xmlns='http://www.w3.org/2000/svg'>" + '<path fill="#1a73e8" d="M16.1063848,2.36637802 C-4.70212828,14.2798866 -4.70212828,85.7217492 16.1063848,97.6352579 C36.914898,109.548767 99.3799973,73.8474298 99.3799973,50.0204125 C99.3799973,26.1933953 36.914898,-9.54713061 16.1063848,2.36637802 Z"/>'
      + '<path fill="#fff" d="M48.8224311,62.5217588 C49.0993505,62.5217588 49.4949496,62.4433804 49.8905487,62.4041912 C50.3257078,62.3258129 50.4443875,62.3258129 50.681747,62.3258129 C52.3828231,62.3258129 53.2927011,63.5798664 53.2927011,64.9122983 C53.2927011,65.970406 52.6597425,66.9109462 51.6311848,67.4204054 C50.7213069,67.8906755 49.5345095,68.1649997 48.3081523,68.1649997 C41.1082485,68.1649997 39.5258521,63.7366231 39.5258521,58.4852739 L39.5258521,45.7096035 L37.3104971,45.7096035 C34.699543,45.7096035 34.2643839,43.8677124 34.2643839,42.9663614 C34.2643839,42.0650104 34.699543,40.2231193 37.3104971,40.2231193 L39.5258521,40.2231193 L39.5258521,35.5204185 C39.5258521,32.3852846 41.7412071,31.797447 42.8488846,31.797447 C43.996122,31.797447 46.1719171,32.3460955 46.1719171,35.5204185 L46.1719171,40.2231193 L50.4443875,40.2231193 C53.0553416,40.2231193 53.4905006,42.0650104 53.4905006,42.9663614 C53.4905006,43.8677124 53.0553416,45.7096035 50.4443875,45.7096035 L46.1719171,45.7096035 L46.1719171,58.4068956 C46.211477,61.1109485 47.1609149,62.5217588 48.8224311,62.5217588 Z"/>'
      + '</svg>', 'image/svg+xml').documentElement.childNodes].map((n) => document.importNode(n, true)));
    return s;
  };

  const build = () => {
    if (shell) return;
    shell = h('div', { id: 'tt-gc-shell', class: 'tt-no-snap' });
    barEl = h('header', { id: 'tt-gc-bar' });
    drawerEl = h('nav', { id: 'tt-gc-drawer', 'aria-label': 'Classroom navigation' });
    view = h('main', { id: 'tt-gc-view' });
    shell.append(barEl, drawerEl, view);
    (document.body || html).appendChild(shell);
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(shell), { once: true });
    }
    applyDrawerMode();
    window.addEventListener('resize', TT.debounce(applyDrawerMode, 100));
    // Clicking outside the slide-over menu closes it.
    document.addEventListener('mousedown', (e) => {
      if (html.classList.contains('tt-gc-drawer-peek') && drawerEl && !drawerEl.contains(e.target) && !e.target.closest('.tt-gc-bar-left .tt-gc-iconbtn')) html.classList.remove('tt-gc-drawer-peek');
    }, true);
  };

  // Wide windows: the drawer is docked (open/closed is remembered). Narrow windows: a slim rail,
  // and the hamburger slides the full menu over the page without remembering it.
  const NARROW = 1100;
  const isNarrow = () => window.innerWidth < NARROW;
  const applyDrawerMode = () => {
    const p = TT.gcPrefs();
    const open = p.drawerOpen != null ? p.drawerOpen : window.innerWidth >= 1280;
    html.classList.toggle('tt-gc-drawer-open', !isNarrow() && !!open);
    if (!isNarrow()) html.classList.remove('tt-gc-drawer-peek');
  };

  const toggleDrawer = () => {
    if (isNarrow()) { html.classList.toggle('tt-gc-drawer-peek'); return; }
    const open = !html.classList.contains('tt-gc-drawer-open');
    html.classList.toggle('tt-gc-drawer-open', open);
    const p = TT.gcPrefs(); p.drawerOpen = open; TT.gcSavePrefs(p);
  };

  const userInfo = () => TT.lsGet('userInfo', {}) || {};

  const renderBar = (r, bar = barEl) => {
    bar.textContent = '';
    const u = userInfo();
    const left = h('div', { class: 'tt-gc-bar-left' },
      h('button', { class: 'tt-gc-iconbtn', title: 'Main menu', 'aria-label': 'Main menu', onClick: toggleDrawer }, I('menu')));
    // The logo is always there; in a class it's just the icon, followed by the class name.
    left.append(link(`${gc.base()}/courses`, { class: 'tt-gc-brand' + (r.courseId ? ' compact' : ''), title: 'Classroom home' }, logo(), h('span', null, 'Classroom')));
    if (r.courseId) {
      const c = gc.course(r.courseId);
      const t = gc.teachers(r.courseId)[0];
      left.append(link(`${gc.base()}/courses/${r.courseId}/home`, { class: 'tt-gc-crumb' },
        h('span', { class: 'tt-gc-crumb-title' }, c.title),
        t ? h('span', { class: 'tt-gc-crumb-sub' }, TT.personName(t)) : null));
    } else {
      const titles = { todo: 'To-do', calendar: 'Calendar' };
      if (titles[r.view]) left.append(h('span', { class: 'tt-gc-crumb-sep' }, I('right')), h('span', { class: 'tt-gc-page-title' }, titles[r.view]));
    }

    const center = h('div', { class: 'tt-gc-tabs' });
    if (r.courseId) {
      const b = `${gc.base()}/courses/${r.courseId}`;
      const tabs = [
        ['stream', 'Stream', `${b}/home`],
        ['classwork', 'Classwork', `${b}/classroom`],
        ['people', 'People', `${b}/home?tt=people`],
        ['course-plan', 'Course plan', `${b}/course-plan/flow`],
        ['journal', 'Portfolio', `${b}/journal`],
      ];
      for (const [k, label, href] of tabs) {
        const active = r.view === k || (!r.view && (r.sub === k || (k === 'classwork' && r.sub === 'classroom')));
        center.append(link(href, { class: 'tt-gc-tab' + (active ? ' active' : ''), 'data-view': k === 'people' ? 'people' : undefined }, label));
      }
    }

    const right = h('div', { class: 'tt-gc-bar-right' });
    right.append(link(`${gc.base()}/courses?tt=todo`, { class: 'tt-gc-iconbtn', title: 'To-do' }, I('todo')));
    // Toddle's notification panel only exists on its home page; open it there (it's pinned on the right by CSS).
    const tb = document.querySelector('[aria-label="Notification"]');
    const n = tb ? (tb.innerText || '').trim() : '';
    if (tb) TT.lsSet('tt:notifN', n);
    const count = n || TT.lsGet('tt:notifN', '');
    right.append(h('button', { class: 'tt-gc-iconbtn tt-gc-bell', title: 'Notifications', onClick: () => {
      const b = document.querySelector('[aria-label="Notification"]');
      if (b) { b.click(); return; }
      gc.go(`${gc.base()}/courses`);
      TT.waitFor('[aria-label="Notification"]', 15000).then((x) => x && setTimeout(() => x.click(), 300));
    } }, I('bell'), count && count !== '0' ? h('span', { class: 'tt-gc-badge' }, count) : null));
    const me = h('button', { class: 'tt-gc-me', title: [u.first_name, u.last_name].filter(Boolean).join(' '), onClick: (e) => { e.stopPropagation(); accountMenu(me); } },
      TT.avatar({ firstName: u.first_name, lastName: u.last_name, profileImage: u.profile_image }, 32));
    right.append(me);
    bar.append(left, center, right);
  };

  // Google-style account card.
  const accountMenu = (anchor) => {
    const u = userInfo();
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    document.querySelectorAll('.tt-gc-menu, .tt-gc-account').forEach((m) => m.remove());
    const card = h('div', { class: 'tt-gc-account', role: 'dialog', 'aria-label': 'Account' },
      h('div', { class: 'tt-gc-account-mail' }, u.email || ''),
      TT.avatar({ firstName: u.first_name, lastName: u.last_name, profileImage: u.profile_image }, 80),
      h('div', { class: 'tt-gc-account-hi' }, `Hi, ${u.preferred_name || u.first_name || 'there'}!`),
      h('div', { class: 'tt-gc-account-org' }, u.org_name || ''),
      h('div', { class: 'tt-gc-account-btns' },
        h('button', { class: 'tt-gc-account-btn', onClick: () => TT.openSettings && TT.openSettings() }, I('settings'), 'Toddle Tweaks settings'),
        h('button', { class: 'tt-gc-account-btn', onClick: () => gc.startTour && gc.startTour() }, I('help'), 'Take a tour'),
        h('button', { class: 'tt-gc-account-btn', onClick: () => TT.saveSettings({ classroomMode: false }).then(() => location.reload()) }, I('exit'), 'Classic Toddle')));
    document.body.append(card);
    const close = (e) => { if (!card.contains(e.target) && !anchor.contains(e.target)) { card.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
    void name;
  };

  // Simple popup menu used by the bar and class cards.
  gc.menu = (anchor, items, opts = {}) => {
    document.querySelectorAll('.tt-gc-menu, .tt-gc-account').forEach((m) => m.remove());
    const w = opts.width || 240;
    const m = h('div', { class: 'tt-gc-menu', role: 'menu', style: { width: w + 'px' } });
    const close = () => { m.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', onKey, true); };
    for (const it of items) {
      if (it.divider) { m.append(h('div', { class: 'tt-gc-menu-div' })); continue; }
      if (it.heading) { m.append(h('div', { class: 'tt-gc-menu-head' }, it.heading)); continue; }
      m.append(h('button', {
        class: 'tt-gc-menu-item' + (it.disabled ? ' info' : ''), role: 'menuitem', disabled: it.disabled ? true : null,
        onClick: (e) => { e.stopPropagation(); close(); it.onClick && it.onClick(); },
      }, it.icon ? I(it.icon) : null, h('span', null, it.label, it.sub ? h('small', null, it.sub) : null)));
    }
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    const below = r.bottom + 4 + m.offsetHeight < window.innerHeight - 8;
    m.style.top = (below ? r.bottom + 4 : Math.max(8, r.top - m.offsetHeight - 4)) + 'px';
    const left = opts.align === 'left' ? r.left : r.right - w;
    m.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8)) + 'px';
    m.style.transformOrigin = `${opts.align === 'left' ? 'left' : 'right'} ${below ? 'top' : 'bottom'}`;
    const outside = (e) => { if (!m.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', onKey, true); }, 0);
    const first = m.querySelector('.tt-gc-menu-item:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  };

  const navItem = (href, icon, label, active, extra) => link(href, { class: 'tt-gc-nav' + (active ? ' active' : ''), title: label, ...(extra || {}) },
    typeof icon === 'string' ? h('span', { class: 'tt-gc-nav-ico' }, I(icon)) : icon, h('span', { class: 'tt-gc-nav-label' }, label));

  const renderDrawer = (r, drawer = drawerEl) => {
    drawer.textContent = '';
    const b = gc.base();
    drawer.append(
      navItem(`${b}/courses`, 'home', 'Home', r.view === 'home'),
      navItem(`${b}/courses?tt=calendar`, 'calendar', 'Calendar', r.view === 'calendar'),
      h('div', { class: 'tt-gc-nav-div' }),
      h('div', { class: 'tt-gc-nav-head' }, 'Enrolled'),
      navItem(`${b}/courses?tt=todo`, 'todo', 'To-do', r.view === 'todo'));
    for (const c of gc.sortedCourses()) {
      const color = TT.themes.color(c);
      const av = h('span', { class: 'tt-gc-nav-av', style: { background: color } }, (c.title || '?').trim()[0].toUpperCase());
      const item = navItem(`${b}/courses/${c.id}/home`, av, c.title, r.courseId === c.id);
      const t = gc.teachers(c.id)[0];
      if (t) item.querySelector('.tt-gc-nav-label').append(h('small', null, TT.personName(t)));
      drawer.append(item);
    }
    drawer.append(
      h('div', { class: 'tt-gc-nav-div' }),
      h('div', { class: 'tt-gc-nav-head' }, 'School'),
      navItem(`${b}/circulars`, 'campaign', 'School announcements', /\/circulars/.test(location.pathname)),
      navItem(`${b}/courses/my-calendar`, 'schedule', 'School calendar', /my-calendar/.test(location.pathname)),
      navItem(`${b}/timetable`, 'calendar', 'Timetable', /\/timetable/.test(location.pathname)),
      navItem(`${b}/attendance-summary`, 'attendance', 'Attendance', /attendance/.test(location.pathname)),
      navItem(`${b}/educatorcenter_v2`, 'description', 'Policies & resources', /educatorcenter/.test(location.pathname)),
      h('div', { class: 'tt-gc-nav-div' }),
      h('button', { class: 'tt-gc-nav', type: 'button', title: 'Take a tour', onClick: () => gc.startTour && gc.startTour() },
        h('span', { class: 'tt-gc-nav-ico' }, I('help')), h('span', { class: 'tt-gc-nav-label' }, 'Take a tour')),
      h('button', { class: 'tt-gc-nav', type: 'button', title: 'Toddle Tweaks settings', onClick: () => TT.openSettings && TT.openSettings() },
        h('span', { class: 'tt-gc-nav-ico' }, I('settings')), h('span', { class: 'tt-gc-nav-label' }, 'Toddle Tweaks settings')));
  };

  // ---------------- render loop ----------------
  let currentKey = null;

  gc.active = () => html.classList.contains('tt-gc-shell');

  gc.render = () => {
    const r = gc.route();
    const on = !!(TT.settings.classroomMode && r && userInfo().jwt);
    html.classList.toggle('tt-gc-shell', on);
    if (!on) {
      html.classList.remove('tt-gc-native');
      if (shell) { shell.remove(); shell = null; currentKey = null; }
      return;
    }
    build();
    html.classList.remove('tt-gc-drawer-peek'); // navigating closes the slide-over menu
    if (!shell.isConnected) (document.body || html).appendChild(shell);
    swapIfChanged(barEl, (el) => renderBar(r, el));
    swapIfChanged(drawerEl, (el) => renderDrawer(r, el));
    if (r.courseId) html.style.setProperty('--tt-course', TT.themes.color(gc.course(r.courseId)));
    else html.style.setProperty('--tt-course', '#1967d2');
    const fn = r.view && gc.views[r.view];
    html.classList.toggle('tt-gc-native', !!fn);
    html.classList.toggle('tt-gc-in-course', !!r.courseId);
    if (!fn) { view.textContent = ''; currentKey = null; return; }
    if (currentKey !== r.key) {
      currentKey = r.key;
      view.textContent = '';
      view.scrollTop = 0;
      fn(view, r);
    }
  };

  const swapIfChanged = (target, draw) => {
    if (!target) return;
    const tmp = document.createElement(target.tagName);
    draw(tmp);
    if (tmp.innerHTML === target.innerHTML) return;
    const st = target.scrollTop;
    target.replaceChildren(...tmp.childNodes);
    target.scrollTop = st;
  };

  // Redraw the current native view in place (data arrived), keeping scroll position.
  gc.rerender = TT.debounce(() => {
    if (!gc.active()) return;
    const r = gc.route();
    if (!r) return;
    swapIfChanged(barEl, (el) => renderBar(r, el));
    swapIfChanged(drawerEl, (el) => renderDrawer(r, el));
    const fn = r.view && gc.views[r.view];
    if (!fn || !view) return;
    // Render off-screen first; only swap if something actually changed (no flicker, no image reloads).
    const tmp = document.createElement('div');
    fn(tmp, r);
    if (tmp.innerHTML === view.innerHTML) return;
    const st = view.scrollTop;
    view.replaceChildren(...tmp.childNodes);
    view.scrollTop = st;
  }, 60);

  gc.start = () => {
    gc.render();
    window.addEventListener('tt:route', () => gc.render());
    window.addEventListener('popstate', () => setTimeout(gc.render, 0));
    TT.onRoute(() => gc.render());
    window.addEventListener('tt:settings', () => { gc.render(); currentKey = null; gc.render(); });
    TT.onTodo(() => gc.rerender());
    gc.loadShared();
    setTimeout(() => TT.refreshTodo(false), 400);
  };
})();
