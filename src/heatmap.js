/*
 * Toddle Tweaks — workload heatmap.
 * A week strip coloured by how much is due each day; expands to a six-week grid plus a few
 * plain-language insights. Every part can be switched off, and where it appears is a setting.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const D = () => TT.dates;

  const weightOf = (it) => {
    const s = TT.settings;
    let w = it.needsSubmission ? 1 : 0.5;
    if (s.hmWeightTests !== false && (it.isTest || it.kind === 'Summative' || it.kind === 'Test')) w *= 2;
    return w;
  };
  const isBig = (it) => it.isTest || it.kind === 'Summative' || it.kind === 'Test' || it.kind === 'Quiz';

  // date → { items, load }
  const loadMap = () => {
    const d = TT.todoData();
    const out = {};
    if (!d) return out;
    const cat = TT.categorize(d.items);
    for (const it of cat.todo) {
      if (!it.deadline || it.bucket === 'missing') continue;
      const k = D().iso(it.deadline);
      const o = out[k] || (out[k] = { items: [], load: 0 });
      o.items.push(it); o.load += weightOf(it);
    }
    return out;
  };
  const level = (load) => (!load ? 0 : load <= 1 ? 1 : load <= 2.5 ? 2 : load <= 4.5 ? 3 : 4);

  const finalsDays = () => {
    const st = TT.school && TT.school.finalsStatus ? TT.school.finalsStatus() : null;
    return new Set(st && st.f && st.f.days ? st.f.days : []);
  };

  const cell = (date, m, info, fin, opts) => {
    const k = D().iso(date);
    const o = m[k];
    const today = k === D().iso(new Date());
    const off = info[k] && info[k].holiday;
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const lv = off ? 0 : level(o ? o.load : 0);
    const n = o ? o.items.length : 0;
    const tests = o ? o.items.filter(isBig).length : 0;
    const tip = `${date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}\n`
      + (off ? `No school: ${off}` : n ? `${n} due${tests ? ` (${tests} test${tests > 1 ? 's' : ''})` : ''}\n${o.items.slice(0, 5).map((x) => '• ' + x.title).join('\n')}` : 'Nothing due')
      + (fin.has(k) ? '\nFinals' : '');
    const cls = 'tt-hm-cell lv' + lv + (today ? ' today' : '') + (off ? ' off' : '') + (weekend ? ' wkend' : '') + (fin.has(k) ? ' finals' : '');
    if (opts.mini) return h('span', { class: cls, title: tip });
    return h('button', { type: 'button', class: cls, title: tip, onClick: () => opts.onDay && opts.onDay(date) },
      opts.labels ? h('span', { class: 'tt-hm-dow' }, date.toLocaleDateString([], { weekday: 'short' })) : null,
      h('span', { class: 'tt-hm-num' }, String(date.getDate())),
      opts.labels ? h('span', { class: 'tt-hm-n' }, off ? 'Off' : n ? String(n) : '–') : null,
      tests && opts.labels ? h('span', { class: 'tt-hm-dot', title: 'Test' }) : null);
  };

  // ---------------- insights ----------------
  const insights = (m, info, mon) => {
    const s = TT.settings;
    const out = [];
    const days = [...Array(7)].map((_, i) => D().addDays(mon, i));
    const school = days.filter((d) => d.getDay() % 6 && !(info[D().iso(d)] && info[D().iso(d)].holiday));
    const todayK = D().iso(new Date());
    const ahead = school.filter((d) => D().iso(d) >= todayK);
    const wk = days.map((d) => ({ d, o: m[D().iso(d)] || { items: [], load: 0 } }));
    const total = wk.reduce((a, x) => a + x.o.items.length, 0);
    if (s.hmiBusiest !== false && total) {
      const top = wk.slice().sort((a, b) => b.o.load - a.o.load)[0];
      if (top.o.items.length) {
        const t = top.o.items.filter(isBig).length;
        out.push(['trend', `Busiest day: ${top.d.toLocaleDateString([], { weekday: 'long' })}`, `${top.o.items.length} due${t ? `, including ${t} test${t > 1 ? 's' : ''}` : ''}`]);
      }
    }
    if (s.hmiLightest !== false && ahead.length > 1) {
      const light = ahead.map((d) => ({ d, o: m[D().iso(d)] || { items: [], load: 0 } })).sort((a, b) => a.o.load - b.o.load)[0];
      out.push(['spa', `Lightest day: ${light.d.toLocaleDateString([], { weekday: 'long' })}`, light.o.items.length ? `only ${light.o.items.length} due` : 'nothing due, a good day to get ahead']);
    }
    if (s.hmiTests !== false) {
      const twoWeeks = [];
      for (let i = 0; i < 14; i++) { const k = D().iso(D().addDays(new Date(), i)); (m[k] ? m[k].items : []).filter(isBig).forEach((x) => twoWeeks.push(x)); }
      if (twoWeeks.length) out.push(['test', `${twoWeeks.length} test${twoWeeks.length > 1 ? 's' : ''} in the next two weeks`, twoWeeks.slice(0, 3).map((x) => `${x.title} (${TT.fmtDate(x.deadline, { weekday: 'short' })})`).join(' · ') + (twoWeeks.length > 3 ? ' …' : '')]);
    }
    if (s.hmiClass !== false && total) {
      const by = {};
      wk.forEach((x) => x.o.items.forEach((it) => { by[it.courseId] = (by[it.courseId] || 0) + 1; }));
      const [cid, n] = Object.entries(by).sort((a, b) => b[1] - a[1])[0] || [];
      const it = cid && wk.flatMap((x) => x.o.items).find((x) => x.courseId === cid);
      if (it && n > 1) out.push(['school', `Most work: ${TT.courseName(it.courseId, it.courseTitle)}`, `${n} things due this week`]);
    }
    if (s.hmiTotal !== false) out.push(['todo', `${total} due this week`, total ? `${wk.filter((x) => x.o.items.length).length} of ${school.length} school days have something due` : 'A quiet week']);
    if (s.hmiOff !== false) {
      const offs = days.filter((d) => info[D().iso(d)] && info[D().iso(d)].holiday && d.getDay() % 6);
      if (offs.length) out.push(['calendar', `No school ${offs.map((d) => d.toLocaleDateString([], { weekday: 'long' })).join(', ')}`, info[D().iso(offs[0])].holiday]);
    }
    if (s.hmiMissing !== false) {
      const d = TT.todoData();
      const n = d ? TT.categorize(d.items).missing.length : 0;
      if (n) out.push(['assignment', `${n} still to turn in from earlier`, 'Listed under Missing in your to-do']);
    }
    if (s.hmiFinals !== false && TT.school) {
      const st = TT.school.finalsStatus();
      if (st.show && st.daysUntil > 0) out.push(['summative', st.daysUntil === 1 ? 'Finals start tomorrow' : `Finals start in ${st.daysUntil} days`, TT.fmtDate(D().parseIso(st.f.start).getTime(), { weekday: 'long', month: 'short', day: 'numeric' })]);
    }
    return out;
  };

  /**
   * TT.heatmap({ week: Date (any day in the week), place: 'calendar'|'timetable'|'home'|'todo', onDay })
   * TT.heatmap({ mini: true }) — the sidebar strip.
   */
  TT.heatmap = (opts = {}) => {
    const s = TT.settings;
    if (s.heatmap === false) return null;
    const m = loadMap();
    const info = TT.school ? TT.school.dayInfo() : {};
    const fin = finalsDays();
    const mon = D().monday(opts.week || new Date());
    const days = [...Array(7)].map((_, i) => D().addDays(mon, i));
    const showWeekend = s.hmWeekends === true || days.slice(5).some((d) => m[D().iso(d)]);
    const shown = showWeekend ? days : days.slice(0, 5);

    if (opts.mini) {
      return h('div', { class: 'tt-hm tt-hm-mini', title: 'This week’s workload' },
        h('div', { class: 'tt-hm-strip' }, shown.map((d) => cell(d, m, info, fin, { mini: true }))));
    }

    const openKey = 'tt:hmOpen:' + (opts.place || 'x');
    const open = TT.lsGet(openKey, s.hmExpanded === true);
    const box = h('section', { class: 'tt-hm' + (open ? ' open' : ''), 'aria-label': 'Workload heatmap' });
    const toggle = () => { TT.lsSet(openKey, !box.classList.contains('open')); box.classList.toggle('open'); };
    const head = h('div', { class: 'tt-hm-head' },
      h('span', { class: 'tt-hm-title' }, I('trend'), 'Workload'),
      h('span', { class: 'tt-hm-legend', 'aria-hidden': 'true' }, 'Less', [0, 1, 2, 3, 4].map((l) => h('span', { class: 'tt-hm-sw lv' + l })), 'More'),
      h('button', { type: 'button', class: 'tt-hm-more', title: 'More: six weeks and insights', 'aria-expanded': String(!!open), onClick: toggle }, I('expand')));
    const strip = h('div', { class: 'tt-hm-strip week' + (showWeekend ? ' seven' : '') }, shown.map((d) => cell(d, m, info, fin, { labels: true, onDay: opts.onDay })));
    box.append(head, strip);

    // Expanded: six weeks + insights.
    const more = h('div', { class: 'tt-hm-expand' });
    if (s.hmGrid !== false) {
      const grid = h('div', { class: 'tt-hm-grid' + (showWeekend ? ' seven' : '') },
        h('span'), (showWeekend ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['M', 'T', 'W', 'T', 'F']).map((x) => h('span', { class: 'tt-hm-gh' }, x)));
      const start = D().monday(new Date());
      for (let w = 0; w < 6; w++) {
        const wm = D().addDays(start, w * 7);
        grid.append(h('span', { class: 'tt-hm-wk' }, wm.toLocaleDateString([], { month: 'short', day: 'numeric' })));
        for (let i = 0; i < (showWeekend ? 7 : 5); i++) grid.append(cell(D().addDays(wm, i), m, info, fin, { onDay: opts.onDay }));
      }
      more.append(grid);
    }
    if (s.hmInsights !== false) {
      const list = insights(m, info, mon);
      if (list.length) more.append(h('ul', { class: 'tt-hm-insights' }, list.map(([ic, t, sub]) => h('li', null, I(ic), h('span', null, h('b', null, t), sub ? h('small', null, sub) : null)))));
    }
    more.append(h('button', { type: 'button', class: 'tt-hm-settings', onClick: () => TT.openSettings && TT.openSettings('heatmap') }, 'Choose what shows here'));
    box.append(more);
    return box;
  };

  TT.heatmapOn = (place) => TT.settings.heatmap !== false && !!TT.settings['hm_' + place];
})();
