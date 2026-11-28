/* Toddle Tweaks — shared helpers for the isolated content scripts. */
/* eslint-disable no-unused-vars */
const TT = (window.TT = window.TT || {});

TT.DEFAULTS = {
  // Speed
  snapshot: true,          // show a cached copy of the page instantly while Toddle boots
  gqlCache: true,          // cache slow-changing GraphQL (config, course list…)
  turboCache: false,       // cache almost everything (stale-by-one-visit)
  blockTrackers: true,     // block analytics / Sentry / ad pixels
  blockIntercom: true,     // hide the Intercom chat bubble
  // To-do
  smartTodo: true,         // replace the home "Assignments and deadlines" widget
  hidePastNoSubmission: true, // past items that don't take submissions count as done
  todoButton: false,       // floating "To-do" button everywhere
  // Look & feel
  classroomMode: true,     // Google Classroom shell: home, class pages, to-do, calendar
  redirectHome: true,      // toddleapp.com → straight to the web app
  realLinks: true,         // middle-click / ctrl-click class & assignment cards to open new tabs
  // Speed (2.2)
  cacheCoursePlan: true,   // course plans show instantly from cache, refreshed in the background
  // Classroom mode details (2.2)
  gcCardInfo: true,        // class cards list what's due + a missing/due-this-week summary
  gcCompact: false,        // tighter spacing everywhere in Classroom mode
  googleBanners: true,     // class banners use Google Classroom's illustrations (store builds default to original art)
  gcNativeCoursePlan: true, // course plan rebuilt as a Classroom-style page (off = Toddle's own)
  gcCoursePlanStyle: true, // course plan restyled like Classroom's Classwork
  cpThumbnails: true,      // (pre-2.5) course plan thumbnails on/off; false now means cpImages = 'icons'
  cpImages: 'preview',     // course plan pictures: 'preview' (thumbnail left) | 'card' (Classroom-style card right) | 'icons'
  cpHideNotRequired: true, // course plan: hide the "Submission not required" labels
  // Handy extras (2.2)
  tabBadge: true,          // "(3)" in the tab title = missing + due today/tomorrow
  commandPalette: true,    // Ctrl/⌘+K: jump to any class or assignment
  shortcuts: true,         // g h / g t / g c / g s, ? for help
  relativeDates: true,     // "Due on 23rd Nov…" gets "(in 4 days)" appended
  // Links (2.5)
  docsNewTab: true,        // Google Docs/Slides/Drive, Microsoft 365, Canva… open in a new tab, not Toddle's viewer
  linksNewTab: false,      // every web link opens in a new tab (uploaded files still use the viewer)
  whatsNew: true,          // "Toddle Tweaks updated" note after an update
  // 2.6
  darkMode: 'off',         // 'off' | 'on' | 'system'
  gcTimetable: true,       // Timetable as a Classroom page (a whole week)
  gcAttendance: true,      // Attendance as a Classroom page
  periodNames: 'block',    // 'block' (A1, B3: rotation day + period) | 'period' (P1, as Toddle shows it)
  nextClass: false,        // "Next: Chemistry in 12 min" in the top bar
  nextClassRoom: true,     //   …with the room
  finalsMode: true,        // Finals page in the menu before exams
  finalsLead: '45',        // days before finals it appears
  finalsStart: '',         // set exam dates by hand ('' = find them automatically)
  finalsEnd: '',
  finalsReviewDays: '7',   // "Start reviewing" suggestion, days before each exam
  heatmap: true,           // workload heatmap
  hm_calendar: true, hm_timetable: false, hm_home: false, hm_todo: false, hm_sidebar: false, // where it shows
  hmExpanded: false,       // open with six weeks + insights showing
  hmWeekends: false,       // always show Saturday and Sunday
  hmWeightTests: true,     // tests count double
  hmGrid: true,            // six-week grid when expanded
  hmInsights: true,        // insights when expanded
  hmiBusiest: true, hmiLightest: true, hmiTests: true, hmiClass: true, hmiTotal: true, hmiOff: true, hmiMissing: true, hmiFinals: true,
  // 2.7
  gcGrades: true,          // Grades: every graded assessment on one page (replaces Toddle's gradebook in Classroom mode)
  gcDrawerHover: false,    // the collapsed menu slides open while the mouse rests on it
  gradeWords: 'new',       // standards levels: 'new' (NE EM DE ME MWD) | 'exemplary' (MWD → Exemplary) | 'old' (Below Approaching Meets Exemplary)
  gradeWordsToddle: true,  //   …also on Toddle's own rubrics, assignments and gradebook
  gradesStyle: 'classroom', // Grades page look: 'classroom' | 'powerschool'
  gradesOverview: true,    // Grades page starts with an overview of your levels
  gradesBehaviors: true,   // Grades page shows learning behaviors
  gradesComments: true,    // Grades page shows teacher comments
  gradesButton: true,      // regular Toddle: "All grades on one page" button on Toddle's gradebook
};

TT.settings = { ...TT.DEFAULTS };

TT.loadSettings = () => new Promise((resolve) => {
  try {
    chrome.storage.sync.get('settings', (r) => {
      TT.settings = { ...TT.DEFAULTS, ...((r && r.settings) || {}) };
      // One-time v2.1 migration: Intercom chat back on by default, floating to-do button retired.
      if (!TT.settings.migratedV21) {
        TT.settings = { ...TT.settings, todoButton: false, migratedV21: true };
        try { chrome.storage.sync.set({ settings: TT.settings }); } catch {}
      }
      // 2.3.1: the Intercom chat bubble is hidden by default (switch it back on in Settings).
      if (!TT.settings.migratedV231) {
        TT.settings = { ...TT.settings, blockIntercom: true, migratedV231: true };
        try { chrome.storage.sync.set({ settings: TT.settings }); } catch {}
      }
      // 2.5: course plan thumbnails on/off became a picture style.
      if (!TT.settings.migratedV25) {
        const stored = (r && r.settings) || {};
        TT.settings = { ...TT.settings, migratedV25: true };
        if (stored.cpThumbnails === false && !stored.cpImages) TT.settings.cpImages = 'icons';
        try { chrome.storage.sync.set({ settings: TT.settings }); } catch {}
      }
      // Mirror into page localStorage so the page-world hook can read it synchronously.
      try { localStorage.setItem('tt:settings', JSON.stringify(TT.settings)); } catch {}
      resolve(TT.settings);
    });
  } catch {
    resolve(TT.settings);
  }
});

TT.saveSettings = (patch) => new Promise((resolve) => {
  TT.settings = { ...TT.settings, ...patch };
  try { localStorage.setItem('tt:settings', JSON.stringify(TT.settings)); } catch {}
  chrome.storage.sync.set({ settings: TT.settings }, () => resolve(TT.settings));
});

// Fast synchronous guess at settings (used at document_start before storage answers).
TT.settingsSync = () => {
  try { return { ...TT.DEFAULTS, ...JSON.parse(localStorage.getItem('tt:settings') || '{}') }; } catch { return { ...TT.DEFAULTS }; }
};

TT.lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
TT.lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---------- IndexedDB (shared with page-hook.js) ----------
TT._db = null;
TT.db = () => TT._db || (TT._db = new Promise((res, rej) => {
  const r = indexedDB.open('toddle-tweaks', 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains('gql')) d.createObjectStore('gql');
    if (!d.objectStoreNames.contains('snap')) d.createObjectStore('snap');
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
TT.idb = async (storeName, mode, fn) => {
  const d = await TT.db();
  return new Promise((res, rej) => {
    const tx = d.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
    tx.onerror = () => rej(tx.error);
  });
};

// ---------- DOM helpers ----------
TT.h = (tag, attrs, ...kids) => {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
};

TT.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// SPA navigation that Toddle's React Router picks up (no full reload).
TT.nav = (url) => {
  const u = new URL(url, location.origin);
  if (u.origin !== location.origin) { location.href = u.href; return; }
  history.pushState(history.state, '', u.pathname + u.search + u.hash);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
};

// Make an <a> behave like a SPA link on plain click, but keep middle/ctrl-click = new tab.
TT.spaLink = (a) => {
  a.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    TT.nav(a.getAttribute('href'));
  });
  return a;
};

TT.cpId = () => {
  const m = location.pathname.match(/\/platform\/(\d+)/);
  if (m) return m[1];
  const c = TT.lsGet('currentCurriculumProgram', null);
  return c && c.id;
};

TT.isHomePath = (p = location.pathname) => /^\/platform\/\d+\/courses\/?$/.test(p);

TT.onRoute = (() => {
  const subs = new Set();
  let last = location.href;
  const fire = () => {
    if (location.href === last) return;
    last = location.href;
    subs.forEach((f) => { try { f(location); } catch (e) { console.warn('[TT]', e); } });
  };
  setInterval(fire, 300);
  window.addEventListener('popstate', () => setTimeout(fire, 0));
  return (f) => { subs.add(f); return () => subs.delete(f); };
})();

TT.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

TT.waitFor = (sel, timeout = 15000, root = document) => new Promise((resolve) => {
  const found = root.querySelector(sel);
  if (found) return resolve(found);
  const mo = new MutationObserver(() => {
    const el = root.querySelector(sel);
    if (el) { mo.disconnect(); resolve(el); }
  });
  mo.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });
  setTimeout(() => { mo.disconnect(); resolve(null); }, timeout);
});

// ---------- Material icons (24px paths) ----------
TT.ICONS = {
  mail: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  calendar: 'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z',
  todo: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
  school: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3 1 9l11 6 9-4.91V17h2V9L12 3z',
  campaign: 'M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z',
  schedule: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  attendance: 'M9 17l3-2.94c-.39-.04-.68-.06-1-.06-2.67 0-8 1.34-8 4v2h9l-3-3zm2-5c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m4.47 8.5L12 17l1.4-1.41 2.07 2.08 5.13-5.17 1.4 1.41-6.53 6.59z',
  description: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  left: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  right: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  folder: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z',
  yourwork: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z',
  people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  palette: 'M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  hide: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
  show: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  exit: 'M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  assignment: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  science: 'M19.8 18.4 14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z',
  calculate: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5.97 4.06L14.09 6l1.41 1.41L16.91 6l1.06 1.06-1.41 1.41 1.41 1.41-1.06 1.06-1.41-1.4-1.41 1.41-1.06-1.06 1.41-1.41-1.41-1.42zm-6.78.66h5v1.5h-5v-1.5zM11.5 16h-2v2H8v-2H6v-1.5h2v-2h1.5v2h2V16zm6.5 1.25h-5v-1.5h5v1.5zm0-2.5h-5v-1.5h5v1.5z',
  language: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
  code: 'M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  music: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  sports: 'M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z',
  history: 'M4 10h3v7H4zM10.5 10h3v7h-3zM2 19h20v3H2zM17 10h3v7h-3zM12 1 2 6v2h20V6z',
  help: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  keyboard: 'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  attach: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  mic: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  drive: 'M7.71 3.5 1.15 15l3.43 5.95L11.14 9.5zM9.65 15l-3.4 5.95h13.13L22.85 15zM22.85 13.5 16.29 2H9.43l6.56 11.5z',
  book: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
  unfold: 'M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z',
  fold: 'M7.41 18.59 8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10l4.59-4.59z',
  slides: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H5V8h14v8z',
  sheet: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8h-8v8H9v-8H5V9h4V5h2v4h8v2z',
  form: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm8 8h-6v-2h6v2zm0-4h-6v-2h6v2zm0-4h-6V7h6v2z',
  play: 'M8 5v14l11-7z',
  summative: 'M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10 17H5v-2h5v2zm0-4H5v-2h5v2zm0-4H5V7h5v2zm4.82 6L12 12.16l1.41-1.41 1.41 1.42L17.99 9l1.42 1.42L14.82 15z',
  test: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 14v-2.47l6.88-6.88c.2-.2.51-.2.71 0l1.77 1.77c.2.2.2.51 0 .71L8.47 14H6zm12 0h-7.5l2-2H18v2z',
  quiz: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7.01 15c-.7 0-1.26-.56-1.26-1.26 0-.71.56-1.25 1.26-1.25.71 0 1.25.54 1.25 1.25-.01.69-.54 1.26-1.25 1.26zm3.01-7.4c-.76 1.11-1.48 1.46-1.87 2.17-.16.29-.22.48-.22 1.41h-1.82c0-.49-.08-1.29.31-1.98.49-.87 1.42-1.39 1.96-2.16.57-.81.25-2.33-1.37-2.33-1.06 0-1.58.8-1.8 1.48l-1.65-.7C9.95 7.15 10.8 6 12.36 6c1.3 0 2.2.59 2.65 1.33.39.63.61 1.82-.01 2.27z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  video: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
  refresh: 'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  event: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  trend: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  grade: 'M300-80q-58 0-99-41t-41-99v-520q0-58 41-99t99-41h500v600q-25 0-42.5 17.5T740-220q0 25 17.5 42.5T800-160v80H300Zm-60-267q14-7 29-10t31-3h20v-440h-20q-25 0-42.5 17.5T240-740v393Zm160-13h320v-440H400v440Zm-160 13v-453 453Zm60 187h373q-6-14-9.5-28.5T660-220q0-16 3-31t10-29H300q-26 0-43 17.5T240-220q0 26 17 43t43 17Z', // Material Symbols book_2
  chat: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z',
  dock: 'M3 5v14h18V5H3zm5 12H5V7h3v10zm11 0h-9V7h9v10z',
  tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
  up: 'M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z',
  down: 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z',
  spa: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
  checkbox: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  doneToddle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  dark: 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z',
  globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16zm2.95-8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
};
// Icons taken from Material Symbols (not Material Icons) use its 960-unit grid.
TT.ICON_BOX = { grade: '0 -960 960 960' };
TT.gIcon = (name, cls) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', TT.ICON_BOX[name] || '0 0 24 24');
  svg.setAttribute('class', 'tt-ico' + (cls ? ' ' + cls : ''));
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', TT.ICONS[name] || TT.ICONS.assignment);
  svg.appendChild(p);
  return svg;
};

// Parse trusted, extension-authored markup into nodes (no innerHTML).
TT.parseHTML = (html) => [...new DOMParser().parseFromString(String(html), 'text/html').body.childNodes];

// ---------- safe HTML (announcements, instructions) ----------
TT.sanitize = (html) => {
  const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'SPAN', 'DIV', 'IMG', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'SUB', 'SUP', 'CODE', 'PRE', 'HR']);
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const out = document.createElement('div');
  const walk = (src, dst) => {
    for (const n of src.childNodes) {
      if (n.nodeType === 3) { dst.append(n.textContent); continue; }
      if (n.nodeType !== 1) continue;
      if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|SVG|MATH|TEMPLATE)$/.test(n.tagName)) continue;
      if (!ALLOWED.has(n.tagName)) { walk(n, dst); continue; }
      const el = document.createElement(n.tagName);
      if (n.tagName === 'A') {
        const href = n.getAttribute('href') || '';
        if (/^(https?:|mailto:)/i.test(href)) { el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
      } else if (n.tagName === 'IMG') {
        const src2 = n.getAttribute('src') || '';
        if (!/^https:/i.test(src2)) continue;
        el.src = src2; el.loading = 'lazy'; el.alt = n.getAttribute('alt') || '';
      }
      walk(n, el);
      dst.append(el);
    }
  };
  walk(doc.body, out);
  return out;
};

TT.initials = (name) => String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
TT.personName = (p) => p ? [p.preferredName || p.firstName, p.lastName].filter(Boolean).join(' ') : '';
TT.avatar = (person, size = 32, color = '#1a73e8') => {
  const name = typeof person === 'string' ? person : TT.personName(person) || person && person.name;
  const img = person && (person.profileImage || person.img);
  const el = TT.h('span', { class: 'tt-avatar', style: { width: size + 'px', height: size + 'px', background: img ? '#e8eaed' : color, fontSize: Math.round(size * 0.42) + 'px' }, title: name || '' });
  if (img) {
    const i = TT.h('img', { src: img, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    i.addEventListener('error', () => { i.remove(); el.style.background = color; el.textContent = TT.initials(name); });
    el.append(i);
  } else el.textContent = TT.initials(name);
  return el;
};

// "in 4 days", "in 3 hours", "2 days ago"
TT.relTime = (t, now = Date.now()) => {
  const diff = t - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat([], { numeric: 'auto' });
  if (abs < 3600e3) return rtf.format(Math.round(diff / 60e3), 'minute');
  if (abs < 36 * 3600e3) return rtf.format(Math.round(diff / 3600e3), 'hour');
  if (abs < 14 * 864e5) return rtf.format(Math.round(diff / 864e5), 'day');
  return rtf.format(Math.round(diff / (7 * 864e5)), 'week');
};

TT.fmtDate = (t, opts) => t ? new Date(t).toLocaleDateString([], opts || { month: 'short', day: 'numeric' }) : '';

// Deterministic colour per class, Classroom-ish palette.
TT.CLASS_COLORS = ['#1967d2', '#137333', '#c5221f', '#e37400', '#9334e6', '#129eaf', '#d01884', '#3c4043', '#0b8043', '#b06000', '#5f6368', '#1a73e8'];
TT.colorFor = (id) => {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TT.CLASS_COLORS[h % TT.CLASS_COLORS.length];
};

// Icon for a piece of work: summatives get a checklist, tests a pencil, quizzes a question mark.
TT.workIcon = (it) => (!it ? 'assignment' : it.kind === 'Summative' ? 'summative' : it.kind === 'Test' ? 'test' : it.kind === 'Quiz' ? 'quiz' : it.needsSubmission === false ? 'description' : 'assignment');

// Middle or high school, from the curriculum program in the URL (Toddle labels them "Middle School",
// "High School"). Settings reads it to pick its Highlights.
TT.schoolLevel = () => {
  const u = TT.lsGet('userInfo', {}) || {};
  const cp = (u.curriculumPrograms || []).find((c) => String(c.id) === String(TT.cpId()));
  if (!cp) return null;
  const s = `${cp.acronym || ''} ${cp.label || ''}`;
  const level = /\bmiddle\b|^MS\b/i.test(s) ? 'ms' : /\bhigh\b|^HS\b/i.test(s) ? 'hs' : /elementary|primary|^ES\b/i.test(s) ? 'es' : 'other';
  return { level, label: cp.label || cp.acronym || '' };
};
// Grades is for middle school for now: high school doesn't grade in Toddle until next year, so it
// stays out of the menu, Ctrl/⌘ + K and Toddle's gradebook there.
TT.gradesOn = () => {
  if (TT.settings.gcGrades === false) return false;
  const l = TT.schoolLevel();
  return !(l && l.level === 'hs');
};
(() => {
  let last = '';
  const note = () => {
    const l = TT.schoolLevel();
    if (!l || l.level + l.label === last) return;
    last = l.level + l.label;
    try { chrome.storage.local.set({ schoolLevel: l }); } catch {}
  };
  setTimeout(note, 1500);
  TT.onRoute(note);
})();
// A different person signed in on this browser (a brother or sister's account, say): forget the last
// person's cached classes, grades, timetable, finals and page snapshots, so nothing of theirs shows or
// gets reused. Settings and layout choices stay. Runs on load and on every route change (Toddle signs
// in without a full reload), and reloads the page when it finds a switch mid-session.
TT.KEEP_ON_SWITCH = /^tt:((settings|gc|gqlUrl|tourDone|finalsKey|finalsOverride|finalsOpen|localDone|ttExport|cpNavFolded|todoView|cwView|streamShow|collapsed|gradesCollapsed|gradesView|openRows|openPosts|cpThumbFail|dev|uid)$|(hmOpen|cwCollapsed|cpCollapsed):)/;
(() => {
  let loaded = false;
  const check = () => {
    const id = (TT.lsGet('userInfo', {}) || {}).id;
    if (!id) return;
    let prev = null;
    try { prev = localStorage.getItem('tt:uid'); } catch { return; }
    if (prev === String(id)) { loaded = true; return; }
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('tt:') && !TT.KEEP_ON_SWITCH.test(k)) localStorage.removeItem(k);
      localStorage.setItem('tt:uid', String(id));
    } catch {}
    TT.idb('snap', 'readwrite', (st) => st.clear()).catch(() => {});
    try { chrome.storage.local.remove(['finalsFound', 'schoolLevel']); } catch {}
    if (loaded) location.reload();
    loaded = true;
  };
  check();
  TT.onRoute(check);
  window.addEventListener('storage', (e) => { if (e.key === 'userInfo') check(); });
})();
