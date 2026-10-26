// Renders the app icons and the link preview picture (og.png) from the bottle drawing in
// index.html, using the Chrome installed on this computer. Run: npm run images

import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const html = readFileSync('index.html', 'utf8');
const bottle = html.match(/<svg id="bottle-svg"[\s\S]*?<\/svg>/)[0]
  .replace(/<g class="kidsb">[\s\S]*?<\/g>/, '')
  .replace(/<polygon class="beam"[^>]*>/, '');

const page = (body, w, h) => `<!doctype html><html><head><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  body{--lvl:#2ED3C1;font-family:"Segoe UI",system-ui,sans-serif;color:#f7f4ff}
  .bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,#2b2466 0%,#15112b 70%)}
  .b{position:absolute;left:50%;top:50%;transform-origin:50% 50%}
  .b svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 ${w / 40}px ${w / 25}px rgba(0,0,0,.5))}
  .ring{position:absolute;left:50%;top:50%;border-radius:50%;translate:-50% -50%;
    background:radial-gradient(circle,rgba(46,211,193,.28),transparent 68%);border:${Math.max(2, w / 120)}px dashed rgba(46,211,193,.45)}
</style></head><body>${body}</body></html>`;

function icon(size, { round = true, scale = 0.7 } = {}) {
  const r = round ? size * 0.22 : 0;
  const bh = size * scale;
  return page(`<div class="bg" style="border-radius:${r}px"></div>
    <div class="ring" style="width:${size * scale * 1.12}px;height:${size * scale * 1.12}px"></div>
    <div class="b" style="height:${bh}px;width:${bh * 100 / 260}px;translate:-50% -50%;rotate:35deg">${bottle}</div>`, size, size);
}

const og = page(`<div class="bg"></div>
  <div class="ring" style="left:900px;width:520px;height:520px"></div>
  <div class="b" style="left:900px;height:430px;width:${430 * 100 / 260}px;translate:-50% -50%;rotate:35deg">${bottle}</div>
  <div style="position:absolute;left:80px;top:120px;width:620px">
    <div style="font-size:84px;font-weight:900;letter-spacing:-1px">Truth n Dare</div>
    <div style="font-size:44px;font-weight:700;margin-top:8px;line-height:1.2">Truth or Dare with a spinning bottle</div>
    <div style="font-size:30px;margin-top:34px;color:#b9b1df">Free · No sign-up · Works offline</div>
    <div style="font-size:30px;margin-top:10px;color:#2ED3C1;font-weight:700">Kids · Friends · Party · 18+</div>
  </div>`, 1200, 630);

const favicon = (size) => `<!doctype html><html><head><style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}img{width:100%;height:100%;display:block}</style></head>
<body><img src="data:image/svg+xml;base64,${Buffer.from(readFileSync('public/favicon.svg')).toString('base64')}"></body></html>`;

const jobs = [
  ['public/favicon-48.png', favicon(48), 48, 48],
  ['public/favicon-96.png', favicon(96), 96, 96],
  ['public/icon-192.png', icon(192), 192, 192],
  ['public/icon-512.png', icon(512), 512, 512],
  ['public/icon-maskable-512.png', icon(512, { round: false, scale: 0.56 }), 512, 512],
  ['public/apple-touch-icon.png', icon(180, { round: false }), 180, 180],
  ['public/og.jpg', og, 1200, 630],
];

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
for (const [file, content, width, height] of jobs) {
  const p = await browser.newPage({ viewport: { width, height } });
  await p.setContent(content);
  await p.screenshot(file.endsWith('.jpg') ? { path: file, type: 'jpeg', quality: 82 } : { path: file, omitBackground: true });
  await p.close();
  console.log(`wrote ${file}`);
}
await browser.close();

// Shrink the PNG icons (fewer colours, same look) so the offline copy stays small.
import { execFileSync } from 'node:child_process';
execFileSync('python', ['-I', '-c', `
from PIL import Image
import sys
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA')
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(f, optimize=True)
`, ...jobs.filter(([f]) => f.endsWith('.png')).map(([f]) => f)], { stdio: 'inherit' });
