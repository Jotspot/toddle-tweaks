/* Toddle Tweaks — popup: settings + quick "up next" list. */
const DEFAULTS = {
  snapshot: true, gqlCache: true, turboCache: false, blockTrackers: true, blockIntercom: true,
  smartTodo: true, hidePastNoSubmission: true, todoButton: false, classroomMode: true, realLinks: true, redirectHome: true, gcNativeCoursePlan: true,
};
const TODDLE = 'https://web.toddleapp.com/';
const $ = (s) => document.querySelector(s);
const status = (t) => { $('#status').textContent = t; };

async function getSettings() {
  const { settings = {} } = await chrome.storage.sync.get('settings');
  return { ...DEFAULTS, ...settings };
}

async function toddleTab() {
  const tabs = await chrome.tabs.query({ url: 'https://web.toddleapp.com/*' });
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs.find((t) => active && t.id === active.id) || tabs[0] || null;
}

// Firefox (and Chrome if you restrict site access) needs an explicit OK for Toddle.
// Only web.toddleapp.com matters: that's where the content scripts run.
const NEED = { origins: ['https://web.toddleapp.com/*'] };
const isFirefox = /firefox/i.test(navigator.userAgent);
async function checkAccess() {
  try {
    const ok = await chrome.permissions.contains(NEED);
    $('#needAccess').hidden = ok;
    return ok;
  } catch { $('#needAccess').hidden = true; return true; } // older browsers: assume granted
}

function showAccessHelp(extra) {
  const help = $('#accessHelp');
  help.hidden = false;
  help.textContent = (isFirefox
    ? 'If no prompt appeared: open the menu ☰ → Add-ons and themes → Toddle Tweaks → Permissions, and turn on access for web.toddleapp.com.'
    : 'If no prompt appeared: right-click the Toddle Tweaks icon → "This can read and change site data" → choose "On web.toddleapp.com" (or "On all sites").')
    + (extra ? ` (${extra})` : '');
}

async function init() {
  checkAccess();
  $('#grantAccess').addEventListener('click', () => {
    // Must be called straight from the click (no await before it) or browsers ignore it.
    let req;
    try { req = chrome.permissions.request(NEED); } catch (e) { showAccessHelp(e.message); return; }
    Promise.resolve(req).then(async (granted) => {
      const ok = await checkAccess();
      if (!granted && !ok) showAccessHelp();
      else if (ok) status('Access granted. Reload Toddle to start.');
    }, (e) => showAccessHelp(e && e.message));
  });
  const s = await getSettings();
  document.querySelectorAll('input[data-k]').forEach((el) => {
    el.checked = !!s[el.dataset.k];
    el.addEventListener('change', async () => {
      const cur = await getSettings();
      cur[el.dataset.k] = el.checked;
      await chrome.storage.sync.set({ settings: cur });
      const live = ['classroomMode', 'smartTodo', 'todoButton', 'hidePastNoSubmission', 'realLinks', 'blockIntercom'];
      status(live.includes(el.dataset.k) ? 'Applied.' : 'Saved — reload Toddle to apply.');
    });
  });

  $('#openTodo').addEventListener('click', async () => {
    const tab = await toddleTab();
    if (tab) {
      await chrome.tabs.update(tab.id, { active: true });
      chrome.tabs.sendMessage(tab.id, { type: 'openTodo' }).catch(() => {});
      window.close();
    } else {
      chrome.tabs.create({ url: TODDLE });
    }
  });

  $('#allSettings').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });
  if (false) $('#clearCache').addEventListener('click', async () => {
    const tab = await toddleTab();
    if (!tab) return status('Open Toddle first.');
    chrome.tabs.sendMessage(tab.id, { type: 'clearCache' }).then(() => status('Cache cleared.')).catch(() => status('Reload Toddle and try again.'));
  });

  renderUpcoming(s);
}

function fmtDue(t) {
  if (!t) return 'No due date';
  const now = Date.now();
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(t).setHours(0, 0, 0, 0) - sod.getTime()) / 864e5);
  const time = new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (t < now) { const late = Math.floor((now - t) / 864e5); return late ? `${late} day${late === 1 ? '' : 's'} late` : `Was due ${time}`; }
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days < 7) return new Date(t).toLocaleDateString([], { weekday: 'long' }) + ', ' + time;
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function renderUpcoming(s) {
  const { todo, localDone = {} } = await chrome.storage.local.get(['todo', 'localDone']);
  const list = $('#upList');
  if (!todo || !todo.items) return;
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const now = Date.now();
  const open = todo.items.filter((x) => !x.toddleDone && !localDone[x.id]
    && !(s.hidePastNoSubmission && !x.needsSubmission && x.status !== 'OVERDUE' && x.deadline && x.deadline < sod.getTime()));
  const missing = open.filter((x) => x.deadline && x.deadline < now && (x.status === 'OVERDUE' || x.needsSubmission));
  const upcoming = open.filter((x) => !missing.includes(x) && x.deadline && x.deadline >= sod.getTime()).sort((a, b) => a.deadline - b.deadline);
  const show = [...missing.slice(0, 3), ...upcoming].slice(0, 6);
  list.textContent = '';
  if (!show.length) { const m = document.createElement('div'); m.className = 'muted'; m.textContent = 'Nothing due. 🎉'; list.append(m); return; }
  for (const it of show) {
    const a = document.createElement('a');
    a.className = 'up' + (missing.includes(it) ? ' late' : '');
    a.href = new URL(it.url, TODDLE).href;
    a.target = '_blank';
    const t = document.createElement('span'); t.className = 't'; t.textContent = it.title;
    const m = document.createElement('span'); m.className = 'm'; m.textContent = `${missing.includes(it) ? 'Missing · ' : ''}${fmtDue(it.deadline)} · ${it.courseTitle}`;
    a.append(t, m);
    list.append(a);
  }
  const ago = Math.round((Date.now() - todo.t) / 60000);
  const note = document.createElement('div');
  note.className = 'muted';
  note.textContent = `Updated ${ago < 1 ? 'just now' : ago + ' min ago'}`;
  list.append(note);
}

init();
