# Tour de France Lancashire

Independent visitor and information site for the **2027 Tour de France, Stage 2** through Lancashire (Saturday 3 July 2027, Keswick to Liverpool).

**Live:** [tourdefrancelancashire.co.uk](https://tourdefrancelancashire.co.uk) (and www), SSL, on Cloudflare Pages with DNS on Cloudflare.

## What it is

A tourist and information website: the route, places to stay, things to see nearby, and news. Not affiliated with A.S.O., Grand Départ GB 2027 or any official partner (see `/legal`). All original artwork (Lancashire rose, logo, artistic route map with landmark icons, hero scene); landmark photos are used under stated licences and credited on `/about#credits`.

## Stack

Zero-dependency static site. A small Node generator (`build.mjs`) assembles `src/` into `dist/`. No frameworks, no npm install required.

```
src/
  layout.html        shared HTML shell (SEO meta, structured data)
  partials/          header + footer
  svg/               original artwork (rose, logo, route map, landmarks, hero)
  css/site.css       design system
  css/fonts.css      self-hosted @font-face (Fraunces + Hanken Grotesk)
  js/                countdown.js, reveal.js, i18n.js (translate links)
  pages/*.html       one file per page (with <!-- title/description/active --> meta)
  news/*.html        news posts (with <!-- title/date/standfirst --> meta)
site.config.json     site data + sourced facts
build.mjs            the generator (also emits sitemap.xml, robots.txt, feed.xml)
public/              static passthrough (_headers, fonts, favicon, og image, photos)
```

## Build & deploy

```bash
node build.mjs         # outputs to dist/
npm run preview        # build + serve at http://localhost:8799

# deploy (wrangler must be logged in; run `wrangler login` UNSANDBOXED)
node build.mjs && wrangler pages deploy dist --project-name tourdefrancelancashire --branch main --commit-dirty=true
```

## Editing

- **Change a fact / route stop:** `site.config.json`
- **Edit a page:** `src/pages/<name>.html`
- **Add a news post:** drop `src/news/<slug>.html` with a `title` / `date` / `standfirst` meta block, then rebuild (it auto-appears in the homepage, RSS feed and sitemap)
- **House style:** no em-dashes anywhere. Verify with `grep -roh '—' dist/ | wc -l` = 0 before deploy.

## Privacy, legal, SEO

- No cookies, no analytics, no tracking; site makes zero third-party requests on load (fonts self-hosted), so no consent banner is required. Documented on `/privacy`.
- A.S.O. trademark acknowledgement and independent/unofficial disclaimer on `/legal`.
- OG image, apple-touch-icon, RSS (`/feed.xml`), sitemap, robots, and Event + NewsArticle + Organization + WebSite structured data.
- Google Translate menu in the footer (6 languages, cookie-clean proxy links).

## Docs

- **ROADMAP.md**: current state, content maintenance as the event approaches, and backlog.
- **MONETISATION.md**: affiliate / sponsorship / product strategy and the legal + cookie guardrails (to revisit).

## Sources

Route facts: [Grand Départ GB, Stage 2](https://www.letourgb.com/tdfroutes/stage-2/), [Lancashire County Council](https://news.lancashire.gov.uk/news/tour-de-france-coming-through-lancashire) (15 Jan 2026), [UK Sport](https://www.uksport.gov.uk/news/2026/01/15/le-tour-gb-route).
