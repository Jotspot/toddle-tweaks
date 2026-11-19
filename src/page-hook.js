/*
 * Toddle Tweaks — page-world hook (runs in Toddle's own JS context at document_start).
 *
 * 1. Stale-while-revalidate cache for slow-changing GraphQL queries (config,
 *    preferences, course lists...). Cached answers come back instantly and are
 *    refreshed in the background for next time.
 * 2. Remembers the filters Toddle uses for its own task queries so the
 *    extension can ask for the same data.
 * 3. Tells the extension when you change something (so the to-do refreshes) and when
 *    Toddle's router changes page.
 */
(() => {
  if (window.__toddleTweaksHooked) return;
  window.__toddleTweaksHooked = true;

  const LS = window.localStorage;
  const readJSON = (k, d) => { try { const v = LS.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const writeJSON = (k, v) => { try { LS.setItem(k, JSON.stringify(v)); } catch {} };

  const settings = Object.assign({ gqlCache: true, turboCache: false, cacheCoursePlan: true }, readJSON('tt:settings', {}));

  // ---------- tiny IndexedDB helper (same DB the isolated scripts use) ----------
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('toddle-tweaks', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('gql')) d.createObjectStore('gql');
      if (!d.objectStoreNames.contains('snap')) d.createObjectStore('snap');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const idb = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction('gql', mode);
      const out = fn(tx.objectStore('gql'));
      tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      tx.onerror = () => rej(tx.error);
    });
  };
  // Load the whole cache into memory once, at document_start (one IndexedDB read instead of one per query).
  const mem = new Map();
  const memReady = idb('readonly', (s) => {
    const req = s.openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { mem.set(c.key, c.value); c.continue(); } };
    return null;
  }).catch(() => {});
  const cacheGet = async (k) => { await memReady; return mem.get(k); };
  const cachePut = (k, v) => { mem.set(k, v); return idb('readwrite', (s) => s.put(v, k)).catch(() => {}); };
  const cacheClearVolatile = () => { for (const [k, v] of mem) if (v && v.volatile) mem.delete(k); return idb('readwrite', (s) => {
    const req = s.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      if (c.value && c.value.volatile) c.delete();
      c.continue();
    };
  }).catch(() => {}); };

  // ---------- what is safe to cache ----------
  // Always-safe: config-ish queries that almost never change mid-term.
  const SAFE = new Set([
    'getConfiguration', 'getPreferences', 'getGradeDetails', 'getLTIIntegrationsCreds',
    'getCourseHomepageLayout', 'getUserCourses', 'getCourseDetails', 'getCourseExtraDetailsQuery',
  ]);
  const SAFE_RE = /^get\w*(Configuration|Config|Preferences|Settings|Constants|Permissions|Translations|FeatureFlags?|Layout|AcademicYears?|CurriculumPrograms?|OrganizationDetails|OrgDetails|Integrations\w*)$/;
  // Never cache anything that reflects live student work/state.
  const NEVER_RE = /task|assign|submission|deadline|feed|post|notification|count|unread|message|conversation|announce|evaluat|attendance|calendar|event|stream|journal|portfolio|progress|report|chat|meeting|search|login|token|auth|session/i;

  // Course plans change rarely (when a teacher adds a resource); shown instantly, refreshed in the background.
  const COURSE_PLAN = new Set(['getEntireCourseFlowFeed', 'getCourseFlowMultiNode', 'getLearningCourseClasses']);
  const CP_TTL = 3 * 864e5;

  const SAFE_TTL = 7 * 864e5;     // 7 days
  const TURBO_TTL = 2 * 864e5;    // 2 days

  const isMutation = (op) => /^\s*mutation\b/.test(op.query || '');
  const isSubscription = (op) => /^\s*subscription\b/.test(op.query || '');
  const classify = (op) => {
    if (!op || !op.operationName || isMutation(op) || isSubscription(op)) return null;
    const n = op.operationName;
    if (SAFE.has(n) || SAFE_RE.test(n)) return { ttl: SAFE_TTL, volatile: false };
    if (settings.cacheCoursePlan !== false && COURSE_PLAN.has(n)) return { ttl: CP_TTL, volatile: false };
    if (settings.turboCache && !NEVER_RE.test(n)) return { ttl: TURBO_TTL, volatile: true };
    return null;
  };

  const userId = () => { try { return JSON.parse(LS.getItem('userInfo') || '{}').id || 'anon'; } catch { return 'anon'; } };
  const keyFor = (op) => `${userId()}|${op.operationName}|${JSON.stringify(op.variables || {})}`;

  // ---------- observation: filters + mark-done template ----------
  const observe = (ops, url) => {
    try {
      writeJSON('tt:gqlUrl', url);
      for (const op of ops) {
        const n = op.operationName;
        if (n === 'getStudentTasks' && op.variables && op.variables.filters) {
          const { completionStatus, status, evaluationStatus, searchText, ...base } = op.variables.filters;
          // Only the home page asks for all classes at once. A single class's Assignments page
          // asks for one course — saving that would shrink the whole to-do to that class.
          const ids = base.courseIds || [];
          if (ids.length > 1 || !readJSON('tt:taskFilters', null)) {
            writeJSON('tt:taskFilters', { ...base, searchText: '', savedAt: Date.now() });
          }
        } else if (n === 'getUserCourses' && op.variables) {
          writeJSON('tt:courseVars', { ...op.variables, savedAt: Date.now() });
        }
      }
    } catch {}
  };

  const emit = (type, data) => {
    try { window.dispatchEvent(new CustomEvent('tt:page', { detail: JSON.stringify({ type, data }) })); } catch {}
  };

  const afterMutation = (ops) => {
    cacheClearVolatile();
    emit('mutation', ops.map((o) => o.operationName));
  };
  // v1 tried to "learn" Mark as done from your clicks, but the same mutation also saves
  // written responses — so drop anything it learned. Mark as done is now a fixed, verified call.
  try { LS.removeItem('tt:markDoneTpl'); } catch {}

  // ---------- route events (Toddle's router uses pushState; content scripts can't see that) ----------
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      try { window.dispatchEvent(new Event('tt:route')); } catch {}
      return r;
    };
  }

  // ---------- fetch wrapper ----------
  const origFetch = window.fetch;
  const jsonResponse = (body) => new Response(JSON.stringify(body), {
    status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'x-toddle-tweaks': 'cache' },
  });

  const store = (ops, results) => {
    const now = Date.now();
    ops.forEach((op, i) => {
      const c = classify(op);
      const r = results[i];
      if (c && r && r.data && !r.errors) cachePut(keyFor(op), { t: now, r, volatile: c.volatile });
    });
  };

  const netBatch = async (url, init, ops, asBatch) => {
    const body = asBatch ? JSON.stringify(ops) : JSON.stringify(ops[0]);
    const res = await origFetch.call(window, url, { ...init, body });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    return Array.isArray(j) ? j : [j];
  };

  window.fetch = async function ttFetch(input, init) {
    let url;
    try { url = typeof input === 'string' ? input : (input && input.url) || String(input); } catch { url = ''; }
    if (!/toddleapp\.com\/graphql/.test(url) || !init || typeof init.body !== 'string') {
      return origFetch.apply(this, arguments);
    }
    let parsed;
    try { parsed = JSON.parse(init.body); } catch { return origFetch.apply(this, arguments); }
    const isBatch = Array.isArray(parsed);
    const ops = isBatch ? parsed : [parsed];
    observe(ops, url);

    // Mutations: pass straight through, then invalidate + learn.
    if (ops.some(isMutation)) {
      const res = await origFetch.apply(this, arguments);
      res.clone().json().then((j) => afterMutation(ops, Array.isArray(j) ? j : [j])).catch(() => afterMutation(ops, null));
      return res;
    }

    if (!settings.gqlCache || !ops.some(classify)) {
      const res = await origFetch.apply(this, arguments);
      if (settings.gqlCache) res.clone().json().then((j) => store(ops, Array.isArray(j) ? j : [j])).catch(() => {});
      return res;
    }

    // Look up cached entries for cacheable ops.
    const now = Date.now();
    const hits = await Promise.all(ops.map(async (op) => {
      const c = classify(op);
      if (!c) return null;
      const e = await cacheGet(keyFor(op));
      return e && now - e.t < c.ttl ? e.r : null;
    }));

    if (!hits.some(Boolean)) {
      const res = await origFetch.apply(this, arguments);
      res.clone().json().then((j) => store(ops, Array.isArray(j) ? j : [j])).catch(() => {});
      return res;
    }

    try {
      const missIdx = ops.map((_, i) => i).filter((i) => !hits[i]);
      const hitIdx = ops.map((_, i) => i).filter((i) => hits[i]);
      const merged = hits.slice();

      if (missIdx.length) {
        const missOps = missIdx.map((i) => ops[i]);
        const results = await netBatch(url, init, missOps, isBatch);
        missIdx.forEach((i, k) => { merged[i] = results[k]; });
        store(missOps, results);
      }

      // Background revalidation of the cached ones (for next time).
      const hitOps = hitIdx.map((i) => ops[i]);
      setTimeout(() => {
        netBatch(url, init, hitOps, isBatch || hitOps.length > 1)
          .then((results) => store(hitOps, results))
          .catch(() => {});
      }, 1500);

      emit('cacheHit', hitOps.map((o) => o.operationName));
      return jsonResponse(isBatch ? merged : merged[0]);
    } catch (e) {
      // Anything odd -> behave exactly like Toddle normally would.
      return origFetch.apply(this, arguments);
    }
  };
})();
