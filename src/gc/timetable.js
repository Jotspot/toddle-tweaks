/*
 * Toddle Tweaks — Timetable (a whole week at once), export to Google Calendar, next class.
 * Toddle's own timetable shows three or four days; this shows Monday to Friday (and the weekend
 * if anything is on), holidays, A/B days, finals days, and what's due in each class that day.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;
  const D = () => TT.dates;
  const S = () => TT.school;

  let weekOffset = 0;
  const SPECIAL = /\b(final|exam|late start|early (release|dismissal)|half day|assembly|testing)\b/i;
  const time = (date, hm) => D().fmtClock(D().at(date, hm));
  const range = (s) => `${time(s.date, s.start)} – ${time(s.date, s.end)}`;

  const dueFor = (courseId, date) => {
    const d = TT.todoData();
    if (!d) return [];
    return d.items.filter((x) => x.courseId === courseId && x.deadline && D().iso(x.deadline) === date && !x.toddleDone);
  };

  const card = (s, now, nextKey, fin, f) => {
    const c = gc.course(s.courseId);
    const color = TT.themes ? TT.themes.color(c) : TT.colorFor(s.courseId);
    const t0 = D().at(s.date, s.start), t1 = D().at(s.date, s.end);
    const live = now >= t0 && now < t1;
    const key = s.date + s.start + s.courseId;
    const due = dueFor(s.courseId, s.date);
    const exams = due.filter((x) => x.isTest || x.kind === 'Summative' || x.kind === 'Test');
    // On exam days, show the class's final (or grey the card out when nothing is posted).
    const final = fin && f && gc.finalFor ? gc.finalFor(f, s.courseId) : null;
    const empty = final && final.kind === 'none';
    const kids = [
      gc.link(`${gc.base()}/courses/${s.courseId}/home`, { class: 'tt-tt-name', title: c.title }, h('i', { class: 'tt-tt-dot', style: { background: color } }), c.title),
      h('div', { class: 'tt-tt-when' }, s.period ? h('b', { title: s.periodLabel || s.period }, S().block(s)) : null, range(s)),
      h('div', { class: 'tt-tt-where' }, [s.room, s.teachers[0] ? s.teachers[0] + (s.teachers.length > 1 ? ` +${s.teachers.length - 1}` : '') : null].filter(Boolean).join(' · ')),
    ];
    const show = final && !empty ? (final.items.length ? final.items : []) : due;
    if (final && final.text) kids.push(h('div', { class: 'tt-tt-due' }, h('span', { class: 'tt-tt-chip exam' }, I('summative'), h('span', null, final.text))));
    if (show.length) {
      kids.push(h('div', { class: 'tt-tt-due' }, show.slice(0, 3).map((it) => gc.link(it.url, { class: 'tt-tt-chip' + (final || exams.includes(it) ? ' exam' : ''), title: it.title }, I(TT.workIcon(it)), h('span', null, it.title)))));
    } else if (empty) {
      kids.push(h('div', { class: 'tt-tt-nofinal' }, final.manual ? 'No final for this class' : finalsQuip(s.courseId)));
    }
    return h('div', { class: 'tt-tt-card' + (live ? ' live' : '') + (key === nextKey ? ' next' : '') + (fin ? ' finals' : '') + (empty ? ' empty' : ''), style: { '--c': color } },
      live ? h('span', { class: 'tt-tt-tag' }, 'Now') : key === nextKey ? h('span', { class: 'tt-tt-tag soft' }, 'Next') : null, kids);
  };

  // Gentle, varied "nothing posted" lines for finals days (stable per class).
  const QUIPS = ['No final posted for this class (yet)', 'Nothing posted here yet', 'No exam on Toddle for this one (yet)', 'All quiet so far', 'Your teacher hasn’t posted a final (yet)', 'No final listed. Check with your teacher'];
  const finalsQuip = (id) => { let n = 0; for (const ch of String(id)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return QUIPS[n % QUIPS.length]; };
  TT.finalsQuip = finalsQuip;

  gc.views.timetable = (el) => {
    const now = Date.now();
    const mon = D().addDays(D().monday(new Date()), weekOffset * 7);
    const days = [...Array(7)].map((_, i) => D().addDays(mon, i));
    const slots = S().week(mon);
    const bells = S().bells(mon) || {};
    const info = S().dayInfo();
    const st = S().finalsStatus();
    const finDays = new Set((st.f && st.f.days) || []);
    const { next } = S().nextClass(new Date());
    const nextKey = next ? next.date + next.start + next.courseId : '';
    const byDate = {};
    for (const s of slots || []) (byDate[s.date] = byDate[s.date] || []).push(s);
    const showDays = days.filter((d, i) => i < 5 || (byDate[D().iso(d)] || []).length);

    const fmt = (dt, o) => dt.toLocaleDateString([], o);
    const label = `${fmt(days[0], { month: 'short', day: 'numeric' })} – ${fmt(days[4], days[0].getMonth() === days[4].getMonth() ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}, ${days[4].getFullYear()}`;
    const head = h('div', { class: 'tt-gc-cal-head' },
      h('div', { class: 'tt-gc-cal-nav' },
        h('button', { class: 'tt-gc-iconbtn', title: 'Previous week', 'aria-label': 'Previous week', onClick: () => { weekOffset--; gc.refreshView(); } }, I('left')),
        h('span', { class: 'tt-gc-cal-range' }, label),
        h('button', { class: 'tt-gc-iconbtn', title: 'Next week', 'aria-label': 'Next week', onClick: () => { weekOffset++; gc.refreshView(); } }, I('right')),
        weekOffset ? h('button', { class: 'tt-gc-btn text', onClick: () => { weekOffset = 0; gc.refreshView(); } }, 'Today') : null),
      [...finDays].some((d) => d >= D().iso(days[0]) && d <= D().iso(days[6])) ? h('span', { class: 'tt-tt-weektag' }, I('summative'), 'Finals week') : null,
      h('div', { class: 'tt-tt-actions' },
        h('button', { class: 'tt-gc-btn outlined', title: 'Every class meeting this semester, as a calendar file for Google Calendar, Apple Calendar or Outlook', onClick: () => gc.exportTimetable() }, I('calendar'), 'Export to Google Calendar'),
        gc.link(`${gc.base()}/timetable?tt=classic`, { class: 'tt-gc-btn text', title: "Toddle's own timetable (PDF download, display settings)" }, 'Toddle view')));

    const hm = TT.heatmapOn && TT.heatmapOn('timetable') ? TT.heatmap({ week: mon, place: 'timetable' }) : null;

    const grid = h('div', { class: 'tt-tt-grid', style: { '--n': String(showDays.length) } });
    for (const d of showDays) {
      const k = D().iso(d);
      const list = byDate[k] || [];
      const isToday = k === D().iso(new Date());
      const fin = finDays.has(k);
      const bell = bells[k];
      const hol = info[k] && info[k].holiday;
      const ev = (info[k] && info[k].events) || [];
      const day = list[0] && S().dayLetter(list[0].day, bell);
      grid.append(h('div', { class: 'tt-tt-day' + (isToday ? ' today' : '') + (fin ? ' finals' : '') + (hol && !list.length ? ' off' : '') },
        h('div', { class: 'tt-tt-dayhead' },
          h('div', { class: 'dow' }, fmt(d, { weekday: 'short' }), day ? h('span', { class: 'tt-tt-rot', title: `${day} day` }, day) : null),
          h('div', { class: 'num' }, String(d.getDate())),
          fin ? h('div', { class: 'tt-tt-badge fin' }, 'Finals') : bell && SPECIAL.test(bell) ? h('div', { class: 'tt-tt-badge', title: bell }, bell) : null),
        h('div', { class: 'tt-tt-col' },
          hol && !list.length ? h('div', { class: 'tt-tt-off' }, I('calendar'), h('b', null, 'No school'), h('span', null, hol)) : null,
          ev.length ? h('div', { class: 'tt-tt-ev' }, ev.slice(0, 2).join(' · ')) : null,
          list.map((s) => card(s, now, nextKey, fin, st.f)),
          !list.length && !hol && slots ? h('div', { class: 'tt-tt-none' }, d.getDay() % 6 ? 'No classes' : '') : null)));
    }

    el.append(h('div', { class: 'tt-gc-calendar tt-tt' }, head, hm,
      !slots ? h('div', { class: 'tt-gc-empty small' }, S().loading('tt:ttw:' + D().iso(mon)) || !TT.lsGet('tt:ttw:' + D().iso(mon), null) ? 'Loading your timetable…' : "Couldn't load the timetable. Try again in a minute.") : grid));
  };

  // ---------------- export: every class meeting, one by one ----------------
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n');
  const stamp = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // Lines longer than 75 bytes are folded (counting UTF-8 bytes, so e.g. Chinese class names stay valid).
  const enc = new TextEncoder();
  const fold = (line) => {
    const out = [];
    let cur = '', n = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (n + b > 74) { out.push(cur); cur = ' '; n = 1; }
      cur += ch; n += b;
    }
    out.push(cur);
    return out.join('\r\n');
  };

  gc.buildTimetableIcs = (slots, opts = {}) => {
    const now = Date.now();
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Toddle Tweaks//Timetable//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(opts.name || 'School timetable')];
    for (const s of slots) {
      const name = (opts.prefix || '') + TT.courseName(s.courseId, s.courseTitle);
      const desc = [[s.period && (S().block(s) !== s.period ? `${S().block(s)} (${s.periodLabel || s.period})` : (s.periodLabel || s.period)), (s.dayName || s.day) && `${s.dayName || s.day} day`].filter(Boolean).join(' · '),
        opts.teacher !== false && s.teachers.length ? 'Teacher: ' + s.teachers.join(', ') : null,
        new URL(`/platform/${TT.cpId()}/courses/${s.courseId}/home`, location.origin).href].filter(Boolean).join('\n');
      lines.push('BEGIN:VEVENT',
        `UID:${s.date}-${s.start.replace(':', '')}-${s.courseId}@toddle-tweaks`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(D().at(s.date, s.start))}`,
        `DTEND:${stamp(D().at(s.date, s.end))}`,
        `SUMMARY:${icsEsc(opts.period && s.period ? `${name} (${S().block(s)})` : name)}`,
        opts.room !== false && s.room ? `LOCATION:${icsEsc(s.room)}` : null,
        `DESCRIPTION:${icsEsc(desc)}`,
        'TRANSP:OPAQUE');
      if (opts.alarm) lines.push('BEGIN:VALARM', `TRIGGER:-PT${opts.alarm}M`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(name)}${s.room ? ' in ' + icsEsc(s.room) : ''}`, 'END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.filter(Boolean).map(fold).join('\r\n') + '\r\n';
  };

  gc.exportTimetable = () => {
    document.querySelectorAll('.tt-gc-dialog-wrap.tt-tt-export').forEach((x) => x.remove());
    const gp = S().gradingPeriods() || [];
    const today = D().iso(new Date());
    const cur = gp.find((g) => g.end >= today);
    const later = gp.filter((g) => g.start > today);
    const yearEnd = gp.length ? gp[gp.length - 1].end : D().iso(D().addDays(new Date(), 180));
    const ranges = [];
    if (cur) ranges.push({ id: 'sem', label: `Rest of ${cur.label}`, sub: `${TT.fmtDate(D().parseIso(cur.start > today ? cur.start : today).getTime())} – ${TT.fmtDate(D().parseIso(cur.end).getTime(), { month: 'short', day: 'numeric', year: 'numeric' })}`, start: cur.start > today ? cur.start : today, end: cur.end });
    for (const g of later.filter((g) => g !== cur).slice(0, 2)) ranges.push({ id: g.id, label: g.label, sub: `${TT.fmtDate(D().parseIso(g.start).getTime())} – ${TT.fmtDate(D().parseIso(g.end).getTime(), { month: 'short', day: 'numeric', year: 'numeric' })}`, start: g.start, end: g.end });
    ranges.push({ id: 'year', label: 'Rest of the school year', sub: `Until ${TT.fmtDate(D().parseIso(yearEnd).getTime(), { month: 'short', day: 'numeric', year: 'numeric' })}`, start: today, end: yearEnd });
    if (!cur) ranges.unshift({ id: 'next90', label: 'Next 3 months', sub: 'Your semester dates aren’t available', start: today, end: D().iso(D().addDays(new Date(), 90)) });

    let pick = ranges[0].id;
    const opt = TT.lsGet('tt:ttExport', { room: true, teacher: true, period: false, alarm: 0, skip: [] });
    const courses = gc.sortedCourses(true);
    const status = h('div', { class: 'tt-tt-exp-status' });
    const body = h('div', { class: 'tt-tt-exp' });
    const wrap = h('div', { class: 'tt-gc-dialog-wrap tt-tt-export', onClick: (e) => { if (e.target === wrap) wrap.remove(); } });
    const close = () => wrap.remove();

    const draw = () => {
      body.textContent = '';
      body.append(h('div', { class: 'tt-tt-exp-h' }, 'Which dates'),
        h('div', { class: 'tt-tt-exp-ranges' }, ranges.map((r) => h('label', { class: 'tt-tt-exp-range' + (pick === r.id ? ' on' : '') },
          h('input', { type: 'radio', name: 'tt-range', checked: pick === r.id ? true : null, onChange: () => { pick = r.id; draw(); } }),
          h('span', null, h('b', null, r.label), h('small', null, r.sub))))));
      const chk = (k, label) => h('label', { class: 'tt-tt-exp-chk' }, h('input', { type: 'checkbox', checked: opt[k] ? true : null, onChange: (e) => { opt[k] = e.target.checked; TT.lsSet('tt:ttExport', opt); } }), label);
      body.append(h('div', { class: 'tt-tt-exp-h' }, 'Details'),
        h('div', { class: 'tt-tt-exp-opts' }, chk('room', 'Room as the location'), chk('teacher', 'Teacher in the notes'), chk('period', 'Block in the title, e.g. "Chemistry (B4)"'),
          h('label', { class: 'tt-tt-exp-chk' }, 'Reminder ',
            h('select', { class: 'tt-gc-select small', onChange: (e) => { opt.alarm = Number(e.target.value); TT.lsSet('tt:ttExport', opt); } },
              [[0, 'None'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before']].map(([v, t]) => h('option', { value: v, selected: opt.alarm === v ? true : null }, t))))));
      if (courses.length) {
        body.append(h('div', { class: 'tt-tt-exp-h' }, 'Classes'),
          h('div', { class: 'tt-tt-exp-classes' }, courses.map((c) => h('label', { class: 'tt-tt-exp-chk' },
            h('input', { type: 'checkbox', checked: opt.skip.includes(c.id) ? null : true, onChange: (e) => { opt.skip = e.target.checked ? opt.skip.filter((x) => x !== c.id) : [...opt.skip, c.id]; TT.lsSet('tt:ttExport', opt); } }),
            h('span', { class: 'tt-tt-exp-dot', style: { background: TT.themes.color(c) } }), c.title))));
      }
      body.append(h('p', { class: 'tt-tt-exp-note' }, 'Only your classes go in: one event for every class meeting, written out one by one from Toddle’s timetable. Holidays and days off are left out. Late starts, A/B days and exam days use their real times.'));
    };
    draw();

    const go = h('button', { class: 'tt-gc-btn filled', onClick: async () => {
      const r = ranges.find((x) => x.id === pick);
      go.disabled = true;
      status.textContent = 'Reading your timetable…';
      try {
        const [all, bellMap] = await Promise.all([S().fetchRange(r.start, r.end), S().fetchBells(r.start, r.end).catch(() => ({}))]);
        const slots = all.filter((s) => !opt.skip.includes(s.courseId) && D().at(s.date, s.end) > Date.now())
          .map((s) => ({ ...s, dayName: S().dayLetter(s.day, bellMap[s.date]) }));
        if (!slots.length) { status.textContent = 'No classes found in those dates.'; go.disabled = false; return; }
        const ics = gc.buildTimetableIcs(slots, { ...opt, name: 'School timetable' });
        const a = h('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: `school-timetable-${r.start}-to-${r.end}.ics` });
        document.body.append(a); a.click(); a.remove();
        const first = slots[0].date, last = slots[slots.length - 1].date;
        showSteps(`${slots.length} class meetings, ${TT.fmtDate(D().parseIso(first).getTime())} – ${TT.fmtDate(D().parseIso(last).getTime(), { month: 'short', day: 'numeric', year: 'numeric' })}`);
      } catch (e) {
        status.textContent = "Couldn't read the timetable: " + (e && e.message ? e.message : 'try again');
        go.disabled = false;
      }
    } }, I('download'), 'Download calendar file');

    const dlg = h('div', { class: 'tt-gc-dialog narrow', role: 'dialog', 'aria-label': 'Export timetable' },
      h('div', { class: 'tt-gc-dialog-title' }, 'Export timetable to Google Calendar'),
      h('div', { class: 'tt-gc-dialog-sub' }, 'Download a calendar file, then import it once. Works with Apple Calendar and Outlook too.'),
      body, status,
      h('div', { class: 'tt-gc-dialog-actions spread' }, h('button', { class: 'tt-gc-btn text', onClick: close }, 'Cancel'), go));

    const step = (n, kids) => h('li', null, h('span', { class: 'tt-tt-step-n' }, String(n)), h('div', null, kids));
    const ext = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
    const showSteps = (summary) => {
      dlg.textContent = '';
      dlg.append(h('div', { class: 'tt-gc-dialog-title' }, 'Saved. Now add it to Google Calendar'),
        h('div', { class: 'tt-gc-dialog-sub' }, summary),
        h('ol', { class: 'tt-tt-steps' },
          step(1, ['Make a calendar just for school, so it’s easy to update later: ', ext('https://calendar.google.com/calendar/r/settings/createcalendar', 'Create new calendar'), '. Call it "School timetable" and click ', h('b', null, 'Create calendar'), '.']),
          step(2, ['Open ', ext('https://calendar.google.com/calendar/r/settings/export', 'Import & export'), ' in Google Calendar settings.']),
          step(3, ['Under ', h('b', null, 'Import'), ', click ', h('b', null, 'Select file from your computer'), ' and pick the ', h('b', null, '.ics'), ' file you just downloaded (it’s in your Downloads folder).']),
          step(4, ['In ', h('b', null, 'Add to calendar'), ', choose ', h('b', null, 'School timetable'), ', then click ', h('b', null, 'Import'), '.'])),
        h('details', { class: 'tt-tt-other' }, h('summary', null, 'Apple Calendar or Outlook'),
          h('p', null, h('b', null, 'Apple Calendar: '), 'double-click the file, choose a calendar (or New Calendar) and click OK. On iPhone, open the file from Files and tap Add All.'),
          h('p', null, h('b', null, 'Outlook: '), 'Calendar → Add calendar → Upload from file, pick the file and a calendar, then Import.')),
        h('p', { class: 'tt-tt-exp-note' }, 'Timetable changed? In Google Calendar, delete the "School timetable" calendar and import a fresh file. Importing the same file again won’t make duplicates.'),
        h('div', { class: 'tt-gc-dialog-actions' }, h('button', { class: 'tt-gc-btn filled', onClick: close }, 'Done')));
    };

    wrap.append(dlg);
    document.body.append(wrap);
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey, true); } };
    document.addEventListener('keydown', onKey, true);
  };

  // ---------------- next class chip (top bar) ----------------
  gc.nextClassChip = () => {
    if (TT.settings.nextClass === false || !S()) return null;
    const now = new Date();
    const { cur, next } = S().nextClass(now);
    const pick = cur || next;
    if (!pick) return null;
    const t0 = D().at(pick.date, pick.start);
    const sameDay = pick.date === D().iso(now);
    // Only "next" for today, or the first class of the next school day after school is out.
    if (!cur && !sameDay && now.getHours() < 15) return null;
    const name = TT.courseName(pick.courseId, pick.courseTitle);
    const mins = Math.round((t0 - now.getTime()) / 60e3);
    const when = cur ? `until ${time(pick.date, pick.end)}`
      : sameDay ? (mins <= 60 ? `in ${Math.max(1, mins)} min` : `at ${time(pick.date, pick.start)}`)
        : `${pick.date === D().iso(D().addDays(now, 1)) ? 'Tomorrow' : D().parseIso(pick.date).toLocaleDateString([], { weekday: 'short' })} ${time(pick.date, pick.start)}`;
    const showRoom = TT.settings.nextClassRoom !== false && pick.room;
    return gc.link(`${gc.base()}/timetable`, { class: 'tt-next' + (cur ? ' now' : ''), title: `${cur ? 'Now' : 'Next'}: ${name}\n${range(pick)}${pick.room ? '\n' + pick.room : ''}\nOpen timetable`, style: { '--c': TT.themes.color(gc.course(pick.courseId)) } },
      TT.gIcon('schedule', 'tt-next-ico'),
      h('span', { class: 'tt-next-name' }, `${cur ? 'Now' : 'Next'}: `, h('b', null, name)),
      h('span', { class: 'tt-next-when' }, `${when}${showRoom ? ` · ${pick.room}` : ''}`));
  };
  // Keep the chip's minutes current.
  setInterval(() => { if (gc.active && gc.active() && TT.settings.nextClass !== false) gc.rerenderBar && gc.rerenderBar(); }, 30e3);
})();
