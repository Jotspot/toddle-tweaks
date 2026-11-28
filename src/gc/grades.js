/*
 * Toddle Tweaks — Grades on one page.
 * Toddle's gradebook makes you pick a class, then click every rubric icon to see a single level.
 * Here every graded assessment in every class is on one page with what you got right in the row:
 * standard levels (SAS middle school's NE / EM / DE / ME / MWD), learning behaviors, scores,
 * rubric and checklist rows and your teacher's comments. "By standard" turns each class into a
 * standards table: every level you've had on each standard, oldest to newest.
 * Read-only; everything comes from one batched request (TT.api.getGrades), cached and refreshed.
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;

  const TYPE = { SA: 'Summative', smt: 'Summative', FA: 'Formative', fmt: 'Formative', le: 'Learning experience', qt: 'Quick task', worksheet: 'Worksheet' };
  const TYPE_SHORT = { SA: 'SA', smt: 'SA', FA: 'FA', fmt: 'FA', le: 'LE', qt: 'QT', worksheet: 'WS' };
  const isSumm = (t) => /^(SA|smt)$/i.test(t || '');

  // ---------------- level names (Settings → Grades → Level names) ----------------
  // SAS middle school's scale is NE / EM / DE / ME / MWD. "Exemplary" renames only the top level;
  // "Old" goes back to the previous four: Below (NE, EM), Approaching (DE), Meets (ME), Exemplary (MWD).
  // Shared with gc/toddle-pages.js, which renames the same words on Toddle's own pages.
  const NEW = { NE: 'Not yet Evident', EM: 'Emerging', DE: 'Developing', ME: 'Meeting', MWD: 'Meeting with Distinction' };
  const OLD = { NE: ['BE', 'Below'], EM: ['BE', 'Below'], DE: ['AP', 'Approaching'], ME: ['ME', 'Meets'], MWD: ['EX', 'Exemplary'] };
  const LABEL_KEY = { 'not yet evident': 'NE', 'not evident': 'NE', emerging: 'EM', developing: 'DE', meeting: 'ME', 'meeting with distinction': 'MWD', 'meets with distinction': 'MWD' };
  const words = () => (['exemplary', 'old'].includes(TT.settings.gradeWords) ? TT.settings.gradeWords : 'new');
  const keyOf = (lv) => {
    const a = String(lv.abbr || '').toUpperCase();
    if (NEW[a] && (!lv.label || LABEL_KEY[String(lv.label).trim().toLowerCase()] === a)) return a;
    return LABEL_KEY[String(lv.label || lv.abbr || '').trim().toLowerCase()] || null;
  };
  const renameKey = (k) => {
    const w = words();
    if (!k || w === 'new') return null;
    if (w === 'exemplary') return k === 'MWD' ? ['EX', 'Exemplary'] : null;
    return OLD[k];
  };
  const renameLv = (lv) => { if (!lv) return lv; const r = renameKey(keyOf(lv)); return r ? { ...lv, abbr: r[0], label: r[1] } : lv; };
  const renameWord = (s) => { const r = renameKey(LABEL_KEY[String(s || '').trim().toLowerCase()]); return r ? r[1] : s; };
  TT.levelNames = { words, keyOf, renameKey, NEW, LABEL_KEY };
  const renamed = (x) => (words() === 'new' ? x : {
    ...x,
    standards: x.standards.map((s) => ({ ...s, level: renameLv(s.level) })),
    behaviors: x.behaviors.map((s) => ({ ...s, level: renameLv(s.level) })),
    rubrics: x.rubrics.map((rb) => ({ ...rb, rows: rb.rows.map((rw) => ({ ...rw, level: renameWord(rw.level) })) })),
  });

  // Level colours. The standards scale (either wording) and the learning-behavior scale by abbreviation;
  // anything else (rubrics, checklists) by its position on its own scale, low = red → high = teal.
  const KNOWN = {
    NE: '#c5221f', EM: '#e8710a', DE: '#e3a008', ME: '#188038', MWD: '#00796b', EX: '#00796b', BE: '#c5221f', AP: '#e3a008',
    RARE: '#c5221f', OCCA: '#e3a008', SOME: '#e3a008', SOMETIMES: '#e3a008', FREQ: '#188038', CONS: '#00796b', INC: '#c5221f',
  };
  // Rubric levels named like the scale get its short form in the chip (the full name is in the tooltip).
  const SHORT = { 'not yet evident': 'NE', 'not evident': 'NE', emerging: 'EM', developing: 'DE', meeting: 'ME', 'meeting with distinction': 'MWD', exemplary: 'EX', below: 'BE', approaching: 'AP', meets: 'ME' };
  const RAMP = ['#c5221f', '#e8710a', '#e3a008', '#7cb342', '#188038', '#00796b'];
  const NAMED = [[/not yet|not evident|beginning|below|incomplete|^no$|rarely|never/i, '#c5221f'], [/emerging/i, '#e8710a'], [/developing|approaching|sometimes|occasionally|partial/i, '#e3a008'],
    [/distinction|exceed|exemplary|advanced|consistently|always/i, '#00796b'], [/meeting|meets|proficient|secure|frequently|usually|^yes$|complete/i, '#188038']];
  const levelColor = (lv) => {
    if (!lv) return '#5f6368';
    const k = String(lv.abbr || '').toUpperCase();
    if (KNOWN[k]) return KNOWN[k];
    const named = NAMED.find(([re]) => re.test(lv.label || lv.abbr || ''));
    if (named) return named[1];
    if (lv.of > 1 && lv.seq != null) return RAMP[Math.round((lv.seq / (lv.of - 1)) * (RAMP.length - 1))];
    return '#5f6368';
  };
  // Order within a scale (summary bars, "typical" level): the standards scale when known, otherwise Toddle's.
  const RANK = { NE: 0, BE: 0, EM: 1, DE: 2, AP: 2, ME: 3, MWD: 4, EX: 4, RARE: 0, OCCA: 1, SOME: 1, SOMETIMES: 1, FREQ: 3, CONS: 4 };
  const rank = (lv) => { const i = RANK[String(lv.abbr || '').toUpperCase()]; return i != null ? i : (lv.seq != null ? lv.seq : 99); };


  // ---------------- data ----------------
  const grades = () => {
    const c = TT.api.cachedGrades();
    const { fresh, load } = gc.courseData;
    if (!fresh(c, 5 * 60e3)) load('grades', 'all', () => TT.api.getGrades());
    return c;
  };
  const when = (x) => x.deadline || x.createdAt || 0;
  // A score of 0 out of 0 is an unused score box, not a result.
  const realScore = (x) => x.score && !(Number(x.score.max) === 0 && Number(x.score.value) === 0) ? x.score : null;
  const hasResults = (x) => x.shared && (x.standards.length || x.behaviors.length || realScore(x) || x.rubrics.length || x.comments.length);

  // Session state: open comments, search text. Remembered view options live in localStorage.
  const openComments = new Set();
  let query = '';
  const vs = () => ({ term: '', course: 'all', mode: 'assess', type: 'all', ungraded: false, ...(TT.lsGet('tt:gradesView', {}) || {}) });
  const setVs = (patch) => {
    // On a class link from Toddle's gradebook, keep that class unless you picked another,
    // and move to the plain Grades address so the choice sticks.
    const r = gc.route && gc.route();
    if (r && r.lc && gc.active()) {
      const lcCourse = courseForLearning(r.lc);
      TT.lsSet('tt:gradesView', { ...vs(), ...(lcCourse ? { course: lcCourse } : {}), ...patch });
      gc.go(`${gc.base()}/courses?tt=grades`);
      return;
    }
    TT.lsSet('tt:gradesView', { ...vs(), ...patch });
    gc.refreshView();
  };
  const collapsedKey = 'tt:gradesCollapsed';

  // Toddle's gradebook links use the "learning course" id; map it to the class.
  const courseForLearning = (lcId) => {
    const all = (TT.api.cachedCourses() || {}).courses || [];
    const c = all.find((x) => [].concat(x.learningCourse || []).some((l) => l && l.id === lcId));
    return c && c.id;
  };

  // The middle level of a list (what a class or an assessment "usually" got), or null.
  const typical = (levels) => {
    const lv = levels.filter((l) => l && RANK[String(l.abbr || '').toUpperCase()] != null).sort((a, b) => rank(a) - rank(b));
    return lv.length ? lv[Math.floor(lv.length / 2)] : null;
  };
  const rubricLv = (rw) => ({ abbr: SHORT[String(rw.level).trim().toLowerCase()] || rw.level, label: rw.level, seq: rw.seq, of: rw.of });
  const assessLevel = (x) => typical([...x.standards.map((s) => s.level), ...x.rubrics.flatMap((rb) => rb.rows.map(rubricLv))]);
  const scoreText = (sc) => `${sc.value}/${sc.max != null ? sc.max : '–'}`;
  const pct = (sc) => (sc && Number(sc.max) > 0 ? Math.round((sc.value / sc.max) * 1000) / 10 : null);
  const lvSpan = (lv, cls) => h('span', { class: cls || 'tt-gr-lv', style: { color: levelColor(lv) }, title: lv.label || '' }, lv.abbr || lv.label);
  const stdName = (s) => s.code || shortLabel(s.label) || s.set || 'Standard';

  gc.views.grades = (el, r = {}) => {
    const data = grades();
    const v = vs();
    // Opened from one class in Toddle's gradebook: start on that class.
    if (r.lc) { const id = courseForLearning(r.lc); if (id) v.course = id; }
    const ps = TT.settings.gradesStyle === 'powerschool';
    const wrap = h('div', { class: ps ? 'tt-gr tt-ps' : 'tt-gr' });
    el.append(wrap);
    const u = TT.lsGet('userInfo', {}) || {};
    const toddleLink = h('a', { class: ps ? 'tt-ps-a' : 'tt-gc-btn text', href: `${gc.base()}/student-progress-summary/${u.id}/grading-period-overview?tt=classic`, title: "Toddle's own gradebook (final grades, report cards)" }, "Toddle's gradebook");
    TT.spaLink(toddleLink);

    if (!data) {
      wrap.append(h('div', { class: 'tt-gc-empty' }, gc.courseData.failedAt['gradesall'] ? "Couldn't load your grades right now. Toddle's gradebook still works." : 'Loading your grades…'));
      return;
    }

    // Your level names; learning behaviors and comments only if they're switched on.
    const prep = (x) => {
      const y = renamed(x);
      if (TT.settings.gradesBehaviors !== false && TT.settings.gradesComments !== false) return y;
      return { ...y, behaviors: TT.settings.gradesBehaviors === false ? [] : y.behaviors, comments: TT.settings.gradesComments === false ? [] : y.comments };
    };
    const all = data.list.map(prep).sort((a, b) => when(b) - when(a));
    const terms = [...new Map(all.filter((x) => x.term).map((x) => [x.term.id, x.term])).values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    const latestTerm = (all.find((x) => x.term && hasResults(x)) || all.find((x) => x.term) || {}).term;
    const term = v.term === 'all' ? 'all' : (terms.find((t) => t.id === v.term) || latestTerm || { id: 'all' }).id;
    const known = gc.sortedCourses(true);
    const courseIds = [...new Set(all.map((x) => x.courseId))];
    const courses = [
      ...known.filter((c) => courseIds.includes(c.id)),
      ...courseIds.filter((id) => !known.some((c) => c.id === id)).map((id) => ({ id, title: TT.courseName(id, (all.find((x) => x.courseId === id) || {}).courseTitle || 'Class') })),
    ];
    const courseSel = courses.some((c) => c.id === v.course) ? v.course : 'all';

    let items = all.filter((x) => term === 'all' || (x.term && x.term.id === term));
    if (v.type === 'summ') items = items.filter((x) => isSumm(x.type));
    else if (v.type === 'form') items = items.filter((x) => !isSumm(x.type));
    if (!v.ungraded) items = items.filter(hasResults);
    if (courseSel !== 'all') items = items.filter((x) => x.courseId === courseSel);

    const sel = (val, opts, on, label) => h('select', { class: ps ? 'tt-ps-select' : 'tt-gc-select small', 'aria-label': label, onChange: (e) => on(e.target.value) },
      opts.map(([k, t]) => h('option', { value: k, selected: k === val ? true : null }, t)));
    const termSel = terms.length > 1 ? sel(term, [...terms.map((t) => [t.id, t.label]), ['all', 'Whole year']], (x) => setVs({ term: x }), 'Grading period') : null;
    const classSel = sel(courseSel, [['all', 'All classes'], ...courses.map((c) => [c.id, c.title])], (x) => setVs({ course: x }), 'Class');
    const typeSel = sel(v.type, [['all', 'All assessments'], ['summ', 'Summatives'], ['form', 'Formatives and others']], (x) => setVs({ type: x }), 'Type');
    const ungraded = h('label', { class: ps ? 'tt-ps-check' : 'tt-gr-check' }, h('input', { type: 'checkbox', checked: v.ungraded ? true : null, onChange: (e) => setVs({ ungraded: e.target.checked }) }), 'Show ungraded');

    if (ps) { psView(wrap, { all, items, terms, term, courses, known, courseSel, v, u, termSel, classSel, typeSel, ungraded, toddleLink }); return; }

    // ---------------- Classroom look ----------------
    // Like Classwork: a toolbar, then each class as a topic (its name in the class colour over a
    // rule), rows with the class's round icon, and the grade on the right. Levels are coloured text.
    const search = h('input', { class: 'tt-gr-search', type: 'search', placeholder: 'Search', 'aria-label': 'Search assessments, standards and comments', value: query });
    const tab = (k, label) => h('button', { class: 'tt-gr-tab' + (v.mode === k ? ' on' : ''), 'aria-pressed': v.mode === k ? 'true' : 'false', onClick: () => setVs({ mode: k }) }, label);
    wrap.append(
      h('div', { class: 'tt-gr-top' },
        h('div', { class: 'tt-gr-tabs', role: 'group', 'aria-label': 'View' }, tab('assess', 'Assessments'), tab('standards', 'Standards')),
        h('span', { class: 'tt-gr-top-r' },
          toddleLink)),
      h('div', { class: 'tt-gr-bar' },
        h('span', { class: 'tt-gr-searchbox' }, I('search'), search),
        termSel, classSel, typeSel, ungraded));

    // Overview (Settings → Grades → "Overview"): how your standard levels and learning behaviors
    // add up for what's filtered, in a Classroom-style card.
    if (TT.settings.gradesOverview !== false) {
      const graded = items.filter(hasResults);
      const tally = (pick) => {
        const m = new Map();
        for (const x of graded) for (const s of pick(x)) {
          const k = String(s.level.abbr || s.level.label).toUpperCase();
          if (!m.has(k)) m.set(k, { lv: s.level, n: 0 });
          m.get(k).n++;
        }
        return [...m.values()].sort((a, b) => rank(b.lv) - rank(a.lv)); // best first
      };
      const std = tally((x) => x.standards);
      const lb = tally((x) => x.behaviors);
      const missing = all.filter((x) => x.status === 'OVERDUE' && (term === 'all' || (x.term && x.term.id === term)) && (courseSel === 'all' || x.courseId === courseSel)).length;
      const bar = (list) => {
        const tot = list.reduce((s, x) => s + x.n, 0);
        return h('div', { class: 'tt-gr-ov-bar', role: 'img', 'aria-label': list.map((x) => `${x.lv.label || x.lv.abbr}: ${x.n} of ${tot}`).join(', ') },
          list.map((x) => h('span', { style: { flexGrow: String(x.n), background: levelColor(x.lv) }, title: `${x.lv.label || x.lv.abbr}: ${x.n} of ${tot}` })));
      };
      const keys = (list) => h('div', { class: 'tt-gr-ov-keys' }, list.map((x) => h('span', null, h('i', { style: { background: levelColor(x.lv) } }), x.lv.label || x.lv.abbr, ' ', h('b', null, String(x.n)))));
      const termLabel = term === 'all' ? 'Whole year' : (terms.find((t) => t.id === term) || {}).label || '';
      const scope = courseSel === 'all' ? 'All classes' : (courses.find((c) => c.id === courseSel) || {}).title || '';
      if (graded.length) {
        wrap.append(h('section', { class: 'tt-gr-ov' },
          h('div', { class: 'tt-gr-ov-head' }, h('span', { class: 'tt-gr-ov-title' }, 'Overview'), h('span', { class: 'tt-gr-ov-sub' }, [scope, termLabel].filter(Boolean).join(' · '))),
          h('div', { class: 'tt-gr-ov-stats' },
            h('span', null, h('b', null, String(graded.length)), ' graded'),
            std.length ? h('span', null, h('b', null, String(std.reduce((s, x) => s + x.n, 0))), ' standard levels') : null,
            missing ? h('span', { class: 'late' }, h('b', null, String(missing)), ' missing') : null),
          std.length ? [bar(std), keys(std)] : null,
          lb.length ? h('div', { class: 'tt-gr-ov-lb' }, h('div', { class: 'tt-gr-ov-lb-t' }, 'Learning behaviors'), bar(lb), keys(lb)) : null));
      }
    }

    if (!items.length) {
      wrap.append(h('div', { class: 'tt-gc-feed-empty' }, data.list.length ? 'Nothing graded matches these filters yet.' : 'No graded assessments yet.'));
      return;
    }

    const collapsed = new Set(TT.lsGet(collapsedKey, []) || []);
    const main = h('div', { class: 'tt-gr-main' });
    for (const c of courses) {
      const list = items.filter((x) => x.courseId === c.id);
      if (!list.length) continue;
      const course = gc.course(c.id);
      const color = TT.themes.color(course.id ? course : c);
      const isClosed = collapsed.has(c.id) && courseSel === 'all';
      const sec = h('section', { class: 'tt-gr-class' + (isClosed ? ' collapsed' : ''), 'data-cid': c.id, style: { '--cc': color } });
      const graded = list.filter(hasResults);
      const usual = typical(graded.flatMap((x) => x.standards.map((s) => s.level)));
      const t = gc.teachers(c.id)[0];
      const headBtn = h('button', { class: 'tt-gr-class-head', 'aria-expanded': isClosed ? 'false' : 'true', onClick: () => {
        if (collapsed.has(c.id)) collapsed.delete(c.id); else collapsed.add(c.id);
        TT.lsSet(collapsedKey, [...collapsed]);
        sec.classList.toggle('collapsed', collapsed.has(c.id));
        headBtn.setAttribute('aria-expanded', collapsed.has(c.id) ? 'false' : 'true');
      } },
      h('span', { class: 'tt-gr-class-name' }, c.title),
      h('span', { class: 'tt-gr-class-meta' }, [t ? TT.personName(t) : null, `${graded.length} graded`].filter(Boolean).join(' · '),
        usual ? h('span', { class: 'tt-gr-usual' }, ' · usually ', lvSpan(usual, 'tt-gr-lv word')) : null),
      I('expand', 'tt-gc-topic-caret'));
      const body = h('div', { class: 'tt-gr-class-body' });
      if (v.mode === 'standards') body.append(...byStandard(list));
      else for (const x of list) body.append(row(x, color, t));
      sec.append(headBtn, body);
      main.append(sec);
    }
    // Collapse all / Expand all, when there's more than one class to fold.
    const secs = [...main.querySelectorAll('.tt-gr-class')];
    if (courseSel === 'all' && secs.length > 1) {
      const label = () => (secs.some((s) => !s.classList.contains('collapsed')) ? 'Collapse all' : 'Expand all');
      const btn = h('button', { class: 'tt-gc-btn text tt-gr-foldall', type: 'button', onClick: () => {
        const close = label() === 'Collapse all';
        for (const s of secs) {
          const id = s.dataset.cid;
          if (close) collapsed.add(id); else collapsed.delete(id);
          s.classList.toggle('collapsed', close);
          s.querySelector('.tt-gr-class-head').setAttribute('aria-expanded', close ? 'false' : 'true');
        }
        TT.lsSet(collapsedKey, [...collapsed]);
        btn.lastChild.textContent = label();
        btn.firstChild.replaceWith(I(close ? 'down' : 'up'));
      } }, I(label() === 'Collapse all' ? 'up' : 'down'), h('span', null, label()));
      main.addEventListener('click', (e) => { if (e.target.closest('.tt-gr-class-head')) setTimeout(() => { btn.lastChild.textContent = label(); btn.firstChild.replaceWith(I(label() === 'Collapse all' ? 'up' : 'down')); }); });
      wrap.append(h('div', { class: 'tt-gr-listbar' }, btn));
    }
    wrap.append(main);

    // Search filters in place, so typing never re-renders under you.
    const applySearch = () => {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      main.querySelectorAll('[data-q]').forEach((n) => { n.hidden = !!words.length && !words.every((w) => n.dataset.q.includes(w)); });
      main.querySelectorAll('.tt-gr-class').forEach((s) => { s.hidden = !!words.length && !s.querySelector('[data-q]:not([hidden])'); });
    };
    search.addEventListener('input', () => { query = search.value; applySearch(); });
    if (query) applySearch();
  };

  // ---- one assessment (Classroom look) ----
  const row = (x, color, teacher) => {
    const sc = realScore(x);
    const lv = assessLevel(x);
    // Right column, like Classroom's "18/20": the score, else the usual level, else the state.
    const grade = !x.shared ? h('span', { class: 'tt-gr-grade muted' }, 'Not released')
      : sc ? h('span', { class: 'tt-gr-grade' }, scoreText(sc))
        : lv ? h('span', { class: 'tt-gr-grade' }, lvSpan(lv))
          : h('span', { class: 'tt-gr-grade muted' }, hasResults(x) ? '' : x.evaluated ? 'Graded' : 'Not graded');
    const lines = [];
    if (x.shared) {
      const parts = [
        ...x.standards.map((s) => h('span', { class: 'tt-gr-item', title: [s.code, s.label].filter(Boolean).join(' ') }, h('span', { class: 'n' }, stdName(s)), ' ', lvSpan(s.level))),
        ...x.rubrics.flatMap((rb) => rb.rows.map((rw) => h('span', { class: 'tt-gr-item', title: `${rw.label}: ${rw.level}${rw.note ? `\n${rw.note}` : ''}` }, h('span', { class: 'n' }, shortLabel(rw.label)), ' ', lvSpan(rubricLv(rw))))),
      ];
      if (parts.length) lines.push(h('div', { class: 'tt-gr-line' }, parts));
      if (x.behaviors.length) {
        lines.push(h('div', { class: 'tt-gr-line' }, h('span', { class: 'tt-gr-line-k' }, 'Learning behaviors'),
          x.behaviors.map((b) => h('span', { class: 'tt-gr-item', title: `${b.label}: ${b.level.label}` }, h('span', { class: 'n' }, b.label), ' ', lvSpan(b.level)))));
      }
    }
    const due = x.deadline ? 'Due ' + TT.fmtDate(x.deadline) : x.createdAt ? 'Posted ' + TT.fmtDate(x.createdAt) : '';
    const q = [x.title, x.courseTitle, TYPE[x.type], ...x.standards.map((s) => `${s.code} ${s.label} ${s.level.abbr} ${s.level.label}`), ...x.behaviors.map((b) => `${b.label} ${b.level.label}`), ...x.comments].join(' ').toLowerCase();
    return h('div', { class: 'tt-gr-row' + (hasResults(x) ? '' : ' pending'), 'data-q': q },
      h('span', { class: 'tt-gc-work-ico', style: { background: hasResults(x) ? color : '#80868b' } }, I(isSumm(x.type) ? 'summative' : 'assignment')),
      h('div', { class: 'tt-gr-body' },
        h('div', { class: 'tt-gr-title-line' },
          gc.link(x.url, { class: 'tt-gr-title' }, x.title),
          grade),
        h('div', { class: 'tt-gr-when' }, [TYPE[x.type], due].filter(Boolean).join(' · ')),
        lines,
        x.shared && x.comments.length ? comment(x, teacher, color) : null));
  };

  // A teacher comment, shown like Classroom's private comments.
  const comment = (x, teacher, color) => {
    const open = openComments.has(x.id);
    const txt = h('div', { class: 'tt-gr-comment-txt' }, x.comments.join('\n\n'));
    const box = h('div', { class: 'tt-gr-comment' + (open ? ' open' : '') },
      teacher ? TT.avatar(teacher, 24, color) : h('span', { class: 'tt-gr-comment-ico' }, I('chat')),
      h('div', null, h('div', { class: 'tt-gr-comment-who' }, teacher ? TT.personName(teacher) : 'Teacher comment'), txt));
    if (x.comments.join(' ').length > 220 || x.comments.length > 1) {
      box.classList.add('long');
      const more = h('button', { class: 'tt-gc-btn text tt-gr-more', 'aria-expanded': open ? 'true' : 'false', onClick: () => {
        const now = !openComments.has(x.id);
        if (now) openComments.add(x.id); else openComments.delete(x.id);
        box.classList.toggle('open', now);
        more.textContent = now ? 'Show less' : 'Show more';
        more.setAttribute('aria-expanded', now ? 'true' : 'false');
      } }, open ? 'Show less' : 'Show more');
      box.lastChild.append(more);
    }
    return box;
  };

  const shortLabel = (s) => { const t = String(s || '').replace(/^\([^)]*\)\s*/, ''); return t.length > 28 ? t.slice(0, 26).trimEnd() + '…' : t; };

  // ---- one class, by standard (Classroom look) ----
  const byStandard = (list) => {
    const out = [];
    const table = (title, pick) => {
      const m = new Map();
      for (const x of list.slice().sort((a, b) => when(a) - when(b))) {
        if (!hasResults(x)) continue;
        for (const s of pick(x)) {
          const k = s.id || s.code || s.label;
          if (!m.has(k)) m.set(k, { s, hits: [] });
          m.get(k).hits.push({ lv: s.level, x });
        }
      }
      if (!m.size) return;
      const rows = [...m.values()].sort((a, b) => (a.s.code || a.s.label).localeCompare(b.s.code || b.s.label, undefined, { numeric: true }));
      out.push(h('div', { class: 'tt-gr-std-head' }, h('span', null, title), h('span', null, 'Oldest to newest'), h('span', null, 'Latest')));
      for (const { s, hits } of rows) {
        const last = hits[hits.length - 1];
        out.push(h('div', { class: 'tt-gr-std', 'data-q': `${s.code} ${s.label} ${hits.map((x) => x.x.title).join(' ')}`.toLowerCase() },
          h('div', { class: 'tt-gr-std-name' }, s.code ? h('b', null, s.code) : null, h('span', { title: s.label }, String(s.label || '').replace(/^\([^)]*\)\s*/, ''))),
          h('div', { class: 'tt-gr-std-hits' }, hits.map((x) => h('span', { title: `${x.x.title}, ${TT.fmtDate(when(x.x))}: ${x.lv.label || x.lv.abbr}` }, lvSpan(x.lv)))),
          h('div', { class: 'tt-gr-std-last' }, lvSpan(last.lv), h('small', null, TT.fmtDate(when(last.x))))));
      }
    };
    table('Standard', (x) => x.standards);
    table('Learning behavior', (x) => x.behaviors);
    if (!out.length) out.push(h('div', { class: 'tt-gr-muted' }, 'No standards graded here yet. Assessments shows scores and comments.'));
    return out;
  };

  // ---------------- PowerSchool-style look (Settings → Grades → Grades look) ----------------
  // Modelled on PowerSchool's student portal. "Grades and Attendance": attendance by class with this
  // week's days, a column per term (hatched where the class doesn't run that term, [ i ] where nothing
  // is graded yet), absences and tardies for this term and the year. Clicking a grade opens the class's
  // "Scores" page: the class line with its expression, the final level, then every assignment with
  // flag icons, score, %, grade and a comment bubble, and the legend underneath. "Standards Grades"
  // is PowerSchool's standards tab.
  const termShort = (t) => String(t.label || '').replace(/^semester\s*/i, 'S').replace(/^quarter\s*/i, 'Q').replace(/^trimester\s*/i, 'T').replace(/^term\s*/i, 'T');
  const DOW = ['M', 'T', 'W', 'H', 'F'];
  // PowerSchool's flag icons: round, coloured, one column each.
  const FLAGS = [
    ['col', 'Collected', 'check', (x) => /^TURNED_IN/.test(x.status || '')],
    ['late', 'Late', 'schedule', (x) => /LATE/.test(x.status || '')],
    ['miss', 'Missing', '!', (x) => x.status === 'OVERDUE'],
    ['exc', 'Not released', 'hide', (x) => !x.shared],
  ];
  const psIcon = (cls, glyph, title) => h('span', { class: 'tt-ps-ico ' + cls, title }, glyph === '!' || glyph === 'check' ? (glyph === 'check' ? '✓' : '!') : I(glyph));
  const lastFirst = (p) => (p ? [p.lastName, p.preferredName || p.firstName].filter(Boolean).join(', ') : '');
  // The Scores page being shown. In Classroom mode it's in the address (&class=…&term=…), so the
  // browser's Back button goes from a class back to Grades and Attendance; in regular Toddle's sheet
  // it's kept here.
  let psOpen = null;
  let psPushed = false; // we opened it from the list, so Back is history.back()
  const psQuery = () => new URLSearchParams((gc.viewUrl ? gc.viewUrl() : location.search).split('?')[1] || '');
  const psInShell = () => !!(gc.active && gc.active()) && psQuery().get('tt') === 'grades';
  const psCur = () => {
    if (!psInShell()) return psOpen;
    const q = psQuery();
    return q.get('class') ? { course: q.get('class'), term: q.get('term') || 'all' } : null;
  };
  const psGo = (o) => {
    if (psInShell()) {
      const u = new URL(location.href);
      if (o) { u.searchParams.set('class', o.course); u.searchParams.set('term', o.term); } else { u.searchParams.delete('class'); u.searchParams.delete('term'); }
      psPushed = !!o;
      gc.go(u.pathname + u.search);
      return;
    }
    psOpen = o;
    gc.refreshView();
    const s = document.querySelector('.tt-sheet-body');
    if (s) s.scrollTop = 0;
  };

  const psView = (wrap, { all, items, terms, term, courses, known, courseSel, v, u, termSel, classSel, typeSel, ungraded, toddleLink }) => {
    const S = TT.school;
    const D = TT.dates;
    const termCols = terms.length ? terms : [{ id: 'all', label: 'Year' }];
    const who = [u.last_name, u.first_name].filter(Boolean).join(', ');
    const graded = all.filter(hasResults);

    // Expression (period and day, like 3(R)) and room from this week's timetable.
    const slots = (S && D && (S.week(new Date()) || S.week(D.addDays(new Date(), -7)))) || [];
    const dayOf = (s) => { const d = String(s.day || '').replace(/\s*day\b.*$/i, '').replace(/\s*\d+$/, '').trim(); return d ? d[0].toUpperCase() : ''; };
    const perOf = (s) => (String(s.period || '').match(/\d+/) || [String(s.period || '').slice(0, 3)])[0] || '';
    // PowerSchool's expression: period, then the days it meets, like 1(A) or 3(A-B).
    const expOf = (id) => {
      const m = new Map();
      for (const s of slots) if (s.courseId === id && perOf(s)) { const p = perOf(s); if (!m.has(p)) m.set(p, new Set()); if (dayOf(s)) m.get(p).add(dayOf(s)); }
      return [...m].sort((a, b) => (parseInt(a[0], 10) || 0) - (parseInt(b[0], 10) || 0))
        .map(([p, ds]) => (ds.size ? `${p}(${[...ds].sort().join('-')})` : p)).join(' ');
    };
    const room = (id) => (slots.find((s) => s.courseId === id && s.room) || {}).room || '';

    const page = h('div', { class: 'tt-ps-page' });
    wrap.append(page);

    // ---- Scores page for one class ----
    const cur0 = psCur();
    if (cur0 && courses.some((c) => c.id === cur0.course)) {
      const c = courses.find((x) => x.id === cur0.course);
      const tid = cur0.term;
      const list = all.filter((x) => x.courseId === c.id && (tid === 'all' || (x.term && x.term.id === tid)) && (v.ungraded || hasResults(x)));
      const t = gc.teachers(c.id)[0];
      const lv = typical(list.filter(hasResults).flatMap((x) => x.standards.map((s) => s.level)));
      const home = TT.api.cachedCourseHome ? TT.api.cachedCourseHome(c.id) : null;
      if (!home && TT.api.getCourseHome) gc.courseData.load('home', c.id, TT.api.getCourseHome); // the class description
      const desc = home && home.description ? TT.sanitize(home.description).textContent.replace(/^\s*course description\s*/i, '').trim() : '';
      const back = h('button', { class: 'tt-ps-a', onClick: () => { if (psInShell() && psPushed) history.back(); else psGo(null); } }, v.mode === 'standards' ? 'Standards Grades' : 'Grades and Attendance');
      const rows = h('tbody');
      for (const x of list) {
        const sc = realScore(x);
        const g = assessLevel(x);
        const open = openComments.has(x.id);
        const cbtn = x.comments.length ? h('button', { class: 'tt-ps-bubble' + (open ? ' on' : ''), title: open ? 'Hide comment' : 'Has comment: show it', 'aria-expanded': open ? 'true' : 'false', onClick: () => {
          const now = !openComments.has(x.id);
          if (now) openComments.add(x.id); else openComments.delete(x.id);
          crow.hidden = !now; cbtn.classList.toggle('on', now); cbtn.setAttribute('aria-expanded', now ? 'true' : 'false');
        } }, I('chat')) : null;
        const crow = h('tr', { class: 'cmt', hidden: open ? null : true }, h('td', { colspan: String(7 + FLAGS.length), class: 'l' }, h('b', null, 'Comment: '), x.comments.join('\n\n')));
        const stds = x.shared ? [
          ...x.standards.map((s) => `${stdName(s)}: ${s.level.abbr}`),
          ...x.rubrics.flatMap((rb) => rb.rows.map((rw) => `${shortLabel(rw.label)}: ${rubricLv(rw).abbr}`)),
          ...x.behaviors.map((b) => `${b.label}: ${b.level.abbr}`),
        ] : [];
        rows.append(h('tr', { class: hasResults(x) ? '' : 'pending' },
          h('td', { class: 'nw' }, x.deadline ? new Date(x.deadline).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''),
          h('td', { class: 'nw' }, isSumm(x.type) ? 'SA' : TYPE_SHORT[x.type] || x.type || ''),
          h('td', { class: 'l' },
            h('span', { class: 'tt-ps-info-i', title: TYPE[x.type] || '' }, 'i'), ' ', x.title,
            stds.length ? h('div', { class: 'tt-ps-stdline' }, stds.join(' · ')) : null),
          FLAGS.map(([cls, title, glyph, test]) => h('td', { class: 'flag' }, test(x) ? psIcon(cls, glyph, title) : null)),
          h('td', { class: 'nw' }, sc ? scoreText(sc) : `--/${'--'}`),
          h('td', { class: 'nw' }, pct(sc) != null ? String(pct(sc)) : ''),
          h('td', { class: 'nw' }, g ? g.abbr : !x.shared ? '' : ''),
          h('td', { class: 'nw' }, cbtn, ' ', gc.link(x.url, { class: 'tt-ps-a' }, 'View'))));
        if (x.comments.length) rows.append(crow);
      }
      const termLabel = tid === 'all' ? 'Whole year' : (terms.find((x) => x.id === tid) || {}).label || '';
      page.append(
        h('div', { class: 'tt-ps-crumb' }, back, ' > Scores'),
        h('h1', null, 'Scores'),
        h('div', { class: 'tt-ps-student' }, who),
        h('div', { class: 'tt-ps-classline' }, c.title, expOf(c.id) ? `  Exp. ${expOf(c.id)}` : '', t ? `  -  ${lastFirst(t)}` : '', `  (${termLabel})`),
        h('table', { class: 'tt-ps-kv' }, h('tbody', null,
          h('tr', null, h('th', null, 'Final Level', h('sup', null, '1'), ':'), h('td', null, lv ? lv.abbr : '--')),
          h('tr', null, h('th', null, 'Graded Assessments:'), h('td', null, String(list.filter(hasResults).length))),
          h('tr', null, h('th', null, 'Teacher Comments:'), h('td', null, '')), // the term comment; assignment comments are in the table
          h('tr', null, h('th', null, 'Section Description:'), h('td', { class: 'desc' }, desc)))),
        h('h2', null, 'Assignments'),
        h('div', { class: 'tt-ps-filters' }, typeSel, ungraded),
        h('table', { class: 'tt-ps-grid tt-ps-scores' },
          h('thead', null, h('tr', null,
            h('th', null, 'Due Date'), h('th', null, 'Category'), h('th', null, 'Assignment'),
            h('th', { colspan: String(FLAGS.length) }, 'Flags'),
            h('th', null, 'Score'), h('th', null, '%'), h('th', null, 'Grade'), h('th', { title: 'Comment' }, I('chat')))),
          list.length ? rows : h('tbody', null, h('tr', null, h('td', { colspan: String(7 + FLAGS.length) }, 'No assignments to show.')))),
        psLegend(true));
      return;
    }

    // ---- Grades and Attendance (or Standards Grades), laid out like SAS's PowerSchool portal ----
    page.append(
      h('h1', null, v.mode === 'standards' ? 'Standards Grades' : 'Grades and Attendance', who ? `: ${who}` : ''),
      h('ul', { class: 'tt-ps-tabs' },
        h('li', { class: v.mode !== 'standards' ? 'on' : '' }, h('button', { onClick: () => setVs({ mode: 'assess' }) }, 'Grades and Attendance')),
        h('li', { class: v.mode === 'standards' ? 'on' : '' }, h('button', { onClick: () => setVs({ mode: 'standards' }) }, 'Standards Grades'))));
    const box = h('div', { class: 'tt-ps-box' });
    page.append(box);
    const open = (cid, tid) => psGo({ course: cid, term: tid });
    const cur = S && S.currentPeriod ? S.currentPeriod() : null;
    const matches = (t) => !!cur && (cur.id === t.id || String(cur.label || '').toLowerCase() === String(t.label || '').toLowerCase());
    // The term we're in: the school's grading period if it's one of these, else the term of your newest work.
    const newest = (all.find((x) => x.term && +new Date(when(x)) <= Date.now()) || all.find((x) => x.term) || {}).term; // `all` is newest first
    const curTerm = termCols.find(matches) || termCols.find((t) => newest && t.id === newest.id) || termCols[termCols.length - 1];
    const isCur = (t) => t === curTerm;
    const foot = h('div', { class: 'tt-ps-foot' },
      h('button', { class: 'tt-ps-a', onClick: () => setVs({ allClasses: !v.allClasses }) }, v.allClasses ? 'Hide classes without assessments' : 'Show classes without assessments also'),
      ' | ', toddleLink);

    if (v.mode === 'standards') { box.append(psStandards({ all, termCols, courses, open, isCur }), foot); return; }

    // Classes in expression order, like PowerSchool: by day, then period.
    const firstSlot = (id) => slots.filter((x) => x.courseId === id)
      .map((x) => ({ p: parseInt((String(x.period || '').match(/\d+/) || ['99'])[0], 10), d: dayOf(x) }))
      .sort((a, b) => a.d.localeCompare(b.d) || a.p - b.p)[0] || { p: 999, d: '~' };
    const list = (v.allClasses ? [...courses, ...known.filter((k) => !courses.some((c) => c.id === k.id))] : courses)
      .filter((c) => courseSel === 'all' || c.id === courseSel)
      .map((c) => ({ c, k: firstSlot(c.id) }))
      .sort((a, b) => (a.k.p === 999) - (b.k.p === 999) || a.k.d.localeCompare(b.k.d) || a.k.p - b.k.p)
      .map((x) => x.c);
    const tb = h('tbody');
    for (const c of list) {
      const mine = all.filter((x) => x.courseId === c.id);
      const t = gc.teachers(c.id)[0];
      const rm = room(c.id);
      tb.append(h('tr', null,
        h('td', { class: 'nw' }, expOf(c.id)),
        h('td', { class: 'l course' },
          h('div', { class: 'tt-ps-cname' }, c.title),
          h('div', null, t ? [
            t.email ? h('a', { class: 'tt-ps-a', href: `mailto:${t.email}` }, h('span', { class: 'tt-ps-mail' }, I('mail')), ' Email ') : null,
            h('span', { class: 'tt-ps-a' }, lastFirst(t))] : null, ` - Rm: ${rm}`)),
        termCols.map((tc) => {
          if (!mine.length) return h('td');
          const inTerm = mine.filter((x) => tc.id === 'all' || (x.term && x.term.id === tc.id));
          if (!inTerm.length) return h('td', { class: 'na', title: 'Not in this class this term' });
          const g = inTerm.filter(hasResults);
          const lv = typical(g.flatMap((x) => x.standards.map((s) => s.level)));
          return h('td', { class: 'grade' }, lv
            ? h('button', { class: 'tt-ps-a', title: `${lv.label}: the middle level of ${g.length} graded assessment${g.length === 1 ? '' : 's'}`, onClick: () => open(c.id, tc.id) }, lv.abbr)
            : h('button', { class: 'tt-ps-a tt-ps-none' + (isCur(tc) ? ' cur' : ''), title: 'Nothing graded yet', onClick: () => open(c.id, tc.id) }, '[ i ]'));
        })));
    }
    box.append(h('table', { class: 'tt-ps-grid tt-ps-main' },
      h('thead', null,
        h('tr', { class: 'cap' }, h('th', { colspan: String(2 + termCols.length) }, 'Attendance By Class')),
        h('tr', null, h('th', { class: 'exp' }, 'Exp'), h('th', null, 'Course'), termCols.map((t) => h('th', { class: 'term', title: t.label }, termShort(t))))),
      tb), foot);
  };

  // PowerSchool's "Standards Grades": Learning Behaviors per term (a column per behavior), then
  // Academic Standards per class with a column per semester.
  // With the old names, PowerSchool writes them out: Meets Expectations, Approaches Expectations.
  const PS_WORDS = { below: 'Below Expectations', approaching: 'Approaches Expectations', meets: 'Meets Expectations' };
  const psWords = (w) => (words() === 'old' && PS_WORDS[String(w).toLowerCase()]) || w;
  const semLabel = (t) => (/^semester\s*/i.test(t.label || '') ? String(t.label).replace(/^semester\s*/i, 'Sem.') : t.label || 'Year');
  const psStandards = ({ all, termCols, courses, open, isCur }) => {
    const box = h('div');
    const graded = all.filter(hasResults);
    const inTerm = (x, t) => t.id === 'all' || (x.term && x.term.id === t.id);
    const word = (hits) => { const lv = typical(hits); return lv ? lv.label || lv.abbr : ''; };
    const nowTerm = (termCols.find(isCur) || termCols[termCols.length - 1]).id;
    box.append(h('p', { class: 'tt-ps-intro' }, 'Please see the current Learning Behaviors grades in the table below, followed by the grades for Academic Standards in each subject. Please click on the subject name to see complete details of the class work during the current term.'));

    // Learning Behaviors
    const lbNames = [...new Set(graded.flatMap((x) => x.behaviors).map((b) => b.label))];
    if (lbNames.length) {
      box.append(h('h2', { class: 'tt-ps-h' }, 'Learning Behaviors'));
      for (const t of termCols) {
        const rows = courses.map((c) => ({ c, xs: graded.filter((x) => x.courseId === c.id && inTerm(x, t) && x.behaviors.length) })).filter((r) => r.xs.length);
        if (!rows.length) continue;
        box.append(h('div', { class: 'tt-ps-panel' }, h('table', { class: 'tt-ps-grid tt-ps-lb' },
          h('thead', null, h('tr', null, h('th', { class: 'courses' }, 'Courses'), h('th', null, 'TERM'), lbNames.map((n) => h('th', null, n.toUpperCase())))),
          h('tbody', null, rows.map(({ c, xs }) => h('tr', null,
            h('td', { class: 'l' }, h('button', { class: 'tt-ps-a tt-ps-it', onClick: () => open(c.id, t.id) }, c.title)),
            h('td', null, termShort(t)),
            lbNames.map((n) => h('td', null, word(xs.flatMap((x) => x.behaviors.filter((b) => b.label === n).map((b) => b.level)))))))))));
      }
    }

    // Academic Standards
    const blocks = [];
    for (const c of courses) {
      const m = new Map();
      for (const x of graded) if (x.courseId === c.id) for (const s of x.standards) {
        const k = s.id || s.code || s.label;
        if (!m.has(k)) m.set(k, { s, hits: [] });
        m.get(k).hits.push({ lv: s.level, x });
      }
      if (!m.size) continue;
      const rows = [...m.values()].sort((a, b) => (a.s.code || a.s.label || '').localeCompare(b.s.code || b.s.label || '', undefined, { numeric: true }));
      blocks.push(h('tbody', { class: 'cls' },
        h('tr', { class: 'chead' },
          h('td', { colspan: '2', class: 'l' }, h('button', { class: 'tt-ps-cls', onClick: () => open(c.id, nowTerm) }, c.title)),
          termCols.map((t) => h('td', { class: 'sem' }, semLabel(t)))),
        rows.map(({ s, hits }) => {
          const label = String(s.label || '').replace(/^\([^)]*\)\s*/, '');
          return h('tr', null,
            h('td', { class: 'l std' }, s.code || label || 'Standard'),
            h('td', { class: 'l desc' }, s.code ? label : ''),
            termCols.map((t) => h('td', { class: 'lvw' }, psWords(word(hits.filter((y) => inTerm(y.x, t)).map((y) => y.lv))))));
        })));
    }
    if (blocks.length) box.append(h('h2', { class: 'tt-ps-h' }, 'Academic Standards'), h('div', { class: 'tt-ps-panel' }, h('table', { class: 'tt-ps-std' }, blocks)));
    if (!lbNames.length && !blocks.length) box.append(h('p', null, 'No standards graded yet.'));
    return box;
  };

  const psLegend = (scores) => h('div', { class: 'tt-ps-legend' },
    h('h3', null, 'Legend'),
    scores ? h('p', null, '1 - The final level is the middle level of this term’s graded standards, worked out by Toddle Tweaks; your report card can differ.') : null,
    h('p', { class: 'icons' }, h('b', null, 'Icons '),
      [h('span', null, h('span', { class: 'tt-ps-info-i' }, 'i'), ' - Assignment Type'), h('span', null, h('span', { class: 'tt-ps-bubble' }, I('chat')), ' - Has Comment'),
        ...FLAGS.map(([cls, title, glyph]) => h('span', null, psIcon(cls, glyph, title), ` - ${title}`))]
        .flatMap((x, i) => (i ? [' | ', x] : [x]))));

  // ---------------- regular Toddle: a way in from Toddle's gradebook ----------------
  // Classroom mode replaces the gradebook outright; regular Toddle keeps it and gets a button that
  // opens every grade on one page over it (Settings → Grades → "Grades button on Toddle's gradebook").
  const syncButton = () => {
    const want = !(gc.active && gc.active()) && /\/student-progress-summary\//.test(location.pathname)
      && TT.gradesOn() && TT.settings.gradesButton !== false && !!document.body;
    let b = document.getElementById('tt-gr-open');
    if (!want) { if (b) b.remove(); return; }
    if (b) return;
    b = h('button', { id: 'tt-gr-open', class: 'tt-gr-open', type: 'button', onClick: () => TT.openView && TT.openView('grades') }, I('grade'), 'All grades on one page');
    document.body.append(b);
  };
  TT.waitFor('body', 20000).then(() => { syncButton(); TT.onRoute(syncButton); window.addEventListener('tt:settings', syncButton); });
})();
