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
  const safeImg = (u) => (/^(https?:\/\/|data:image\/)/i.test(u || '') ? u : null);
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

  // What a file/link is, from its URL / mime type: drives the icon, its colour and the preview.
  const KINDS = {
    doc: ['description', '#4285f4', 'Google Docs'], slides: ['slides', '#f4b400', 'Google Slides'], sheet: ['sheet', '#0f9d58', 'Google Sheets'],
    form: ['form', '#7248b9', 'Google Forms'], drive: ['drive', '#1a73e8', 'Google Drive'], youtube: ['play', '#ff0000', 'YouTube'],
    pdf: ['description', '#ea4335', 'PDF'], word: ['description', '#2b579a', 'Document'], ppt: ['slides', '#d24726', 'Presentation'], excel: ['sheet', '#217346', 'Spreadsheet'],
    video: ['video', '#d93025', 'Video'], audio: ['mic', '#e37400', 'Audio'], image: ['image', '#1e8e3e', 'Image'], link: ['link', '#5f6368', ''], file: ['attach', '#5f6368', 'File'],
  };
  const kindOf = (n) => {
    const u = n.url || '';
    const m = ((n.mime || '') + ' ' + (n.fileType || '')).toLowerCase();
    const ext = (u.split(/[?#]/)[0].match(/\.(\w{2,7})$/) || [])[1] || '';
    if (/docs\.google\.com\/document/.test(u)) return 'doc';
    if (/docs\.google\.com\/presentation/.test(u)) return 'slides';
    if (/docs\.google\.com\/spreadsheets/.test(u)) return 'sheet';
    if (/docs\.google\.com\/forms|forms\.gle/.test(u)) return 'form';
    if (/drive\.google\.com/.test(u)) return 'drive';
    if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
    if (/pdf/.test(m) || ext === 'pdf') return 'pdf';
    if (/presentation|powerpoint/.test(m) || /^(pptx?|key)$/.test(ext)) return 'ppt';
    if (/spreadsheet|excel/.test(m) || /^(xlsx?|csv|numbers)$/.test(ext)) return 'excel';
    if (/msword|wordprocessing|pages/.test(m) || /^(docx?|pages)$/.test(ext)) return 'word';
    if (/video/.test(m)) return 'video';
    if (/audio/.test(m)) return 'audio';
    if (/image/.test(m)) return 'image';
    if (/link/.test(m) || /^https?:/i.test(u)) return 'link';
    return 'file';
  };
  // Toddle gives most links the same placeholder picture (and some a Google logo): treat as "no picture".
  const GENERIC_THUMB = /linkDefaultImage|\/branding\/googlelogo|\/images\/branding\//i;
  const driveId = (u) => (/forms\/d\/e\//.test(u) ? null : ((u.match(/\/d\/([\w-]{20,})/) || u.match(/[?&]id=([\w-]{20,})/) || [])[1] || null));
  const ytId = (u) => (u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) || [])[1] || null;
  // Best picture for a file/link, or null. Drive previews come from Google and only show for files
  // your signed-in Google account can open; anything that fails falls back to the icon.
  const previewOf = (n, kind) => {
    const t = safeImg(n.thumb);
    if (t && !GENERIC_THUMB.test(t)) return t;
    const u = n.url || '';
    if (kind === 'youtube' && ytId(u)) return `https://i.ytimg.com/vi/${ytId(u)}/mqdefault.jpg`;
    if (/^(doc|slides|sheet|drive)$/.test(kind) && driveId(u)) return `https://drive.google.com/thumbnail?id=${driveId(u)}&sz=w400`;
    return null;
  };
  // Previews that failed to load (no access, rate-limited, blank): url → when. Skipped for a week.
  const FAIL_KEY = 'tt:cpThumbFail';
  const failed = (() => {
    const now = Date.now();
    const m = TT.lsGet(FAIL_KEY, {}) || {};
    for (const k of Object.keys(m)) if (now - m[k] > 7 * 864e5) delete m[k];
    return m;
  })();
  const markFailed = (u) => { if (!u || failed[u]) return; failed[u] = Date.now(); TT.lsSet(FAIL_KEY, failed); };
  const kindIcon = (kind, extra) => h('span', { class: 'tt-gc-work-ico tt-gc-plan-kind' + (extra ? ' ' + extra : ''), style: { background: KINDS[kind][1] } }, I(KINDS[kind][0]));
  const imgStyle = () => {
    const v = TT.settings.cpImages;
    if (v === 'card' || v === 'icons' || v === 'preview') return v;
    return TT.settings.cpThumbnails === false ? 'icons' : 'preview';
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

    const wrap = h('div', { class: 'tt-gc-course tt-gc-plan img-' + imgStyle() });
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
          h('span', { class: 'tt-gc-work-ico', style: { background: done ? '#80868b' : color } }, I(mine ? TT.workIcon(mine) : /^(SA|smt)$/i.test(n.aType || '') ? 'summative' : 'assignment')),
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
      const kind = kindOf(n);
      const style = imgStyle();
      let pic = style === 'icons' ? null : previewOf(n, kind);
      if (pic && failed[pic]) pic = null;
      // The picture box; if the image fails (or is a 1px tracker), `outer` is swapped for `fallback()`.
      const img = (cls, fallback) => {
        const im = h('img', { src: pic, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', decoding: 'async' });
        const box = h('span', { class: cls }, im);
        let outer = box;
        // Look the wrapper up when it fails: re-renders can move this row around.
        const fail = () => {
          markFailed(pic);
          const o = im.closest('.tt-gc-plan-thumbwrap, .tt-gc-plan-card') || outer;
          if (o && o.parentNode) o.replaceWith(fallback());
        };
        im.addEventListener('error', fail, { once: true });
        im.addEventListener('load', () => { if (im.naturalWidth < 24) fail(); }, { once: true });
        return { box, wrapIn: (w) => { outer = w; return w; } };
      };
      let visual;
      if (pic && style === 'preview') {
        const t = img('tt-gc-plan-thumb', () => kindIcon(kind));
        visual = t.wrapIn(h('span', { class: 'tt-gc-plan-thumbwrap' }, t.box, kindIcon(kind, 'badge')));
      } else visual = kindIcon(kind);
      const label = KINDS[kind][2];
      const where = url ? host(url) : '';
      const sub = /^(Google|YouTube)/.test(label) ? label : [label, where].filter(Boolean).join(' · ') || (n.fileType || 'File').toLowerCase();
      const inner = [
        visual,
        h('span', { class: 'tt-gc-cw-main' },
          h('span', { class: 'tt-gc-cw-title' }, n.label),
          h('span', { class: 'tt-gc-cw-sub' }, sub)),
        pic && style === 'card' ? img('tt-gc-plan-card', () => document.createTextNode('')).box : null,
        url ? h('span', { class: 'tt-gc-plan-open', title: 'Opens in a new tab' }, I('open')) : null,
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
        isTopic ? null : h('span', { class: 'tt-gc-work-ico tt-gc-plan-folder-ico' }, I('folder')),
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
    const nav = h('nav', { class: 'tt-gc-plan-nav', 'aria-label': 'Topics' },
      h('button', { class: 'tt-gc-plan-nav-item all on', onClick: () => { const v = document.getElementById('tt-gc-view'); (v || window).scrollTo({ top: 0, behavior: 'smooth' }); } }, 'All topics'));
    const navFor = new Map();
    let loose = null;
    for (const n of roots) {
      if (n.type === 'UNIT_PLAN' || n.type === 'FOLDER') {
        loose = null;
        main.append(block(n, 0, ''));
        const navBtn = h('button', { class: 'tt-gc-plan-nav-item' + (n.id === currentId ? ' now' : ''), title: n.label, onClick: () => {
          const target = document.getElementById('tt-cp-' + n.id);
          if (target && target.classList.contains('collapsed')) target.querySelector('button').click();
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } }, n.label);
        navFor.set('tt-cp-' + n.id, navBtn);
        nav.append(navBtn);
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

    main.prepend(toolbar);
    wrap.append(h('div', { class: 'tt-gc-plan-layout' }, nav, main));
    el.append(wrap);

    // Highlight the topic you're reading in the topic list (like Classroom's Classwork page).
    if (navFor.size && 'IntersectionObserver' in window) {
      const seen = new Map();
      const spy = new IntersectionObserver((entries) => {
        if (!wrap.isConnected) { spy.disconnect(); return; }
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null);
        const top = [...seen].filter(([, t]) => t !== null).sort((x, y) => x[1] - y[1])[0];
        const btn = top ? navFor.get(top[0]) : null;
        const want = btn || nav.firstChild;
        if (want.classList.contains('on')) return;
        nav.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
        want.classList.add('on');
        if (nav.scrollWidth > nav.clientWidth + 4) nav.scrollTo({ left: want.offsetLeft - 16, behavior: 'smooth' });
      }, { rootMargin: '-80px 0px -55% 0px' });
      main.querySelectorAll(':scope > .tt-gc-plan-topic[id]').forEach((t) => spy.observe(t));
    }
  };
})();
