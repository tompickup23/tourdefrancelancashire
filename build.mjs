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
  out = out.replace(/\{\{faq\}\}/g, () => faqHtml());
  out = out.replace(/\{\{analytics\.(\w+)\}\}/g, (_, k) => analyticsToken(k));
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

/* ---- Analytics ----------------------------------------------------------
 * Cloudflare Web Analytics, cookieless. The beacon token is a public site tag,
 * not a secret: it ships in the HTML of every page, which is why it lives in
 * site.config.json rather than an environment variable. With it empty nothing
 * is emitted, so the site keeps making zero third-party requests. The CSP in
 * public/_headers already allows static.cloudflareinsights.com in script-src
 * and cloudflareinsights.com in connect-src, so no header change is needed. */
const BEACON = ((config.analytics && config.analytics.beaconToken) || '').trim();
if (BEACON && !/^[0-9a-f]{32}$/.test(BEACON)) {
  throw new Error(`analytics.beaconToken must be 32 hex characters, got ${JSON.stringify(BEACON)}`);
}
const analyticsTag = BEACON
  ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${BEACON}"}'></script>`
  : '';

/* What /privacy/ says about visitor counting, chosen by the same setting that
 * decides whether the beacon ships. The page cannot describe analytics the
 * site does not run, or stay silent about analytics it does. */
const ANALYTICS_COPY = config.analytics.copy[BEACON ? 'on' : 'off'];
const analyticsToken = (key) => ANALYTICS_COPY[key] || '';

/* ---- Structured data ---------------------------------------------------- */
const U = config.site.url;
const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/* The Lancashire stage itself. Emitted only on pages where it is the subject,
 * so the same event is not repeated on the privacy and legal pages. */
function stageEvent() {
  const s = config.stage;
  return {
    '@type': 'SportsEvent',
    '@id': `${U}/#stage2`,
    name: `Tour de France 2027, Stage ${s.number}: ${s.start} to ${s.finish}`,
    alternateName: 'Tour de France 2027 in Lancashire',
    description: `Stage ${s.number} of the 2027 Tour de France runs ${s.distanceKm} km from ${s.start} to ${s.finish} on ${s.dateLong}, with about ${s.lancashireMiles} miles of it through Lancashire and ${s.climbsInLancashire} categorised climbs.`,
    startDate: s.date,
    endDate: s.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    isAccessibleForFree: true,
    sport: 'Road cycling',
    url: `${U}/route/`,
    image: [`${U}/img/og-default.png`],
    superEvent: { '@type': 'SportsEvent', name: 'Tour de France 2027', startDate: '2027-07-02' },
    organizer: { '@type': 'Organization', name: 'Amaury Sport Organisation', url: 'https://www.letour.fr/' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP', availability: 'https://schema.org/InStock', url: `${U}/plan/`, validFrom: '2026-01-15' },
    location: {
      '@type': 'Place',
      name: 'Lancashire, England',
      address: { '@type': 'PostalAddress', addressRegion: 'Lancashire', addressCountry: 'GB' },
      containedInPlace: { '@type': 'AdministrativeArea', name: 'England' },
    },
  };
}

function pageGraph(page, meta) {
  const crumbs = [{ name: 'Home', item: `${U}/` }];
  if (meta.parent && meta.parentUrl) crumbs.push({ name: meta.parent, item: U + meta.parentUrl });
  if (page.canonical !== `${U}/`) crumbs.push({ name: meta.breadcrumb || page.title, item: page.canonical });

  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${U}/#website`,
      url: `${U}/`,
      name: config.site.name,
      description: config.site.tagline,
      inLanguage: 'en-GB',
      publisher: { '@id': `${U}/#org` },
    },
    {
      '@type': 'Organization',
      '@id': `${U}/#org`,
      name: config.site.name,
      url: `${U}/`,
      logo: { '@type': 'ImageObject', url: `${U}/img/og-default.png`, width: 1200, height: 630 },
      description: 'An independent, unofficial visitor guide to the 2027 Tour de France Grand Départ in Lancashire. Not affiliated with A.S.O. or Grand Départ GB.',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${page.canonical}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
    },
    {
      '@type': 'WebPage',
      '@id': `${page.canonical}#webpage`,
      url: page.canonical,
      name: page.fullTitle,
      description: page.description,
      inLanguage: 'en-GB',
      isPartOf: { '@id': `${U}/#website` },
      breadcrumb: { '@id': `${page.canonical}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: U + page.ogimage },
      datePublished: (meta.article && meta.article.date) || config.site.contentPublished,
      dateModified: page.updated,
      ...(meta.place
        ? { about: [{ '@id': `${page.canonical}#place` }, { '@id': `${U}/#stage2` }], mainEntity: { '@id': `${page.canonical}#place` } }
        : meta.event === 'true'
          ? { about: { '@id': `${U}/#stage2` }, mainEntity: { '@id': `${U}/#stage2` } }
          : {}),
    },
  ];
  if (meta.event === 'true' || meta.article || meta.place) graph.push(stageEvent());
  if (meta.place) {
    const pl = meta.place;
    graph.push({
      '@type': pl.kind === 'climb' ? 'Landform' : 'Place',
      '@id': `${page.canonical}#place`,
      name: pl.name,
      description: pl.standfirst,
      url: page.canonical,
      ...(pl.photo ? { image: [U + pl.photo] } : {}),
      containedInPlace: { '@type': 'AdministrativeArea', name: 'Lancashire, England' },
      event: { '@id': `${U}/#stage2` },
    });
  }
  if (meta.faq === 'true') graph.push(faqNode(page));
  if (meta.places === 'true') {
    graph.push({
      '@type': 'ItemList',
      '@id': `${page.canonical}#corridor`,
      name: 'The Lancashire corridor, in racing order',
      numberOfItems: places.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: places.map((pl, i) => ({
        '@type': 'ListItem', position: i + 1, name: pl.name, url: U + placeUrl(pl),
      })),
    });
  }
  if (meta.article) {
    const a = meta.article;
    graph.push({
      '@type': 'NewsArticle',
      '@id': `${page.canonical}#article`,
      headline: a.title,
      description: a.standfirst || a.title,
      datePublished: a.date,
      dateModified: a.updated || a.date,
      inLanguage: 'en-GB',
      isAccessibleForFree: true,
      image: [`${U}/img/og-default.png`],
      mainEntityOfPage: { '@id': `${page.canonical}#webpage` },
      about: { '@id': `${U}/#stage2` },
      author: { '@id': `${U}/#org` },
      publisher: { '@id': `${U}/#org` },
    });
  }
  return ldScript({ '@context': 'https://schema.org', '@graph': graph });
}

/* FAQ answers are rendered into the page from the same config entries that
 * feed the schema, so the visible text and the markup cannot drift apart. */
function faqNode(page) {
  return {
    '@type': 'FAQPage',
    '@id': `${page.canonical}#faq`,
    mainEntity: config.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

const faqHtml = () => config.faq.map((f) => `
      <div class="faq-item">
        <h3>${f.q}</h3>
        <p>${f.a}</p>
      </div>`).join('\n');

function buildPage(meta, body, outPath) {
  const active = meta.active || '';
  const canonical = config.site.url + (outPath === 'index.html' ? '/' : '/' + outPath.replace(/index\.html$/, '').replace(/\/$/, '') + '/');
  const title = meta.title || config.site.name;
  const page = {
    title,
    description: (meta.description || config.site.description)
      .replace(/\{\{analytics\.(\w+)\}\}/g, (_, k) => analyticsToken(k)),
    fullTitle: meta.fullTitle || (meta.title ? `${meta.title} · ${config.site.name}` : `${config.site.name} · ${config.site.tagline}`),
    ogimage: meta.ogimage || '/img/og-default.png',
    ogwidth: meta.ogwidth || '1200',
    ogheight: meta.ogheight || '630',
    ogalt: meta.ogalt || 'Tour de France Lancashire: Stage 2, Saturday 3 July 2027',
    robots: meta.robots || 'index, follow, max-image-preview:large, max-snippet:-1',
    updated: meta.updated || config.site.contentUpdated,
    canonical,
    bodyClass: meta.bodyClass || '',
    analytics: analyticsTag,
  };
  page.jsonld = meta.robots && meta.robots.includes('noindex') ? '' : pageGraph(page, meta);
  const content = render(body, { active, page });
  const full = render(layout, { active, page }).replace('{{content}}', () => content);
  emit(outPath, full);
  return page;
}

/* ---- Place guides ------------------------------------------------------
 * One page per confirmed stop on the Lancashire corridor, under /route/.
 * Copy lives in places.json, which carries the sourcing note: every claim
 * traces to the Grand Depart GB stage page, Lancashire County Council's
 * January 2026 release, or something already verified elsewhere on the site. */
const places = JSON.parse(read(join(ROOT, 'places.json'))).places;
const placeUrl = (p) => `/route/${p.slug}/`;

function buildPlaces() {
  places.forEach((p, i) => {
    const prev = places[i - 1];
    const next = places[i + 1];
    const body = `
<section class="page-hero">
  <div class="wrap">
    <span class="eyebrow">${p.area} · Stage 2 · Saturday 3 July 2027</span>
    <h1>${p.name}</h1>
    <p class="lede">${p.standfirst}</p>
  </div>
</section>
${p.photo ? `
<section style="padding-top:0">
  <div class="wrap" style="max-width:900px">
    <img class="place-hero" src="${p.photo}" alt="${p.photoAlt}" width="${p.photoW}" height="${p.photoH}" fetchpriority="high" />
  </div>
</section>` : ''}

<section style="padding-top:${p.photo ? '2.4rem' : '0'}">
  <div class="wrap" style="max-width:760px">
    <div class="prose">
      ${p.body.map((para) => `<p>${para}</p>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="bg-paper2">
  <div class="wrap" style="max-width:900px">
    <div class="grid grid-2">
      <div class="area">
        <p class="meta">Worth your time</p>
        <h2>Nearby</h2>
        <ul>
          ${p.nearby.map((n) => `<li>${n}</li>`).join('\n          ')}
        </ul>
      </div>
      <div class="area">
        <p class="meta">Still to come</p>
        <h2>What is not confirmed</h2>
        <ul>
          <li>The exact roads through ${p.name}</li>
          <li>Road closure times, and when they reopen</li>
          <li>Official fan zones, parking and park-and-ride</li>
          <li>The timetable for the caravan and the peloton</li>
        </ul>
      </div>
    </div>
    <p class="faq-note">The organisers, the police and the local councils publish these closer to the race. This page says what is known and nothing more.</p>
  </div>
</section>

<section>
  <div class="wrap" style="max-width:900px">
    <nav class="place-prevnext" aria-label="Along the route">
      ${prev ? `<a class="pn pn--prev" href="${placeUrl(prev)}"><span>Earlier in the stage</span><b>&larr; ${prev.name}</b></a>` : '<span></span>'}
      ${next ? `<a class="pn pn--next" href="${placeUrl(next)}"><span>Later in the stage</span><b>${next.name} &rarr;</b></a>` : '<span></span>'}
    </nav>
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <span class="eyebrow" style="justify-content:center">Next</span>
    <h2>Plan the day around ${p.name}</h2>
    <p>The full corridor, the practical guidance for race day, and where to put your head down afterwards.</p>
    <div class="hero-cta" style="justify-content:center">
      <a class="btn btn--primary" href="/route/">The whole route</a>
      <a class="btn btn--ghost" href="/plan/">Plan your day</a>
      <a class="btn btn--ghost" href="/stay/">Places to stay</a>
    </div>
  </div>
</section>`;
    buildPage(
      {
        title: p.name,
        fullTitle: p.title,
        breadcrumb: p.name,
        parent: 'The Route',
        parentUrl: '/route/',
        description: p.description,
        active: 'route',
        place: p,
        ...(p.photo ? { ogimage: p.photo, ogwidth: String(p.photoW), ogheight: String(p.photoH), ogalt: p.photoAlt } : {}),
      },
      body,
      `route/${p.slug}/index.html`
    );
  });
  return places.map((p) => ({ url: placeUrl(p), lastmod: config.site.contentUpdated }));
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
        <p class="post-date">Published <time datetime="${p.meta.date}">${fmtDate(p.meta.date)}</time></p>
        <h1>${p.meta.title}</h1>
        ${p.meta.standfirst ? `<p class="standfirst">${p.meta.standfirst}</p>` : ''}
        <div class="post-body">${render(p.body, { active: 'news' })}</div>
      </article>`;
    buildPage(
      {
        title: p.meta.title,
        // The headline already carries the subject, so no site suffix: it would
        // push every news title past the width Google shows.
        fullTitle: p.meta.fullTitle || p.meta.title,
        description: p.meta.description || p.meta.standfirst || p.meta.title,
        breadcrumb: p.meta.title,
        parent: 'News',
        parentUrl: '/news/',
        active: 'news',
        bodyClass: 'page-post',
        updated: p.meta.updated || p.meta.date,
        article: p.meta,
      },
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

// News and places first so the index and route pages can list them.
const posts = buildNews();
const placeRecords = buildPlaces();
const newsCards = posts.map((p) => `
  <a class="news-card" href="${p.url}">
    <span class="news-card__date">${fmtDate(p.meta.date)}</span>
    <span class="news-card__title">${p.meta.title}</span>
    ${p.meta.standfirst ? `<span class="news-card__excerpt">${p.meta.standfirst}</span>` : ''}
    <span class="news-card__more">Read more &rarr;</span>
  </a>`).join('\n');

const placeCards = places.map((p) => `
  <a class="place-card" href="${placeUrl(p)}">
    <span class="place-card__kicker">${p.area}</span>
    <span class="place-card__name">${p.name}</span>
    <span class="place-card__note">${p.kind === 'climb' ? 'Categorised climb' : 'On the corridor'}</span>
  </a>`).join('\n');

// Pages
const pageRecords = [];
for (const f of readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'))) {
  const { meta, body } = parseMeta(read(join(SRC, 'pages', f)));
  const name = basename(f, '.html');
  // 404.html sits at the root so Cloudflare Pages serves it with a real 404
  // status instead of falling back to the homepage.
  const outPath = name === 'index' ? 'index.html' : name === '404' ? '404.html' : `${name}/index.html`;
  const withPosts = body
    .replace('{{news_cards}}', () => newsCards || '<p>News will appear here soon.</p>')
    .replace('{{place_cards}}', () => placeCards);
  const page = buildPage(meta, withPosts, outPath);
  if (name !== '404') pageRecords.push({ url: page.canonical.replace(config.site.url, ''), lastmod: page.updated });
}

// Static assets
for (const d of ['css', 'js']) {
  const s = join(SRC, d);
  if (existsSync(s)) cpSync(s, join(DIST, d), { recursive: true });
}
if (existsSync(join(ROOT, 'public'))) cpSync(join(ROOT, 'public'), DIST, { recursive: true });

// Inline SVGs are used via includes; also expose standalone files under /img for OG/social if present.

// Sitemap + robots
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Built from what was actually emitted, so a page can never be listed without
// existing (or exist without being listed).
const order = ['/', ...config.nav.map((n) => n.href), '/privacy/', '/legal/'];
const rank = (u) => { const i = order.indexOf(u); return i === -1 ? order.length : i; };
const urls = [
  ...pageRecords.sort((a, b) => rank(a.url) - rank(b.url)),
  ...placeRecords,
  ...posts.map((p) => ({ url: p.url, lastmod: p.meta.updated || p.meta.date })),
];
const missing = order.filter((u) => !urls.some((r) => r.url === u));
if (missing.length) throw new Error('nav points at pages that were not built: ' + missing.join(', '));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${config.site.url}${u.url}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') + `\n</urlset>\n`;
emit('sitemap.xml', sitemap);
emit('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${config.site.url}/sitemap.xml\n`);

// RSS feed for news
const rssItems = posts.map((p) => {
  const link = `${config.site.url}${p.url}`;
  const pub = new Date(p.meta.date + 'T09:00:00Z').toUTCString();
  return `    <item>\n      <title>${xmlEsc(p.meta.title)}</title>\n      <link>${link}</link>\n      <guid isPermaLink="true">${link}</guid>\n      <pubDate>${pub}</pubDate>\n      <description>${xmlEsc(p.meta.standfirst || p.meta.title)}</description>\n    </item>`;
}).join('\n');
const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${xmlEsc(config.site.name)}: News</title>\n    <link>${config.site.url}/news/</link>\n    <description>${xmlEsc(config.site.description)}</description>\n    <language>en-gb</language>\n    <atom:link href="${config.site.url}/feed.xml" rel="self" type="application/rss+xml" />\n${rssItems}\n  </channel>\n</rss>\n`;
emit('feed.xml', rss);

// count output
let count = 0;
(function walk(d){ for (const e of readdirSync(d)) { const p = join(d,e); if (statSync(p).isDirectory()) walk(p); else count++; } })(DIST);
console.log(`Built ${count} files into dist/ (${posts.length} news posts).`);
