/* Promo studio: runs the real Toddle Tweaks UI with made-up data so store images show no real people. */
(() => {
  const scene = new URLSearchParams(location.search).get('scene') || 'home';
  const DAY = 864e5;
  const now = Date.now();
  const at = (days, h = 23, m = 59) => { const d = new Date(now + days * DAY); d.setHours(h, m, 0, 0); return d.getTime(); };

  // ---------- fake people (illustrated avatars, nobody real) ----------
  const face = (bg, skin, hair) => 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' fill='${bg}'/>`
    + `<circle cx='40' cy='34' r='16' fill='${skin}'/><path d='M22 32c0-12 8-19 18-19s18 7 18 19c-4-6-10-9-18-9s-14 3-18 9z' fill='${hair}'/>`
    + `<path d='M12 80c2-16 14-24 28-24s26 8 28 24z' fill='${skin}' opacity='.9'/></svg>`);
  const T = {
    rivera: { id: 't1', firstName: 'Elena', lastName: 'Rivera', profileImage: face('#c8e6c9', '#e0ac69', '#3b2416') },
    patel: { id: 't2', firstName: 'Arjun', lastName: 'Patel', profileImage: face('#bbdefb', '#c68642', '#1b1b1b') },
    chen: { id: 't3', firstName: 'Wei', lastName: 'Chen', profileImage: face('#ffe0b2', '#f1c27d', '#222') },
    okafor: { id: 't4', firstName: 'Grace', lastName: 'Okafor', profileImage: face('#e1bee7', '#8d5524', '#111') },
    novak: { id: 't5', firstName: 'Tom', lastName: 'Novak', profileImage: face('#b2dfdb', '#ffdbac', '#a0522d') },
    garcia: { id: 't6', firstName: 'Lucía', lastName: 'García', profileImage: face('#f8bbd0', '#e0ac69', '#4a2c17') },
    brooks: { id: 't7', firstName: 'Sam', lastName: 'Brooks', profileImage: face('#cfd8dc', '#ffdbac', '#d4a017') },
    lee: { id: 't8', firstName: 'Hana', lastName: 'Lee', profileImage: face('#fff9c4', '#f1c27d', '#2b1d14') },
  };
  const courses = [
    { id: 'c1', title: 'Biology', t: T.rivera },
    { id: 'c2', title: 'Algebra II', t: T.patel },
    { id: 'c3', title: 'World History', t: T.okafor },
    { id: 'c4', title: 'English 10', t: T.novak },
    { id: 'c5', title: 'Chemistry', t: T.chen },
    { id: 'c6', title: 'Spanish III', t: T.garcia },
    { id: 'c7', title: 'Computer Science', t: T.brooks },
    { id: 'c8', title: 'Art & Design', t: T.lee },
  ];

  // ---------- fake assignments ----------
  let n = 0;
  const task = (c, title, deadline, o = {}) => ({
    id: 's' + (++n), assignmentId: 'a' + n, submissionId: 'b' + n, courseId: c.id, courseTitle: c.title, title,
    type: o.test ? 'SA' : 'le', kind: o.kind || null, isTest: !!o.kind, deadline, publishedAt: o.posted || deadline - 6 * DAY,
    status: o.done ? 'TURNED_IN' : o.late ? 'OVERDUE' : o.nr ? 'SUBMISSION_NOT_REQUIRED' : 'SUBMISSION_PENDING',
    needsSubmission: !o.nr, isSubmitted: !!o.done, isEvaluated: !!o.graded, isNew: !!o.isNew, toddleDone: !!o.done,
    url: `/platform/1/courses/${c.id}/classroom/classroom-details/a${n}/s${n}`,
    unitTitle: o.unit || '', unitId: o.unit ? 'u-' + o.unit : null, description: o.desc || '', by: { name: `${c.t.firstName} ${c.t.lastName}` },
  });
  const [bio, alg, hist, eng, chem, span, cs, art] = courses;
  const items = [
    task(eng, 'Persuasive essay: final draft', at(-2, 23, 59), { late: true }),
    task(bio, 'Cell structure lab report', at(0, 23, 30), { isNew: true, unit: 'Unit 3: Cells', desc: '<p>Write up your observations from Tuesday\'s microscope lab. Include labelled diagrams of both cell types.</p>' }),
    task(alg, 'Problem set 4.2', at(0, 23, 59), { unit: 'Unit 4: Exponentials' }),
    task(hist, 'Primary source analysis', at(1, 17, 0), { unit: 'Unit 2: Revolutions' }),
    task(chem, 'Stoichiometry quiz', at(1, 8, 30), { kind: 'Quiz', nr: true, test: true }),
    task(span, 'Vocabulario: capítulo 5', at(3, 23, 59)),
    task(cs, 'Classes & objects lab', at(4, 23, 30), { unit: 'Unit 3: Objects' }),
    task(art, 'Portfolio piece #3', at(5, 16, 0)),
    task(alg, 'Unit 4 test', at(8, 9, 0), { kind: 'Test', nr: true, test: true, unit: 'Unit 4: Exponentials' }),
    task(bio, 'Unit 3 summative', at(12, 9, 0), { kind: 'Summative', test: true, unit: 'Unit 3: Cells' }),
    task(eng, 'Reading journal week 9', at(9, 23, 59)),
    task(hist, 'Debate preparation notes', null),
    task(bio, 'Photosynthesis reading questions', at(-1, 23, 59), { late: true, unit: 'Unit 3: Cells' }),
    task(bio, 'Mitosis flipbook', at(4, 15, 0), { unit: 'Unit 3: Cells' }),
    task(bio, 'Cell organelles quiz', at(6, 9, 0), { kind: 'Quiz', test: true, nr: true, unit: 'Unit 3: Cells' }),
    task(bio, 'Microscope worksheet', at(-6, 15, 0), { done: true, graded: true, unit: 'Unit 3: Cells' }),
    task(bio, 'Osmosis demo questions', at(-9, 15, 0), { done: true, unit: 'Unit 3: Cells' }),
    task(bio, 'Unit 2 test review', at(-20, 9, 0), { nr: true, unit: 'Unit 2: Biochemistry' }),
    task(bio, 'Enzymes practical', at(-24, 15, 0), { done: true, graded: true, unit: 'Unit 2: Biochemistry' }),
    task(chem, 'Moles practice', at(-3, 23, 59), { done: true }),
    task(alg, 'Problem set 4.1', at(-5, 23, 59), { done: true, graded: true, unit: 'Unit 4: Exponentials' }),
  ];

  // ---------- environment the real code expects ----------
  localStorage.clear();
  localStorage.setItem('userInfo', JSON.stringify({ id: 'me', jwt: 'demo', first_name: 'Alex', last_name: 'Kim', email: 'alex.kim@school.edu', org_name: 'Riverside High School', profile_image: face('#d2e3fc', '#f1c27d', '#3e2723') }));
  localStorage.setItem('currentCurriculumProgram', JSON.stringify({ id: '1' }));
  localStorage.setItem('tt:notifN', JSON.stringify('3'));
  localStorage.setItem('tt:tourDone', JSON.stringify('done'));
  localStorage.setItem('tt:gc', JSON.stringify({ drawerOpen: true }));
  localStorage.setItem('tt:todoView', JSON.stringify({ tab: 'todo', sort: 'smart', course: 'all' }));
  localStorage.setItem('tt:cwView', JSON.stringify({ sort: 'smart', show: 'all' }));
  localStorage.setItem('tt:cwCollapsed:c1', JSON.stringify([]));
  localStorage.setItem('tt:collapsed', JSON.stringify({}));

  const TT = window.TT;
  TT.settings = { ...TT.DEFAULTS, classroomMode: true, googleBanners: true, gcCardInfo: true };
  const data = { t: now, items };
  const teachers = Object.fromEntries(courses.map((c) => [c.id, [c.t]]));
  const anns = [
    { id: 'n1', title: 'Field trip forms due Friday', description: '<p>Hi everyone! Please bring your signed forms for next week\'s visit to the science museum. We\'ll leave right after lunch.</p>', publishedAt: new Date(now - DAY).toISOString(), isRead: false, createdBy: T.rivera },
    { id: 'n2', title: 'Lab safety reminder', description: '<p>Goggles on whenever we use the burners. Thanks for being careful!</p>', publishedAt: new Date(now - 5 * DAY).toISOString(), isRead: true, createdBy: T.rivera },
  ];
  const students = ['Maya Johnson', 'Liam Smith', 'Sofia Martinez', 'Noah Williams', 'Ava Brown', 'Ethan Davis', 'Zoe Wilson', 'Lucas Moore']
    .map((nm, i) => ({ id: 'p' + i, firstName: nm.split(' ')[0], lastName: nm.split(' ')[1] }));
  TT.api = {
    user: () => JSON.parse(localStorage.userInfo), hasFilters: () => true, canMarkDone: () => true,
    cachedTasks: () => data, getTasks: async () => data,
    cachedCourses: () => ({ t: now, courses: courses.map(({ id, title }) => ({ id, title })) }), getCourses: async () => courses,
    cachedTeachers: () => ({ t: now, map: teachers }), getTeachers: async () => teachers,
    cachedCourseWork: (id) => ({ t: now, list: items.filter((x) => x.courseId === id) }), getCourseWork: async () => [],
    cachedAnnouncements: () => ({ t: now, list: anns }), getAnnouncements: async () => anns,
    cachedPeople: () => ({ t: now, teachers: [T.rivera], students }), getPeople: async () => ({}),
  };
  window.__TT_DEMO = { scene, courses };
})();
