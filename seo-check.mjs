#!/usr/bin/env node
/*
 * Post-build SEO gate. Reads dist/ and refuses anything that would quietly
 * damage search: over-long or duplicated titles, missing canonicals, JSON-LD
 * that will not parse, an FAQ whose visible text has drifted from its markup,
 * a sitemap listing a page that was never built, or a house-style em-dash.
 *
 *   node seo-check.mjs
 *
 * Every check here can fail on real input. Prove it before trusting a pass:
 * see PROVING THE GATES at the foot of this file.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const U = config.site.url;

const TITLE_MAX = 60;   // beyond this Google truncates in the result
const DESC_MAX = 160;
const DESC_MIN = 70;

const fails = [];
const warns = [];
const fail = (where, msg) => fails.push(`${where}: ${msg}`);
// A warning is for something only a human with dashboard access can fix. It is
// printed on every run and surfaced in the CI summary, but does not block.
const warn = (where, msg) => warns.push(`${where}: ${msg}`);

const html = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.html')) html.push(p.slice(DIST.length + 1));
  }
})(DIST);

const text = (rel) => readFileSync(join(DIST, rel), 'utf8');
const one = (s, re) => { const m = s.match(re); return m ? m[1] : null; };
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&nbsp;/g, ' ');

/* ---- 1. Head tags, per page -------------------------------------------- */
const titles = new Map();
const descs = new Map();
for (const rel of html) {
  const s = text(rel);
  const title = one(s, /<title>([\s\S]*?)<\/title>/);
  const desc = one(s, /<meta name="description" content="([^"]*)"/);
  const canon = one(s, /<link rel="canonical" href="([^"]*)"/);
  const robots = one(s, /<meta name="robots" content="([^"]*)"/) || '';
  const h1s = (s.match(/<h1[\s>]/g) || []).length;

  if (!title) fail(rel, 'no <title>');
  else if (title.length > TITLE_MAX) fail(rel, `title ${title.length} chars, over ${TITLE_MAX}`);
  if (!desc) fail(rel, 'no meta description');
  else if (desc.length > DESC_MAX) fail(rel, `description ${desc.length} chars, over ${DESC_MAX}`);
  else if (desc.length < DESC_MIN) fail(rel, `description ${desc.length} chars, under ${DESC_MIN}`);
  if (!canon) fail(rel, 'no canonical');
  else if (!canon.startsWith(U)) fail(rel, `canonical points off site: ${canon}`);
  if (h1s !== 1) fail(rel, `${h1s} h1 tags, expected exactly 1`);

  // Duplicate titles and descriptions are only a defect on indexable pages.
  if (!robots.includes('noindex')) {
    if (title) titles.set(title, [...(titles.get(title) || []), rel]);
    if (desc) descs.set(desc, [...(descs.get(desc) || []), rel]);
  }
}
for (const [t, where] of titles) if (where.length > 1) fail(where.join(' + '), `duplicate title "${t}"`);
for (const [d, where] of descs) if (where.length > 1) fail(where.join(' + '), `duplicate description "${d.slice(0, 40)}..."`);

/* ---- 2. JSON-LD parses, and says what it should ------------------------- */
let sawEvent = false, sawFaq = false, sawBreadcrumb = false;
for (const rel of html) {
  const s = text(rel);
  const robots = one(s, /<meta name="robots" content="([^"]*)"/) || '';
  const blocks = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) {
    if (!robots.includes('noindex')) fail(rel, 'no JSON-LD');
    continue;
  }
  for (const b of blocks) {
    let parsed;
    try { parsed = JSON.parse(b[1]); } catch (e) { fail(rel, `JSON-LD does not parse: ${e.message}`); continue; }
    const nodes = parsed['@graph'] || [parsed];
    const types = nodes.map((n) => n['@type']);
    if (types.includes('SportsEvent')) sawEvent = true;
    if (types.includes('FAQPage')) sawFaq = true;
    if (types.includes('BreadcrumbList')) sawBreadcrumb = true;
    else fail(rel, 'JSON-LD has no BreadcrumbList');
    // An @id referenced but never defined anywhere in the graph is a dangling
    // node: valid JSON-LD, but Google reads it as an empty entity.
    const defined = new Set(nodes.map((n) => n['@id']).filter(Boolean));
    const refs = JSON.stringify(nodes).match(/"@id":"[^"]+"/g) || [];
    for (const r of refs) {
      const id = r.slice(7, -1);
      if (!defined.has(id)) fail(rel, `JSON-LD references undefined @id ${id}`);
    }
  }
}
if (!sawEvent) fail('site', 'no SportsEvent anywhere');
if (!sawFaq) fail('site', 'no FAQPage anywhere');
if (!sawBreadcrumb) fail('site', 'no BreadcrumbList anywhere');

/* ---- 3. FAQ: markup, visible answers and config all agree ---------------
 * Google demotes an FAQ whose markup says something the reader cannot see.
 * Comparing the markup only against the visible text would prove nothing here,
 * because one build writes both from the same array: that check can never
 * fail. The third leg, site.config.json, is what gives it teeth. It catches a
 * stale dist, and it catches anyone hardcoding FAQ copy into the page. */
{
  const rel = 'plan/index.html';
  const s = text(rel);
  const source = config.faq.map((f) => [f.q, f.a]);
  const block = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .flatMap((p) => p['@graph'] || [p])
    .find((n) => n['@type'] === 'FAQPage');
  const visible = [...s.matchAll(/<div class="faq-item">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)]
    .map((m) => [decode(m[1].trim()), decode(m[2].trim())]);

  if (!block) fail(rel, 'FAQPage markup missing');
  else if (block.mainEntity.length !== source.length) {
    fail(rel, `${block.mainEntity.length} questions in the markup, ${source.length} in site.config.json`);
  }
  if (visible.length !== source.length) {
    fail(rel, `${visible.length} FAQ items on the page, ${source.length} in site.config.json`);
  } else {
    source.forEach(([q, a], i) => {
      if (visible[i][0] !== q) fail(rel, `FAQ question ${i + 1} on the page is not the one in site.config.json`);
      if (visible[i][1] !== a) fail(rel, `FAQ answer ${i + 1} on the page is not the one in site.config.json`);
      if (block && block.mainEntity[i]) {
        if (block.mainEntity[i].name !== q) fail(rel, `FAQ question ${i + 1} markup does not match site.config.json`);
        if (block.mainEntity[i].acceptedAnswer.text !== a) fail(rel, `FAQ answer ${i + 1} markup does not match site.config.json`);
      }
    });
  }
}

/* ---- 4. Sitemap agrees with what was built ------------------------------ */
{
  const sm = text('sitemap.xml');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) fail('sitemap.xml', 'no URLs');
  for (const loc of locs) {
    const path = loc.slice(U.length);
    const file = path === '/' ? 'index.html' : path.replace(/^\//, '').replace(/\/$/, '') + '/index.html';
    if (!existsSync(join(DIST, file))) fail('sitemap.xml', `lists ${loc} but ${file} was not built`);
    const s = text(file);
    const canon = one(s, /<link rel="canonical" href="([^"]*)"/);
    if (canon !== loc) fail('sitemap.xml', `${loc} canonicalises to ${canon}`);
    if ((one(s, /<meta name="robots" content="([^"]*)"/) || '').includes('noindex')) {
      fail('sitemap.xml', `${loc} is noindex but listed`);
    }
  }
  for (const m of sm.matchAll(/<url>(?:(?!<\/url>)[\s\S])*<\/url>/g)) {
    if (!/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(m[0])) fail('sitemap.xml', 'entry with no valid lastmod');
  }
  // Every built, indexable page must be in the sitemap, not just the reverse.
  for (const rel of html) {
    const s = text(rel);
    if ((one(s, /<meta name="robots" content="([^"]*)"/) || '').includes('noindex')) continue;
    const canon = one(s, /<link rel="canonical" href="([^"]*)"/);
    if (canon && !locs.includes(canon)) fail('sitemap.xml', `${canon} was built but is not listed`);
  }
}

/* ---- 4b. Body text: thin pages and near-duplicates ----------------------
 * Eleven place guides built from one template is exactly the shape that goes
 * thin or duplicate without anyone noticing, so measure it rather than assume.
 * The shingle comparison is over the page body with the shared header, footer
 * and nav stripped out, or every page would look 90% identical to every other. */
const WORDS_MIN = 220;
const OVERLAP_MAX = 0.4; // real worst pair sits at 27.8%, so this has teeth without false alarms
const bodies = new Map();
for (const rel of html) {
  const s = text(rel);
  if ((one(s, /<meta name="robots" content="([^"]*)"/) || '').includes('noindex')) continue;
  const main = (s.match(/<main id="main">([\s\S]*?)<\/main>/) || [])[1];
  if (!main) { fail(rel, 'no <main> element'); continue; }
  const words = decode(main.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length < WORDS_MIN) fail(rel, `${words.length} words of body copy, under ${WORDS_MIN}`);
  bodies.set(rel, words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean));
}
const shingles = (w) => new Set(w.slice(0, -4).map((_, i) => w.slice(i, i + 5).join(' ')));
const shingled = new Map([...bodies].map(([rel, w]) => [rel, shingles(w)]));
const seenPair = new Set();
for (const [a, sa] of shingled) {
  for (const [b, sb] of shingled) {
    if (a === b || seenPair.has(b + '|' + a)) continue;
    seenPair.add(a + '|' + b);
    const smaller = sa.size <= sb.size ? sa : sb;
    const larger = sa.size <= sb.size ? sb : sa;
    if (!smaller.size) continue;
    let hits = 0;
    for (const sh of smaller) if (larger.has(sh)) hits++;
    const overlap = hits / smaller.size;
    if (overlap > OVERLAP_MAX) fail(`${a} + ${b}`, `${Math.round(overlap * 100)}% of body text is shared, over ${OVERLAP_MAX * 100}%`);
  }
}

/* ---- 4c. Internal links resolve, and nothing is orphaned ---------------- */
{
  const linkedTo = new Set();
  for (const rel of html) {
    const s = text(rel);
    for (const m of s.matchAll(/<a[^>]+href="(\/[^"]*)"/g)) {
      const href = m[1].split('#')[0];
      if (!href) continue;
      const file = href === '/' ? 'index.html'
        : href.endsWith('/') ? href.slice(1) + 'index.html'
        : href.slice(1);
      if (!existsSync(join(DIST, file))) fail(rel, `links to ${m[1]}, which was not built`);
      else if (rel !== file) linkedTo.add(file);
    }
  }
  for (const rel of html) {
    if (rel === 'index.html' || rel === '404.html') continue;
    if ((one(text(rel), /<meta name="robots" content="([^"]*)"/) || '').includes('noindex')) continue;
    if (!linkedTo.has(rel)) fail(rel, 'orphan: no other page links to it');
  }
}

/* ---- 4d. Images carry alt text and intrinsic dimensions ----------------- */
for (const rel of html) {
  for (const m of text(rel).matchAll(/<img[^>]*>/g)) {
    const tag = m[0];
    if (!/\salt="[^"]+"/.test(tag)) fail(rel, `img with no alt text: ${tag.slice(0, 70)}`);
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) {
      fail(rel, `img with no width/height, which shifts layout: ${tag.slice(0, 70)}`);
    }
  }
}

/* ---- 5. A real 404 page exists ------------------------------------------ */
if (!existsSync(join(DIST, '404.html'))) {
  fail('dist', 'no 404.html, so Cloudflare Pages will serve the homepage with HTTP 200');
}

/* ---- 6. House style ------------------------------------------------------ */
for (const rel of html) {
  const s = text(rel);
  if (s.includes('—')) fail(rel, 'contains an em-dash');
  if (/&mdash;|&ndash;|&#8212;|&#8211;|&#x2014;|&#x2013;/i.test(s)) fail(rel, 'contains an entity-encoded dash');
}

/* ---- 7. The site does what its privacy page says it does ----------------
 * /privacy/ tells readers "we use Cloudflare Web Analytics" and "this is the
 * one request a page makes to another address on load". If no beacon ships,
 * that page describes behaviour the site does not have. With a token set the
 * mismatch is a build bug and fails; without one it is a job for Tom in the
 * Cloudflare dashboard, so it warns rather than blocking every deploy. */
{
  const token = ((config.analytics && config.analytics.beaconToken) || '').trim();
  const on = !!token;
  const active = config.analytics.copy[on ? 'on' : 'off'];
  const inactive = config.analytics.copy[on ? 'off' : 'on'];
  const privacy = text('privacy/index.html');
  const withBeacon = html.filter((rel) => text(rel).includes('static.cloudflareinsights.com'));

  if (on && !/^[0-9a-f]{32}$/.test(token)) {
    fail('site.config.json', `analytics.beaconToken is not 32 hex characters: ${token}`);
  }

  // The beacon must be on every page or none of them, matching the setting.
  if (on) {
    const missing = html.filter((rel) => !withBeacon.includes(rel));
    if (missing.length) fail('dist', `beacon token is set but ${missing.length} page(s) do not carry it, first: ${missing[0]}`);
  } else if (withBeacon.length) {
    fail('dist', `no beacon token is set but ${withBeacon.length} page(s) load one, first: ${withBeacon[0]}`);
  }

  // The privacy page must carry the copy for the state the site is actually in,
  // and none of the copy for the state it is not in. Checking the built page
  // against site.config.json, not against the other half of the same build,
  // is what makes this catch a stale dist or a hand-edited page.
  for (const [key, wanted] of Object.entries(active)) {
    if (!privacy.includes(wanted)) {
      fail('privacy/index.html', `analytics is ${on ? 'ON' : 'OFF'} but the page is missing the "${key}" copy for that state`);
    }
  }
  for (const key of ['summary', 'processing']) {
    if (privacy.includes(inactive[key])) {
      fail('privacy/index.html', `analytics is ${on ? 'ON' : 'OFF'} but the page still carries the "${key}" copy for the other state`);
    }
  }

  if (!on) {
    warn('site.config.json',
      'no analytics.beaconToken, so nothing is measured. The privacy page correctly says so. '
      + 'To turn counting on, paste the public 32-hex site tag from the Cloudflare dashboard '
      + '(Analytics & Logs > Web Analytics > Manage site > JS snippet) and rebuild: the beacon '
      + 'and the privacy wording both follow that one setting.');
  }
}

/* ---- Report -------------------------------------------------------------- */
if (warns.length) {
  console.error(`\nSEO check WARNINGS, ${warns.length}:`);
  for (const w of warns) console.error('  ! ' + w);
  console.error('');
}
if (fails.length) {
  console.error(`SEO check FAILED, ${fails.length} problem(s):`);
  for (const f of fails) console.error('  ' + f);
  process.exit(1);
}
console.log(`SEO check passed: ${html.length} pages, titles <= ${TITLE_MAX}, descriptions ${DESC_MIN} to ${DESC_MAX}, JSON-LD parsed, FAQ markup matches the page, sitemap reconciles both ways, 404.html present.`);

/* PROVING THE GATES
 * A check that cannot fail is decoration. Each of these makes exactly one
 * check fail, and nothing else should be needed to see it:
 *   1. lengthen any fullTitle in src/pages/*.html past 60 characters
 *   2. break a brace inside pageGraph() in build.mjs
 *   3. edit one answer in site.config.json faq[] after the page is built
 *   4. delete src/pages/stay.html, leaving /stay/ in nav
 *   5. delete src/pages/404.html
 *   6. put an em-dash in any page description
 */
