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
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site}/</loc></url>
  <url><loc>${site}/privacy</loc></url>
</urlset>
`);
console.log(`site address: ${site}`);
