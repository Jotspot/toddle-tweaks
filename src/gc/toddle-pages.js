/*
 * Toddle Tweaks — Classroom touches on Toddle's own pages shown inside the shell.
 *  - Course plan: units / folders / items styled like Classroom topics, plus Collapse all / Expand all.
 *  - Assignment page: Classroom's "+ Add or create" menu (drives Toddle's own upload/link/Drive/etc.
 *    controls), and "Your response" becomes "Your work".
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------- toast ----------------
  const toast = (msg) => {
    document.querySelectorAll('.tt-gc-toast').forEach((t) => t.remove());
    const t = h('div', { class: 'tt-gc-toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 3500);
  };
  gc.toast = toast;

  // ---------------- course plan ----------------
  const tagCoursePlan = () => {
    for (const row of document.querySelectorAll('[class*="AccordionItem__accordionContainer"]')) {
      const sub = row.querySelector('[class*="AccordionContent__subtit"]');
      const t = sub ? sub.textContent.trim() : '';
      const kind = /^Unit(?![a-z])/.test(t) ? 'unit' : /^Folder(?![a-z])/.test(t) ? 'folder' : 'item'; // text is like "Unit11 items"
      if (row.dataset.ttKind !== kind) row.dataset.ttKind = kind;
      const st = row.querySelector('[class*="AccordionContent__accordionStatus"]');
      if (st) { if (/not required/i.test(st.textContent)) st.dataset.ttNr = '1'; else delete st.dataset.ttNr; }
    }
  };

  // "Due on 23rd Nov 2026, 8:30 AM" → "… (in 4 days)". Works in classic mode too (see extras.js).
  const addRelativeDue = () => {
    if (TT.settings.relativeDates === false) return;
    for (const el of document.querySelectorAll('[class*="StudentAssignmentBasicDetails__basicDetails___"]')) {
      if (el.querySelector('.tt-reldue')) continue;
      const m = (el.textContent || '').match(/Due on (\d{1,2})(?:st|nd|rd|th)? (\w{3})\w* (\d{4}),? (\d{1,2}):(\d{2}) ?([AP]M)?/i);
      if (!m) continue;
      let hr = +m[4];
      if (m[6]) { if (/pm/i.test(m[6]) && hr < 12) hr += 12; if (/am/i.test(m[6]) && hr === 12) hr = 0; }
      const t = new Date(`${m[2]} ${m[1]} ${m[3]} ${hr}:${m[5]}`).getTime();
      if (!t) continue;
      el.append(TT.h('span', { class: 'tt-reldue' + (t < Date.now() ? ' late' : '') }, ' · ' + TT.relTime(t)));
    }
  };
  TT.addRelativeDue = addRelativeDue;

  // Toddle's list is virtualized, so click one toggle per tick and let it re-render.
  // Collapsing only needs top-level rows (children disappear with them).
  let toggling = false;
  const isRoot = (row) => {
    const cc = row.querySelector('[class*="AccordionItem__accordionContentContainer"]');
    return cc && parseFloat(getComputedStyle(cc).paddingLeft) <= 16;
  };
  const toggleAll = async (expand) => {
    if (toggling) return;
    toggling = true;
    try {
      const want = expand ? 'true' : 'false';
      const skip = new WeakSet();
      for (let i = 0; i < 150; i++) {
        const rows = [...document.querySelectorAll('[class*="AccordionItem__accordionContainer"]')];
        const target = rows
          .filter((r) => expand || isRoot(r))
          .map((r) => r.querySelector(`[aria-expanded="${expand ? 'false' : 'true'}"]`))
          .find((b) => b && !skip.has(b));
        if (!target) break;
        target.click();
        // Wait for Toddle to actually flip it before touching anything else.
        let flipped = false;
        for (let t = 0; t < 15; t++) {
          await sleep(40);
          if (!target.isConnected || target.getAttribute('aria-expanded') === want) { flipped = true; break; }
        }
        if (!flipped) skip.add(target);
      }
    } finally { toggling = false; }
  };

  const mountCoursePlanTools = () => {
    // Students don't get Toddle's filter bar, so the buttons sit next to the "OUTLINE" heading.
    const host = document.querySelector('[class*="Outline__titleContainer"]');
    if (!host || host.querySelector('.tt-gc-cp-tools')) return;
    host.append(h('span', { class: 'tt-gc-cp-tools' },
      h('button', { class: 'tt-gc-iconbtn small', title: 'Collapse all units & folders', onClick: (e) => { e.stopPropagation(); toggleAll(false); } }, I('fold')),
      h('button', { class: 'tt-gc-iconbtn small', title: 'Expand all', onClick: (e) => { e.stopPropagation(); toggleAll(true); } }, I('unfold'))));
  };

  // ---------------- assignment page: "+ Add or create" ----------------
  const clickToddleButton = (wrapper, re) => {
    const b = [...wrapper.querySelectorAll('button')].find((x) => re.test(x.innerText || ''));
    if (b) { b.click(); return true; }
    return false;
  };

  const fromMoreMenu = async (wrapper, label) => {
    const more = wrapper.querySelector('[class*="AttachmentItem__moreOptionContainer"]') ||
      [...wrapper.querySelectorAll('button')].find((x) => !(x.innerText || '').trim());
    if (!more) return false;
    document.documentElement.classList.add('tt-gc-quickpick'); // keep Toddle's own dropdown invisible
    try {
      more.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 20; i++) {
        await sleep(60);
        const dd = [...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)')].pop();
        if (!dd) continue;
        const item = [...dd.querySelectorAll('*')].find((n) => n.children.length === 0 && (n.textContent || '').trim() === label);
        if (item) { (item.closest('[role="menuitem"], li, button, [class*="item"], [class*="Item"]') || item).click(); return true; }
      }
      document.body.click();
      return false;
    } finally {
      setTimeout(() => document.documentElement.classList.remove('tt-gc-quickpick'), 200);
    }
  };

  const mountAddOrCreate = () => {
    const wrapper = document.querySelector('[class*="AddStudentWork__attachmentsWrapper"]');
    if (!wrapper) return;
    wrapper.classList.add('tt-gc-toddle-add');
    if (wrapper.previousElementSibling && wrapper.previousElementSibling.classList.contains('tt-gc-addcreate')) return;
    const notAvail = () => toast("That option isn't available for this assignment");
    const btn = h('button', { class: 'tt-gc-addcreate', type: 'button', onClick: (e) => {
      e.stopPropagation();
      gc.menu(btn, [
        { icon: 'drive', label: 'Google Drive', onClick: () => fromMoreMenu(wrapper, 'Google Drive').then((ok) => ok || notAvail()) },
        { icon: 'link', label: 'Link', onClick: () => fromMoreMenu(wrapper, 'Link').then((ok) => ok || notAvail()) },
        { icon: 'attach', label: 'File', onClick: () => clickToddleButton(wrapper, /Upload files/i) || notAvail() },
        { icon: 'image', label: 'Photo or video', onClick: () => clickToddleButton(wrapper, /Add media/i) || notAvail() },
        { divider: true },
        { heading: 'Create new' },
        { icon: 'description', label: 'Toddle Document', onClick: () => fromMoreMenu(wrapper, 'Toddle Document').then((ok) => ok || notAvail()) },
        { icon: 'mic', label: 'Audio recording', onClick: () => fromMoreMenu(wrapper, 'Audio').then((ok) => ok || notAvail()) },
        { icon: 'book', label: 'Workbook', onClick: () => fromMoreMenu(wrapper, 'Workbook').then((ok) => ok || notAvail()) },
      ], { align: 'left', width: 260 });
    } }, I('plus'), 'Add or create');
    wrapper.before(btn);
  };

  const renameResponseTitle = () => {
    for (const el of document.querySelectorAll('[class*="StudentAssignmentSubmission__responseTitle"]')) {
      if (el.textContent.trim() === 'Your response') el.textContent = 'Your work';
    }
  };

  // ---------------- loop ----------------
  const tick = TT.debounce(() => {
    if (!gc.active || !gc.active()) return;
    if (/\/course-plan\//.test(location.pathname)) { tagCoursePlan(); mountCoursePlanTools(); }
    if (/\/classroom-details\//.test(location.pathname)) { mountAddOrCreate(); }
  }, 120);

  TT.waitFor('body', 20000).then((body) => {
    if (!body) return;
    new MutationObserver(tick).observe(body, { childList: true, subtree: true });
    tick();
  });
})();
