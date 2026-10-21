// WhatsApp invites and question cards shared as pictures (with a QR code back to the card).

import { t, cardText } from './i18n.js';
import { LEVEL } from './levels.js';
import { toast } from './ui.js';
import { track } from './analytics.js';
import { CARD_ID } from '../shared/validate.js';

const site = () => location.origin;

export function invite() {
  const url = `${site()}/?ref=whatsapp`;
  const text = t('inviteMsg', { url });
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  track('invite');
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function bottleImage(color, kids) {
  const node = document.getElementById('bottle-svg').cloneNode(true);
  node.querySelector(kids ? '.soda' : '.kidsb')?.remove();
  node.querySelector('.beam')?.remove();
  node.removeAttribute('id');
  const svg = node.outerHTML
    .replace(/var\(--lvl\)/g, color)
    .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="260"');
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Draws the card as a 1080×1350 picture and opens the share sheet (or downloads it). */
export async function shareCard(card, levelKey, typeLabel) {
  try {
    const { default: qrcode } = await import('qrcode-generator');
    const lvl = LEVEL[levelKey];
    const link = CARD_ID.test(card.id || '') ? `${site()}/?q=${card.id}&ref=card` : `${site()}/?ref=card`;
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const font = getComputedStyle(document.body).fontFamily;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#221b48');
    bg.addColorStop(1, '#0f0c1f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = lvl.color;
    ctx.fillRect(0, 0, W, 18);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 52px ${font}`;
    ctx.fillText('TruthSpin', 80, 130);
    ctx.font = `600 34px ${font}`;
    ctx.fillStyle = lvl.color;
    ctx.fillText(`${t(`level_${levelKey}`)} · ${lvl.age === 'all' ? t('allAges') : lvl.age}`, 80, 185);

    ctx.font = `800 40px ${font}`;
    ctx.fillStyle = lvl.color;
    ctx.fillText(typeLabel.toUpperCase(), 80, 330);

    const text = cardText(card);
    let size = text.length > 120 ? 58 : text.length > 70 ? 66 : 76;
    ctx.font = `800 ${size}px ${font}`;
    let lines = wrap(ctx, text, W - 160);
    while (lines.length > 7 && size > 40) {
      size -= 4;
      ctx.font = `800 ${size}px ${font}`;
      lines = wrap(ctx, text, W - 160);
    }
    ctx.fillStyle = '#ffffff';
    lines.forEach((l, i) => ctx.fillText(l, 80, 420 + i * size * 1.22));

    const bottle = await bottleImage(lvl.color, levelKey === 'kids');
    if (bottle) {
      ctx.save();
      ctx.translate(W - 170, H - 210);
      ctx.rotate(-0.5);
      ctx.drawImage(bottle, -50, -130, 100, 260);
      ctx.restore();
    }

    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    const n = qr.getModuleCount();
    const box = 220;
    const cell = Math.floor(box / n);
    const qx = 80;
    const qy = H - 80 - cell * n;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx - 16, qy - 16, cell * n + 32, cell * n + 32);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, cell, cell);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 38px ${font}`;
    ctx.fillText(t('shareCardPlay'), qx + cell * n + 50, qy + 70);
    ctx.font = `500 32px ${font}`;
    ctx.fillStyle = '#c9c2ee';
    ctx.fillText(location.host, qx + cell * n + 50, qy + 120);

    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'truthspin-card.png', { type: 'image/png' });
    track('share-card');
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${t('shareCardText')} ${link}` });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(t('shareSaved'));
  } catch (e) {
    if (e?.name !== 'AbortError') toast(t('shareFailed'));
  }
}
