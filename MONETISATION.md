# Monetisation plan

Captured 23 July 2026. Strategy for turning tourdefrancelancashire.co.uk into revenue, to revisit later. Nothing here is built yet.

## The two guardrails that shape everything

**1. Stay in the "independent guide" lane.** The whole legal framing (A.S.O. trademark acknowledgement on `/legal`, "not affiliated / unofficial" disclaimer, no official marks) protects the site. Monetisation must never sell "official" Tour tickets or merchandise, or imply endorsement. Affiliate income, advertising, sponsorship and our own **non-official** products are all fine. Ambush branding is not.

**2. Monetising can cost the no-cookie / no-banner status.** The site currently sets zero cookies, so no consent banner is legally required (documented on `/privacy`).
- **Plain affiliate deep links** (`<a href>` with an affiliate ID) set no cookie on our page. They keep the clean setup.
- **Embedded widgets / ad networks / most analytics** (Stay22 map, Booking search box, AdSense, GA) set third-party cookies, which would then legally require a consent banner and a privacy-policy update.
- To measure traffic for selling sponsorship without a banner, use **Cloudflare Web Analytics** (free, cookieless, already on the account).
- **ASA/CAP rule:** affiliate and sponsored content must be labelled (a disclosure line per page + in `/legal`).

## Models, ranked for this site

| Model | Fit | Notes |
|---|---|---|
| Accommodation affiliate | high | "Places to Stay" is pure booking intent; race-weekend room rates spike |
| Local sponsored listings / paid directory | high | Sell featured spots to Lancashire hotels, B&Bs, pubs, bike shops, tour operators; the "Lancashire-side inventory" idea; direct sales, biggest line if sold well |
| Experiences / attractions affiliate | med-high | Clitheroe Castle, Williamson Park, guided cycling tours, day trips |
| Cycling-gear affiliate | med-high | Merlin Cycles (Lancashire-based) is a natural local partner |
| Own digital product | med | Paid "Race-Day Guide" PDF (climbs, timings, parking, where to eat), or free-for-email to build the list |
| Non-official merch | med | Lancashire-rose + cycling print-on-demand (Printful). Safe ONLY if Lancashire/cycling themed, never TdF marks/yellow jersey |
| Whole-site sponsorship | med | A Lancashire brand / hotel group / DMO sponsors the site; peaks around the event |
| Display ads | low | Cheapens a premium site and breaks the cookie stance; only at scale (Mediavine/Raptive tier) |

## Affiliate programmes (specifics)

**Accommodation**
- Booking.com Affiliate Partner (direct portal): deep links cookie-clean; search widget is not
- Sykes / cottages.com / holidaycottages.co.uk (via Awin): self-catering, big in Bowland + Ribble Valley
- Expedia / Hotels.com / Vrbo (CJ or Expedia Partner Solutions)
- Stay22 (direct): map aggregator, nice UX but a script that sets cookies

**Experiences / attractions**
- GetYourGuide (Partnerize), Viator (Impact), Tiqets (direct)

**Transport**
- Trainline (Awin/Impact), Discover Cars / Rentalcars

**Cycling / race-day kit**
- Merlin Cycles (Lancashire-based, Awin), Tredz / Sigma Sports / Rapha / Halfords (Awin)
- Amazon Associates UK: catch-all (OS maps of Bowland, guidebooks, picnic/waterproof kit)

**Networks to sign up with (covers most of the above):** Awin (one account), Amazon Associates UK, Booking.com, GetYourGuide. All support plain deep links.

## Suggested sequence

- **Now (rails):** cookieless analytics (Cloudflare) + accommodation & experience deep links + start the email list off the news/RSS + affiliate-disclosure line.
- **Through 2026:** paid local directory (direct sales to Lancashire hospitality) + race-day guide product; keep publishing news for SEO.
- **2027 peak:** whole-site sponsorship + merch. Most revenue lands in the ~6 months around the race.

Honest read: it is a long game. The durable value is the audience, the email list, and the domain becoming the default independent guide.

## Build notes (when the accounts exist)

Claude cannot create the affiliate accounts (they need identity / tax / payment details, which are the owner's to enter). Once IDs exist, the build is small:
- Cookie-clean deep links into `src/pages/stay.html`, `see.html`, `plan.html`, `route.html`.
- Affiliate-disclosure line added to `/legal` and `/privacy` (and a short note near affiliate links).
- Add Cloudflare Web Analytics beacon (cookieless) via a `_headers` / `<script>` snippet, or enable it in the Cloudflare dashboard for the zone (no code needed).
- Optional: an email-signup block (needs a provider; a cookieless embed or a form posting to a serverless function / provider API).
