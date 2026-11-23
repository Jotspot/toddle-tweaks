#!/usr/bin/env node
/*
 * Toddle Tweaks production build.
 *   node scripts/build.mjs
 * Produces:
 *   dist/chrome/   + dist/toddle-tweaks-chrome-<version>.zip   (Chrome Web Store)
 *   dist/firefox/  + dist/toddle-tweaks-firefox-<version>.zip  (addons.mozilla.org)
 * Store builds drop the developer-only "reload from the page" hooks (// @dev-start … // @dev-end).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const INCLUDE = ['manifest.json', 'background.js', 'icons', 'popup', 'options', 'onboarding', 'rules', 'src'];

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const version = manifest.version;

// Keep the "See what's new" page (docs/changelog.html) in step with CHANGELOG.md.
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-changelog.mjs')], { stdio: 'inherit' });

const stripDev = (code) => code.replace(/[ \t]*\/\/ @dev-start[\s\S]*?\/\/ @dev-end[^\n]*\n?/g, '');

const copyTree = (src, dst) => {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) copyTree(path.join(src, f), path.join(dst, f));
    return;
  }
  if (/\.js$/.test(src)) fs.writeFileSync(dst, stripDev(fs.readFileSync(src, 'utf8')));
  else fs.copyFileSync(src, dst);
};

const zip = (dir, out) => {
  fs.rmSync(out, { force: true });
  // Windows' built-in bsdtar writes proper forward-slash zip paths (PowerShell's Compress-Archive doesn't, and AMO rejects that).
  const tar = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'zip';
  if (process.platform === 'win32') execFileSync(tar, ['-a', '-c', '-f', out, '*'], { cwd: dir, stdio: 'inherit', shell: false, windowsVerbatimArguments: false });
  else execFileSync('zip', ['-r', '-q', out, '.'], { cwd: dir, stdio: 'inherit' });
};

const build = (target, transform) => {
  const out = path.join(DIST, target);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of INCLUDE) copyTree(path.join(ROOT, f), path.join(out, f));
  const m = transform(JSON.parse(JSON.stringify(manifest)));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  const leftover = execGrep(out);
  if (leftover.length) throw new Error(`${target}: dev hooks still present in ${leftover.join(', ')}`);
  const zipPath = path.join(DIST, `toddle-tweaks-${target}-${version}.zip`);
  zip(out, zipPath);
  console.log(`✔ ${target}: ${path.relative(ROOT, zipPath)} (${Math.round(fs.statSync(zipPath).size / 1024)} KB)`);
};

const execGrep = (dir) => {
  const hits = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.js$/.test(f) && /devReload|tt:dev-reload|@dev-start/.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(dir, p));
    }
  };
  walk(dir);
  return hits;
};

// ---------- Chrome ----------
build('chrome', (m) => m);

// ---------- Firefox (MV3, Firefox 128+ for "world": "MAIN" content scripts) ----------
build('firefox', (m) => {
  m.background = { scripts: ['background.js'] };
  m.options_ui = { page: m.options_page, open_in_tab: true };
  delete m.options_page;
  m.browser_specific_settings = {
    gecko: {
      id: 'toddle-tweaks@toddletweaks.app',
      strict_min_version: '128.0',
      // Toddle Tweaks sends nothing to its developer; everything stays in the browser.
      data_collection_permissions: { required: ['none'] },
    },
  };
  return m;
});
