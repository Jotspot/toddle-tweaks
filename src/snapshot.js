/* Toddle Tweaks — captures a lightweight snapshot of each page once it has settled. */
(() => {
  const TT = window.TT;
  const MAX_HTML = 1.5 * 1024 * 1024;
  const MAX_ENTRIES = 30;

  const cssHrefs = () => [...document.querySelectorAll('link[rel="stylesheet"]')]
    .filter((l) => !l.dataset.ttSnap && l.href)
    .map((l) => l.href)
    .filter((h, i, a) => h && a.indexOf(h) === i);

  const inlineStyles = () => {
    const out = [];
    let total = 0;
    for (const st of document.querySelectorAll('head style')) {
      if (st.dataset.ttSnap) continue;
      const t = st.textContent || '';
      if (!t || total + t.length > 400000) continue;
      total += t.length;
      out.push(t);
    }
    return out;
  };

  const capture = async () => {
    if (!TT.settings.snapshot || TT.settings.classroomMode) return;
    if (document.getElementById('tt-snapshot')) return; // never snapshot the snapshot
    if (document.hidden) return;
    const live = document.getElementById('root');
    if (!live) return;
    const text = live.innerText || '';
    if (text.length < 200) return;
    const key = TT.snapKey ? TT.snapKey() : location.pathname;
    if (!key || !/^\/platform\//.test(key)) return;

    const clone = live.cloneNode(true);
    clone.querySelectorAll('script, iframe, video, audio, object, embed, canvas, input[type="password"], .tt-no-snap, #tt-todo-page')
      .forEach((n) => n.remove());
    clone.querySelectorAll('input, textarea').forEach((n) => { n.removeAttribute('value'); n.textContent = ''; });
    // Find the main scroll position (Toddle scrolls inner containers, not the window).
    let scrollY = window.scrollY;
    const html = clone.outerHTML;
    if (html.length > MAX_HTML) return;

    const snap = { html, css: cssHrefs(), styles: inlineStyles(), title: document.title, t: Date.now(), textLen: text.length, scrollY };
    try {
      await TT.idb('snap', 'readwrite', (s) => s.put(snap, key));
      // Track recency and prune.
      const idx = TT.lsGet('tt:snapIndex', []).filter((k) => k !== key);
      idx.unshift(key);
      const drop = idx.splice(MAX_ENTRIES);
      TT.lsSet('tt:snapIndex', idx);
      if (drop.length) TT.idb('snap', 'readwrite', (s) => { drop.forEach((k) => s.delete(k)); return null; }).catch(() => {});
    } catch {}
  };

  // Capture after the page has been quiet for a moment.
  let quietTimer = null;
  let lastCapture = 0;
  const schedule = () => {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => {
      if (Date.now() - lastCapture < 4000) return schedule();
      lastCapture = Date.now();
      (window.requestIdleCallback || setTimeout)(() => capture());
    }, 1800);
  };

  TT.startSnapshots = () => {
    const root = document.getElementById('root');
    if (!root) return;
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: false });
    TT.onRoute(() => {
      if (TT.isHomePath()) TT.lsSet('tt:lastHome', location.pathname.replace(/\/+$/, ''));
      schedule();
    });
    if (TT.isHomePath()) TT.lsSet('tt:lastHome', location.pathname.replace(/\/+$/, ''));
    schedule();
    window.addEventListener('pagehide', () => { /* best effort */ });
  };
})();
