/* Toddle Tweaks: settings page. Every setting has a little live preview of what it does. */
const DEFAULTS = {
  snapshot: true, gqlCache: true, turboCache: false, blockTrackers: true, blockIntercom: true,
  smartTodo: true, hidePastNoSubmission: true, todoButton: false, classroomMode: true, redirectHome: true, realLinks: true,
  cacheCoursePlan: true, googleBanners: true, gcCardInfo: true, gcCompact: false, gcCoursePlanStyle: true, cpThumbnails: true, cpHideNotRequired: true,
  tabBadge: true, commandPalette: true, shortcuts: true, relativeDates: true,
};

// Mini previews (made-up example classes), only where seeing it helps.
const P = {
  classroom: (on) => on
    ? `<div class="pv-gc"><div class="pv-gc-bar"><b class="pv-dot"></b> Classroom</div><div class="pv-gc-cards">
        <div class="pv-card"><div class="pv-card-h" style="background:#108a7d">Biology<small>Ms. Rivera</small></div><div class="pv-card-b"><small>Due tomorrow</small>Lab report</div></div>
        <div class="pv-card"><div class="pv-card-h" style="background:#e8930c">World History<small>Mr. Chen</small></div><div class="pv-card-b"></div></div></div></div>`
    : `<div class="pv-toddle"><div class="pv-t-row"><span class="pv-sq">BI</span>Biology<small>Grade 9 +3 more</small></div><div class="pv-t-row"><span class="pv-sq">WH</span>World History<small>Grade 10</small></div></div>`,
  compact: (on) => `<div class="pv-list ${on ? 'compact' : ''}"><div class="pv-li"><span class="pv-ci"></span>Problem set 3.2<small>Due Oct 16</small></div><div class="pv-li"><span class="pv-ci"></span>Chapter 4 quiz<small>Due Sep 25</small></div><div class="pv-li"><span class="pv-ci"></span>Reading notes<small>Posted Sep 3</small></div></div>`,
  cardInfo: (on) => `<div class="pv-card wide"><div class="pv-card-h" style="background:#d91a60">Algebra II<small>Mr. Patel</small></div><div class="pv-card-b">${on ? '<small>Due Friday, 11:59 PM</small>Problem set 4.1' : ''}</div><div class="pv-card-f">${on ? '<span class="late">1 missing</span> · 2 due this week' : ''}<i>▣ ▢</i></div></div>`,
  cpStyle: (on) => on
    ? `<div class="pv-cp"><div class="pv-cp-unit">Unit 3: Cells</div><div class="pv-cp-item"><span class="pv-ci" style="background:#108a7d"></span>Cell diagram worksheet</div><div class="pv-cp-item"><span class="pv-ci" style="background:#108a7d"></span>Unit 3 test</div></div>`
    : `<div class="pv-cp toddle"><div class="pv-cp-box">▾ Unit 3: Cells<small>Unit • 4 items</small></div><div class="pv-cp-box in"><span class="pv-sq">LE</span>Cell diagram worksheet</div></div>`,
  thumbs: (on) => `<div class="pv-cp"><div class="pv-cp-item">${on ? '<span class="pv-thumb"></span>' : ''}Course syllabus<small>Link</small></div><div class="pv-cp-item">${on ? '<span class="pv-thumb t2"></span>' : ''}Class textbook<small>Link</small></div></div>`,
  notRequired: (on) => `<div class="pv-cp"><div class="pv-cp-item"><span class="pv-sq">LE</span>Warm-up 1.1${on ? '' : '<em>Submission not required</em>'}</div><div class="pv-cp-item"><span class="pv-sq">SA</span>Unit 1 test${on ? '' : '<em>Submission not required</em>'}</div></div>`,
  smartTodo: (on) => on
    ? `<div class="pv-todo"><b class="red">Today</b><div>Lab report <small>Due 8:00 AM</small></div><b>Tomorrow</b><div>Essay draft <small>Turn in</small></div></div>`
    : `<div class="pv-todo"><b>Pending (80)</b><div>Welcome activity <small>Due 14th Aug</small></div><div>Warm-up 1.1 <small>Due 14th Aug</small></div></div>`,
  hidePast: (on) => `<div class="pv-todo"><b>Assigned</b>${on ? '' : '<div class="old">Class notes <small>94 days late</small></div><div class="old">Warm-up 1.2 <small>93 days late</small></div>'}<div>Essay draft <small>Due tomorrow</small></div></div>`,
  tabBadge: (on) => `<div class="pv-tab"><span class="pv-fav"></span>${on ? '<b>(3)</b> ' : ''}Classroom</div>`,
  palette: (on) => on ? `<div class="pv-pal"><div class="pv-pal-in">⌕ bio</div><div class="pv-pal-r sel">Biology <small>Class</small></div><div class="pv-pal-r">Biology lab report <small>Assignment</small></div></div>` : `<div class="pv-mouse muted">Ctrl+K does nothing</div>`,
  banners: (on) => on ? '<div class="pv-banner g"><span>Biology</span></div><small>Google Classroom illustration</small>' : '<div class="pv-banner p"><span>Biology</span><i></i></div><small>Original pattern</small>',
  relDates: (on) => `<div class="pv-due">Submission open • Due on 23rd Nov, 8:30 AM${on ? ' <b>· in 4 days</b>' : ''}</div>`,
};

// mode: 'gc' = only in Classroom mode, 'classic' = only in regular Toddle, 'both'
const SECTIONS = [
  { id: 'gc', title: 'Google Classroom mode', mode: 'gc', intro: 'Toddle wrapped in a Classroom-style app. These options only apply while it\'s on.', items: [
    { k: 'classroomMode', t: 'Google Classroom mode', d: 'Class cards, Stream / Classwork / People, To-do and Calendar. Turn it off for regular Toddle.', pv: P.classroom, master: true },
    { k: 'gcCompact', t: 'Compact spacing', d: 'Tighter rows and cards, so more fits on screen.', pv: P.compact },
    { k: 'gcCardInfo', t: 'Class cards show what\'s due', d: 'Up to three due items plus a "missing / due this week" summary on each card.', pv: P.cardInfo },
    { k: 'gcCoursePlanStyle', t: 'Classroom-style course plan', d: 'Units become coloured topic headings, items become rows with round icons.', pv: P.cpStyle },
    { k: 'cpThumbnails', t: 'Course plan thumbnails', d: 'Show the little preview images next to links and files.', pv: P.thumbs },
    { k: 'cpHideNotRequired', t: 'Hide "Submission not required"', d: 'Removes the repeated label from course plan rows.', pv: P.notRequired },
    { k: 'googleBanners', t: 'Use Google Classroom banner art', d: "Class banners use Google Classroom's own illustrations, loaded from Google's servers. Off: original Toddle Tweaks patterns in the same colours.", pv: P.banners },
  ] },
  { id: 'classic', title: 'Regular Toddle mode', mode: 'classic', intro: 'Tweaks for Toddle\'s own pages. These apply while Classroom mode is off.', items: [
    { k: 'smartTodo', t: 'Smart to-do on the home page', d: 'Replaces "Assignments and deadlines" with Missing, Today, This week and so on.', pv: P.smartTodo },
    { k: 'snapshot', t: 'Instant page snapshots', d: 'Shows your last view of a page right away while Toddle loads.', reload: true },
  ] },
  { id: 'both', title: 'Both modes', mode: 'both', items: [
    { k: 'hidePastNoSubmission', t: 'Hide past "no submission" items', d: 'Old in-class work that can\'t be turned in counts as done instead of piling up.', pv: P.hidePast },
    { k: 'tabBadge', t: 'Count in the tab title', d: 'How many things are missing or due today/tomorrow, visible from any tab.', pv: P.tabBadge },
    { k: 'commandPalette', t: 'Quick jump (Ctrl/⌘ + K)', d: 'Search every class, assignment and page and jump straight there.', pv: P.palette },
    { k: 'relativeDates', t: 'Relative due dates', d: 'Adds "in 4 days" or "2 days ago" next to due dates on assignment pages.', pv: P.relDates },
    { k: 'shortcuts', t: 'Keyboard shortcuts', d: 'g h home, g t to-do, g c calendar, g s settings, ? for the full list.' },
    { k: 'realLinks', t: 'Open in a new tab', d: 'Middle-click or Ctrl-click class and assignment cards to open them in a new tab.' },
  ] },
  { id: 'speed', title: 'Speed & privacy', mode: 'both', items: [
    { k: 'gqlCache', t: 'Cache settings & class data', d: 'Config that rarely changes loads from your computer and refreshes in the background.', reload: true },
    { k: 'cacheCoursePlan', t: 'Cache course plans', d: 'Course plans open instantly. Changes your teacher makes show up on the next visit.', reload: true },
    { k: 'turboCache', t: 'Turbo cache', d: 'Caches almost everything. Fastest, but a page can be one visit out of date.', reload: true, warn: true },
    { k: 'redirectHome', t: 'Skip the marketing site', d: 'toddleapp.com goes straight to sign-in or your classes.' },
    { k: 'blockTrackers', t: 'Block trackers', d: 'Analytics, error reporting and ad pixels don\'t load.', reload: true },
    { k: 'blockIntercom', t: 'Hide the Intercom chat bubble', d: 'Blocks Toddle\'s help-chat widget.', reload: true },
  ] },
];
const MODE_LABEL = { gc: 'Classroom mode', classic: 'Regular Toddle', both: 'Both modes' };

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}) => { const e = document.createElement(tag); Object.assign(e, attrs); return e; };
// Previews are our own static markup; parse it instead of using innerHTML.
const parse = (html) => [...new DOMParser().parseFromString(html, 'text/html').body.childNodes];
let settings = { ...DEFAULTS };
let savedTimer;

const save = async (patch) => {
  settings = { ...settings, ...patch };
  await chrome.storage.sync.set({ settings });
  const s = $('#saved');
  s.textContent = 'Saved';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { s.textContent = ''; }, 1500);
};

const render = () => {
  const main = $('#main');
  const toc = $('#toc');
  main.textContent = '';
  toc.textContent = '';
  for (const sec of SECTIONS) {
    const ta = el('a', { href: '#' + sec.id, textContent: sec.title }); ta.append(el('small', { textContent: MODE_LABEL[sec.mode] })); toc.append(ta);
    const box = el('section', { id: sec.id, className: 'sec' });
    const h2 = el('h2', { textContent: sec.title });
    h2.append(el('span', { className: 'mode ' + sec.mode, textContent: MODE_LABEL[sec.mode] }));
    box.append(h2);
    if (sec.intro) box.append(el('p', { className: 'intro', textContent: sec.intro }));
    for (const it of sec.items) {
      const row = el('div', { className: 'row' });
      row.dataset.search = (it.t + ' ' + it.d).toLowerCase();
      const on = !!settings[it.k];
      const disabled = !it.master && ((sec.mode === 'gc' && !settings.classroomMode) || (sec.mode === 'classic' && settings.classroomMode));
      const text = el('div', { className: 'txt' });
      text.append(el('div', { className: 'ttl', textContent: it.t }), el('div', { className: 'desc', textContent: it.d }));
      if (it.reload) text.append(el('div', { className: 'note', textContent: 'Applies the next time you load Toddle' }));
      if (disabled) text.append(el('div', { className: 'note', textContent: sec.mode === 'gc' ? 'Turn on Google Classroom mode to use this' : 'Only used while Classroom mode is off' }));
      const pv = el('div', { className: 'preview' + (on ? ' on' : '') });
      if (it.pv) pv.append(...parse(it.pv(on)));
      else pv.classList.add('empty');
      const sw = el('input', { type: 'checkbox', className: 'switch', checked: on, ariaLabel: it.t });
      sw.addEventListener('change', async () => {
        await save({ [it.k]: sw.checked });
        render();
      });
      row.append(text, pv, sw);
      if (disabled) row.classList.add('dim');
      if (it.warn && on) row.classList.add('warn');
      box.append(row);
    }
    main.append(box);
  }

  // Data & reset
  const data = el('section', { id: 'data', className: 'sec' });
  data.append(el('h2', { textContent: 'Your data' }));
  data.append(el('p', { className: 'desc', textContent: 'Everything Toddle Tweaks stores stays on this computer (and your Chrome sync for these settings). Nothing is sent anywhere except Toddle itself.' }));
  const btns = el('div', { className: 'btns' });
  const act = (label, type, confirmText) => {
    const b = el('button', { className: 'btn', textContent: label });
    b.addEventListener('click', async () => {
      if (confirmText && !confirm(confirmText)) return;
      const tabs = await chrome.tabs.query({ url: 'https://web.toddleapp.com/*' });
      if (!tabs.length) { b.textContent = 'Open Toddle first'; return; }
      await Promise.all(tabs.map((t) => chrome.tabs.sendMessage(t.id, { type }).catch(() => {})));
      b.textContent = 'Done ✓';
      setTimeout(() => { b.textContent = label; }, 1600);
    });
    return b;
  };
  btns.append(
    act('Clear cache', 'clearCache'),
    act('Reset Classroom customizations', 'resetGc', 'Reset class order, themes, hidden classes and renamed classes back to default?'),
    (() => { const b = el('button', { className: 'btn', textContent: 'Restore default settings' }); b.addEventListener('click', async () => { if (!confirm('Turn every setting back to its default?')) return; settings = { ...DEFAULTS, migratedV21: true }; await chrome.storage.sync.set({ settings }); render(); }); return b; })());
  data.append(btns);
  main.append(data);
  toc.append(el('a', { href: '#data', textContent: 'Your data' }));
  applyFilter();
};

const applyFilter = () => {
  const q = $('#filter').value.trim().toLowerCase();
  for (const row of document.querySelectorAll('.row')) row.hidden = q && !row.dataset.search.includes(q);
  for (const sec of document.querySelectorAll('.sec')) {
    const rows = sec.querySelectorAll('.row');
    sec.hidden = q && rows.length && [...rows].every((r) => r.hidden);
  }
};

(async () => {
  $('#ver').textContent = 'v' + chrome.runtime.getManifest().version;
  const { settings: s = {} } = await chrome.storage.sync.get('settings');
  settings = { ...DEFAULTS, ...s };
  render();
  $('#filter').addEventListener('input', applyFilter);
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'sync' && ch.settings) { settings = { ...DEFAULTS, ...ch.settings.newValue }; render(); }
  });
})();
