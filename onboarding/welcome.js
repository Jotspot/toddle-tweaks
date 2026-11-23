/* Toddle Tweaks — welcome page (opens once after installing; also linked from Settings). */
const TODDLE = 'https://web.toddleapp.com/';
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, attrs); e.append(...kids); return e; };

// Material icon paths (same set the extension uses).
const ICON = {
  todo: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
  event: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  summative: 'M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10 17H5v-2h5v2zm0-4H5v-2h5v2zm0-4H5V7h5v2zm4.82 6L12 12.16l1.41-1.41 1.41 1.42L17.99 9l1.42 1.42L14.82 15z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  check: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  trend: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  attendance: 'M9 17l3-2.94c-.39-.04-.68-.06-1-.06-2.67 0-8 1.34-8 4v2h9l-3-3zm2-5c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m4.47 8.5L12 17l1.4-1.41 2.07 2.08 5.13-5.17 1.4 1.41-6.53 6.59z',
  bolt: 'M7 2v11h3v9l7-12h-4l4-8z',
};
const icon = (name) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICON[name]); s.append(p);
  return s;
};

const FEATURES = [
  ['todo', '#1a73e8', 'A to-do that makes sense', 'Missing, Today, Tomorrow, This week. Old in-class items stop piling up.'],
  ['event', '#137333', 'Your whole week', 'The Timetable shows Monday to Friday with A/B/C/D days, holidays and what\'s due in each class.'],
  ['event', '#e37400', 'Timetable in Google Calendar', 'Export every class meeting for the semester, holidays and late starts included. Step-by-step import help.'],
  ['summative', '#9334e6', 'Finals, calmly', 'A few weeks before exams, a Finals page shows a day count and your exam schedule.'],
  ['search', '#d01884', 'Ctrl/⌘ + K', 'Jump to any class, assignment, page or setting. The class you\'re in now comes first.'],
  ['check', '#1e8e3e', 'Mark as done, with Undo', 'Tick an in-class item and it\'s marked done in Toddle. Changed your mind? Undo.'],
  ['trend', '#129eaf', 'Workload heatmap', 'See which days are heavy at a glance, with tips like your lightest day to get ahead.'],
  ['attendance', '#5f6368', 'Attendance at a glance', 'Your percentage, every class, and any period you weren\'t marked present.'],
  ['bolt', '#c5221f', 'Faster and quieter', 'Pages load from cache, trackers are blocked, and Google Docs open in a new tab.'],
];
const KEYS = [['Ctrl/⌘ K', 'Jump to anything'], ['g t', 'To-do'], ['g c', 'Calendar'], ['g w', 'Timetable'], ['g f', 'Finals'], ['[ ]', 'Next / previous section of a class'], ['?', 'Every shortcut']];

let settings = {};
// Changes go into the copy loaded at start (synchronously), so quick clicks can't overwrite each other.
const save = async (patch) => {
  settings = { ...settings, ...patch };
  paint();
  await chrome.storage.sync.set({ settings });
};
// Same defaults as the extension (src/common.js) for the settings this page shows.
const DEFAULTS = { classroomMode: true };
const paint = () => {
  const v = (k) => (k in settings ? settings[k] : DEFAULTS[k]);
  const gc = v('classroomMode') !== false;
  document.querySelectorAll('.look').forEach((b) => { const on = (b.dataset.mode === 'gc') === gc; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
};

const finish = async () => {
  try { await chrome.storage.local.set({ onboarded: Date.now() }); } catch {}
  location.href = TODDLE;
};

(async () => {
  const grid = $('#features');
  for (const [ic, color, title, text] of FEATURES) {
    grid.append(el('div', { className: 'feat' }, el('span', { className: 'feat-ico', style: `background:${color}` }, icon(ic)), el('b', { textContent: title }), el('small', { textContent: text })));
  }
  const keys = $('#keys');
  for (const [k, what] of KEYS) keys.append(el('div', { className: 'key' }, el('kbd', { textContent: k }), el('span', { textContent: what })));
  paint();
  try { settings = { ...((await chrome.storage.sync.get('settings')).settings || {}), ...settings }; } catch {}
  paint();
  document.querySelectorAll('.look').forEach((b) => b.addEventListener('click', () => save({ classroomMode: b.dataset.mode === 'gc' })));
  $('#skip').addEventListener('click', finish);
  $('#done').addEventListener('click', finish);

  // Firefox (and Chrome with restricted site access) needs an explicit OK for Toddle.
  const NEED = { origins: ['https://web.toddleapp.com/*'] };
  try { $('#access').hidden = await chrome.permissions.contains(NEED); } catch {}
  $('#grant').addEventListener('click', () => {
    let req;
    try { req = chrome.permissions.request(NEED); } catch { $('#accessHelp').hidden = false; return; }
    Promise.resolve(req).then(async (ok) => {
      if (ok || await chrome.permissions.contains(NEED)) { $('#access').hidden = true; return; }
      const help = $('#accessHelp');
      help.hidden = false;
      help.textContent = /firefox/i.test(navigator.userAgent)
        ? 'If no prompt appeared: menu ☰ → Add-ons and themes → Toddle Tweaks → Permissions, and turn on web.toddleapp.com.'
        : 'If no prompt appeared: right-click the Toddle Tweaks icon → "This can read and change site data" → "On web.toddleapp.com".';
    });
  });
})();
