#!/usr/bin/env node
/*
 * Renders store images with headless Chrome (made-up demo data, no real accounts).
 *   node scripts/render-promo.mjs
 * Output: store/images/chrome/*.png and store/images/firefox/*.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROMO = path.join(ROOT, 'store', 'promo');
const OUT = path.join(ROOT, 'store', 'images');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('Chrome not found; set CHROME_PATH');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-promo-'));

const shot = (file, query, w, h, out) => {
  const url = pathToFileURL(path.join(PROMO, file)).href + (query ? '?' + new URLSearchParams(query) : '');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--user-data-dir=${profile}`, `--window-size=${w},${h}`, '--force-device-scale-factor=1', '--virtual-time-budget=6000',
    `--screenshot=${out}`, url], { stdio: 'ignore' });
  console.log('✔', path.relative(ROOT, out));
};

const SCREENS = [
  { scene: 'home', h: 'Your classes, at a glance', p: 'Clean class cards show what\'s due, what\'s missing and who teaches it. Drag them into any order.' },
  { scene: 'todo', h: 'A to-do list that makes sense', p: 'Missing, Today, Tomorrow, This week. Old in-class work that can\'t be turned in stays out of the way.' },
  { scene: 'classwork', h: 'Every class, organized', p: 'Stream, Classwork and People for each class, with what needs you first and status at a glance.' },
  { scene: 'palette', h: 'Jump anywhere with Ctrl + K', p: 'Search every class, assignment and page. Keyboard shortcuts, a due count in your tab, and more.' },
  { scene: 'settings', h: 'Make it yours', p: 'Every tweak can be switched on or off, with a preview of what it does. Everything stays in your browser.' },
];

for (const browser of ['chrome', 'firefox']) {
  SCREENS.forEach((s, i) => shot('promo.html', { browser, scene: s.scene, h: s.h, p: s.p }, 1280, 800, path.join(OUT, browser, `screenshot-${i + 1}-${s.scene}.png`)));
}
shot('tile.html', null, 440, 280, path.join(OUT, 'chrome', 'promo-small-440x280.png'));
shot('marquee.html', null, 1400, 560, path.join(OUT, 'chrome', 'promo-marquee-1400x560.png'));
fs.rmSync(profile, { recursive: true, force: true });
