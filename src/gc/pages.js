/* Toddle Tweaks — Classroom To-do and Calendar pages. */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;

  // ---------------- To-do (smart to-do, Classroom look) ----------------
  gc.views.todo = (el) => {
    const box = h('div', { class: 'tt-gc-todo' });
    el.append(box);
    TT.renderTodo(box, 'gc');
  };

  // ---------------- Calendar (week view of due work) ----------------
  let weekOffset = 0;
  let calCourse = 'all';
  const DAY = 864e5;

  // Calendar file of upcoming, not-done work (one 15-minute event at each due time).
  const exportIcs = (courseFilter) => {
    const d = TT.todoData();
    if (!d) return;
    const now = Date.now();
    const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const stamp = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const items = d.items.filter((x) => !x.toddleDone && x.deadline && x.deadline > now - 864e5 && (courseFilter === 'all' || x.courseId === courseFilter));
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Toddle Tweaks//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Toddle due dates'];
    for (const it of items) {
      lines.push('BEGIN:VEVENT', `UID:${it.id}@toddle-tweaks`, `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(it.deadline - 15 * 60e3)}`, `DTEND:${stamp(it.deadline)}`,
        `SUMMARY:${esc((it.kind ? it.kind + ': ' : 'Due: ') + it.title)}`,
        `DESCRIPTION:${esc(TT.courseName(it.courseId, it.courseTitle) + '\n' + new URL(it.url, location.origin).href)}`,
        `URL:${new URL(it.url, location.origin).href}`,
        'BEGIN:VALARM', 'TRIGGER:-PT12H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(it.title)} is due soon`, 'END:VALARM',
        'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'toddle-due-dates.ics' });
    document.body.append(a); a.click(); a.remove();
    if (gc.toast) gc.toast(`Saved ${items.length} due date${items.length === 1 ? '' : 's'} — open the file to add them to your calendar`);
  };

  gc.views.calendar = (el) => {
    const d = TT.todoData();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + weekOffset * 7);
    const days = [...Array(7)].map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const end = new Date(days[6].getTime() + DAY);
    const fmt = (dt, o) => dt.toLocaleDateString([], o);
    const range = `${fmt(days[0], { month: 'short', day: 'numeric' })} – ${fmt(days[6], days[0].getMonth() === days[6].getMonth() ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}, ${days[6].getFullYear()}`;

    const courses = gc.sortedCourses(true);
    const sel = h('select', { class: 'tt-gc-select', onChange: (e) => { calCourse = e.target.value; gc.rerender(); } },
      h('option', { value: 'all' }, 'All classes'),
      courses.map((c) => h('option', { value: c.id, selected: calCourse === c.id ? true : null }, c.title)));

    const head = h('div', { class: 'tt-gc-cal-head' },
      sel,
      h('div', { class: 'tt-gc-cal-nav' },
        h('button', { class: 'tt-gc-iconbtn', title: 'Previous week', onClick: () => { weekOffset--; gc.rerender(); } }, I('left')),
        h('span', { class: 'tt-gc-cal-range' }, range),
        h('button', { class: 'tt-gc-iconbtn', title: 'Next week', onClick: () => { weekOffset++; gc.rerender(); } }, I('right')),
        weekOffset ? h('button', { class: 'tt-gc-btn text', onClick: () => { weekOffset = 0; gc.rerender(); } }, 'Today') : null),
      h('button', { class: 'tt-gc-btn outlined tt-gc-cal-export', title: 'Download every upcoming due date as a calendar file (works with Google Calendar, Apple Calendar, Outlook)', onClick: () => exportIcs(calCourse) }, I('download'), 'Export to calendar (.ics)'));

    const items = (d ? d.items : []).filter((x) => x.deadline && x.deadline >= start.getTime() && x.deadline < end.getTime() && (calCourse === 'all' || x.courseId === calCourse));
    const ld = TT.lsGet('tt:localDone', {});
    const grid = h('div', { class: 'tt-gc-cal' });
    for (const day of days) {
      const isToday = day.toDateString() === now.toDateString();
      const list = items.filter((x) => new Date(x.deadline).toDateString() === day.toDateString()).sort((a, b) => a.deadline - b.deadline);
      grid.append(h('div', { class: 'tt-gc-cal-day' + (isToday ? ' today' : '') },
        h('div', { class: 'tt-gc-cal-dayhead' },
          h('div', { class: 'dow' }, fmt(day, { weekday: 'short' })),
          h('div', { class: 'num' }, String(day.getDate()))),
        h('div', { class: 'tt-gc-cal-items' }, list.map((it) => {
          const color = TT.courseColor(it.courseId, it.courseTitle);
          const done = it.toddleDone || ld[it.id];
          return gc.link(it.url, { class: 'tt-gc-cal-item' + (done ? ' done' : ''), style: { background: color }, title: `${it.title}\n${TT.courseName(it.courseId, it.courseTitle)}\n${TT.fmtDue(it.deadline)}` },
            h('span', { class: 'what' }, it.title),
            h('span', { class: 'who' }, TT.courseName(it.courseId, it.courseTitle)));
        }))));
    }
    el.append(h('div', { class: 'tt-gc-calendar' }, head, grid,
      !d ? h('div', { class: 'tt-gc-empty small' }, 'Loading…') : null));
  };
})();
