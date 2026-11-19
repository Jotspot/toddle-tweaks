/* Toddle Tweaks — minimal client for Toddle's GraphQL API (uses your existing session). */
(() => {
  const TT = window.TT;

  const user = () => TT.lsGet('userInfo', {}) || {};
  const endpoint = () => {
    const saved = TT.lsGet('tt:gqlUrl', null);
    if (saved) return saved;
    const region = user().orgRegion || 'ap-southeast-1';
    return `https://${region}-production-apis.toddleapp.com/graphql`;
  };

  const gql = async (query, variables, operationName) => {
    const u = user();
    if (!u.jwt) throw new Error('Not signed in to Toddle');
    const res = await fetch(endpoint(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + u.jwt,
        'x-tod-source': 'WEB',
        'x-tod-lang': 'en',
      },
      body: JSON.stringify({ operationName, query, variables }),
    });
    const j = await res.json();
    if (j.errors && !j.data) throw new Error(j.errors[0].message);
    return j.data;
  };

  const TASKS_Q = `query ttTasks($userId: ID!, $filters: TaskFilter, $first: Int, $after: String) {
  node(id: $userId, type: STUDENT) { id ... on Student {
    tasks(filters: $filters, first: $first, after: $after) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { id orderDate itemType item { id ... on StudentAssignment {
        status isSubmitted isEvaluated isNewForStudent
        submission { id statusV2 }
        assignment { id contentType deadline closeSubmissionDate isStudentSubmissionEnabled
          state { publishedAt }
          course { id title }
          content { id ... on Assessment { title { value } assessmentType { value } } }
        } } } }
    } } } }`;

  const COURSES_Q = `query ttCourses($userId: ID!, $courseFilters: CourseFilter, $courseGradeFilters: CourseGradeFilters) {
  node(id: $userId, type: STUDENT) { id ... on Student {
    courses(orderBy: TITLE, orderByDirection: ASC, filters: $courseFilters) {
      id title profileImage
      profileImageData { url icon color acronym }
      primaryGrade(filters: $courseGradeFilters) { id name }
      learningCourse { id title }
    } } } }`;

  const TYPE_LABELS = {
    le: 'Learning experience', SA: 'Summative', FA: 'Formative', qt: 'Quick task', worksheet: 'Worksheet',
    smt: 'Summative', fmt: 'Formative',
  };

  const normalize = (edge, cp) => {
    const it = edge.item || {};
    const a = it.assignment;
    if (!a) return null;
    const type = (a.content && a.content.assessmentType && a.content.assessmentType.value) || a.contentType || '';
    const courseId = a.course && a.course.id;
    const title = (a.content && a.content.title && a.content.title.value) || 'Untitled';
    const kind = /\bquiz\b/i.test(title) ? 'Quiz'
      : /\b(test|exam|midterm|final exam)\b/i.test(title) ? 'Test'
        : /^(SA|smt)$/i.test(type) ? 'Summative' : null;
    const publishedAt = a.state && a.state.publishedAt ? Date.parse(a.state.publishedAt) : null;
    return {
      id: it.id,
      assignmentId: a.id,
      submissionId: it.submission && it.submission.id,
      courseId,
      courseTitle: (a.course && a.course.title) || '',
      title,
      type,
      typeLabel: TYPE_LABELS[type] || (a.contentType || '').toLowerCase(),
      kind,                 // 'Quiz' | 'Test' | 'Summative' | null
      isTest: !!kind,
      deadline: a.deadline ? Date.parse(a.deadline) : null,
      closeAt: a.closeSubmissionDate ? Date.parse(a.closeSubmissionDate) : null,
      publishedAt,
      status: it.status,
      submissionStatus: it.submission && it.submission.statusV2,
      needsSubmission: !!a.isStudentSubmissionEnabled && it.status !== 'SUBMISSION_NOT_REQUIRED',
      isSubmitted: !!it.isSubmitted,
      isEvaluated: !!it.isEvaluated,
      // Toddle's isNewForStudent stays true forever on items you never opened; only trust it for recent posts.
      isNew: !!it.isNewForStudent && !!publishedAt && Date.now() - publishedAt < 3 * 864e5,
      url: `/platform/${cp}/courses/${courseId}/classroom/classroom-details/${a.id}/${it.id}`,
    };
  };

  const fetchAllTasks = async (filters) => {
    const u = user();
    const out = [];
    let after = null;
    for (let page = 0; page < 10; page++) {
      const d = await gql(TASKS_Q, { userId: u.id, filters, first: 100, after }, 'ttTasks');
      const t = d && d.node && d.node.tasks;
      if (!t) break;
      out.push(...t.edges);
      if (!t.pageInfo.hasNextPage) break;
      after = t.pageInfo.endCursor;
    }
    return out;
  };

  TT.api = {
    gql,
    user,
    hasFilters: () => !!TT.lsGet('tt:taskFilters', null),

    async getTasks() {
      const base = TT.lsGet('tt:taskFilters', null);
      if (!base) throw new Error('NEED_HOME_VISIT');
      const { savedAt, ...filters } = base;
      // Always ask for every class you're in (repairs filters saved from a single-class page).
      const known = (TT.lsGet('tt:coursesCache', null) || {}).courses;
      if (known && known.length) filters.courseIds = known.map((c) => c.id);
      const cp = TT.cpId() || (filters.curriculumProgramIds && filters.curriculumProgramIds[0]);
      const [todo, done] = await Promise.all([
        fetchAllTasks({ ...filters, completionStatus: 'TODO' }),
        fetchAllTasks({ ...filters, completionStatus: 'COMPLETED' }),
      ]);
      const items = [
        ...todo.map((e) => normalize(e, cp)).filter(Boolean).map((x) => ({ ...x, toddleDone: false })),
        ...done.map((e) => normalize(e, cp)).filter(Boolean).map((x) => ({ ...x, toddleDone: true })),
      ];
      const payload = { t: Date.now(), items };
      TT.lsSet('tt:todoCache', payload);
      try { chrome.storage.local.set({ todo: payload, cp }); } catch {}
      return payload;
    },

    cachedTasks: () => TT.lsGet('tt:todoCache', null),

    async getCourses() {
      const cv = TT.lsGet('tt:courseVars', null);
      const tf = TT.lsGet('tt:taskFilters', null);
      const u = user();
      const academicYear = (cv && cv.courseFilters && cv.courseFilters.academicYear) || (tf && tf.academicYearId);
      const cps = (cv && cv.courseFilters && cv.courseFilters.curriculumProgramIds) || (tf && tf.curriculumProgramIds) || [TT.cpId()];
      const vars = {
        userId: u.id,
        courseFilters: { archivalState: 'ACTIVE', curriculumProgramIds: cps, ...(academicYear ? { academicYear } : {}) },
        courseGradeFilters: academicYear ? { academicYearId: academicYear } : {},
      };
      const d = await gql(COURSES_Q, vars, 'ttCourses');
      const courses = (d && d.node && d.node.courses) || [];
      TT.lsSet('tt:coursesCache', { t: Date.now(), courses });
      return courses;
    },

    cachedCourses: () => TT.lsGet('tt:coursesCache', null),

    // Teachers for many courses in one request (aliased). Used for card avatars + names.
    async getTeachers(courseIds) {
      if (!courseIds.length) return {};
      const parts = courseIds.map((id, i) => `c${i}: node(id: "${String(id).replace(/\D/g, '')}", type: COURSE) { id ... on Course {
        allCollaborators { edges { node { id firstName lastName preferredName prefix profileImage } } } } }`);
      const d = await gql(`query ttTeachers { ${parts.join('\n')} }`, {}, 'ttTeachers');
      const out = {};
      courseIds.forEach((id, i) => {
        const n = d && d[`c${i}`];
        out[id] = ((n && n.allCollaborators && n.allCollaborators.edges) || []).map((e) => e.node);
      });
      TT.lsSet('tt:teachers', { t: Date.now(), map: out });
      return out;
    },
    cachedTeachers: () => TT.lsGet('tt:teachers', null),

    async getPeople(courseId) {
      const d = await gql(`query ttPeople($id: ID!) { node(id: $id, type: COURSE) { id ... on Course {
        allCollaborators { edges { node { id firstName lastName preferredName prefix profileImage } } }
        students { edges { node { id firstName lastName preferredName profileImage } } } } } }`, { id: courseId }, 'ttPeople');
      const n = (d && d.node) || {};
      const res = {
        teachers: ((n.allCollaborators && n.allCollaborators.edges) || []).map((e) => e.node),
        students: ((n.students && n.students.edges) || []).map((e) => e.node),
      };
      TT.lsSet('tt:people:' + courseId, { t: Date.now(), ...res });
      return res;
    },
    cachedPeople: (courseId) => TT.lsGet('tt:people:' + courseId, null),

    async getAnnouncements(courseId) {
      const u = user();
      const tf = TT.lsGet('tt:taskFilters', {}) || {};
      const d = await gql(`query ttAnn($org: ID!, $ay: ID!, $courseIds: [ID!]) { node(id: $org, type: ORGANIZATION) { id ... on Organization {
        circularFeedV3(input: { first: 30, orderBy: PUBLISHED_AT, orderByDirection: DESC, states: [PUBLISHED], createdBy: OTHERS, academicYearId: $ay, createdIn: CLASS, courseIds: $courseIds }) {
          edges { node { id title description publishedAt isRead createdBy { id firstName lastName ... on Staff { profileImage } } } } } } } }`,
      { org: u.org_id, ay: tf.academicYearId, courseIds: [courseId] }, 'ttAnn');
      const list = ((d && d.node && d.node.circularFeedV3 && d.node.circularFeedV3.edges) || []).map((e) => e.node);
      TT.lsSet('tt:ann:' + courseId, { t: Date.now(), list });
      return list;
    },
    cachedAnnouncements: (courseId) => TT.lsGet('tt:ann:' + courseId, null),

    // Everything assigned in one class, with unit (= Classroom "topic"), instructions and poster.
    async getCourseWork(courseId) {
      const base = TT.lsGet('tt:taskFilters', null);
      if (!base) throw new Error('NEED_HOME_VISIT');
      const { savedAt, ...filters } = base;
      const cp = TT.cpId() || (filters.curriculumProgramIds && filters.curriculumProgramIds[0]);
      const Q = TASKS_Q.replace('query ttTasks', 'query ttCourseWork').replace('content { id ... on Assessment { title { value } assessmentType { value } } }',
        `content { id ... on Assessment { title { value } assessmentType { value } description { value } unitPlan { id title { value } } } }
          createdBy { id firstName lastName profileImage }`);
      const fetchAll = async (f) => {
        const out = [];
        let after = null;
        for (let page = 0; page < 10; page++) {
          const d = await gql(Q, { userId: user().id, filters: f, first: 100, after }, 'ttCourseWork');
          const t = d && d.node && d.node.tasks;
          if (!t) break;
          out.push(...t.edges);
          if (!t.pageInfo.hasNextPage) break;
          after = t.pageInfo.endCursor;
        }
        return out;
      };
      const f = { ...filters, courseIds: [courseId] }; // eslint-disable-line
      const [todo, done] = await Promise.all([fetchAll({ ...f, completionStatus: 'TODO' }), fetchAll({ ...f, completionStatus: 'COMPLETED' })]);
      const enrich = (e, isDone) => {
        const x = normalize(e, cp);
        if (!x) return null;
        const c = e.item.assignment.content || {};
        const by = e.item.assignment.createdBy;
        return {
          ...x,
          toddleDone: isDone,
          description: (c.description && c.description.value) || '',
          unitId: c.unitPlan && c.unitPlan.id,
          unitTitle: (c.unitPlan && c.unitPlan.title && c.unitPlan.title.value) || '',
          by: by ? { id: by.id, name: [by.firstName, by.lastName].filter(Boolean).join(' '), img: by.profileImage } : null,
        };
      };
      const list = [...todo.map((e) => enrich(e, false)), ...done.map((e) => enrich(e, true))].filter(Boolean);
      try { TT.lsSet('tt:cw:' + courseId, { t: Date.now(), list }); } catch {}
      return list;
    },
    cachedCourseWork: (courseId) => TT.lsGet('tt:cw:' + courseId, null),

    canMarkDone: () => true,

    // Same call Toddle's own "Mark as done" button makes (verified against it), minus the
    // `response` field — so it can never overwrite anything you've written.
    // Only ever used on items that don't take a submission.
    async markDone(item) {
      if (!item || !item.submissionId) throw new Error('No submission id');
      if (item.needsSubmission) throw new Error('Refusing: this item takes a real submission');
      const d = await gql(`mutation ttMarkDone($id: ID!) { platform {
        editStudentAssignmentSubmission(input: { id: $id, status: SUBMITTED, checkForSimilarity: false, isWorksheet: false }) { id status } } }`,
      { id: item.submissionId }, 'ttMarkDone');
      return d;
    },
  };
})();
