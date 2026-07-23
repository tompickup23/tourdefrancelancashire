#!/usr/bin/env node
/*
 * Tour de France Lancashire — zero-dependency static site generator.
 * Assembles src/ into dist/ using a layout, partials, SVG includes and
 * a shared config. No npm packages, no runtime JS required by the site.
 *
 *   node build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const BUILD_YEAR = 2026; // fixed for reproducible builds

const read = (p) => readFileSync(p, 'utf8');
const partialsDir = join(SRC, 'partials');
const svgDir = join(SRC, 'svg');

/* Resolve a dotted path (site.name, stage.dateLong) against the config. */
function lookup(path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), config);
}

/* Pull a partial (.html) or svg (.svg) from disk, cached. */
const includeCache = new Map();
function include(name) {
  if (includeCache.has(name)) return includeCache.get(name);
  const candidates = [join(partialsDir, name + '.html'), join(svgDir, name + '.svg'), join(svgDir, name)];
  for (const c of candidates) {
    if (existsSync(c)) {
      const out = render(read(c), {});
      includeCache.set(name, out);
      return out;
    }
  }
  throw new Error('include not found: ' + name);
}

/* Build the primary nav with an active state for the current page. */
function buildNav(active) {
  return config.nav.map((item) => {
    const cur = item.id === active ? ' aria-current="page"' : '';
    const cls = item.id === active ? ' class="is-active"' : '';
    return `<a href="${item.href}"${cls}${cur}>${item.label}</a>`;
  }).join('\n');
}

/* Token + include expansion. ctx overrides config lookups (page meta, loops). */
function render(tpl, ctx) {
  let out = tpl;
  // includes: {{> name}}
  out = out.replace(/\{\{>\s*([\w.-]+)\s*\}\}/g, (_, n) => include(n));
  // special tokens
  out = out.replace(/\{\{nav\}\}/g, () => buildNav(ctx.active));
  out = out.replace(/\{\{year\}\}/g, () => String(BUILD_YEAR));
  // data tokens: {{site.name}} / {{page.title}}
  out = out.replace(/\{\{([\w.]+)\}\}/g, (m, path) => {
    if (path.startsWith('page.') && ctx.page) {
      const v = ctx.page[path.slice(5)];
      return v == null ? '' : String(v);
    }
    const v = lookup(path);
    return v == null ? m : String(v);
  });
  return out;
}

/* Parse a leading <!-- key: value --> metadata block from a page/post. */
function parseMeta(src) {
  const m = src.match(/^\s*<!--([\s\S]*?)-->/);
  const meta = {};
  let body = src;
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^\s*([\w-]+):\s*(.*)$/);
      if (kv) meta[kv[1].trim()] = kv[2].trim();
    }
    body = src.slice(m[0].length);
  }
  return { meta, body };
}

const layout = read(join(SRC, 'layout.html'));

function emit(relPath, html) {
  const dest = join(DIST, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, html);
}

function buildPage(meta, body, outPath) {
  const active = meta.active || '';
  const page = {
    title: meta.title || config.site.name,
    description: meta.description || config.site.description,
    fullTitle: meta.title ? `${meta.title} · ${config.site.name}` : `${config.site.name} · ${config.site.tagline}`,
    ogimage: meta.ogimage || '/img/og-default.png',
    canonical: config.site.url + (outPath === 'index.html' ? '/' : '/' + outPath.replace(/index\.html$/, '').replace(/\/$/, '') + '/'),
    bodyClass: meta.bodyClass || '',
  };
  const content = render(body, { active, page });
  const full = render(layout, { active, page }).replace('{{content}}', () => content);
  emit(outPath, full);
}

/* ---- News collection ---------------------------------------------------- */
function buildNews() {
  const dir = join(SRC, 'news');
  if (!existsSync(dir)) return [];
  const posts = readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => {
    const { meta, body } = parseMeta(read(join(dir, f)));
    const slug = basename(f, '.html');
    return { slug, meta, body, url: `/news/${slug}/` };
  });
  posts.sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));
  for (const p of posts) {
    const article = `
      <article class="post">
        <a class="back" href="/news/">&larr; All news</a>
        <p class="post-date">${fmtDate(p.meta.date)}</p>
        <h1>${p.meta.title}</h1>
        ${p.meta.standfirst ? `<p class="standfirst">${p.meta.standfirst}</p>` : ''}
        <div class="post-body">${render(p.body, { active: 'news' })}</div>
      </article>`;
    buildPage(
      { title: p.meta.title, description: p.meta.standfirst || p.meta.title, active: 'news', bodyClass: 'page-post' },
      article,
      `news/${p.slug}/index.html`
    );
  }
  return posts;
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${d} ${months[m - 1]} ${y}`;
}

/* ---- Run ---------------------------------------------------------------- */
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// News first so the index page can list posts.
const posts = buildNews();
const newsCards = posts.map((p) => `
  <a class="news-card" href="${p.url}">
    <span class="news-card__date">${fmtDate(p.meta.date)}</span>
    <span class="news-card__title">${p.meta.title}</span>
    ${p.meta.standfirst ? `<span class="news-card__excerpt">${p.meta.standfirst}</span>` : ''}
    <span class="news-card__more">Read more &rarr;</span>
  </a>`).join('\n');

// Pages
for (const f of readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'))) {
  const { meta, body } = parseMeta(read(join(SRC, 'pages', f)));
  const name = basename(f, '.html');
  const outPath = name === 'index' ? 'index.html' : `${name}/index.html`;
  const withPosts = body.replace('{{news_cards}}', () => newsCards || '<p>News will appear here soon.</p>');
  buildPage(meta, withPosts, outPath);
}

// Static assets
for (const d of ['css', 'js']) {
  const s = join(SRC, d);
  if (existsSync(s)) cpSync(s, join(DIST, d), { recursive: true });
}
if (existsSync(join(ROOT, 'public'))) cpSync(join(ROOT, 'public'), DIST, { recursive: true });

// Inline SVGs are used via includes; also expose standalone files under /img for OG/social if present.

// Sitemap + robots
const urls = ['/', ...config.nav.map((n) => n.href), ...posts.map((p) => p.url)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${config.site.url}${u}</loc></url>`).join('\n') + `\n</urlset>\n`;
emit('sitemap.xml', sitemap);
emit('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${config.site.url}/sitemap.xml\n`);

// count output
let count = 0;
(function walk(d){ for (const e of readdirSync(d)) { const p = join(d,e); if (statSync(p).isDirectory()) walk(p); else count++; } })(DIST);
console.log(`Built ${count} files into dist/ (${posts.length} news posts).`);
