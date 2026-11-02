/**
 * Tells IndexNow (Bing, Yandex, Seznam, Naver and others) about every URL in
 * the live sitemap, in one request.
 *
 *   node scripts/indexnow.mjs
 *
 * The key is public by design: IndexNow proves ownership by fetching
 * https://tourdefrancelancashire.co.uk/<key>.txt and checking it holds the
 * key, so the file lives in public/ and is copied to the site root. The deploy
 * workflow runs this after each production deploy; a failure never blocks it.
 */
import { readdirSync } from "node:fs";

const SITE = "https://tourdefrancelancashire.co.uk";
// The key is read from the one key file in public/, named <key>.txt.
const keyFiles = readdirSync(new URL("../public/", import.meta.url)).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (keyFiles.length !== 1) {
  console.error(`indexnow: expected one <key>.txt in public/, found ${keyFiles.length}`);
  process.exit(1);
}
const KEY = keyFiles[0].slice(0, -4);

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.error("indexnow: the live sitemap lists no URL");
  process.exit(1);
}
const keyFile = await fetch(`${SITE}/${KEY}.txt`);
if (!keyFile.ok || (await keyFile.text()).trim() !== KEY) {
  console.error(`indexnow: ${SITE}/${KEY}.txt is not live with the key; deploy first`);
  process.exit(1);
}
const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
});
console.log(`indexnow: submitted ${urls.length} URLs, HTTP ${response.status}`);
if (!response.ok && response.status !== 202) process.exit(1);
