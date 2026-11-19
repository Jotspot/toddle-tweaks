/* Toddle Tweaks — Classroom home: class cards (drag to reorder), theme picker, hide/show. */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;
  let showHidden = false;

  const dueMap = () => {
    const d = TT.todoData();
    const map = new Map();
    if (!d) return map;
    const c = TT.categorize(d.items);
    for (const it of [...c.missing, ...c.todo.filter((x) => ['today', 'tomorrow', 'week', 'nextweek'].includes(x.bucket))]) {
      if (!map.has(it.courseId)) map.set(it.courseId, []);
      const arr = map.get(it.courseId);
      if (!arr.some((x) => x.id === it.id)) arr.push(it);
    }
    return map;
  };

  const dueLabel = (it) => {
    if (it.bucket === 'missing') return 'Missing';
    const s = TT.fmtDue(it.deadline);
    return s.replace(/^Due today, /, 'Due today – ').replace(/^Due tomorrow, /, 'Due tomorrow – ');
  };

  // ---------------- theme picker ----------------
  gc.pickTheme = (course) => {
    const cur = TT.themes.forCourse(course);
    const dlg = h('div', { class: 'tt-gc-dialog-wrap', onClick: (e) => { if (e.target === dlg) dlg.remove(); } });
    const grid = h('div', { class: 'tt-gc-theme-grid' });
    for (const [id, [label]] of Object.entries(TT.themes.all)) {
      grid.append(h('button', {
        class: 'tt-gc-theme' + (id === cur ? ' sel' : ''), title: label,
        style: { backgroundImage: `url("${TT.themes.url(id)}")` },
        onClick: () => { TT.themes.set(course.id, id); dlg.remove(); gc.rerender(); },
      }, h('span', null, label)));
    }
    dlg.append(h('div', { class: 'tt-gc-dialog', role: 'dialog', 'aria-label': 'Select theme' },
      h('div', { class: 'tt-gc-dialog-title' }, 'Select theme'),
      h('div', { class: 'tt-gc-dialog-sub' }, course.title),
      grid,
      h('div', { class: 'tt-gc-dialog-actions' }, h('button', { class: 'tt-gc-btn text', onClick: () => dlg.remove() }, 'Cancel'))));
    document.body.append(dlg);
  };

  const setHidden = (id, hide) => {
    const p = TT.gcPrefs();
    const s = new Set(p.hidden || []);
    if (hide) s.add(id); else s.delete(id);
    p.hidden = [...s];
    TT.gcSavePrefs(p);
    gc.rerender();
  };

  // ---------------- Edit class dialog ----------------
  gc.editCourse = (c) => {
    const p = TT.gcPrefs();
    const o = (p.overrides || {})[c.id] || {};
    const teachers = gc.allTeachers(c.id);
    const field = (label, input, hint) => h('label', { class: 'tt-gc-field' }, h('span', { class: 'tt-gc-field-label' }, label), input, hint ? h('span', { class: 'tt-gc-field-hint' }, hint) : null);
    const name = h('input', { class: 'tt-gc-input', value: o.title || '', placeholder: c.originalTitle || c.title, maxlength: '80' });
    const section = h('input', { class: 'tt-gc-input', value: o.section || '', placeholder: 'e.g. Period 3 · Room 204', maxlength: '60' });
    const teacherSel = h('select', { class: 'tt-gc-input' },
      h('option', { value: '' }, teachers.length ? `Automatic (${TT.personName(teachers[0])})` : 'Automatic'),
      teachers.map((t) => h('option', { value: t.id, selected: o.teacherId === t.id ? true : null }, TT.personName(t))),
      h('option', { value: '__custom', selected: o.teacherName ? true : null }, 'Type a name…'));
    const custom = h('input', { class: 'tt-gc-input', value: o.teacherName || '', placeholder: 'Teacher name', maxlength: '60' });
    const syncCustom = () => { custom.style.display = teacherSel.value === '__custom' ? '' : 'none'; };
    teacherSel.addEventListener('change', syncCustom);
    syncCustom();
    const hidden = new Set(p.hidden || []);
    const hide = h('input', { type: 'checkbox', checked: hidden.has(c.id) ? true : null });

    const close = () => dlg.remove();
    const save = () => {
      const q = TT.gcPrefs();
      const next = {};
      if (name.value.trim() && name.value.trim() !== (c.originalTitle || c.title)) next.title = name.value.trim();
      if (section.value.trim()) next.section = section.value.trim();
      if (teacherSel.value === '__custom' && custom.value.trim()) next.teacherName = custom.value.trim();
      else if (teacherSel.value && teacherSel.value !== '__custom') next.teacherId = teacherSel.value;
      q.overrides = { ...(q.overrides || {}) };
      if (Object.keys(next).length) q.overrides[c.id] = next; else delete q.overrides[c.id];
      const hs = new Set(q.hidden || []);
      if (hide.checked) hs.add(c.id); else hs.delete(c.id);
      q.hidden = [...hs];
      TT.gcSavePrefs(q);
      close();
      gc.render(); gc.rerender();
    };
    const restore = () => {
      const q = TT.gcPrefs();
      if (q.overrides) delete q.overrides[c.id];
      if (q.themes) delete q.themes[c.id];
      q.hidden = (q.hidden || []).filter((x) => x !== c.id);
      TT.gcSavePrefs(q);
      close();
      gc.render(); gc.rerender();
      if (gc.toast) gc.toast('Restored the original class details');
    };
    const dlg = h('div', { class: 'tt-gc-dialog-wrap', onClick: (e) => { if (e.target === dlg) close(); } },
      h('div', { class: 'tt-gc-dialog narrow', role: 'dialog', 'aria-label': 'Advanced class settings' },
        h('div', { class: 'tt-gc-dialog-title' }, 'Advanced class settings'),
        h('div', { class: 'tt-gc-warn' }, I('settings'), h('span', null, h('b', null, 'Overrides what Toddle shows for this class. '), 'Only you see these changes and nothing is sent to Toddle, but a wrong name or teacher can be confusing later. ', h('b', null, 'Restore original'), ' undoes everything.')),
        field('Class name', name, `Toddle calls it “${c.originalTitle || c.title}”`),
        field('Section', section, 'Shown under the name, like in Classroom'),
        field('Teacher shown', h('div', { class: 'tt-gc-field-row' }, teacherSel, custom)),
        h('div', { class: 'tt-gc-field' },
          h('span', { class: 'tt-gc-field-label' }, 'Theme'),
          h('button', { class: 'tt-gc-btn outlined', type: 'button', onClick: () => { close(); gc.pickTheme(c); } }, I('palette'), 'Choose theme…')),
        h('label', { class: 'tt-gc-check' }, hide, h('span', null, 'Hide from the home page')),
        h('div', { class: 'tt-gc-dialog-actions spread' },
          h('button', { class: 'tt-gc-btn text', type: 'button', onClick: restore }, 'Restore original'),
          h('span', null,
            h('button', { class: 'tt-gc-btn text', type: 'button', onClick: close }, 'Cancel'),
            h('button', { class: 'tt-gc-btn filled', type: 'button', onClick: save }, 'Save')))));
    document.body.append(dlg);
    name.focus();
    dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') save(); });
  };

  // ---------------- card ----------------
  const card = (c, due, hidden) => {
    const b = gc.base();
    const theme = TT.themes.forCourse(c);
    const color = TT.themes.color(c);
    const teachers = gc.teachers(c.id);
    const t = teachers[0];
    const all = due.get(c.id) || [];
    const showInfo = TT.settings.gcCardInfo !== false;
    const items = showInfo ? all.slice(0, 3) : [];
    const nMissing = all.filter((x) => x.bucket === 'missing').length;
    const nWeek = all.filter((x) => ['today', 'tomorrow', 'week'].includes(x.bucket)).length;
    const stream = `${b}/courses/${c.id}/home`;

    const more = h('button', { class: 'tt-gc-card-more', title: 'Options', 'aria-label': 'Options', onClick: (e) => {
      e.preventDefault(); e.stopPropagation();
      gc.menu(more, [
        { icon: 'palette', label: 'Change theme', onClick: () => gc.pickTheme(c) },
        hidden ? { icon: 'show', label: 'Show on home', onClick: () => setHidden(c.id, false) } : { icon: 'hide', label: 'Hide from home', onClick: () => setHidden(c.id, true) },
        { divider: true },
        { icon: 'open', label: 'Open in classic Toddle', onClick: () => window.open(`${b}/courses/${c.id}/classroom`, '_blank') },
        { divider: true },
        { icon: 'settings', label: 'Advanced class settings…', sub: 'Rename, change teacher, restore', onClick: () => gc.editCourse(c) },
      ]);
    } }, I('more'));

    const head = h('div', { class: 'tt-gc-card-head', style: { backgroundImage: `url("${TT.themes.url(theme)}")`, backgroundColor: color } },
      gc.link(stream, { class: 'tt-gc-card-title', title: c.title, draggable: 'false' }, c.title),
      c.section ? h('div', { class: 'tt-gc-card-sec' }, c.section) : null,
      h('div', { class: 'tt-gc-card-teacher' }, t ? TT.personName(t) : ''),
      more);

    const avatar = t ? TT.avatar(t, 75, color) : h('span', { class: 'tt-avatar', style: { width: '75px', height: '75px', background: color, fontSize: '30px' } }, TT.initials(c.title));
    avatar.classList.add('tt-gc-card-av');

    const body = h('div', { class: 'tt-gc-card-body' },
      items.map((it) => gc.link(it.url, { class: 'tt-gc-card-due' + (it.bucket === 'missing' ? ' late' : ''), draggable: 'false' },
        h('span', { class: 'when' }, dueLabel(it)),
        h('span', { class: 'what' }, it.title))));

    const stats = showInfo ? h('span', { class: 'tt-gc-card-stats' },
      nMissing ? h('span', { class: 'late' }, `${nMissing} missing`) : null,
      nMissing && nWeek ? ' · ' : null,
      nWeek ? `${nWeek} due this week` : null,
      !nMissing && !nWeek ? h('span', { class: 'ok' }, 'All caught up') : null) : null;
    const foot = h('div', { class: 'tt-gc-card-foot' },
      stats,
      gc.link(`${b}/courses?tt=todo`, { class: 'tt-gc-iconbtn', title: `Open your work for "${c.title}"`, draggable: 'false', onClick: () => { const v = TT.lsGet('tt:todoView', {}) || {}; v.course = c.id; TT.lsSet('tt:todoView', v); } }, I('yourwork')),
      gc.link(`${b}/courses/${c.id}/course-plan/flow`, { class: 'tt-gc-iconbtn', title: `Open course plan for "${c.title}"`, draggable: 'false' }, I('folder')));

    return h('div', { class: 'tt-gc-card' + (hidden ? ' is-hidden' : ''), draggable: 'true', 'data-id': c.id }, head, avatar, body, foot);
  };

  // ---------------- drag & drop reorder ----------------
  const enableDnD = (grid) => {
    let dragging = null;
    grid.addEventListener('dragstart', (e) => {
      const c = e.target.closest('.tt-gc-card');
      if (!c) return;
      dragging = c;
      c.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', c.dataset.id);
    });
    grid.addEventListener('dragover', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const over = e.target.closest('.tt-gc-card');
      if (!over || over === dragging) return;
      const r = over.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      if (after) over.after(dragging); else over.before(dragging);
    });
    const finish = () => {
      if (!dragging) return;
      dragging.classList.remove('dragging');
      dragging = null;
      const p = TT.gcPrefs();
      const visible = [...grid.querySelectorAll('.tt-gc-card')].map((x) => x.dataset.id);
      const rest = (p.order || []).filter((id) => !visible.includes(id));
      p.order = [...visible, ...rest];
      TT.gcSavePrefs(p);
      gc.rerender();
    };
    grid.addEventListener('drop', (e) => { e.preventDefault(); finish(); });
    grid.addEventListener('dragend', finish);
  };

  gc.views.home = (el) => {
    const due = dueMap();
    const courses = gc.sortedCourses();
    const all = gc.sortedCourses(true);
    const shownIds = new Set(courses.map((c) => c.id));
    const hiddenList = all.filter((c) => !shownIds.has(c.id));
    const wrap = h('div', { class: 'tt-gc-home' });
    if (!all.length) {
      wrap.append(h('div', { class: 'tt-gc-empty' }, TT.api.hasFilters() ? 'Loading your classes…' : 'Loading… (if this sticks, switch to classic Toddle once from the avatar menu, then back)'));
      el.append(wrap);
      return;
    }
    const grid = h('div', { class: 'tt-gc-cards' }, courses.map((c) => card(c, due, false)));
    enableDnD(grid);
    wrap.append(grid);
    if (hiddenList.length) {
      wrap.append(h('button', { class: 'tt-gc-btn text tt-gc-hidden-toggle', onClick: () => { showHidden = !showHidden; gc.rerender(); } },
        showHidden ? 'Hide hidden classes' : `Show ${hiddenList.length} hidden class${hiddenList.length > 1 ? 'es' : ''}`));
      if (showHidden) wrap.append(h('div', { class: 'tt-gc-cards' }, hiddenList.map((c) => card(c, due, true))));
    }
    wrap.append(h('div', { class: 'tt-gc-hint' }, 'Tip: drag cards to rearrange them. ', h('button', { class: 'tt-gc-linkbtn', onClick: () => gc.startTour && gc.startTour() }, 'Take a tour of Classroom mode')));
    setTimeout(() => { if (el.isConnected && gc.maybeOfferTour) gc.maybeOfferTour(); }, 1500);
    el.append(wrap);
  };
})();
