/*
 * Toddle Tweaks — boot (isolated world, document_start).
 * - Applies theme classes before Toddle paints (no flash).
 * - Paints the last snapshot of this page instantly while Toddle's 60 MB of JS boots,
 *   then fades it out the moment the live page has rendered.
 */
(() => {
  const TT = window.TT;
  const root = document.documentElement;

  const loadFonts = () => {
    if (document.getElementById('tt-fonts')) return;
    const add = (id, href) => {
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet'; l.href = href;
      (document.head || root).appendChild(l);
    };
    add('tt-fonts', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
    add('tt-fonts-gs', 'https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;500;700&display=swap');
  };

  const applyClasses = (s) => {
    loadFonts(); // our UI (palette, to-do, menus) uses these in both modes
    root.classList.toggle('tt-gc', !!s.classroomMode);
    root.classList.toggle('tt-smart', !!s.smartTodo);
    root.classList.toggle('tt-hide-intercom', !!s.blockIntercom);
    root.classList.toggle('tt-gc-compact', !!s.gcCompact);
    root.classList.toggle('tt-cp-style', s.gcCoursePlanStyle !== false);
    root.classList.toggle('tt-cp-nothumbs', s.cpThumbnails === false);
    root.classList.toggle('tt-cp-hidenr', s.cpHideNotRequired !== false);
    // Dark mode: on, off, or follow the computer.
    // Dark mode is switched off for now (styles kept in v26.css). Set DARK_MODE to bring it back.
    const dark = DARK_MODE && (s.darkMode === 'on' || (s.darkMode === 'system' && darkQuery && darkQuery.matches));
    root.classList.toggle('tt-dark', !!dark);
  };
  const DARK_MODE = false;
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => applyClasses(TT.settings));

  const early = TT.settingsSync();
  TT.settings = early;
  applyClasses(early);
  // Classroom shell draws immediately from cached data, before Toddle's JS even starts.
  if (TT.gc && TT.gc.start) TT.gc.start();
  TT.loadSettings().then((s) => { applyClasses(s); if (TT.gc) TT.gc.render(); });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'sync' && ch.settings) {
      TT.settings = { ...TT.DEFAULTS, ...ch.settings.newValue };
      try { localStorage.setItem('tt:settings', JSON.stringify(TT.settings)); } catch {}
      applyClasses(TT.settings);
      if (TT.gc) TT.gc.render();
      window.dispatchEvent(new CustomEvent('tt:settings'));
    }
  });

  // ---------------- instant snapshot ----------------
  if (!early.snapshot) return;
  // Classroom mode draws its own pages instantly; a snapshot of Toddle's UI would just flash.
  if (early.classroomMode) return;

  TT.snapKey = (path = location.pathname) => {
    if (!/^\/platform\//.test(path)) return TT.lsGet('tt:lastHome', null);
    return path.replace(/\/+$/, '');
  };

  const key = TT.snapKey();
  if (!key) return;

  const MAX_AGE = 14 * 864e5;
  let overlay = null;
  let pendingClick = null;
  let removed = false;

  TT.idb('snap', 'readonly', (s) => s.get(key)).then((snap) => {
    if (!snap || Date.now() - snap.t > MAX_AGE || removed) return;
    // If Toddle already rendered (fast load), don't bother.
    const live = document.getElementById('root');
    if (live && live.innerText && live.innerText.length > 200) return;
    show(snap);
  }).catch(() => {});

  function show(snap) {
    overlay = document.createElement('div');
    overlay.id = 'tt-snapshot';
    overlay.setAttribute('aria-hidden', 'true');
    for (const href of snap.css || []) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.dataset.ttSnap = '1';
      (document.head || root).appendChild(l);
    }
    if (snap.styles && snap.styles.length) {
      const st = document.createElement('style');
      st.dataset.ttSnap = '1';
      st.textContent = snap.styles.join('\n');
      (document.head || root).appendChild(st);
    }
    const body = document.createElement('div');
    body.className = 'tt-snapshot-body';
    // Snapshot of Toddle's own page (scripts/iframes were stripped when it was saved).
    const parsed = new DOMParser().parseFromString(snap.html, 'text/html');
    parsed.querySelectorAll('script, iframe, object, embed').forEach((n) => n.remove());
    body.append(...[...parsed.body.childNodes].map((n) => document.importNode(n, true)));
    overlay.appendChild(body);

    const pill = document.createElement('div');
    pill.className = 'tt-snapshot-pill';
    const setPill = (text) => { pill.textContent = ''; const d = document.createElement('span'); d.className = 'tt-dot'; pill.append(d, text); };
    setPill('Cached view · loading live Toddle…');
    overlay.appendChild(pill);
    const bar = document.createElement('div');
    bar.className = 'tt-snapshot-bar';
    overlay.appendChild(bar);

    // Remember what the user clicks on the snapshot and replay it on the live page.
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.target.closest('[class]');
      if (!t) return;
      pendingClick = {
        text: (t.innerText || '').trim().slice(0, 200),
        cls: String(t.className).split(/\s+/).map((c) => c.split('___')[0]).filter((c) => c.includes('__')),
      };
      setPill('Got it, opening as soon as Toddle is ready…');
    }, true);

    const mount = () => {
      if (removed) return;
      root.appendChild(overlay);
      if (snap.scrollY) requestAnimationFrame(() => { body.scrollTop = snap.scrollY; });
    };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
    watchForLive(snap);
  }

  function watchForLive(snap) {
    const started = Date.now();
    const target = Math.max(150, (snap.textLen || 0) * 0.6);
    let lastLen = -1;
    let stableSince = Date.now();
    const iv = setInterval(() => {
      const live = document.getElementById('root');
      const len = live ? (live.innerText || '').length : 0;
      if (len !== lastLen) { lastLen = len; stableSince = Date.now(); }
      const stable = Date.now() - stableSince > 700 && len > 300;
      if (len >= target || stable || Date.now() - started > 12000) {
        clearInterval(iv);
        hide();
      }
    }, 100);
  }

  function hide() {
    if (removed) return;
    removed = true;
    if (!overlay) return;
    overlay.classList.add('tt-snapshot-out');
    setTimeout(() => {
      overlay.remove();
      document.querySelectorAll('[data-tt-snap]').forEach((n) => n.remove());
    }, 180);
    if (pendingClick) replayClick(pendingClick);
  }

  function replayClick({ text, cls }) {
    if (!text) return;
    const tryIt = (n) => {
      const sel = cls.length ? cls.map((c) => `[class*="${c}___"]`).join('') : '[class]';
      const match = [...document.querySelectorAll(sel)].find((el) => (el.innerText || '').trim() === text);
      if (match) { match.click(); return; }
      if (n > 0) setTimeout(() => tryIt(n - 1), 250);
    };
    tryIt(12);
  }
})();
