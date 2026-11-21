#!/usr/bin/env node
/*
 * CHANGELOG.md → docs/changelog.html (the "See what's new" page, served by GitHub Pages).
 * Styled like Toddle Tweaks' Classroom mode: top bar, drawer listing versions, a class-style
 * banner and one Stream-style post per release.
 *   node scripts/build-changelog.mjs      (build.mjs runs it too)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const md = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');
const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Tiny inline markdown: `code`, **bold**, [text](url).
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

// ## 2.5.0 (optional note) → { version, note, groups: [{ title, items }] }. "### Heading" starts a group.
const releases = [];
for (const block of md.split(/\n(?=## )/).slice(1)) {
  const [head, ...rest] = block.split('\n');
  const m = head.match(/^##\s+([\d.]+)\s*(?:\((.+)\))?/);
  if (!m) continue;
  const groups = [{ title: '', items: [] }];
  for (const line of rest) {
    const g = line.match(/^###\s+(.+)/);
    if (g) { groups.push({ title: g[1].trim(), items: [] }); continue; }
    const it = line.match(/^\s*[-*]\s+(.+)/);
    if (it) groups[groups.length - 1].items.push(it[1].trim());
  }
  releases.push({ version: m[1], note: m[2] || '', groups: groups.filter((x) => x.items.length) });
}

// Classroom-ish theme colours, one per release.
const COLORS = ['#1967d2', '#137333', '#c26401', '#a142f4', '#d93025', '#007b83', '#e52592', '#5f6368'];
const anchor = (v) => 'v' + v.replace(/\./g, '-');
// What kind of change, from its first word: decides the post icon.
const ICONS = {
  star: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  build: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
};

const post = (r, i) => {
  const color = COLORS[i % COLORS.length];
  const isPatch = !/\.0$/.test(r.version);
  const body = r.groups.map((g) => `${g.title ? `<h3>${inline(g.title)}</h3>` : ''}<ul>${g.items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`).join('');
  return `
      <article class="post" id="${anchor(r.version)}" style="--c:${color}">
        <header>
          <span class="av"><svg viewBox="0 0 24 24"><path d="${isPatch ? ICONS.build : ICONS.star}"/></svg></span>
          <div><b>Version ${esc(r.version)}${r.version === current ? ' <span class="chip">Latest</span>' : ''}</b><small>${r.note ? inline(r.note) : isPatch ? 'Fixes and polish' : 'New features'}</small></div>
          <a class="perma" href="#${anchor(r.version)}" title="Link to this version" aria-label="Link to version ${esc(r.version)}">#</a>
        </header>
        <div class="body">${body}</div>
      </article>`;
};

const nav = releases.map((r, i) => `
        <a class="nav" href="#${anchor(r.version)}"><span class="dot" style="background:${COLORS[i % COLORS.length]}">${esc(r.version.split('.').slice(0, 2).join('.'))}</span><span>Version ${esc(r.version)}<small>${r.version === current ? 'Latest' : r.note ? inline(r.note) : ''}</small></span></a>`).join('');

const LOGO = `<svg class="logo" viewBox="0 0 100 100" aria-hidden="true"><path fill="#1a73e8" d="M16.1 2.37C-4.7 14.28-4.7 85.72 16.1 97.64c20.81 11.91 83.28-23.79 83.28-47.62S36.91-9.55 16.1 2.37Z"/><path fill="#fff" d="M48.82 62.52c.28 0 .67-.08 1.07-.12.44-.08.55-.08.79-.08 1.7 0 2.61 1.25 2.61 2.59 0 1.06-.63 2-1.66 2.51-.91.47-2.1.74-3.32.74-7.2 0-8.79-4.43-8.79-9.68V45.71h-2.21c-2.61 0-3.05-1.84-3.05-2.74s.44-2.75 3.05-2.75h2.21v-4.7c0-3.14 2.22-3.72 3.33-3.72 1.14 0 3.32.55 3.32 3.72v4.7h4.27c2.61 0 3.05 1.84 3.05 2.75s-.44 2.74-3.05 2.74h-4.27v12.7c.04 2.7.99 4.11 2.65 4.11Z"/></svg>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>What's new in Toddle Tweaks</title>
  <meta name="description" content="Release notes for Toddle Tweaks, the browser extension that makes Toddle faster and easier.">
  <link rel="icon" href="assets/icon.png">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&family=Google+Sans+Flex:wght@400;500&display=swap">
  <!-- Generated from CHANGELOG.md by scripts/build-changelog.mjs. Edit those, not this file. -->
  <style>
    :root { --bar: 64px; --dw: 300px; --font: "Google Sans", "Google Sans Flex", Roboto, Arial, sans-serif; --body: Roboto, "Segoe UI", Arial, sans-serif; --text: #3c4043; --sub: #5f6368; --line: #dadce0; --blue: #1967d2; --theme: #848484; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; scroll-padding-top: calc(var(--bar) + 16px); }
    body { margin: 0; font: 400 14px/20px var(--body); color: var(--text); background: #fff; }
    a { color: var(--blue); }
    .bar { position: fixed; inset: 0 0 auto; height: var(--bar); display: flex; align-items: center; gap: 4px; padding: 0 16px 0 4px; background: #fff; border-bottom: 1px solid var(--line); z-index: 10; }
    .menu { width: 48px; height: 48px; border: 0; background: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: 4px; }
    .menu:hover { background: #f1f3f4; }
    .menu svg { width: 24px; height: 24px; fill: var(--sub); }
    .brand { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; font: 400 22px/28px var(--font); margin-left: 4px; }
    .brand .logo { width: 36px; height: 36px; }
    .crumb { display: flex; align-items: center; gap: 8px; color: var(--sub); font: 400 18px/24px var(--font); }
    .crumb::before { content: "›"; color: #80868b; margin: 0 4px 0 6px; }
    .tabs { margin-left: auto; display: flex; align-self: stretch; }
    .tabs a { display: flex; align-items: center; padding: 0 20px; color: var(--sub); text-decoration: none; font: 500 14px var(--font); border-bottom: 4px solid transparent; }
    .tabs a.on { color: var(--blue); border-bottom-color: var(--blue); }
    .tabs a:hover { background: #f8f9fa; }
    .drawer { position: fixed; top: var(--bar); bottom: 0; left: 0; width: var(--dw); border-right: 1px solid var(--line); overflow: auto; padding: 8px 0 24px; background: #fff; z-index: 9; transition: transform .2s; }
    .drawer h2 { font: 500 14px/20px var(--font); color: var(--text); margin: 8px 0 4px; padding: 8px 24px; }
    .nav { display: flex; align-items: center; gap: 16px; height: 56px; padding: 0 16px 0 24px; margin-right: 12px; border-radius: 0 28px 28px 0; color: var(--text); text-decoration: none; font: 500 14px/20px var(--font); }
    .nav:hover { background: #f1f3f4; }
    .nav.on { background: #e8f0fe; color: var(--blue); }
    .nav small { display: block; font: 400 12px/16px var(--body); color: var(--sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px; }
    .dot { width: 32px; height: 32px; border-radius: 50%; color: #fff; font: 500 11px/32px var(--font); text-align: center; flex: none; }
    .drawer hr { border: 0; border-top: 1px solid var(--line); margin: 8px 0; }
    .side-link { display: flex; align-items: center; gap: 16px; height: 48px; padding: 0 24px; color: var(--text); text-decoration: none; font: 500 14px var(--font); margin-right: 12px; border-radius: 0 24px 24px 0; }
    .side-link:hover { background: #f1f3f4; }
    .side-link svg { width: 24px; height: 24px; fill: var(--sub); }
    main { margin-left: var(--dw); padding: calc(var(--bar) + 24px) 24px 80px; transition: margin .2s; }
    .wrap { max-width: 1000px; margin: 0 auto; }
    /* Google Classroom's "Design" banner (swatches, marker, stencil): we're tweaking things. */
    .banner { position: relative; height: 240px; border-radius: 8px; overflow: hidden; color: #fff; padding: 24px; display: flex; flex-direction: column; justify-content: flex-end;
      background: #848484 url("https://www.gstatic.com/classroom/themes/Design.jpg") right center / cover no-repeat; }
    .banner h1 { margin: 0; font: 500 36px/44px var(--font); }
    .banner p { margin: 4px 0 0; font: 400 16px/22px var(--font); opacity: .92; }
    .banner .pill { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,.18); padding: 6px 14px; border-radius: 16px; font: 500 13px var(--font); }
    .grid { display: grid; grid-template-columns: 196px minmax(0, 1fr); gap: 24px; margin-top: 24px; align-items: start; }
    .side { border: 1px solid var(--line); border-radius: 8px; padding: 16px; position: sticky; top: calc(var(--bar) + 24px); }
    .side b { display: block; font: 500 14px/20px var(--font); margin-bottom: 8px; }
    .side a { display: block; text-decoration: none; padding: 4px 0; }
    .side p { margin: 0 0 12px; color: var(--sub); font-size: 13px; }
    .stream { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .post { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; transition: box-shadow .15s; }
    .post:hover { box-shadow: 0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15); }
    .post:target { border-color: var(--c); box-shadow: 0 0 0 1px var(--c); }
    .post header { display: flex; align-items: center; gap: 16px; padding: 16px 16px 8px 24px; }
    .post header b { display: flex; align-items: center; gap: 8px; font: 500 14px/20px var(--font); color: #202124; }
    .post header small { display: block; color: var(--sub); font-size: 12px; }
    .av { width: 40px; height: 40px; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center; flex: none; }
    .av svg { width: 20px; height: 20px; fill: #fff; }
    .chip { font: 500 11px/20px var(--body); padding: 0 8px; border-radius: 10px; background: #e6f4ea; color: #137333; }
    .perma { margin-left: auto; color: #80868b; text-decoration: none; font: 500 18px var(--font); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; }
    .post:hover .perma { opacity: 1; }
    .perma:hover { background: #f1f3f4; }
    .body { padding: 0 24px 16px 80px; }
    .body h3 { font: 500 13px/20px var(--font); color: var(--c); margin: 8px 0 0; text-transform: uppercase; letter-spacing: .04em; }
    .body ul { margin: 6px 0 4px; padding-left: 18px; }
    .body li { margin: 4px 0; }
    .body li::marker { color: var(--c); }
    code { font: 13px/1 ui-monospace, Consolas, monospace; background: #f1f3f4; padding: 2px 5px; border-radius: 4px; }
    footer { margin: 40px auto 0; max-width: 1000px; color: #80868b; font-size: 12px; text-align: center; }
    @media (max-width: 1100px) {
      .drawer { transform: translateX(-100%); visibility: hidden; transition: transform .2s, visibility 0s .2s; }
      body.open .drawer { transform: none; visibility: visible; transition: transform .2s; box-shadow: 0 8px 10px 1px rgba(0,0,0,.14), 0 3px 14px 2px rgba(0,0,0,.12); }
      main { margin-left: 0; }
    }
    @media (max-width: 760px) {
      .tabs, .crumb { display: none; }
      .grid { grid-template-columns: minmax(0, 1fr); }
      .side { position: static; }
      .banner { height: 180px; } .banner h1 { font-size: 28px; line-height: 34px; }
      main { padding-left: 12px; padding-right: 12px; }
      .body { padding-left: 24px; }
    }
  </style>
</head>
<body>
  <header class="bar">
    <button class="menu" aria-label="Versions" onclick="document.body.classList.toggle('open')"><svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg></button>
    <a class="brand" href="index.html">${LOGO}<span>Toddle Tweaks</span></a>
    <span class="crumb">What's new</span>
    <nav class="tabs"><a class="on" href="changelog.html">Changelog</a><a href="index.html">About</a><a href="https://github.com/Jotspot/toddle-tweaks" target="_blank" rel="noopener">GitHub</a></nav>
  </header>
  <nav class="drawer" aria-label="Versions">
    <h2>Versions</h2>${nav}
    <hr>
    <a class="side-link" href="https://github.com/Jotspot/toddle-tweaks/issues" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M20 8h-2.81a5.985 5.985 0 0 0-1.82-1.96L17 4.41 15.59 3l-2.17 2.17a6.002 6.002 0 0 0-2.83 0L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/></svg>Report a problem</a>
    <a class="side-link" href="privacy-policy.html"><svg viewBox="0 0 24 24"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>Privacy policy</a>
  </nav>
  <main>
    <div class="wrap">
      <section class="banner">
        <span class="pill">Now on ${esc(current)}</span>
        <h1>What's new</h1>
        <p>Everything that changed in Toddle Tweaks, newest first.</p>
      </section>
      <div class="grid">
        <aside class="side">
          <b>Latest</b>
          <p>Version ${esc(current)}</p>
          <a href="#${anchor(current)}">Jump to release notes</a>
          <a href="https://github.com/Jotspot/toddle-tweaks/issues" target="_blank" rel="noopener">Something broken?</a>
        </aside>
        <div class="stream">${releases.map(post).join('')}
        </div>
      </div>
    </div>
    <footer>Toddle Tweaks is free and open source (MIT). Not affiliated with Toddle or Google.</footer>
  </main>
  <script>
    // Highlight the version you're reading in the drawer; close the drawer after picking one on small screens.
    const links = [...document.querySelectorAll('.nav')];
    const mark = () => {
      let cur = links[0];
      for (const a of links) { const p = document.querySelector(a.getAttribute('href')); if (p && p.getBoundingClientRect().top < 140) cur = a; }
      links.forEach((a) => a.classList.toggle('on', a === cur));
    };
    addEventListener('scroll', mark, { passive: true }); mark();
    links.forEach((a) => a.addEventListener('click', () => document.body.classList.remove('open')));
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'docs', 'changelog.html'), html);
console.log(`✔ docs/changelog.html (${releases.length} releases, latest ${current})`);
