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
      contentId: a.content && a.content.id, // matches course-plan assessment items
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

  // ---------------- grades ----------------
  const GRADES_Q = `query ttGrades($studentId: ID!, $first: Int, $after: String, $filters: StudentAssignmentFeedFilters) {
  node(id: $studentId, type: STUDENT) { id ... on Student {
    assignments(first: $first, after: $after, filters: $filters, orderBy: PUBLISHED_AT, orderByDirection: DESC) {
      pageInfo { hasNextPage endCursor }
      edges { node { id isEvaluated isSharedWithStudent
        submission { id statusV2 }
        toolResponses: toolResponsesV2(filters: { userFilter: ALL }) { toolId toolType toolResponses { rowId columnId subjectiveResponse creatorType isDeleted } }
        ibPYPElementRatings { creatorType value ibPYPElementId ibPYPElementType isDeleted
          academicCriteriaSet { id label } academicCriteriaValue { id label abbreviation color displaySequence } }
        elementRemarks(filters: { creatorTypes: [STAFF] }) { message ibPYPElementType }
        assignment { id deadline createdAt course { id title }
          content { id ... on Assessment { title { value } assessmentType { value } academicTerm { id label } category { label }
            assessmentTools { edges { node { assessmentToolType assessmentToolItem { id
              ... on ScoreAssessmentTool { scoreToolData { maxScore } }
              ... on StandardRubric { associateScoreTool { scoreToolData { maxScore } } } } } } }
            fields(uids: ["atlsUBD", "learningStandardUBD"]) { uid resolvedMinimalTree { ... on ResolvedFieldPlannerElementSet { nodes { id label code } } } } } } } } }
    } } } }`;
  const TOOL_ENTITY = { RUBRIC: 'RUBRIC', CHECKLIST: 'CHECKLIST', STANDARD_BASED_RUBRIC: 'STANDARD_RUBRIC' };
  const TOOL_FIELDS = {
    RUBRIC: '... on Rubric { title criterias { id label displaySequence } indicators { id label displaySequence } }',
    CHECKLIST: '... on Checklist { title checklistItems { id label displaySequence } checklistOptionItems { id label displaySequence } }',
    STANDARD_BASED_RUBRIC: `... on StandardRubric { standardRubricCriterias { id label displaySequence standard { id label code }
      descriptors: standardRubricDescriptors { id label displaySequence gradeScaleValue { label abbreviation } } } }`,
  };
  const bySeq = (a, b) => (a.displaySequence || 0) - (b.displaySequence || 0);
  // Compact definition: rows (what's assessed) and cols (levels/options), each { label, abbr?, seq }.
  const toolDef = (type, n) => {
    const rows = {}, cols = {};
    if (type === 'RUBRIC') {
      (n.indicators || []).slice().sort(bySeq).forEach((x, i) => { rows[x.id] = { label: x.label, seq: i }; });
      const c = (n.criterias || []).slice().sort(bySeq);
      c.forEach((x, i) => { cols[x.id] = { label: x.label, seq: i, of: c.length }; });
      return { type, title: n.title || '', rows, cols };
    }
    if (type === 'CHECKLIST') {
      (n.checklistItems || []).slice().sort(bySeq).forEach((x, i) => { rows[x.id] = { label: x.label, seq: i }; });
      const c = (n.checklistOptionItems || []).slice().sort(bySeq);
      c.forEach((x, i) => { cols[x.id] = { label: x.label, seq: i, of: c.length }; });
      return { type, title: n.title || '', rows, cols };
    }
    (n.standardRubricCriterias || []).slice().sort(bySeq).forEach((x, i) => {
      rows[x.id] = { label: (x.standard && x.standard.label) || x.label || '', code: x.standard && x.standard.code, standardId: x.standard && x.standard.id, seq: i };
      const ds = (x.descriptors || []).slice().sort(bySeq);
      ds.forEach((d, j) => { cols[d.id] = { label: (d.gradeScaleValue && d.gradeScaleValue.label) || d.label || '', abbr: d.gradeScaleValue && d.gradeScaleValue.abbreviation, seq: j, of: ds.length }; });
    });
    return { type, title: '', rows, cols };
  };
  const strip = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizeGrade = (n, defs, cp) => {
    const a = n.assignment;
    const c = a.content || {};
    const tools = ((c.assessmentTools && c.assessmentTools.edges) || []).map((e) => e.node);
    const names = {};
    for (const f of c.fields || []) for (const x of (f.resolvedMinimalTree && f.resolvedMinimalTree.nodes) || []) names[x.id] = { label: x.label || '', code: x.code || '' };
    const lvl = (v) => v && { label: v.label || '', abbr: v.abbreviation || v.label || '', color: v.color || '', seq: v.displaySequence };
    const standards = [], behaviors = [];
    let score = null;
    for (const r of n.ibPYPElementRatings || []) {
      if (r.isDeleted || (r.creatorType && r.creatorType !== 'STAFF')) continue;
      if (r.ibPYPElementType === 'SCORE') { if (r.value != null && r.value !== '') score = { value: r.value, max: null }; continue; }
      if (!r.academicCriteriaValue) continue;
      const nm = names[r.ibPYPElementId] || {};
      const row = { id: r.ibPYPElementId, label: nm.label || '', code: nm.code || '', set: (r.academicCriteriaSet && r.academicCriteriaSet.label) || '', level: lvl(r.academicCriteriaValue) };
      if (/ATL|BEHAV/i.test(r.ibPYPElementType || '') || /behavio/i.test(row.set)) behaviors.push(row); else standards.push(row);
    }
    for (const t of tools) {
      const it = t.assessmentToolItem || {};
      const sd = it.scoreToolData || (it.associateScoreTool && it.associateScoreTool.scoreToolData);
      if (sd && sd.maxScore != null && score) score.max = sd.maxScore;
    }
    // Rubric / checklist rows, plus any standard-based rubric rows the ratings didn't already cover.
    const rubrics = [];
    const comments = [];
    for (const r of n.toolResponses || []) {
      const resp = (r.toolResponses || []).filter((x) => !x.isDeleted && (!x.creatorType || x.creatorType === 'STAFF'));
      if (!resp.length) continue;
      if (r.toolType === 'COMMENT') { resp.forEach((x) => { const m = strip(x.subjectiveResponse); if (m) comments.push(m); }); continue; }
      const def = defs[r.toolId];
      if (!def) continue;
      if (r.toolType === 'STANDARD_BASED_RUBRIC') {
        for (const x of resp) {
          const row = def.rows[x.rowId], col = def.cols[x.columnId];
          if (!row || !col || standards.some((s) => s.id === row.standardId)) continue;
          standards.push({ id: row.standardId || x.rowId, label: row.label, code: row.code || '', set: '', level: { label: col.label, abbr: col.abbr || col.label, seq: col.seq, of: col.of } });
        }
        continue;
      }
      const rows = resp.map((x) => ({ row: def.rows[x.rowId], col: def.cols[x.columnId], note: strip(x.subjectiveResponse) }))
        .filter((x) => x.row && x.col).sort((p, q) => p.row.seq - q.row.seq)
        .map((x) => ({ label: x.row.label, level: x.col.label, seq: x.col.seq, of: x.col.of, note: x.note }));
      if (rows.length) rubrics.push({ type: r.toolType, title: def.title, rows });
    }
    for (const m of n.elementRemarks || []) { const s = strip(m.message); if (s && !comments.includes(s)) comments.push(s); }
    const courseId = a.course && a.course.id;
    return {
      id: n.id,
      courseId,
      courseTitle: (a.course && a.course.title) || '',
      title: (c.title && c.title.value) || 'Untitled',
      type: (c.assessmentType && c.assessmentType.value) || '',
      category: (c.category && c.category.label) || '',
      term: c.academicTerm ? { id: c.academicTerm.id, label: c.academicTerm.label } : null,
      deadline: a.deadline ? Date.parse(a.deadline) : null,
      createdAt: a.createdAt ? Date.parse(String(a.createdAt).replace(' ', 'T') + (/[zZ+]/.test(a.createdAt) ? '' : 'Z')) : null,
      shared: n.isSharedWithStudent !== false,
      evaluated: !!n.isEvaluated,
      status: n.submission && n.submission.statusV2,
      standards, behaviors, score, rubrics, comments,
      url: `/platform/${cp}/courses/${courseId}/classroom/classroom-details/${a.id}/${n.id}`,
    };
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
        allCollaborators { edges { node { id firstName lastName preferredName prefix profileImage email } } } } }`);
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

    // The whole course plan in one request: units, folders, links/files (with URLs) and assessments,
    // as a flat list in display order (each node has depth + parent).
    async getCoursePlan(courseId) {
      const d = await gql(`query ttCoursePlan($id: ID!, $filters: LearningCourseFlowFilter) { node(id: $id, type: COURSE) { id ... on Course {
        classFlowFeedWrapper { learningCourseFlowFeed(first: 10000, filters: $filters) { edges { node { id label depth resourceType: itemType parent { id }
          item { id ... on Attachment { name url type mimeType thumbUrl } ... on Assessment { assessmentType { value } } ... on UnitPlan { startDate endDate } } } } } } } } }`,
      { id: courseId, filters: { searchText: '', unitTypes: [], sharedWith: [], itemTypes: ['FOLDER', 'ASSESSMENT', 'UNIT_PLAN', 'FILE'], classIds: [courseId], subjects: [],
        assessmentFilters: { assessmentType: [], groupTypes: [], studentAssignmentStatus: [] }, attachmentTypes: [], createdBy: [], shouldShowSharedItemsOnly: false } }, 'ttCoursePlan');
      const edges = (d && d.node && d.node.classFlowFeedWrapper && d.node.classFlowFeedWrapper.learningCourseFlowFeed && d.node.classFlowFeedWrapper.learningCourseFlowFeed.edges) || [];
      const nodes = edges.map(({ node: n }) => ({
        id: n.id, label: n.label || 'Untitled', depth: n.depth || 1, type: n.resourceType, parent: n.parent && n.parent.id,
        itemId: n.item && n.item.id,
        url: n.item && n.item.url, fileType: n.item && n.item.type, mime: n.item && n.item.mimeType, thumb: n.item && n.item.thumbUrl,
        aType: n.item && n.item.assessmentType && n.item.assessmentType.value,
        start: n.item && n.item.startDate, end: n.item && n.item.endDate,
      }));
      TT.lsSet('tt:cp:' + courseId, { t: Date.now(), nodes });
      return nodes;
    },
    cachedCoursePlan: (courseId) => TT.lsGet('tt:cp:' + courseId, null),

    // Every graded assessment in every class, with what the teacher gave you on each one
    // (standard levels, learning behaviors, scores, rubric and checklist rows, comments).
    // Toddle's own gradebook asks for ~100 KB per assessment and hides each result behind a click;
    // this is one paged request plus one batched request for rubric/checklist definitions.
    async getGrades() {
      const u = user();
      const cp = TT.cpId();
      const edges = [];
      let after = null;
      for (let page = 0; page < 20; page++) {
        const d = await gql(GRADES_Q, { studentId: u.id, first: 100, after, filters: {
          contentTypes: 'ASSESSMENT', states: ['PUBLISHED', 'ARCHIVED'], isEvaluationEnabled: true, courseArchivalState: 'ALL' } }, 'ttGrades');
        const a = d && d.node && d.node.assignments;
        if (!a) break;
        edges.push(...a.edges);
        if (!a.pageInfo.hasNextPage) break;
        after = a.pageInfo.endCursor;
      }
      const nodes = edges.map((e) => e.node).filter((n) => n && n.assignment);

      // Rubric / checklist definitions (rows and levels), only for tools that have a response.
      // They rarely change, so they're kept until a new one shows up.
      const defs = TT.lsGet('tt:gradeTools', {}) || {};
      const need = new Map();
      for (const n of nodes) {
        const answered = new Set((n.toolResponses || []).filter((r) => (r.toolResponses || []).some((x) => !x.isDeleted)).map((r) => r.toolId));
        for (const e of (n.assignment.content && n.assignment.content.assessmentTools && n.assignment.content.assessmentTools.edges) || []) {
          const t = e.node;
          const id = t.assessmentToolItem && t.assessmentToolItem.id;
          if (id && TOOL_ENTITY[t.assessmentToolType] && answered.has(id) && !defs[id]) need.set(id, t.assessmentToolType);
        }
      }
      const ids = [...need.keys()];
      for (let i = 0; i < ids.length; i += 25) {
        const chunk = ids.slice(i, i + 25);
        const parts = chunk.map((id, j) => `t${j}: node(id: "${String(id).replace(/\D/g, '')}", type: ${TOOL_ENTITY[need.get(id)]}) { id ${TOOL_FIELDS[need.get(id)]} }`);
        const d = await gql(`query ttGradeTools { ${parts.join('\n')} }`, {}, 'ttGradeTools').catch(() => null);
        chunk.forEach((id, j) => { const n = d && d[`t${j}`]; if (n) defs[id] = toolDef(need.get(id), n); });
      }
      try { TT.lsSet('tt:gradeTools', defs); } catch {}

      const list = nodes.map((n) => normalizeGrade(n, defs, cp)).filter(Boolean);
      const payload = { t: Date.now(), list };
      try { TT.lsSet('tt:grades', payload); } catch {}
      return payload;
    },
    cachedGrades: () => TT.lsGet('tt:grades', null),

    // A class's home page from Toddle: the teacher's description, quick links and banner picture.
    async getCourseHome(courseId) {
      const c = ((TT.lsGet('tt:coursesCache', null) || {}).courses || []).find((x) => x.id === courseId);
      const lc = c && (Array.isArray(c.learningCourse) ? c.learningCourse[0] : c.learningCourse);
      if (!lc || !lc.id) throw new Error('No learning course');
      const d = await gql(`query ttCourseHome($id: ID!) { node(id: $id, type: LEARNING_COURSE) { id ... on LearningCourse {
        homepageLayout { id widgets { id widgetType showWidget contents { id
          ... on HomepageWidgetAttachmentContent { attachment { id url title type thumbUrl description } }
          ... on HomepageWidgetCustomContent { payload } } } } } } }`, { id: lc.id }, 'ttCourseHome');
      const widgets = (d && d.node && d.node.homepageLayout && d.node.homepageLayout.widgets) || [];
      const out = { description: '', links: [], banner: null };
      const decode = (s) => { try { return new TextDecoder().decode(Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))); } catch { return ''; } };
      for (const w of widgets) {
        if (w.showWidget === false) continue;
        for (const ct of w.contents || []) {
          const p = ct.payload || {};
          if (w.widgetType === 'RICH_TEXT_EDITOR' && typeof p.description === 'string') out.description += decode(p.description);
          if (w.widgetType === 'BANNER' && typeof p.banner === 'string' && /^https:\/\//.test(p.banner)) out.banner = p.banner;
          const a = ct.attachment;
          if (w.widgetType === 'QUICK_LINKS' && a && /^https?:\/\//i.test(a.url || '')) out.links.push({ id: a.id, title: a.title || a.url, url: a.url, description: a.description || '' });
        }
      }
      TT.lsSet('tt:home:' + courseId, { t: Date.now(), ...out });
      return out;
    },
    cachedCourseHome: (courseId) => TT.lsGet('tt:home:' + courseId, null),

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
