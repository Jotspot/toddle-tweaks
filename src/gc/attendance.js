/*
 * Toddle Tweaks — Attendance, Classroom style.
 * Overall ring, the category breakdown, a year-at-a-glance day grid, every class, and the
 * periods you weren't marked present, newest first. Read-only; numbers come straight from Toddle.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;
  const D = () => TT.dates;
  const S = () => TT.school;

  const COLOR = [[/unexcused/i, '#d93025'], [/tardy|late/i, '#9334e6'], [/excused|sponsored|medical|approved/i, '#e37400'], [/present/i, '#1e8e3e'], [/uncategori/i, '#80868b']];
  const colorFor = (label) => (COLOR.find(([re]) => re.test(label || '')) || [null, '#5f6368'])[1];
  // Day colour = the "worst" record that day.
  const RANK = { '#d93025': 4, '#9334e6': 3, '#e37400': 2, '#80868b': 1, '#5f6368': 1, '#1e8e3e': 0 };

  // Toddle's own page has excusals and the full record table; keep it one obvious click away.
  const toddleBtn = () => gc.link(`${gc.base()}/attendance-summary?tt=classic`, { class: 'tt-gc-btn outlined tt-att-toddle', title: "Toddle's attendance page: excusals, informed absences and the full record" }, I('attendance'), "Toddle's attendance page");

  gc.views.attendance = (el) => {
    const a = S().attendance();
    const wrap = h('div', { class: 'tt-att' });
    el.append(wrap);
    if (!a) {
      wrap.append(h('div', { class: 'tt-att-top' }, toddleBtn()));
      wrap.append(h('div', { class: 'tt-gc-empty' }, S().loading('tt:attendance') || !TT.lsGet('tt:attendance', null) ? 'Loading your attendance…' : "Couldn't load attendance right now."));
      return;
    }
    const catLabel = Object.fromEntries((a.cats || []).map((c) => [c.id, c.label]));
    const recColor = (r) => (r.present ? '#1e8e3e' : colorFor(catLabel[r.categoryId] || r.label));

    // ---- hero ----
    const o = a.overall;
    if (o) {
      const pct = Math.round(o.pct * 10) / 10;
      wrap.append(h('section', { class: 'tt-att-hero' },
        h('div', { class: 'tt-att-ring', style: { '--p': String(Math.max(0, Math.min(100, pct))) }, role: 'img', 'aria-label': `${pct}% present` }, h('span', null, h('b', null, String(pct)), '%')),
        h('div', { class: 'tt-att-hero-txt' },
          h('h1', null, 'Attendance'),
          h('div', { class: 'tt-att-big' }, `Present for ${o.present} of ${o.total} periods`),
          h('div', { class: 'tt-att-sub' }, `Since ${TT.fmtDate(D().parseIso(a.from).getTime(), { month: 'long', day: 'numeric' })}`),
          o.tier ? h('span', { class: 'tt-att-tier' }, o.tier) : null),
        toddleBtn()));
    }

    // ---- breakdown ----
    const cats = (a.cats || []).filter((c) => c.pct > 0).sort((x, y) => y.pct - x.pct);
    if (cats.length) {
      wrap.append(h('section', { class: 'tt-att-card' },
        h('h2', null, 'Breakdown'),
        h('div', { class: 'tt-att-stack', role: 'img', 'aria-label': cats.map((c) => `${c.label} ${c.pct}%`).join(', ') },
          cats.map((c) => h('span', { style: { width: Math.max(c.pct, 0.6) + '%', background: colorFor(c.label) }, title: `${c.label}: ${c.pct}%` }))),
        h('div', { class: 'tt-att-keys' }, cats.map((c) => h('span', { class: 'tt-att-key' }, h('i', { style: { background: colorFor(c.label) } }), c.label, h('b', null, `${c.pct}%`))))));
    }

    // ---- year at a glance ----
    const byDay = {};
    for (const r of a.records || []) {
      const c = recColor(r);
      const cur = byDay[r.date];
      if (!cur || RANK[c] > RANK[cur.c]) byDay[r.date] = { c, label: r.present ? 'Present' : r.label, n: (cur ? cur.n : 0) + 1 };
      else cur.n++;
    }
    const info = S().dayInfo();
    const start = D().monday(D().parseIso(a.from));
    const end = new Date();
    const grid = h('div', { class: 'tt-att-grid' });
    const months = h('div', { class: 'tt-att-months' });
    let lastMonth = -1;
    for (let w = new Date(start); w <= end; w = D().addDays(w, 7)) {
      const col = h('div', { class: 'tt-att-col' });
      for (let i = 0; i < 5; i++) {
        const d = D().addDays(w, i);
        const k = D().iso(d);
        const rec = byDay[k];
        const off = info[k] && info[k].holiday;
        col.append(h('span', { class: 'tt-att-day' + (d > end ? ' future' : '') + (off && !rec ? ' off' : ''), style: rec ? { background: rec.c } : null,
          title: `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}: ${rec ? rec.label : off ? 'No school: ' + off : d > end ? '' : 'No records'}` }));
      }
      grid.append(col);
      const m = w.getMonth();
      months.append(h('span', null, m !== lastMonth ? w.toLocaleDateString([], { month: 'short' }) : ''));
      lastMonth = m;
    }
    wrap.append(h('section', { class: 'tt-att-card' },
      h('h2', null, 'This year at a glance'),
      h('div', { class: 'tt-att-glance' }, h('div', { class: 'tt-att-dows' }, ['', 'M', 'T', 'W', 'T', 'F'].map((x) => h('span', null, x))), h('div', null, months, grid)),
      h('div', { class: 'tt-att-keys small' }, [['Present', '#1e8e3e'], ['Excused', '#e37400'], ['Tardy', '#9334e6'], ['Unexcused', '#d93025']].map(([l, c]) => h('span', { class: 'tt-att-key' }, h('i', { style: { background: c } }), l)))));

    // ---- by class ----
    const classes = (a.byClass || []).map((c) => ({ ...c, n: (a.records || []).filter((r) => r.courseId === c.id).length }));
    const counted = classes.filter((c) => !c.excluded && c.n).sort((x, y) => x.pct - y.pct || x.title.localeCompare(y.title));
    const notCounted = classes.filter((c) => c.excluded || !c.n);
    wrap.append(h('section', { class: 'tt-att-card' },
      h('h2', null, 'By class'),
      h('div', { class: 'tt-att-classes' }, counted.map((c) => {
        const course = gc.course(c.id);
        const color = TT.themes.color(course);
        const miss = (a.records || []).filter((r) => r.courseId === c.id && !r.present).length;
        return h('div', { class: 'tt-att-class' },
          h('span', { class: 'tt-gc-nav-av', style: { background: color } }, (course.title || '?').trim()[0].toUpperCase()),
          h('div', { class: 'tt-att-class-main' },
            gc.link(`${gc.base()}/courses/${c.id}/home`, { class: 'tt-att-class-name' }, course.title),
            h('div', { class: 'tt-att-bar' }, h('span', { style: { width: c.pct + '%', background: c.pct >= 95 ? '#1e8e3e' : c.pct >= 90 ? '#e37400' : '#d93025' } }))),
          h('div', { class: 'tt-att-class-pct' }, h('b', null, `${c.pct}%`), miss ? h('small', null, `${miss} not present`) : h('small', null, 'Every period')));
      })),
      notCounted.length ? h('p', { class: 'tt-fin-hint' }, 'Not counted: ', notCounted.map((c) => TT.courseName(c.id, c.title)).join(', ')) : null));

    // ---- not present ----
    const away = (a.records || []).filter((r) => !r.present);
    const sec = h('section', { class: 'tt-att-card' }, h('h2', null, 'Not marked present'));
    if (!away.length) sec.append(h('div', { class: 'tt-gc-empty small' }, 'Present for every period so far.'));
    let month = '';
    for (const r of away) {
      const d = D().parseIso(r.date);
      const m = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
      if (m !== month) { sec.append(h('div', { class: 'tt-att-month' }, m)); month = m; }
      const c = recColor(r);
      sec.append(h('div', { class: 'tt-att-rec' },
        h('div', { class: 'tt-att-rec-date' }, h('b', null, String(d.getDate())), h('small', null, d.toLocaleDateString([], { weekday: 'short' }))),
        h('span', { class: 'tt-att-chip', style: { color: c, borderColor: c } }, r.abbr || '', r.abbr ? ' · ' : '', r.label),
        h('div', { class: 'tt-att-rec-main' }, h('b', null, TT.courseName(r.courseId, r.courseTitle) || 'Class'), h('small', null, [r.period, r.remark].filter(Boolean).join(' · ')))));
    }
    wrap.append(sec);

    const age = Math.round((Date.now() - ((TT.lsGet('tt:attendance', {}) || {}).t || Date.now())) / 60000);
    wrap.append(h('div', { class: 'tt-att-foot' },
      `Updated ${age < 1 ? 'just now' : age < 60 ? age + ' min ago' : Math.round(age / 60) + ' h ago'} · `,
      h('button', { class: 'tt-gc-linkbtn', onClick: () => { try { localStorage.removeItem('tt:attendance'); } catch {} S().attendance(); gc.refreshView(); } }, 'Refresh'),
      ' · ', gc.link(`${gc.base()}/attendance-summary?tt=classic`, { class: 'tt-gc-linkbtn' }, "Toddle's attendance page")));
  };
})();
