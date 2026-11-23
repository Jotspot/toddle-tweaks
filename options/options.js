/* Toddle Tweaks: settings page. Every setting has a little live preview of what it does. */
const DEFAULTS = {
  snapshot: true, gqlCache: true, turboCache: false, blockTrackers: true, blockIntercom: true,
  smartTodo: true, hidePastNoSubmission: true, todoButton: false, classroomMode: true, redirectHome: true, realLinks: true,
  cacheCoursePlan: true, googleBanners: true, gcNativeCoursePlan: true, gcCardInfo: true, gcCompact: false, gcCoursePlanStyle: true, cpThumbnails: true, cpImages: 'preview', cpHideNotRequired: true,
  tabBadge: true, commandPalette: true, shortcuts: true, relativeDates: true,
  docsNewTab: true, linksNewTab: false, whatsNew: true,
  darkMode: 'off', gcTimetable: true, gcAttendance: true, periodNames: 'block', nextClass: false, nextClassRoom: true,
  finalsMode: true, finalsLead: '45', finalsStart: '', finalsEnd: '', finalsReviewDays: '7',
  heatmap: true, hm_calendar: true, hm_timetable: false, hm_home: false, hm_todo: false, hm_sidebar: false,
  hmExpanded: false, hmWeekends: false, hmWeightTests: true, hmGrid: true, hmInsights: true,
  hmiBusiest: true, hmiLightest: true, hmiTests: true, hmiClass: true, hmiTotal: true, hmiOff: true, hmiMissing: true, hmiFinals: true,
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
  cpImages: (v) => {
    const pic = (c) => `<span class="pv-pic ${c}"></span>`;
    const ico = (c) => `<span class="pv-ico" style="background:${c}"></span>`;
    const row = (name, kind, color, cls) => v === 'icons' ? `<div class="pv-cp-item">${ico(color)}${name}<small>${kind}</small></div>`
      : v === 'card' ? `<div class="pv-cp-item">${ico(color)}${name}<small>${kind}</small>${pic(cls + ' card')}</div>`
      : `<div class="pv-cp-item">${pic(cls)}${name}<small>${kind}</small></div>`;
    return `<div class="pv-cp">${row('Unit 3 notes', 'Google Slides', '#f4b400', 's')}${row('Cells video', 'YouTube', '#ff0000', 'y')}</div>`;
  },
  thumbs: (on) => `<div class="pv-cp"><div class="pv-cp-item">${on ? '<span class="pv-thumb"></span>' : ''}Course syllabus<small>Link</small></div><div class="pv-cp-item">${on ? '<span class="pv-thumb t2"></span>' : ''}Class textbook<small>Link</small></div></div>`,
  notRequired: (on) => `<div class="pv-cp"><div class="pv-cp-item"><span class="pv-sq">LE</span>Warm-up 1.1${on ? '' : '<em>Submission not required</em>'}</div><div class="pv-cp-item"><span class="pv-sq">SA</span>Unit 1 test${on ? '' : '<em>Submission not required</em>'}</div></div>`,
  smartTodo: (on) => on
    ? `<div class="pv-todo"><b class="red">Today</b><div>Lab report <small>Due 8:00 AM</small></div><b>Tomorrow</b><div>Essay draft <small>Turn in</small></div></div>`
    : `<div class="pv-todo"><b>Pending (80)</b><div>Welcome activity <small>Due 14th Aug</small></div><div>Warm-up 1.1 <small>Due 14th Aug</small></div></div>`,
  hidePast: (on) => `<div class="pv-todo"><b>Assigned</b>${on ? '' : '<div class="old">Class notes <small>94 days late</small></div><div class="old">Warm-up 1.2 <small>93 days late</small></div>'}<div>Essay draft <small>Due tomorrow</small></div></div>`,
  tabBadge: (on) => `<div class="pv-tab"><span class="pv-fav"></span>${on ? '<b>(3)</b> ' : ''}Classroom</div>`,
  palette: (on) => on ? `<div class="pv-pal"><div class="pv-pal-in">⌕ bio</div><div class="pv-pal-r sel">Biology <small>Class</small></div><div class="pv-pal-r">Biology lab report <small>Assignment</small></div></div>` : `<div class="pv-mouse muted">Ctrl+K does nothing</div>`,
  banners: (on) => on ? '<div class="pv-banner g"><span>Biology</span></div><small>Google Classroom illustration</small>' : '<div class="pv-banner p"><span>Biology</span><i></i></div><small>Original pattern</small>',
  newTab: (on) => on
    ? `<div class="pv-tab"><span class="pv-fav"></span>Toddle</div><div class="pv-tab g"><span class="pv-fav g"></span>Essay draft - Google Docs</div>`
    : `<div class="pv-viewer"><span>Essay draft</span><i>✕</i><div></div></div>`,
  dark: (v) => v === 'off'
    ? `<div class="pv-dk"><div class="pv-dk-bar">Classroom</div><div class="pv-dk-card"><b>Biology</b><small>Lab report · Due tomorrow</small></div></div>`
    : `<div class="pv-dk dark"><div class="pv-dk-bar">Classroom</div><div class="pv-dk-card"><b>Biology</b><small>Lab report · Due tomorrow</small></div></div>`,
  heatmap: (on) => on ? `<div class="pv-hm">${[1, 3, 0, 4, 2].map((l, i) => `<span class="l${l}"><small>${'MTWTF'[i]}</small>${[2, 5, 0, 7, 3][i] || '–'}</span>`).join('')}</div>` : `<div class="pv-mouse muted">No heatmap</div>`,
  next: (on) => on ? `<div class="pv-next"><i></i><small>NEXT</small><b>Chemistry</b> in 12 min · H306</div>` : `<div class="pv-mouse muted">Top bar shows only your icons</div>`,
  week: (on) => on ? `<div class="pv-week">${'MTWTF'.split('').map((d) => `<span><small>${d}</small><i></i><i></i><i></i></span>`).join('')}</div>` : `<div class="pv-week few">${'MTW'.split('').map((d) => `<span><small>${d}</small><i></i><i></i></span>`).join('')}</div>`,
  relDates: (on) => `<div class="pv-due">Submission open • Due on 23rd Nov, 8:30 AM${on ? ' <b>· in 4 days</b>' : ''}</div>`,
};

// mode: 'gc' = only in Classroom mode, 'classic' = only in regular Toddle, 'both'. An item's own mode wins.
// needs: another setting that has to be on for this one to do anything.
const SECTIONS = [
  { id: 'start', title: 'Start here', mode: 'both', items: [
    { k: 'classroomMode', t: 'Google Classroom mode', d: 'Class cards, Stream / Classwork / People, To-do, Calendar, Timetable and more, in a Classroom-style app. Turn it off for regular Toddle.', pv: P.classroom, master: true },
    { k: 'whatsNew', t: '"What\'s new" after updates', d: 'A small note in Toddle after Toddle Tweaks updates, with a link to the changelog.' },
  ] },
  { id: 'todo', title: 'To-do & checking off', mode: 'both', items: [
    { k: 'smartTodo', t: 'Smart to-do on the home page', d: 'Replaces "Assignments and deadlines" with Missing, Today, This week and so on.', pv: P.smartTodo, mode: 'classic' },
    { k: 'hidePastNoSubmission', t: 'Check off past in-class items automatically', d: 'Old in-class work that can\'t be turned in is checked off instead of piling up. It goes to the bottom of the Done tab.', pv: P.hidePast },
    { k: 'tabBadge', t: 'Count in the tab title', d: 'How many things are missing or due today/tomorrow, visible from any tab.', pv: P.tabBadge },
  ] },
  { id: 'school', title: 'Timetable & attendance', mode: 'both', intro: 'In regular Toddle these open over the page from Ctrl/⌘+K or g w / g a.', items: [
    { k: 'gcTimetable', t: 'Timetable shows the whole week', d: 'Monday to Friday with A/B/C/D days, holidays, finals days and what\'s due in each class. Export every class meeting to Google Calendar from there.', pv: P.week, mode: 'gc' },
    { k: 'periodNames', t: 'Class blocks', d: 'Blocks: like A1 or B3, from your rotation and period. Periods: Toddle\'s own P1, P2…', choices: [['block', 'Blocks (A1)'], ['period', 'Periods (P1)']] },
    { k: 'nextClass', t: 'Next class in the top bar', d: '"Now: Chemistry until 1:30" or "Next: Chemistry in 12 min". Click it to open the timetable.', pv: P.next, mode: 'gc' },
    { k: 'nextClassRoom', t: 'Show the room with the next class', d: 'Adds the room, like "· H306".', mode: 'gc', needs: 'nextClass' },
    { k: 'gcAttendance', t: 'Attendance as a Classroom page', d: 'Your percentage, a breakdown, the year at a glance, every class, and the periods you weren\'t marked present. Off: Toddle\'s own attendance page.', mode: 'gc' },
  ] },
  { id: 'finals', title: 'Finals', mode: 'both', intro: 'A Finals page in the menu in the weeks before exams: a day count, your exam schedule and what\'s due before finals.', items: [
    { k: 'finalsMode', t: 'Finals page before exams', d: 'Exam days are found from your school\'s bell schedule or calendar in Toddle. If they\'re wrong, set them below.' },
    { k: 'finalsLead', t: 'Show it this many days before finals', d: 'When the Finals item appears in the menu.', type: 'number', min: 1, max: 120, unit: 'days', needs: 'finalsMode' },
    { k: 'finalsStart', t: 'First exam day', d: 'Found automatically. Change it if it’s wrong; Reset goes back to automatic.', type: 'date', found: 'start', needs: 'finalsMode' },
    { k: 'finalsEnd', t: 'Last exam day', d: 'Found automatically. Change it if it’s wrong; Reset goes back to automatic.', type: 'date', found: 'end', needs: 'finalsMode' },
  ] },
  { id: 'heatmap', title: 'Workload heatmap', mode: 'both', intro: 'A week coloured by how much is due each day. Click the arrow on it for six weeks and a few insights.', items: [
    { k: 'heatmap', t: 'Workload heatmap', d: 'Turn the whole thing on or off.', pv: P.heatmap },
    { t: 'Where it shows', d: 'The Calendar, Timetable, home page and menu are Classroom mode; the home page also means the smart to-do in regular Toddle.', type: 'multi', label: 'Choose places', needs: 'heatmap', options: [
      ['hm_calendar', 'Calendar'], ['hm_timetable', 'Timetable'], ['hm_home', 'Home page'], ['hm_todo', 'To-do page'], ['hm_sidebar', 'Menu (small strip)']] },
    { k: 'hmInsights', t: 'Insights', d: 'Short notes when expanded.', type: 'multi', label: 'Choose insights', needs: 'heatmap', options: [
      ['hmiBusiest', 'Busiest day this week'], ['hmiLightest', 'Lightest day (a good day to get ahead)'], ['hmiTests', 'Tests in the next two weeks'],
      ['hmiClass', 'Class with the most work'], ['hmiTotal', 'This week in total'], ['hmiOff', 'Days off'], ['hmiMissing', 'Still to turn in'], ['hmiFinals', 'Finals countdown']] },
    { k: 'hmExpanded', t: 'Start expanded', d: 'Show six weeks and insights without clicking the arrow.', needs: 'heatmap' },
    { k: 'hmGrid', t: 'Six-week view', d: 'The next six weeks as a grid when expanded.', needs: 'heatmap' },
    { k: 'hmWeekends', t: 'Always show the weekend', d: 'Otherwise Saturday and Sunday only show up when something is due.', needs: 'heatmap' },
    { k: 'hmWeightTests', t: 'Tests count double', d: 'Tests, quizzes and summatives make a day darker than homework.', needs: 'heatmap' },
  ] },
  { id: 'classroom', title: 'Classroom look', mode: 'gc', intro: 'How Classroom mode looks. These only apply while it\'s on.', items: [
    { k: 'gcCompact', t: 'Compact spacing', d: 'Tighter rows and cards, so more fits on screen.', pv: P.compact },
    { k: 'gcCardInfo', t: 'Class cards show what\'s due', d: 'Up to three due items plus a "missing / due this week" summary on each card.', pv: P.cardInfo },
    { k: 'googleBanners', t: 'Use Google Classroom banner art', d: "Class banners use Google Classroom's own illustrations, loaded from Google's servers. Off: original Toddle Tweaks patterns in the same colours.", pv: P.banners },
    { k: 'gcNativeCoursePlan', t: 'Course plan as a Classroom page', d: "Units become topics with their dates, links open directly, and assignments show your status. Off: Toddle's own course plan.", pv: P.cpStyle },
    { k: 'cpImages', t: 'Course plan pictures', d: 'Previews: a picture of each Doc, slide deck or video next to it. Cards: Classroom-style cards on the right. Icons: coloured file icons only (nothing loaded from Google or YouTube).', pv: P.cpImages,
      choices: [['preview', 'Previews'], ['card', 'Cards'], ['icons', 'Icons']] },
    { k: 'cpHideNotRequired', t: 'Hide "Submission not required"', d: 'Removes the repeated label from course plan rows.', pv: P.notRequired },
    { k: 'gcCoursePlanStyle', t: "Restyle Toddle's course plan", d: "When you open Toddle's own course plan (Classic view), give it Classroom-style headings and rows." },
  ] },
  { id: 'nav', title: 'Shortcuts & links', mode: 'both', items: [
    { k: 'commandPalette', t: 'Quick jump (Ctrl/⌘ + K)', d: 'Search every class, assignment, page, action and setting and jump straight there.', pv: P.palette },
    { k: 'shortcuts', t: 'Keyboard shortcuts', d: 'g h home, g t to-do, g c calendar, g w timetable, [ and ] between a class\'s sections, ? for the full list.' },
    { k: 'relativeDates', t: 'Relative due dates', d: 'Adds "in 4 days" or "2 days ago" next to due dates on assignment pages.', pv: P.relDates },
    { k: 'docsNewTab', t: 'Open Google Docs in a new tab', d: "Google Docs, Slides, Sheets, Drive, Microsoft 365, Canva and similar links (and sites Toddle can't show anyway) open in their own tab instead of Toddle's built-in viewer.", pv: P.newTab },
    { k: 'linksNewTab', t: 'Open every link in a new tab', d: "Any web link skips Toddle's viewer. Uploaded files (PDFs, images, videos) still open in the viewer." },
    { k: 'realLinks', t: 'Middle-click opens a new tab', d: 'Middle-click or Ctrl-click class and assignment cards to open them in a new tab.' },
  ] },
  { id: 'speed', title: 'Speed & privacy', mode: 'both', items: [
    { k: 'gqlCache', t: 'Cache settings & class data', d: 'Config that rarely changes loads from your computer and refreshes in the background.', reload: true },
    { k: 'cacheCoursePlan', t: 'Cache course plans', d: 'Course plans open instantly. Changes your teacher makes show up on the next visit.', reload: true },
    { k: 'snapshot', t: 'Instant page snapshots', d: 'Shows your last view of a page right away while Toddle loads.', reload: true, mode: 'classic' },
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
let found = null; // exam dates Toddle Tweaks found (written by the Toddle page)
const openMulti = new Set();
const fmtD = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); };
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
      const row = el('div', { className: 'row' + (it.choices ? ' choice' : '') + (it.type ? ' wide' : '') });
      row.dataset.search = (it.t + ' ' + it.d + ' ' + (it.options || []).map((o) => o[1]).join(' ')).toLowerCase();
      const on = it.choices ? settings[it.k] : !!settings[it.k];
      const mode = it.mode || sec.mode;
      const wrongMode = !it.master && ((mode === 'gc' && !settings.classroomMode) || (mode === 'classic' && settings.classroomMode));
      const needsOff = it.needs && !settings[it.needs];
      const disabled = wrongMode || needsOff;
      const text = el('div', { className: 'txt' });
      const ttl = el('div', { className: 'ttl', textContent: it.t });
      if (it.mode && it.mode !== sec.mode) ttl.append(el('span', { className: 'mode small ' + it.mode, textContent: MODE_LABEL[it.mode] }));
      text.append(ttl, el('div', { className: 'desc', textContent: it.d }));
      if (it.reload) text.append(el('div', { className: 'note', textContent: 'Applies the next time you load Toddle' }));
      if (it.found) {
        const SRC = { bell: "your school's bell schedule", calendar: 'the school calendar', schedule: 'the shape of your timetable' };
        const manual = settings.finalsStart || settings.finalsEnd;
        text.append(el('div', { className: 'note ' + (manual ? '' : 'ok'), textContent: manual ? 'Set by you' + (found && found[it.found] ? ` (found automatically: ${fmtD(found[it.found])})` : '')
          : found && found[it.found] ? `Found automatically from ${SRC[found.source] || 'Toddle'}` : 'Not found yet. Open the Finals page in Toddle once, or set it here' }));
      }
      if (disabled) text.append(el('div', { className: 'note', textContent: wrongMode ? (mode === 'gc' ? 'Turn on Google Classroom mode to use this' : 'Only used while Classroom mode is off')
        : `Turn on "${(SECTIONS.flatMap((x) => x.items).find((x) => x.k === it.needs) || {}).t || it.needs}" to use this` }));
      const pv = el('div', { className: 'preview' + (on ? ' on' : '') });
      if (it.pv) pv.append(...parse(it.pv(on)));
      else pv.classList.add('empty');
      let sw;
      if (it.type === 'number') {
        const input = el('input', { type: 'number', className: 'field num', value: settings[it.k] || '', min: it.min, max: it.max, ariaLabel: it.t });
        input.addEventListener('change', async () => {
          const n = Math.round(Number(input.value));
          if (!n || n < it.min || n > it.max) { input.value = settings[it.k]; return; }
          await save({ [it.k]: String(n) });
        });
        sw = el('div', { className: 'fieldwrap' });
        sw.append(input, el('span', { className: 'unit', textContent: it.unit || '' }));
      } else if (it.type === 'multi') {
        const det = el('details', { className: 'multi' });
        const on = it.options.filter(([k]) => !!settings[k]).length;
        det.append(el('summary', { textContent: `${it.label} (${on} of ${it.options.length})` }));
        const box = el('div', { className: 'multi-list' });
        for (const [k, label] of it.options) {
          const lab = el('label');
          const cb = el('input', { type: 'checkbox', checked: !!settings[k] });
          cb.addEventListener('change', () => save({ [k]: cb.checked }));
          lab.append(cb, document.createTextNode(' ' + label));
          box.append(lab);
        }
        det.append(box);
        sw = el('div', { className: 'fieldwrap col' });
        if (it.k) {
          const sw2 = el('input', { type: 'checkbox', className: 'switch', checked: !!settings[it.k], ariaLabel: it.t });
          sw2.addEventListener('change', async () => { await save({ [it.k]: sw2.checked }); render(); });
          sw.append(sw2);
        }
        sw.append(det);
        const mk = it.k || it.label;
        if (openMulti.has(mk)) det.open = true;
        det.addEventListener('toggle', () => { if (det.open) openMulti.add(mk); else openMulti.delete(mk); });
      } else if (it.type === 'date' || it.type === 'textarea') {
        const auto = it.found && !settings.finalsStart && !settings.finalsEnd && found && found[it.found];
        const input = it.type === 'date'
          ? el('input', { type: 'date', className: 'field' + (auto ? ' auto' : ''), value: settings[it.k] || auto || '', ariaLabel: it.t })
          : el('textarea', { className: 'field area', value: settings[it.k] || '', rows: 3, ariaLabel: it.t, placeholder: 'Go through notes and old work\nDo practice questions\nAsk about anything unclear' });
        input.addEventListener('change', async () => {
          if ((settings[it.k] || '') === input.value) return;
          const patch = { [it.k]: input.value.trim() ? input.value : '' };
          // Changing one date by hand keeps the other one that was found.
          if (it.found && found) { const other = it.k === 'finalsStart' ? 'finalsEnd' : 'finalsStart'; if (!settings[other] && found[other === 'finalsStart' ? 'start' : 'end']) patch[other] = found[other === 'finalsStart' ? 'start' : 'end']; }
          await save(patch);
          render();
        });
        sw = input;
        if (it.type === 'date') {
          const clr = el('button', { type: 'button', className: 'btn small', textContent: it.found ? 'Reset' : 'Clear', title: it.found ? 'Go back to the dates found automatically' : '' });
          clr.addEventListener('click', async () => { await save(it.found ? { finalsStart: '', finalsEnd: '' } : { [it.k]: '' }); render(); });
          sw = el('div', { className: 'fieldwrap' });
          sw.append(input, clr);
        }
      } else if (it.choices) {
        sw = el('div', { className: 'seg', role: 'radiogroup', ariaLabel: it.t });
        for (const [val, label] of it.choices) {
          const b = el('button', { type: 'button', className: 'seg-b' + (on === val ? ' on' : ''), textContent: label, role: 'radio', ariaChecked: String(on === val) });
          b.addEventListener('click', async () => { await save({ [it.k]: val }); render(); });
          sw.append(b);
        }
      } else {
        sw = el('input', { type: 'checkbox', className: 'switch', checked: on, ariaLabel: it.t });
        sw.addEventListener('change', async () => {
          await save({ [it.k]: sw.checked });
          render();
        });
      }
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
  const welcome = el('a', { className: 'btn', href: '../onboarding/welcome.html', textContent: 'Show the welcome page' });
  btns.prepend(welcome);
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
  try { found = (await chrome.storage.local.get('finalsFound')).finalsFound || null; } catch {}
  render();
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 50); }
  $('#filter').addEventListener('input', applyFilter);
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'sync' && ch.settings) { settings = { ...DEFAULTS, ...ch.settings.newValue }; render(); }
    if (area === 'local' && ch.finalsFound) { found = ch.finalsFound.newValue || null; render(); }
  });
})();
