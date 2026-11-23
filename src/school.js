/*
 * Toddle Tweaks — school data: timetable, holidays, bell schedules, semesters, finals, attendance.
 * Everything is shown from localStorage first and refreshed in the background (same idea as the
 * to-do cache). Nothing here replays or rewrites Toddle's own requests; these are our own small
 * read-only queries (verified against what Toddle's Timetable and Attendance pages ask for).
 */
(() => {
  const TT = window.TT;
  const DAY = 864e5;

  // ---------------- dates ----------------
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parseIso = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const monday = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const dow = (x.getDay() + 6) % 7; return addDays(x, -dow); };
  // "08:00:00" on 2026-12-14 → local timestamp
  const at = (date, time) => { const d = parseIso(date); const [h, m] = String(time || '0:0').split(':').map(Number); d.setHours(h || 0, m || 0, 0, 0); return d.getTime(); };
  const fmtClock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  TT.dates = { iso, parseIso, addDays, monday, at, fmtClock, DAY };

  // ---------------- who / where ----------------
  const ids = () => {
    const u = TT.lsGet('userInfo', {}) || {};
    const tf = TT.lsGet('tt:taskFilters', null) || {};
    const cv = TT.lsGet('tt:courseVars', null) || {};
    const cp = TT.cpId() || (tf.curriculumProgramIds && tf.curriculumProgramIds[0]);
    const ay = tf.academicYearId || (cv.courseGradeFilters && cv.courseGradeFilters.academicYearId) || (cv.courseFilters && cv.courseFilters.academicYear);
    const cur = TT.lsGet('currentCurriculumProgram', null);
    const cpInfo = (u.curriculumPrograms || []).find((x) => x && x.id === cp);
    const cpType = (cur && cur.id === cp && cur.type) || (cpInfo && cpInfo.type) || 'UBD';
    return { student: u.id, org: u.org_id, cp, ay, cpType, isStudent: !u.user_type || /student/i.test(u.user_type) };
  };

  const gql = (q, v, op) => TT.api.gql(q, v, op);

  // ---------------- tiny cache-then-refresh store ----------------
  const subs = new Set();
  const notify = TT.debounce(() => subs.forEach((f) => { try { f(); } catch (e) { console.warn('[TT]', e); } }), 30);
  const inflight = new Map();
  const failed = new Map();
  // Returns the cached value right away; refreshes in the background when older than ttl.
  const cached = (key, ttl, fetcher) => {
    const c = TT.lsGet(key, null);
    const stale = !c || Date.now() - c.t > ttl;
    if (stale && !inflight.has(key) && !(failed.get(key) > Date.now() - 60e3)) {
      const p = fetcher().then((v) => { TT.lsSet(key, { t: Date.now(), v }); failed.delete(key); notify(); return v; })
        .catch((e) => { failed.set(key, Date.now()); console.warn('[TT] school', key, e && e.message); notify(); })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return c ? c.v : null;
  };
  // Same, but awaitable (fresh if stale).
  const fresh = async (key, ttl, fetcher) => {
    const v = cached(key, ttl, fetcher);
    if (inflight.has(key)) { try { return (await inflight.get(key)) ?? v; } catch { return v; } }
    return v;
  };

  // ---------------- timetable ----------------
  const TT_Q = `query ttTimetable($id: ID!, $f: PeriodFilterOptions) { node(id: $id, type: STUDENT) { id ... on Student {
    enrolledPeriodsV2(filters: $f) { date startTime endTime location rotationDay { id label }
      period { id label abbreviation type } course { id title primaryGrade { id } }
      teachers { id firstName lastName preferredName prefix } } } } }`;

  const fetchSlots = async (start, end) => {
    const { student, ay } = ids();
    if (!student) throw new Error('Not signed in');
    const d = await gql(TT_Q, { id: student, f: { startDate: start, endDate: end, ...(ay ? { academicYearId: ay } : {}), isAllDayPeriods: false, onlySelectedSlots: true, filterByViewerClassAccess: false } }, 'ttTimetable');
    const list = (d && d.node && d.node.enrolledPeriodsV2) || [];
    const g = list.find((x) => x.course && x.course.primaryGrade);
    if (g) TT.lsSet('tt:gradeId', g.course.primaryGrade.id);
    return list.filter((x) => x.course && x.startTime && x.endTime).map((x) => ({
      date: x.date,
      start: x.startTime.slice(0, 5),
      end: x.endTime.slice(0, 5),
      courseId: x.course.id,
      courseTitle: x.course.title,
      period: x.period ? (x.period.abbreviation || x.period.label) : '',
      periodLabel: x.period ? x.period.label : '',
      room: x.location || '',
      day: x.rotationDay ? x.rotationDay.label : '',
      teachers: (x.teachers || []).map((t) => TT.personName(t)).filter(Boolean),
    })).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  };

  // Long ranges are fetched a month at a time, in parallel.
  const fetchRange = async (start, end) => {
    const chunks = [];
    for (let s = parseIso(start); s <= parseIso(end); s = addDays(s, 31)) {
      const e = addDays(s, 30);
      chunks.push([iso(s), iso(e > parseIso(end) ? parseIso(end) : e)]);
    }
    const parts = await Promise.all(chunks.map(([a, b]) => fetchSlots(a, b)));
    const seen = new Set();
    return parts.flat().filter((x) => { const k = x.date + x.start + x.courseId; if (seen.has(k)) return false; seen.add(k); return true; });
  };

  // One week (Mon–Sun) of slots, cached per week.
  const week = (mon) => {
    const m = iso(monday(mon));
    const ttl = m < iso(monday()) ? 7 * DAY : 6 * 3600e3;
    return cached('tt:ttw:' + m, ttl, () => fetchSlots(m, iso(addDays(parseIso(m), 6))));
  };
  // Keep only a few weeks around.
  const pruneWeeks = () => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('tt:ttw:')).sort();
      const keep = new Set([...keys].sort((a, b) => (TT.lsGet(b, {}).t || 0) - (TT.lsGet(a, {}).t || 0)).slice(0, 16));
      keys.forEach((k) => { if (!keep.has(k)) localStorage.removeItem(k); });
    } catch {}
  };
  setTimeout(pruneWeeks, 10e3);

  // ---------------- school calendar (holidays, events) ----------------
  const EV_Q = `query ttSchoolCal($id: ID!, $filters: UserCoursesCalendarFilter!) { node(id: $id, type: STUDENT) { id ... on Student {
    calendarEvents(filters: $filters) { id startTime endTime item { id ... on CalendarEventItem { label isFullDayEvent tag: eventTag { label uid } } } } } } }`;
  const GENERIC = /^(holiday|school break|public holidays? subject to change)$/i;

  const yearRange = () => {
    const gp = (TT.lsGet('tt:gp', null) || {}).v || [];
    if (gp.length) return [gp[0].start, gp[gp.length - 1].end];
    const now = new Date();
    return [iso(addDays(now, -60)), iso(addDays(now, 300))];
  };

  const evFetch = async () => {
    const { student, cp, ay, cpType } = ids();
    const [a, b] = yearRange();
    const d = await gql(EV_Q, { id: student, filters: {
      startDate: parseIso(a).toISOString(), endDate: new Date(addDays(parseIso(b), 1).getTime() - 1).toISOString(),
      contentTypes: ['SCHOOL_CALENDAR'], curriculumProgramId: cp, curriculumType: cpType, ...(ay ? { academicYearId: ay } : {}),
    } }, 'ttSchoolCal');
    return ((d && d.node && d.node.calendarEvents) || []).filter((e) => e.item && e.item.label).map((e) => ({
      start: String(e.startTime).slice(0, 10), end: String(e.endTime || e.startTime).slice(0, 10),
      label: e.item.label, allDay: !!e.item.isFullDayEvent, holiday: !!(e.item.tag && e.item.tag.uid === 'HOLIDAYS_AND_VACATIONS'),
    }));
  };
  const events = () => cached('tt:schoolCal', 24 * 3600e3, evFetch);

  // date → { holiday: 'Thanksgiving', events: ['Last day of school …'] }
  const dayInfo = () => {
    const out = {};
    for (const e of events() || []) {
      for (let d = parseIso(e.start); iso(d) <= e.end; d = addDays(d, 1)) {
        const k = iso(d);
        const o = out[k] || (out[k] = { holiday: null, events: [] });
        if (e.holiday) { if (!o.holiday || (GENERIC.test(o.holiday) && !GENERIC.test(e.label))) o.holiday = e.label; }
        else if (e.allDay && !o.events.includes(e.label)) o.events.push(e.label);
      }
    }
    return out;
  };

  // ---------------- semesters ----------------
  const gpFetch = async () => {
    const courses = ((TT.api.cachedCourses() || {}).courses || []).map((c) => c.id);
    const tryIds = courses.length ? courses.slice(0, 4) : [];
    for (const id of tryIds) {
      const d = await gql(`query ttGP($id: ID!) { node(id: $id, type: COURSE) { id ... on Course { learningCourse { id gradingPeriods { edges { node { id label startDate endDate } } } } } } }`, { id }, 'ttGP').catch(() => null);
      const lc = d && d.node && d.node.learningCourse;
      const edges = ((Array.isArray(lc) ? lc[0] : lc) || {}).gradingPeriods;
      const list = ((edges && edges.edges) || []).map((e) => e.node).filter((n) => n && n.startDate && n.endDate)
        .map((n) => ({ id: n.id, label: n.label, start: n.startDate.slice(0, 10), end: n.endDate.slice(0, 10) }))
        .sort((a, b) => a.start.localeCompare(b.start));
      if (list.length) return list;
    }
    return [];
  };
  const gradingPeriods = () => cached('tt:gp', 3 * DAY, gpFetch);
  const currentPeriod = (when = new Date()) => {
    const t = iso(when);
    const gp = gradingPeriods() || [];
    return gp.find((g) => g.start <= t && t <= g.end) || gp.find((g) => g.start > t) || null;
  };

  // ---------------- bell schedules (named day types: "Final Exams-Periods3&4") ----------------
  const BELL_Q = `query ttBell($id: ID!, $cp: [ID!], $rf: RoutineFilterOptions!, $rdf: RoutineDatesFilters!) { node(id: $id, type: ORGANIZATION) { id ... on Organization {
    curriculumPrograms(curriculumIds: $cp) { id routines(filter: $rf) { id routineDates(filters: $rdf) { date rotationDay { label } bellSchedule { id label } } } } } } }`;
  const fetchBells = async (start, end) => {
    const { org, cp, ay } = ids();
    const gradeId = TT.lsGet('tt:gradeId', null);
    if (!org || !cp) return {};
    const f = { startDate: start, endDate: end, ...(ay ? { academicYearId: ay } : {}) };
    const d = await gql(BELL_Q, { id: org, cp: [cp], rf: { ...f, ...(gradeId ? { gradeIds: [gradeId] } : {}) }, rdf: f }, 'ttBell');
    const out = {};
    for (const prog of (d && d.node && d.node.curriculumPrograms) || []) {
      for (const r of prog.routines || []) for (const rd of r.routineDates || []) {
        if (rd.bellSchedule && rd.bellSchedule.label) out[rd.date] = rd.bellSchedule.label;
      }
    }
    return out;
  };
  const bells = (mon) => {
    const m = iso(monday(mon));
    return cached('tt:bell:' + m, 3 * DAY, () => fetchBells(m, iso(addDays(parseIso(m), 6))));
  };

  // ---------------- finals ----------------
  const FINAL_RE = /\b(final|finals|exam|exams|examination)\b/i;
  const NOT_FINAL_RE = /\b(mock|practice|pre-?exam|no exams?)\b/i;
  // Long blocks, few of them, school done by early afternoon: what most exam days look like.
  const examShaped = (slots) => {
    if (!slots.length || slots.length > 3) return false;
    const mins = slots.map((s) => (at(s.date, s.end) - at(s.date, s.start)) / 60e3);
    return mins.every((m) => m >= 85) && slots.every((s) => s.end <= '13:30');
  };

  const detectFinals = async () => {
    const s = TT.settings;
    const gp = (await fresh('tt:gp', 3 * DAY, gpFetch)) || [];
    const today = iso(new Date());
    const sem = gp.find((g) => g.end >= today) || null;
    // You told us: trust it.
    if (s.finalsStart) {
      const start = s.finalsStart;
      const end = s.finalsEnd && s.finalsEnd >= start ? s.finalsEnd : iso(addDays(parseIso(start), 4));
      const days = [];
      for (let d = parseIso(start); iso(d) <= end; d = addDays(d, 1)) if (d.getDay() % 6) days.push(iso(d));
      return { start, end, days, source: 'manual', semester: sem };
    }
    if (!sem) return null;
    // Exams sit in the last few weeks of a semester.
    const winStart = iso(addDays(parseIso(sem.end), -24));
    const winEnd = sem.end;
    let days = [];
    let source = null;
    const bellMap = await fetchBells(winStart, winEnd).catch(() => ({}));
    days = Object.entries(bellMap).filter(([, l]) => FINAL_RE.test(l) && !NOT_FINAL_RE.test(l)).map(([d]) => d);
    if (days.length) source = 'bell';
    if (!days.length) {
      const ev = (await fresh('tt:schoolCal', 24 * 3600e3, evFetch)) || [];
      for (const e of ev) {
        if (!FINAL_RE.test(e.label) || NOT_FINAL_RE.test(e.label) || e.end < winStart || e.start > winEnd) continue;
        for (let d = parseIso(e.start); iso(d) <= e.end; d = addDays(d, 1)) if (d.getDay() % 6) days.push(iso(d));
      }
      if (days.length) source = 'calendar';
    }
    let slots = [];
    try { slots = await fetchSlots(winStart, winEnd); } catch {}
    if (!days.length && slots.length) {
      const byDate = {};
      for (const x of slots) (byDate[x.date] = byDate[x.date] || []).push(x);
      // Exam-shaped days at the end of the semester, in one run.
      const shaped = Object.keys(byDate).sort().filter((d) => examShaped(byDate[d]));
      if (shaped.length >= 2) { days = shaped; source = 'schedule'; }
    }
    days = [...new Set(days)].sort();
    if (!days.length) return { start: null, end: null, days: [], source: null, semester: sem };
    const finalSlots = slots.filter((x) => days.includes(x.date));
    return { start: days[0], end: days[days.length - 1], days, source, semester: sem, slots: finalSlots, bellNames: Object.fromEntries(days.map((d) => [d, bellMap[d] || null])) };
  };
  // The settings page can't read Toddle's storage, so tell it what was found (it shows the dates).
  const detectAndShare = async () => {
    const f = await detectFinals();
    if (!f || f.source !== 'manual') {
      try { chrome.storage.local.set({ finalsFound: f && f.start ? { start: f.start, end: f.end, source: f.source, t: Date.now() } : null }); } catch {}
    }
    return f;
  };
  const finals = () => cached('tt:finals', 12 * 3600e3, detectAndShare);

  // { show, daysUntil, phase: 'before'|'during'|'after' }
  const finalsStatus = (now = new Date()) => {
    if (TT.settings.finalsMode === false) return { show: false };
    const f = finals();
    if (!f) return { show: false, f };
    const today = iso(now);
    const lead = Number(TT.settings.finalsLead) || 45;
    if (f.start) {
      const until = Math.round((parseIso(f.start) - parseIso(today)) / DAY);
      if (today > f.end) return { show: false, f, phase: 'after' };
      if (until > lead) return { show: false, f, daysUntil: until };
      return { show: true, f, daysUntil: until, phase: until > 0 ? 'before' : 'during', dayNum: f.days.filter((d) => d <= today).length };
    }
    // Finals not found, but the semester is ending: still useful (with a nudge to set the dates).
    if (f.semester) {
      const until = Math.round((parseIso(f.semester.end) - parseIso(today)) / DAY);
      if (until >= 0 && until <= Math.min(lead, 30)) return { show: true, f, daysUntil: null, semesterLeft: until, phase: 'unknown' };
    }
    return { show: false, f };
  };
  // Forget cached finals when the dates in Settings change.
  window.addEventListener('tt:settings', () => {
    const k = `${TT.settings.finalsStart || ''}|${TT.settings.finalsEnd || ''}`;
    if (TT.lsGet('tt:finalsKey', '') !== k) { TT.lsSet('tt:finalsKey', k); try { localStorage.removeItem('tt:finals'); } catch {} notify(); }
  });

  // ---------------- attendance ----------------
  const ATT_STATS_Q = `query ttAttStats($id: ID!, $f: StudentAttendanceFilters) { node(id: $id, type: STUDENT) { id ... on Student {
    overall: attendanceV2(filters: $f) { presenceOverview { totalCount presencePercentage absencePercentage presenceNumber absenceNumber tier { id label } } }
    stats: attendanceV2(filters: $f) { statistics { courseItems { percentage item { id title isExcludedFromAttendanceCalculation } } }
      categorySummary { percentageItems { category { id label } percentage } } } } } }`;
  const ATT_REC_Q = `query ttAttRec($id: ID!, $f: StudentAttendanceFilters, $first: Int, $after: String) { node(id: $id, type: STUDENT) { id ... on Student {
    attendanceV2(first: $first, after: $after, orderBy: ATTENDANCE_DATE, orderByDirection: DESC, filters: $f) {
      edges { node { id date remark period { id label } course { id title } value { id label abbreviation status attendanceCategory { id } } } }
      pageInfo { hasNextPage endCursor } } } } }`;

  const fetchAttendance = async () => {
    const { student, cp, ay } = ids();
    const gp = (await fresh('tt:gp', 3 * DAY, gpFetch)) || [];
    const today = iso(new Date());
    const start = gp.length ? gp[0].start : iso(addDays(new Date(), -150));
    const f = { startDate: start, endDate: today + 'T23:59:59.999Z', isPeriodByAttendance: true, ...(ay ? { academicYearIds: ay } : {}), ...(cp ? { curriculumProgramIds: cp } : {}) };
    const statsP = gql(ATT_STATS_Q, { id: student, f }, 'ttAttStats');
    const records = [];
    let after = null;
    for (let page = 0; page < 8; page++) {
      const d = await gql(ATT_REC_Q, { id: student, f, first: 200, after }, 'ttAttRec');
      const a = d && d.node && d.node.attendanceV2;
      if (!a) break;
      for (const e of a.edges || []) {
        const n = e.node;
        if (!n || !n.value) continue;
        records.push({ id: n.id, date: String(n.date).slice(0, 10), period: n.period ? n.period.label : '', courseId: n.course && n.course.id, courseTitle: n.course && n.course.title,
          label: n.value.label, abbr: n.value.abbreviation, present: n.value.status === 'PRESENT', categoryId: n.value.attendanceCategory && n.value.attendanceCategory.id, remark: n.remark || '' });
      }
      if (!a.pageInfo || !a.pageInfo.hasNextPage) break;
      after = a.pageInfo.endCursor;
    }
    const st = await statsP;
    const node = (st && st.node) || {};
    const ov = (node.overall && node.overall.presenceOverview) || null;
    const stats = (node.stats || {});
    const cats = ((stats.categorySummary && stats.categorySummary.percentageItems) || []).map((x) => ({ id: x.category.id, label: x.category.label, pct: x.percentage }));
    const byClass = ((stats.statistics && stats.statistics.courseItems) || []).filter((x) => x.item).map((x) => ({ id: x.item.id, title: x.item.title, pct: x.percentage, excluded: !!x.item.isExcludedFromAttendanceCalculation }));
    return { from: start, overall: ov && { total: ov.totalCount, present: ov.presenceNumber, absent: ov.absenceNumber, pct: ov.presencePercentage, tier: ov.tier && ov.tier.label }, cats, byClass, records };
  };
  const attendance = () => cached('tt:attendance', 3 * 3600e3, fetchAttendance);

  // "A3" for period 3 on an A day (any rotation letters: A/B, C/D, 1–6…). Falls back to Toddle's "P3".
  const block = (sl) => {
    if (!sl) return '';
    if (TT.settings.periodNames === 'period' || !sl.day) return sl.period;
    const m = String(sl.period || '').match(/\d+/) || String(sl.periodLabel || '').match(/\d+/);
    return m ? `${sl.day}${m[0]}` : sl.period;
  };

  // The school's own day letter. Toddle only stores the rotation (A or B), but bell schedules are
  // named like "Day: C/D - w/out Adv": rotation A on a C/D schedule is a C day, B is a D day.
  const dayLetter = (rot, bell) => {
    if (!rot) return '';
    const m = String(bell || '').match(/\b([A-Z])\s*\/\s*([A-Z])\b/);
    if (!m || !/^[A-Z]$/.test(rot)) return rot;
    return m[1 + ((rot.charCodeAt(0) - 65) % 2)];
  };

  TT.school = {
    dayLetter,
    fetchBells,
    block,
    ids, week, fetchRange, fetchSlots, events, dayInfo, gradingPeriods, currentPeriod, bells, finals, finalsStatus, attendance,
    on: (f) => { subs.add(f); return () => subs.delete(f); },
    loading: (key) => inflight.has(key),
    // Class now and the next one today (or the next school day).
    nextClass: (now = new Date()) => {
      const t = now.getTime();
      const slots = [...(week(now) || []), ...(now.getDay() >= 5 || now.getDay() === 0 ? (week(addDays(monday(now), 7)) || []) : [])];
      const cur = slots.find((s) => at(s.date, s.start) <= t && t < at(s.date, s.end));
      const next = slots.find((s) => at(s.date, s.start) > t);
      return { cur, next };
    },
    refreshAll: () => { ['tt:finals', 'tt:attendance', 'tt:schoolCal', 'tt:gp'].forEach((k) => { try { localStorage.removeItem(k); } catch {} }); notify(); },
  };

  // Warm the caches the sidebar/top bar need, once Toddle has told us who you are.
  setTimeout(() => {
    if (!ids().student || !TT.api.hasFilters || !TT.api.hasFilters()) return;
    gradingPeriods(); week(new Date()); events();
    setTimeout(() => finals(), 1500);
  }, 2500);
})();
