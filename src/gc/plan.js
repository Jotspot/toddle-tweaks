/*
 * Toddle Tweaks: Classroom-style course plan.
 * Toddle's course plan (units → folders → links/files/assessments) rebuilt as a Classwork-like page:
 * units are topics with their dates, folders collapse, links open directly, and assessments show
 * your status from the assignment list. Toddle's own page stays available as "Classic view".
 */
(() => {
  const TT = window.TT;
  const { h } = TT;
  const I = (n, c) => TT.gIcon(n, c);
  const gc = TT.gc;

  const TYPE = { le: 'Learning experience', SA: 'Summative', FA: 'Formative', qt: 'Quick task', worksheet: 'Worksheet', smt: 'Summative', fmt: 'Formative' };
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
  const day = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtRange = (a, b) => {
    const s = day(a), e = day(b);
    const f = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (s && e) return `${f(s)} – ${f(e)}`;
    if (s) return `From ${f(s)}`;
    return '';
  };
  const isCurrent = (n) => {
    const s = day(n.start), e = day(n.end);
    if (!s || !e) return false;
    const now = new Date();
    return now >= s && now <= new Date(e.getTime() + 864e5);
  };

  const fileIcon = (n) => {
    const m = (n.mime || '') + ' ' + (n.fileType || '') + ' ' + (n.url || '');
    if (/image/i.test(m)) return 'image';
    if (/audio/i.test(m)) return 'mic';
    if (/drive\.google|docs\.google|google-apps|pdf|document|presentation|spreadsheet|msword|officedocument/i.test(m)) return 'description';
    if (/LINK/i.test(n.fileType || '') || /^https?:/i.test(n.url || '')) return 'link';
    return 'attach';
  };

  // Collapsed folders/units, per class.
  const collapsedKey = (id) => 'tt:cpCollapsed:' + id;

  gc.views['course-plan'] = (el, r) => {
    const course = gc.course(r.courseId);
    const color = TT.themes.color(course);
    const b = gc.base();
    const cached = TT.api.cachedCoursePlan(r.courseId);
    const { work, fresh, load, failedAt } = gc.courseData;
    if (!fresh(cached, 5 * 60e3)) load('cp', r.courseId, TT.api.getCoursePlan);
    const myWork = work(r.courseId) || [];
    const byContent = new Map(myWork.filter((x) => x.contentId).map((x) => [x.contentId, x]));

    const wrap = h('div', { class: 'tt-gc-course tt-gc-plan' });
    const search = h('input', { class: 'tt-gc-plan-search', type: 'search', placeholder: 'Search the course plan', 'aria-label': 'Search the course plan' });
    const toolbar = h('div', { class: 'tt-gc-plan-bar' },
      h('span', { class: 'tt-gc-plan-searchbox' }, I('search'), search),
      h('button', { class: 'tt-gc-btn text', onClick: () => toggleAll(true) }, I('unfold'), 'Expand all'),
      h('button', { class: 'tt-gc-btn text', onClick: () => toggleAll(false) }, I('fold'), 'Collapse all'),
      gc.link(`${b}/courses/${r.courseId}/course-plan/flow?tt=classic`, { class: 'tt-gc-btn text', title: "Toddle's original course plan" }, 'Classic view'));
    wrap.append(toolbar);

    if (!cached) {
      wrap.append(h('div', { class: 'tt-gc-empty small' }, failedAt['cp' + r.courseId] ? 'Couldn\'t load the course plan. "Classic view" still works.' : 'Loading course plan…'));
      el.append(wrap);
      return;
    }
    const nodes = cached.nodes || [];
    if (!nodes.length) { wrap.append(h('div', { class: 'tt-gc-feed-empty' }, 'Your teacher hasn\'t shared a course plan yet.')); el.append(wrap); return; }

    // Tree from the flat, ordered list.
    const kids = new Map();
    const ids = new Set(nodes.map((n) => n.id));
    const roots = [];
    for (const n of nodes) {
      if (n.parent && ids.has(n.parent)) { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(n); }
      else roots.push(n);
    }
    const count = (n) => (kids.get(n.id) || []).reduce((s, k) => s + (k.type === 'FOLDER' || k.type === 'UNIT_PLAN' ? count(k) : 1), 0);

    // Which unit is "current"? Use unit dates when teachers set real ones; many just leave the same
    // placeholder range on every unit, so then use whichever unit has your work due closest to today.
    const units = roots.filter((n) => n.type === 'UNIT_PLAN');
    const realDates = new Set(units.map((n) => `${n.start}|${n.end}`)).size > 1;
    const descendants = (n) => (kids.get(n.id) || []).flatMap((k) => [k, ...descendants(k)]);
    let currentId = null;
    if (realDates) currentId = (units.find(isCurrent) || {}).id || null;
    if (!currentId) {
      const now = Date.now();
      let best = Infinity;
      for (const u of units) {
        for (const k of descendants(u)) {
          const w = k.type === 'ASSESSMENT' && byContent.get(k.itemId);
          if (!w || !w.deadline) continue;
          const score = w.deadline >= now - 864e5 ? w.deadline - now : (now - w.deadline) * 3; // prefer upcoming work
          if (score < best) { best = score; currentId = u.id; }
        }
      }
    }
    if (!currentId && units.length) currentId = units[0].id;
    const showDates = realDates;

    // Default collapse state: current unit open, everything else closed (until you change it).
    const saved = TT.lsGet(collapsedKey(r.courseId), null);
    const collapsed = new Set(saved || roots.filter((n) => (n.type === 'UNIT_PLAN' || n.type === 'FOLDER') && n.id !== currentId).map((n) => n.id));
    const save = () => TT.lsSet(collapsedKey(r.courseId), [...collapsed]);

    const row = (n, trail) => {
      const q = (trail + ' ' + n.label).toLowerCase();
      if (n.type === 'ASSESSMENT') {
        const mine = byContent.get(n.itemId);
        const done = mine && (mine.toddleDone || (!mine.needsSubmission && mine.deadline && mine.deadline < Date.now() - 864e5));
        const late = mine && !mine.toddleDone && mine.needsSubmission && mine.deadline && mine.deadline < Date.now();
        const status = !mine ? null : mine.toddleDone ? (mine.isEvaluated ? ['Graded', 'ok'] : ['Turned in', 'ok']) : late ? ['Missing', 'late'] : null;
        const inner = [
          h('span', { class: 'tt-gc-work-ico', style: { background: done ? '#80868b' : color } }, I(mine && mine.isTest ? 'assignment' : 'assignment')),
          h('span', { class: 'tt-gc-cw-main' },
            h('span', { class: 'tt-gc-cw-title' }, n.label),
            h('span', { class: 'tt-gc-cw-sub' }, [TYPE[n.aType] || 'Assessment', mine ? null : 'not assigned to you yet'].filter(Boolean).join(' · '))),
          h('span', { class: 'tt-gc-cw-right' },
            status ? h('span', { class: 'tt-gc-pillst ' + status[1] }, status[0]) : null,
            mine && mine.deadline ? h('span', { class: 'tt-gc-cw-due' + (late ? ' late' : '') }, 'Due ' + TT.fmtDate(mine.deadline)) : null),
        ];
        const a = mine
          ? gc.link(mine.url, { class: 'tt-gc-plan-row', 'data-q': q }, ...inner)
          : gc.link(`${b}/courses/${r.courseId}/course-plan/flow?tt=classic`, { class: 'tt-gc-plan-row muted', 'data-q': q, title: "Open in Toddle's course plan" }, ...inner);
        return a;
      }
      // Files and links
      const url = safeUrl(n.url);
      const showThumb = TT.settings.cpThumbnails !== false && n.thumb && safeUrl(n.thumb);
      const visual = showThumb
        ? h('span', { class: 'tt-gc-plan-thumb' }, h('img', { src: n.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }))
        : h('span', { class: 'tt-gc-work-ico plain' }, I(fileIcon(n)));
      if (showThumb) visual.querySelector('img').addEventListener('error', (e) => { e.target.parentElement.replaceWith(h('span', { class: 'tt-gc-work-ico plain' }, I(fileIcon(n)))); });
      const inner = [
        visual,
        h('span', { class: 'tt-gc-cw-main' },
          h('span', { class: 'tt-gc-cw-title' }, n.label),
          h('span', { class: 'tt-gc-cw-sub' }, url ? host(url) : (n.fileType || 'File').toLowerCase())),
        url ? h('span', { class: 'tt-gc-plan-open' }, I('open')) : null,
      ];
      return url
        ? h('a', { class: 'tt-gc-plan-row', href: url, target: '_blank', rel: 'noopener noreferrer', 'data-q': q }, ...inner)
        : gc.link(`${b}/courses/${r.courseId}/course-plan/flow?tt=classic`, { class: 'tt-gc-plan-row', 'data-q': q }, ...inner);
    };

    const block = (n, level, trail) => {
      const list = kids.get(n.id) || [];
      const isTopic = level === 0;
      const isClosed = collapsed.has(n.id);
      const sec = h(isTopic ? 'section' : 'div', { class: (isTopic ? 'tt-gc-plan-topic' : 'tt-gc-plan-folder') + (isClosed ? ' collapsed' : ''), id: 'tt-cp-' + n.id });
      const meta = [n.type === 'UNIT_PLAN' && showDates ? fmtRange(n.start, n.end) : null, `${count(n)} item${count(n) === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
      const head = h('button', { class: isTopic ? 'tt-gc-plan-topic-head' : 'tt-gc-plan-folder-head', style: isTopic ? { color } : null, 'aria-expanded': isClosed ? 'false' : 'true', onClick: () => {
        if (collapsed.has(n.id)) collapsed.delete(n.id); else collapsed.add(n.id);
        save();
        sec.classList.toggle('collapsed');
        head.setAttribute('aria-expanded', sec.classList.contains('collapsed') ? 'false' : 'true');
      } },
        isTopic ? null : I('folder', 'tt-gc-plan-folder-ico'),
        h('span', { class: 'tt-gc-plan-name' }, n.label, isTopic && n.id === currentId ? h('span', { class: 'tt-gc-plan-now' }, 'Current unit') : null),
        h('span', { class: 'tt-gc-plan-meta' }, meta),
        I('expand', 'tt-gc-topic-caret'));
      const body = h('div', { class: 'tt-gc-plan-body' });
      const nextTrail = trail + ' ' + n.label;
      for (const k of list) body.append(k.type === 'FOLDER' || k.type === 'UNIT_PLAN' ? block(k, level + 1, nextTrail) : row(k, nextTrail));
      if (!list.length) body.append(h('div', { class: 'tt-gc-plan-empty' }, 'Nothing here yet'));
      sec.append(head, body);
      return sec;
    };

    // Sections: each root unit/folder is a topic; loose root items collect under "Resources".
    const main = h('div', { class: 'tt-gc-plan-main' });
    const nav = h('nav', { class: 'tt-gc-plan-nav', 'aria-label': 'Topics' }, h('div', { class: 'tt-gc-plan-nav-head' }, 'Topics'));
    let loose = null;
    for (const n of roots) {
      if (n.type === 'UNIT_PLAN' || n.type === 'FOLDER') {
        loose = null;
        main.append(block(n, 0, ''));
        nav.append(h('button', { class: 'tt-gc-plan-nav-item' + (n.id === currentId ? ' now' : ''), onClick: () => {
          const target = document.getElementById('tt-cp-' + n.id);
          if (target && target.classList.contains('collapsed')) target.querySelector('button').click();
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } }, n.label));
      } else {
        if (!loose) {
          loose = h('section', { class: 'tt-gc-plan-topic' }, h('div', { class: 'tt-gc-plan-topic-head static', style: { color } }, h('span', { class: 'tt-gc-plan-name' }, 'Resources')), h('div', { class: 'tt-gc-plan-body' }));
          main.append(loose);
        }
        loose.lastChild.append(row(n, ''));
      }
    }

    function toggleAll(open) {
      main.querySelectorAll('.tt-gc-plan-topic, .tt-gc-plan-folder').forEach((s) => {
        const id = (s.id || '').replace('tt-cp-', '');
        if (!id) return;
        s.classList.toggle('collapsed', !open);
        if (open) collapsed.delete(id); else collapsed.add(id);
      });
      save();
    }

    // Search filters in place (no re-render, so typing never loses focus).
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      main.classList.toggle('searching', !!q);
      const words = q.split(/\s+/).filter(Boolean);
      main.querySelectorAll('.tt-gc-plan-row').forEach((rw) => { rw.hidden = !!q && !words.every((w) => rw.dataset.q.includes(w)); });
      main.querySelectorAll('.tt-gc-plan-folder, .tt-gc-plan-topic').forEach((s) => {
        s.hidden = !!q && !s.querySelector('.tt-gc-plan-row:not([hidden])');
      });
    });

    wrap.append(h('div', { class: 'tt-gc-plan-layout' }, nav, main));
    el.append(wrap);
  };
})();
