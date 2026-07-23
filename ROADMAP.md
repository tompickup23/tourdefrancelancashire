# Roadmap & backlog

Status snapshot and next steps, captured 23 July 2026 so the project can be parked and picked up later.

## Current state: LIVE and complete for launch

- Live at **https://tourdefrancelancashire.co.uk** and **https://www.tourdefrancelancashire.co.uk** (SSL, Cloudflare Pages, DNS on Cloudflare).
- 7 content pages + Privacy + Legal, animated hero, artistic landmark route map, real licensed photography, refined design system, self-hosted fonts.
- Compliance: no cookies / no tracking / no consent banner needed; A.S.O. trademark + independent disclaimer; image credits.
- SEO: OG image, apple-touch-icon, RSS feed, sitemap, robots, Event + NewsArticle + Organization + WebSite structured data.
- Google Translate menu (6 languages) + browser-translate friendly.

## Content maintenance (as the event approaches)

- **Update the route as A.S.O. publishes the road book:** the other four categorised climbs, exact lane-level roads, and the detailed map. Currently only the Cote de Jubilee Tower climb and the corridor are confirmed (Jan 2026 announcement).
- **Add when confirmed:** official fan zones, road closures, timings, park-and-ride, spectator guidance (the `/plan` page has placeholders framed as "still to come").
- **Keep publishing news** for SEO (drop `src/news/<slug>.html` with a title/date/standfirst meta block, then rebuild). Each post auto-appears in the feed, sitemap and homepage.
- Refresh / add photography if stronger licensed shots appear (the Forest of Bowland moor shot is the plainest; all credits on `/about#credits`).

## Monetisation

See **MONETISATION.md**. Owner to revisit. Rails to add once affiliate accounts exist: cookie-clean deep links, Cloudflare Web Analytics (cookieless), affiliate disclosure, email signup. Bigger lines later: paid local directory, race-day guide PDF, whole-site sponsorship, non-official merch.

## Tech / ops backlog (optional)

- Add a **Google Search Console** verification meta tag and submit the sitemap.
- If any cookie-setting tool is ever added (ads, GA, booking widgets): add a consent banner and update `/privacy` first.
- CI: `.github/workflows/deploy.yml` exists but needs repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` for auto-deploy on push. Until then, deploy manually: `node build.mjs && wrangler pages deploy dist --project-name tourdefrancelancashire --branch main --commit-dirty=true`.
- Note: `wrangler login` must be run **unsandboxed** for the OAuth callback to bind.
- CSP has a sha256 hash for the inline `has-js` script in `public/_headers`; if that inline script text ever changes, recompute the hash or the scroll-reveal animations break in production.

## Rebuild / edit reminders

- Build: `node build.mjs` (zero dependencies). Preview: `npm run preview` (localhost:8799).
- Edit facts/route stops in `site.config.json`; pages in `src/pages/*.html`; shared chrome in `src/partials/`.
- **House style: no em-dashes anywhere.** Verify with `grep -roh '—' dist/ | wc -l` = 0 before deploy.
- Fonts self-hosted in `public/fonts/`; the site makes zero third-party requests on load (keep it that way to avoid a consent banner).
