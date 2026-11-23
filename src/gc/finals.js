/*
 * Toddle Tweaks — Finals.
 * Shows up in the menu a few weeks before exams (Settings → Finals). Calm on purpose:
 * a day count, the exam schedule (every exam slot is a final unless you say otherwise),
 * and what's due before finals start. Exam days come from the school's bell schedule
 * ("Final Exams…"), the school calendar, or the shape of the timetable; or are set by hand.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;
  const D = () => TT.dates;
  const S = () => TT.school;
  const time = (date, hm) => D().fmtClock(D().at(date, hm));
  const dayName = (k, o) => D().parseIso(k).toLocaleDateString([], o || { weekday: 'short', month: 'short', day: 'numeric' });

  // ---------------- what counts as a class's final ----------------
  // Every exam slot is a final. You can rename it or say a class has none (⋮). Work that's
  // due on an exam day is shown with it; nothing earlier is guessed at.
  const overrides = () => TT.lsGet('tt:finalsOverride', {});
  const setOverride = (courseId, v) => { const o = overrides(); if (v) o[courseId] = v; else delete o[courseId]; TT.lsSet('tt:finalsOverride', o); gc.refreshView(); };

  const finalFor = (f, courseId) => {
    const ov = overrides()[courseId];
    if (ov && ov.mode === 'none') return { kind: 'none', items: [], manual: true };
    const d = TT.todoData();
    const onDay = d && f.days ? d.items.filter((x) => x.courseId === courseId && x.deadline && f.days.includes(D().iso(x.deadline))) : [];
    return { kind: 'final', items: onDay, text: ov && ov.mode === 'text' ? ov.text : '', manual: !!ov };
  };

  gc.finalFor = finalFor;

  // Override menu: pick the final, say there isn't one, or go back to automatic.
  const overrideMenu = (anchor, c) => {
    const ov = overrides()[c.id];
    gc.menu(anchor, [
      { heading: c.title.length > 34 ? c.title.slice(0, 32) + '…' : c.title },
      { icon: 'edit', label: 'Name this final…', sub: 'e.g. "Lab practical" or "Essay"', onClick: () => {
        const t = prompt(`What's the final for ${c.title}?`, ov && ov.mode === 'text' ? ov.text : 'Final exam');
        if (t && t.trim()) setOverride(c.id, { mode: 'text', text: t.trim().slice(0, 80) });
      } },
      { icon: 'hide', label: 'No final for this class', onClick: () => setOverride(c.id, { mode: 'none' }) },
      ov ? { divider: true } : null,
      ov ? { icon: 'refresh', label: 'Undo my change', onClick: () => setOverride(c.id, null) } : null,
    ].filter(Boolean), { width: 300 });
  };

  const finalChips = (fin) => (!fin.text && !fin.items.length ? null : h('div', { class: 'tt-tt-due' },
    fin.text ? h('span', { class: 'tt-tt-chip exam' }, I('summative'), h('span', null, fin.text)) : null,
    fin.items.slice(0, 2).map((it) => gc.link(it.url, { class: 'tt-tt-chip', title: it.title }, I(TT.workIcon(it)), h('span', null, it.title)))));
  const moreBtn = (c) => h('button', { class: 'tt-fin-more', type: 'button', title: 'Set the final for this class', 'aria-label': 'Set the final for this class',
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); overrideMenu(e.currentTarget, c); } }, I('more'));

  // ---------------- page ----------------
  const counter = (st) => {
    const f = st.f;
    if (st.phase === 'unknown') {
      return [h('div', { class: 'tt-fin-big' }, st.semesterLeft === 0 ? 'Last day' : `${st.semesterLeft} day${st.semesterLeft === 1 ? '' : 's'}`),
        h('div', { class: 'tt-fin-small' }, `until ${f.semester.label} ends`)];
    }
    if (st.phase === 'during') {
      const n = st.dayNum, total = f.days.length;
      return [h('div', { class: 'tt-fin-big' }, n >= total ? 'Last exam day' : `Day ${n} of ${total}`), h('div', { class: 'tt-fin-small' }, 'One exam at a time.')];
    }
    return [h('div', { class: 'tt-fin-big' }, st.daysUntil === 1 ? 'Tomorrow' : `${st.daysUntil} days`), h('div', { class: 'tt-fin-small' }, st.daysUntil === 1 ? 'Finals start tomorrow' : 'until finals start')];
  };
  const SOURCE = { bell: "from your school's bell schedule", calendar: 'from the school calendar', schedule: 'from the shape of your timetable', manual: 'set by you in Settings' };

  const section = (key, title, extra, body, defaultOpen) => {
    const m = TT.lsGet('tt:finalsOpen', {});
    const open = key in m ? m[key] : defaultOpen;
    const sec = h('section', { class: 'tt-fin-sec' + (open ? '' : ' shut') });
    sec.append(h('div', { class: 'tt-fin-sec-head' },
      h('button', { class: 'tt-fin-toggle', type: 'button', 'aria-expanded': String(!!open), onClick: () => { const x = TT.lsGet('tt:finalsOpen', {}); x[key] = !open; TT.lsSet('tt:finalsOpen', x); gc.refreshView(); } },
        I('expand'), h('h2', null, title)), extra), open ? body : null);
    return sec;
  };

  gc.views.finals = (el) => {
    const st = S().finalsStatus();
    const f = st.f;
    const wrap = h('div', { class: 'tt-fin' });
    el.append(wrap);
    if (!f) {
      wrap.append(h('div', { class: 'tt-gc-empty' }, 'Looking for your exam dates…'));
      return;
    }

    const sub = f.start ? `${f.semester ? f.semester.label + ' · ' : ''}${dayName(f.start)} – ${dayName(f.end)}`
      : f.semester ? `${f.semester.label} ends ${dayName(f.semester.end)}` : '';
    wrap.append(h('section', { class: 'tt-fin-hero' },
      h('div', { class: 'tt-fin-hero-l' },
        h('h1', null, 'Finals'),
        h('div', { class: 'tt-fin-sub' }, sub),
        f.source ? h('div', { class: 'tt-fin-src' }, 'Exam dates ', SOURCE[f.source] || '', '. ', h('button', { class: 'tt-gc-linkbtn', onClick: () => TT.openSettings('finals') }, f.source === 'manual' ? 'Change' : 'Not right?'))
          : h('div', { class: 'tt-fin-src' }, "Couldn't find your exam days in Toddle. ", h('button', { class: 'tt-gc-linkbtn', onClick: () => TT.openSettings('finals') }, 'Set the dates in Settings'))),
      h('div', { class: 'tt-fin-hero-r' }, counter(st))));


    // ---- exam schedule ----
    const slots = (f.slots || []).slice().sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    if (f.start) {
      const byDate = {};
      for (const s of slots) (byDate[s.date] = byDate[s.date] || []).push(s);
      const sched = h('div', { class: 'tt-tt-grid tt-fin-grid', style: { '--n': String(Math.min(f.days.length, 5)) } });
      for (const k of f.days) {
        const list = byDate[k] || [];
        sched.append(h('div', { class: 'tt-tt-day finals' + (k === D().iso(new Date()) ? ' today' : '') },
          h('div', { class: 'tt-tt-dayhead' }, h('div', { class: 'dow' }, dayName(k, { weekday: 'short' })),
            h('div', { class: 'num' }, String(D().parseIso(k).getDate()))),
          h('div', { class: 'tt-tt-col' }, list.length ? list.map((s) => {
            const c = gc.course(s.courseId);
            const fin = finalFor(f, s.courseId);
            const none = fin.kind === 'none';
            return h('div', { class: 'tt-tt-card finals' + (none ? ' empty' : '') },
              moreBtn(c),
              gc.link(`${gc.base()}/courses/${s.courseId}/home`, { class: 'tt-tt-name' }, h('i', { class: 'tt-tt-dot', style: { background: TT.themes.color(c) } }), c.title),
              h('div', { class: 'tt-tt-when' }, h('b', null, S().block(s)), `${time(s.date, s.start)} – ${time(s.date, s.end)}`),
              s.room ? h('div', { class: 'tt-tt-where' }, s.room) : null,
              none ? h('div', { class: 'tt-tt-nofinal' }, 'No final for this class') : finalChips(fin));
          }) : h('div', { class: 'tt-tt-none' }, f.slots ? 'No exams for you this day' : 'Loading…'))));
      }
      const exportBtn = slots.length ? h('button', { class: 'tt-gc-btn outlined', onClick: () => {
        const ics = gc.buildTimetableIcs(slots, { name: 'Finals', prefix: 'Final: ', room: true, teacher: true });
        const a = h('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'finals-schedule.ics' });
        document.body.append(a); a.click(); a.remove();
        if (gc.toast) gc.toast('Saved finals-schedule.ics. Import it like the timetable (Timetable → Export shows how).');
      } }, I('download'), 'Add exams to calendar') : null;
      wrap.append(section('schedule', 'Exam schedule', exportBtn, h('div', null,
        compare(f, slots),
        h('p', { class: 'tt-fin-hint' }, 'Use ⋮ on a class to rename its final or mark that it doesn’t have one.'),
        sched), true));
    }

    // ---- due before finals ----
    if (f.start) {
      const d = TT.todoData();
      if (d) {
        const cat = TT.categorize(d.items);
        const startT = D().parseIso(f.start).getTime();
        const before = cat.todo.filter((x) => x.deadline && x.deadline < startT && x.bucket !== 'missing').slice(0, 10);
        const missing = cat.missing.slice(0, 5);
        const rowIt = (it) => gc.link(it.url, { class: 'tt-fin-due' + (it.bucket === 'missing' ? ' late' : '') },
          h('span', { class: 'tt-fin-due-ico', style: { background: TT.courseColor ? TT.courseColor(it.courseId, it.courseTitle) : TT.colorFor(it.courseId) } }, I(TT.workIcon(it))),
          h('span', { class: 'tt-fin-due-main' }, h('b', null, it.title), h('small', null, `${TT.courseName(it.courseId, it.courseTitle)} · ${it.bucket === 'missing' ? 'Missing' : TT.fmtDue(it.deadline)}`)));
        if (before.length || missing.length) {
          wrap.append(section('before', 'Due before finals', null, h('div', null,
            h('p', { class: 'tt-fin-hint' }, 'Getting these out of the way leaves more room to study.'),
            h('div', { class: 'tt-fin-dues' }, missing.map(rowIt), before.map(rowIt))), true));
        }
      }
    }
  };

  // "Regular days: 4 classes, 8:00 – 3:00 · Finals days: 2 exams, 8:00 – 12:00"
  const compare = (f, slots) => {
    if (!slots.length) return null;
    const reg = (S().week(D().addDays(D().monday(D().parseIso(f.start)), -7)) || S().week(new Date()) || []).filter((s) => !f.days.includes(s.date));
    const span = (list) => {
      const by = {};
      list.forEach((s) => { (by[s.date] = by[s.date] || []).push(s); });
      const ds = Object.values(by);
      if (!ds.length) return null;
      const n = Math.round(ds.reduce((a, x) => a + x.length, 0) / ds.length);
      const first = ds.map((x) => x[0].start).sort()[0];
      const last = ds.map((x) => x[x.length - 1].end).sort().pop();
      const any = ds[0][0].date;
      return { n, from: time(any, first), to: time(any, last) };
    };
    const a = span(reg), b = span(slots);
    if (!b) return null;
    return h('div', { class: 'tt-fin-compare' },
      a ? h('span', null, h('b', null, 'Regular days'), `${a.n} classes · ${a.from} – ${a.to}`) : null,
      h('span', { class: 'fin' }, h('b', null, 'Finals days'), `${b.n} exam${b.n === 1 ? '' : 's'} · ${b.from} – ${b.to}`));
  };
})();
