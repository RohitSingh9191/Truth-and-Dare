// Tick and stop sounds made in code (no sound files), plus the short buzz on Android.
// Browsers only allow sound after a tap, so unlock() is called from the first spin.

let ctx = null;
let warmed = false;

export function unlock() {
  // iPhone: sound made in code obeys the ring/silent switch unless the page says it plays media,
  // and most iPhones are kept on silent (iOS 17+; older versions ignore this).
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
    }
    // 'suspended' before the first tap; 'interrupted' on iPhone after a call or locking the screen
    if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume();
    if (!warmed) { // older iPhones only wake the sound up once something plays inside the tap
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      warmed = true;
    }
  } catch { ctx = null; }
}

/** Sound switched off: let go of the speaker so music from other apps can play. */
export function mute() {
  try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch { /* ignore */ }
}

function blip(freq, start, length, volume, type = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

export function tick() {
  if (!ctx || ctx.state !== 'running') return;
  blip(1700, ctx.currentTime, 0.025, 0.08, 'triangle');
}

export function stopChime() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  blip(660, t, 0.18, 0.18);
  blip(990, t + 0.09, 0.28, 0.16);
}

export function timerEnd() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  [0, 0.22, 0.44].forEach((d) => blip(880, t + d, 0.16, 0.2, 'square'));
}

export function buzz(ms = 40) {
  try { navigator.vibrate?.(ms); } catch { /* iPhone browsers cannot vibrate */ }
}

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;
