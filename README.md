# Tour de France Lancashire

Independent visitor and information site for the **2027 Tour de France, Stage 2** through Lancashire (Saturday 3 July 2027, Keswick to Liverpool).

Live: [tourdefrancelancashire.co.uk](https://tourdefrancelancashire.co.uk)

## What it is

A tourist and information website: the route, places to stay, things to see nearby, and news. Not affiliated with A.S.O., Grand Départ GB 2027 or any official partner. All artwork (Lancashire rose, route map, landmark illustrations) is original — no third-party images, zero copyright surface.

## Stack

Zero-dependency static site. A small Node generator (`build.mjs`) assembles `src/` into `dist/`. No frameworks, no npm install required.

```
src/
  layout.html        shared HTML shell (SEO, structured data)
  partials/          header + footer
  svg/               original artwork (rose, logo, route map, landmarks)
  css/site.css       design system
  js/countdown.js    race-day countdown
  pages/*.html       one file per page (with <!-- title/description/active --> meta)
  news/*.html        news posts (with <!-- title/date/standfirst --> meta)
site.config.json     site data + sourced facts
build.mjs            the generator
public/              static passthrough (_headers, favicon, og image)
```

## Build

```bash
node build.mjs         # outputs to dist/
npm run preview        # build + serve at http://localhost:8799
```

## Deploy

Hosted on **Cloudflare Pages**. Output directory `dist`, build command `node build.mjs`.

## Editing

- **Change a fact / route stop:** `site.config.json`
- **Edit a page:** `src/pages/<name>.html`
- **Add a news post:** drop `src/news/<slug>.html` with a `title` / `date` / `standfirst` meta block, then rebuild
- **House style:** no em-dashes anywhere (use commas, colons or parentheses)

## Sources

Route facts: [Grand Départ GB — Stage 2](https://www.letourgb.com/tdfroutes/stage-2/), [Lancashire County Council](https://news.lancashire.gov.uk/news/tour-de-france-coming-through-lancashire) (15 Jan 2026), [UK Sport](https://www.uksport.gov.uk/news/2026/01/15/le-tour-gb-route).
