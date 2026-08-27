# Tour de France Lancashire

Independent visitor and information site for the **2027 Tour de France, Stage 2** through Lancashire (Saturday 3 July 2027, Keswick to Liverpool).

**Live:** [tourdefrancelancashire.co.uk](https://tourdefrancelancashire.co.uk) (and www), SSL, on Cloudflare Pages with DNS on Cloudflare.

## What it is

A tourist and information website: the route, places to stay, things to see nearby, and news. Not affiliated with A.S.O., Grand Départ GB 2027 or any official partner (see `/legal`). All original artwork (Lancashire rose, logo, artistic route map with landmark icons, hero scene); landmark photos are used under stated licences and credited on `/about#credits`.

## Stack

Zero-dependency static site. A small Node generator (`build.mjs`) assembles `src/` into `dist/`. No frameworks, no npm install required.

```
src/
  layout.html        shared HTML shell (SEO meta, structured data, analytics)
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
npm run seo-check      # the gate: run it before every deploy
npm run preview        # build + serve at http://localhost:8799

# deploy (wrangler must be logged in; run `wrangler login` UNSANDBOXED)
node build.mjs && node seo-check.mjs && npx wrangler@4 pages deploy dist --project-name tourdefrancelancashire --branch main --commit-dirty=true
```

`seo-check.mjs` refuses an over-long or duplicated title, a missing canonical, a
page without exactly one h1, JSON-LD that will not parse or that references an
`@id` nothing defines, FAQ copy that has drifted from `site.config.json`, a
sitemap that disagrees with `dist` in either direction, a missing `404.html`,
body copy under 220 words, more than 40% five-word overlap between any two
pages, an orphan page, an internal link to a file that was not built, an image
with no alt text or intrinsic dimensions, and any em-dash. It also warns about
things only a human with dashboard access can fix, which do not block a build.
Every check is proved to fail on a deliberately broken input; see PROVING THE
GATES at the foot of that file, and add a proof for anything new.

## Two things that need a Cloudflare dashboard

Both are five-minute jobs and neither can be done from this repo. Until they are
done the site still works; it just deploys by hand and measures nothing.

### 1. Turn the visitor counter on

Nothing is measured at the moment. The site runs no analytics, makes no
third-party request on load, and `/privacy/` says exactly that.

One setting controls all of it. In the Cloudflare dashboard go to **Analytics &
Logs > Web Analytics**, add or open `tourdefrancelancashire.co.uk`, choose
**Manage site > JS snippet**, and copy the 32-character hex `token` out of it.
Paste it into `site.config.json`:

```json
"analytics": { "provider": "cloudflare", "beaconToken": "<the 32 hex characters>" }
```

Rebuild and deploy. Three things happen from that one value: the beacon is
emitted on every page, the privacy notice switches to the wording that describes
cookieless analytics, and the gate starts enforcing that no page is missing the
beacon and that the notice matches. Clear the token and all three reverse.

The wording for both states is in `analytics.copy.on` and `analytics.copy.off`
in the same file, so what the site does and what it tells readers cannot drift
apart. **The token is public**: it ships in the HTML of every page, which is why
it lives in the config and not in a secret. Do not reuse another site's token,
this property is kept separate from the rest of the estate on purpose.

### 2. Let CI deploy

The `deploy` job is skipped while the repo has no Cloudflare secrets, so pushes
build and gate but publish nothing, and the run summary says so. To enable it:

1. Cloudflare dashboard > **My Profile > API Tokens > Create Token**, use the
   **Edit Cloudflare Workers** template or a custom token with **Account >
   Cloudflare Pages > Edit** on the `tompickup@gmail.com` account, and copy the
   token once (it is shown only at creation).
2. In this repo, **Settings > Secrets and variables > Actions > New repository
   secret**, twice:
   - `CLOUDFLARE_API_TOKEN` = the token from step 1
   - `CLOUDFLARE_ACCOUNT_ID` = `35e8f9e8edb5487b97309d107331f7f5`

   Or from a terminal, which prompts for the value rather than putting it in
   shell history:

   ```bash
   gh secret set CLOUDFLARE_API_TOKEN --repo tompickup23/tourdefrancelancashire
   gh secret set CLOUDFLARE_ACCOUNT_ID --repo tompickup23/tourdefrancelancashire
   ```

The next push to main deploys on its own. Nothing else needs editing.

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
