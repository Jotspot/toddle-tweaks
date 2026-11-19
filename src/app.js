/* Toddle Tweaks — orchestrator (isolated world; waits for Toddle's #root). */
(() => {
  const TT = window.TT;
  // (The floating To-do button was retired in 2.1 — Alt+T and the popup still open the to-do.)
  const mountFab = () => { const fab = document.getElementById('tt-fab'); if (fab) fab.remove(); };

  // ---------------- middle-click / ctrl-click on Toddle's own cards ----------------
  // Toddle uses clickable <div>s everywhere, so "open in new tab" never works. Fix the common ones.
  const resolveCardUrl = (el) => {
    const classCard = el.closest('[class*="ClassCardV2__container"], [class*="CourseList__courseItemContainer"]');
    if (classCard) {
      const title = (classCard.querySelector('[class*="ClassCardV2__classLabel"], [class*="CourseList__courseTitle"]') || classCard).innerText.trim().split('\n')[0];
      const list = (TT.api.cachedCourses() || {}).courses || [];
      let c = list.find((x) => x.title === title);
      if (!c) {
        const d = TT.todoData();
        const it = d && d.items.find((x) => x.courseTitle === title);
        if (it) c = { id: it.courseId };
      }
      if (c) return `/platform/${TT.cpId()}/courses/${c.id}/classroom`;
    }
    const feed = el.closest('[class*="ConsolidatedDeadlinesWidget__itemsWrapper"] > *, [class*="FeedItem__"], [class*="ClassroomFeed"] [class*="__container"]');
    if (feed) {
      const text = feed.innerText || '';
      const d = TT.todoData();
      if (d) {
        const it = d.items.filter((x) => text.includes(x.title)).sort((a, b) => b.title.length - a.title.length)[0];
        if (it) return it.url;
      }
    }
    return null;
  };
  const onAux = (e) => {
    if (!TT.settings.realLinks) return;
    const isNewTab = e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey));
    if (!isNewTab || e.target.closest('a[href]')) return;
    const url = resolveCardUrl(e.target);
    if (!url) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(url, '_blank', 'noopener');
  };
  document.addEventListener('auxclick', onAux, true);
  document.addEventListener('click', (e) => { if (e.ctrlKey || e.metaKey) onAux(e); }, true);
  document.addEventListener('mousedown', (e) => { if (e.button === 1 && resolveCardUrl(e.target)) e.preventDefault(); }, true); // no autoscroll icon

  // ---------------- keyboard shortcuts ----------------
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      if (TT.gc && TT.gc.active && TT.gc.active()) TT.gc.go(`/platform/${TT.cpId()}/courses?tt=todo`);
      else if (TT.closeTodoPage) TT.closeTodoPage(); else TT.openTodoPage();
    }
  });

  // ---------------- dev: reload the unpacked extension from the page (for testing) ----------------
  // @dev-start (removed from store builds by scripts/build.mjs)
  if (!('update_url' in chrome.runtime.getManifest())) {
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      if (e.data === 'tt:dev-reload') chrome.runtime.sendMessage({ type: 'devReload' });
      if (e.data && e.data.type === 'tt:dev-set' && e.data.patch) TT.saveSettings(e.data.patch);
    });
  }
  // @dev-end

  // ---------------- messages from popup ----------------
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg && msg.type === 'openTodo') {
      if (TT.gc && TT.gc.active && TT.gc.active()) TT.gc.go(`/platform/${TT.cpId()}/courses?tt=todo`); else TT.openTodoPage();
      reply({ ok: true });
    }
    if (msg && msg.type === 'resetGc') {
      try { localStorage.removeItem('tt:gc'); } catch {}
      if (TT.gc) { TT.gc.render(); TT.gc.rerender(); }
      reply({ ok: true });
    }
    if (msg && msg.type === 'refreshTodo') { TT.refreshTodo(true).then(() => reply({ ok: true })); return true; }
    if (msg && msg.type === 'clearCache') {
      Promise.all([
        TT.idb('gql', 'readwrite', (s) => s.clear()),
        TT.idb('snap', 'readwrite', (s) => s.clear()),
      ]).then(() => reply({ ok: true }), () => reply({ ok: false }));
      return true;
    }
    return false;
  });

  // ---------------- mount loop ----------------
  const mountAll = () => {
    TT.mountSmartPanel();
    mountFab();
  };
  const mountSoon = TT.debounce(mountAll, 120);

  const start = async () => {
    await TT.loadSettings();
    const root = await TT.waitFor('#root');
    if (!root) return;
    new MutationObserver(mountSoon).observe(root, { childList: true, subtree: true });
    TT.onRoute(() => { mountSoon(); });
    window.addEventListener('tt:settings', () => {
      const p = document.getElementById('tt-smart-panel');
      if (p && (!TT.settings.smartTodo || TT.settings.classroomMode)) p.remove();
      mountAll();
    });
    mountAll();
    TT.startSnapshots();
    // Warm the to-do data in the background once Toddle has settled.
    setTimeout(() => TT.refreshTodo(false), 1500);
  };
  start();
})();
