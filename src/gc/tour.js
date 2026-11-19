/* Toddle Tweaks: a short guided tour of Classroom mode (spotlight + tooltip). */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;
  const DONE_KEY = 'tt:tourDone';

  const STEPS = [
    { title: 'Welcome to Classroom mode', body: 'Toddle, but laid out like Google Classroom. This takes about a minute, and you can leave any time with Esc.' },
    { sel: '#tt-gc-drawer', title: 'Your classes', body: 'Everything lives in this menu: Home, Calendar, your To-do and every class. The ☰ button at the top left makes it a slim icon rail.', place: 'right' },
    { sel: '.tt-gc-card', title: 'Class cards', body: 'Each class gets a Classroom banner and its teacher. Work that\'s due soon shows right on the card. Drag cards to put them in any order.', place: 'right' },
    { sel: '.tt-gc-card-stats', title: 'At a glance', body: 'Missing work and what\'s due this week, per class.', place: 'top' },
    { sel: '.tt-gc-card-more', title: 'Class options', body: 'Change the banner theme, hide a class you don\'t need, or open Advanced class settings to rename it or fix the teacher shown.', place: 'left' },
    { sel: '#tt-gc-bar a[title="To-do"]', title: 'Your to-do', body: 'Everything you need to do, sorted by when it\'s due: Missing, Today, Tomorrow, This week. Old in-class work that can\'t be turned in stays out of the way.', place: 'bottom' },
    { sel: '.tt-gc-bell', title: 'Notifications', body: 'Toddle\'s notifications open in a panel on the right.', place: 'bottom' },
    { sel: '#tt-gc-drawer a[title="Calendar"]', title: 'Calendar', body: 'A week view of everything due. You can export it to Google, Apple or Outlook calendar from there.', place: 'right' },
    { title: 'Jump anywhere', body: 'Press Ctrl + K (⌘ + K on a Mac) to search every class and assignment. Press ? to see all the keyboard shortcuts.', keys: ['Ctrl', 'K'] },
    { sel: '#tt-gc-drawer button[title="Toddle Tweaks settings"]', title: 'Make it yours', body: 'Every tweak can be switched on or off in settings, with a preview of what it does. You can restart this tour from the menu any time.', place: 'right' },
  ];

  let state = null;

  const end = (completed) => {
    if (!state) return;
    state.layer.remove();
    window.removeEventListener('resize', state.onResize);
    document.removeEventListener('keydown', state.onKey, true);
    state = null;
    TT.lsSet(DONE_KEY, completed ? 'done' : 'skipped');
  };

  const show = (i) => {
    const step = STEPS[i];
    state.i = i;
    const { spot, card } = state;
    const target = step.sel ? document.querySelector(step.sel) : null;
    if (target) target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = target ? target.getBoundingClientRect() : null;
    const visible = r && r.width > 0 && r.height > 0;

    if (visible) {
      const pad = 6;
      Object.assign(spot.style, { display: 'block', top: (r.top - pad) + 'px', left: (r.left - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    } else {
      Object.assign(spot.style, { display: 'block', top: '50%', left: '50%', width: '0px', height: '0px' });
    }

    card.textContent = '';
    card.append(...[
      h('div', { class: 'tt-tour-count' }, `${i + 1} of ${STEPS.length}`),
      h('div', { class: 'tt-tour-title' }, step.title),
      h('div', { class: 'tt-tour-body' }, step.body),
      step.keys ? h('div', { class: 'tt-tour-keys' }, step.keys.map((k) => h('kbd', null, k))) : null,
      h('div', { class: 'tt-tour-actions' },
        i === STEPS.length - 1 ? h('span') : h('button', { class: 'tt-gc-btn text', onClick: () => end(false) }, 'Skip tour'),
        h('span', null,
          i > 0 ? h('button', { class: 'tt-gc-btn text', onClick: () => show(i - 1) }, 'Back') : null,
          h('button', { class: 'tt-gc-btn filled', onClick: () => (i === STEPS.length - 1 ? end(true) : show(i + 1)) }, i === STEPS.length - 1 ? 'Done' : 'Next')))].filter(Boolean));

    // Place the card next to the target (or centred).
    card.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const cw = card.offsetWidth, ch = card.offsetHeight, W = window.innerWidth, H = window.innerHeight, gap = 14;
      let x = (W - cw) / 2, y = (H - ch) / 2;
      if (visible) {
        const place = step.place || 'bottom';
        if (place === 'right' && r.right + gap + cw < W) { x = r.right + gap; y = r.top; }
        else if (place === 'left' && r.left - gap - cw > 0) { x = r.left - gap - cw; y = r.top; }
        else if (place === 'top' && r.top - gap - ch > 0) { x = r.left + r.width / 2 - cw / 2; y = r.top - gap - ch; }
        else { x = r.left + r.width / 2 - cw / 2; y = r.bottom + gap; }
        if (y + ch > H - 12) y = Math.max(12, r.top - gap - ch);
      }
      card.style.left = Math.max(12, Math.min(x, W - cw - 12)) + 'px';
      card.style.top = Math.max(12, Math.min(y, H - ch - 12)) + 'px';
      card.style.visibility = '';
      const next = card.querySelector('.tt-gc-btn.filled');
      if (next) next.focus({ preventScroll: true });
    });
  };

  gc.startTour = async () => {
    if (state) return;
    document.querySelectorAll('.tt-gc-menu, .tt-gc-account, .tt-gc-tour-offer').forEach((m) => m.remove());
    if (!document.documentElement.classList.contains('tt-gc-drawer-open')) {
      // The tour reads better with the full menu showing.
      document.documentElement.classList.add('tt-gc-drawer-open');
    }
    const r = gc.route();
    if (!r || r.view !== 'home') { gc.go(`${gc.base()}/courses`); await new Promise((res) => setTimeout(res, 450)); }
    const layer = h('div', { class: 'tt-tour', role: 'dialog', 'aria-label': 'Classroom mode tour' });
    const spot = h('div', { class: 'tt-tour-spot' });
    const card = h('div', { class: 'tt-tour-card' });
    layer.append(spot, card);
    document.body.append(layer);
    const onResize = TT.debounce(() => state && show(state.i), 80);
    const onKey = (e) => {
      if (!state) return;
      if (e.key === 'Escape') { e.preventDefault(); end(false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (state.i < STEPS.length - 1) show(state.i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (state.i > 0) show(state.i - 1); }
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey, true);
    state = { layer, spot, card, onResize, onKey, i: 0 };
    show(0);
  };

  // First visit to the Classroom home: a small, dismissible offer (never a pop-up that blocks you).
  gc.maybeOfferTour = () => {
    if (TT.lsGet(DONE_KEY, null) || document.querySelector('.tt-gc-tour-offer') || state) return;
    const offer = h('div', { class: 'tt-gc-tour-offer', role: 'status' },
      h('span', null, 'New to Classroom mode? Take a 1-minute tour.'),
      h('button', { class: 'tt-gc-btn text light', onClick: () => { offer.remove(); TT.lsSet(DONE_KEY, 'dismissed'); } }, 'No thanks'),
      h('button', { class: 'tt-gc-btn text light strong', onClick: () => { offer.remove(); gc.startTour(); } }, 'Take the tour'));
    document.body.append(offer);
  };
})();
