#!/usr/bin/env node
// Export a diagram HTML file (docs/*.html) to a sibling .svg and .png.
// Usage: node scripts/export-diagram.mjs docs/how-it-works.html [--scale 2] [--playwright <dir with node_modules>]
// SVG: the first <svg> block, made standalone with the Google Fonts @import (ampersands XML-escaped).
// PNG: the rendered HTML screenshotted at the <svg> bounding box, on the paper background so the image
// reads the same on GitHub's light and dark themes. Needs playwright; pass --playwright when it is not
// installed in this repository (it is a dev tool, not a dependency).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
if (!src) { console.error('usage: export-diagram.mjs <file.html> [--scale 2] [--playwright <dir>]'); process.exit(2); }
const scale = Number(flag('--scale', '2'));
const out = join(dirname(src), basename(src, '.html'));

const html = readFileSync(src, 'utf8');
const m = html.match(/<svg[\s\S]*?<\/svg>/);
if (!m) { console.error('no <svg> in', src); process.exit(1); }
let svg = m[0];
if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
const style = `<style>@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@400;500;600&amp;display=swap');</style>`;
svg = /<defs>/.test(svg) ? svg.replace('<defs>', `<defs>${style}`) : svg.replace(/(<desc[^>]*>[\s\S]*?<\/desc>)/, `$1<defs>${style}</defs>`);
writeFileSync(`${out}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
console.log('wrote', `${out}.svg`);

const req = createRequire(resolve(flag('--playwright', process.cwd()), 'package.json'));
let chromium;
try { ({ chromium } = req('playwright')); } catch (e) { console.error('playwright not resolvable; pass --playwright <dir>'); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: scale });
await page.goto(`file://${resolve(src).replace(/\\/g, '/')}`);
await page.waitForLoadState('networkidle');
await page.evaluate(() => document.fonts.ready);
await page.locator('svg').first().screenshot({ path: `${out}.png`, omitBackground: false });
await browser.close();
console.log('wrote', `${out}.png`);
