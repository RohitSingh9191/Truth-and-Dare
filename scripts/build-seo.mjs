// Writes public/robots.txt and public/sitemap.xml from VITE_SITE_URL in .env, so the site
// address lives in one place. Run by `npm run dev` and `npm run build`.

import { readFileSync, writeFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const site = (process.env.VITE_SITE_URL || env.match(/^VITE_SITE_URL=(.+)$/m)?.[1] || '').trim().replace(/\/$/, '');
if (!/^https:\/\//.test(site)) throw new Error('Set VITE_SITE_URL=https://... in .env');

writeFileSync('public/robots.txt', `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${site}/sitemap.xml
`);
const today = new Date().toISOString().slice(0, 10);
let pages = [];
try { pages = JSON.parse(readFileSync('public/pages.json', 'utf8')); } catch { /* no question pages */ }
const urls = [`${site}/`, ...pages.map((p) => `${site}/${p.slug}/`), `${site}/privacy`];
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
console.log(`site address: ${site}`);
