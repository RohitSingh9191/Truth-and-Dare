// The spinning bottle: tap, flick or button. The game decides where it stops (see picker.js);
// this file only turns the drawing, slowing it like a real bottle, and reports finger flicks.

import { spinCurve } from './picker.js';

const TICK_EVERY = 30; // degrees between ticks
const MIN_TICK_GAP = 45; // ms, so fast turns don't buzz

export function createBottle(el, surface, { onGesture, canSpin = () => true }) {
  let angle = 0;
  let spinning = false;
  let drag = null;

  const set = (a) => {
    angle = a;
    el.style.transform = `rotate(${a}deg)`;
  };

  function centre() {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Finger angle around the bottle centre: 0 = up, clockwise.
  function fingerAngle(e, c) {
    return (Math.atan2(e.clientX - c.x, c.y - e.clientY) * 180) / Math.PI;
  }

  surface.addEventListener('pointerdown', (e) => {
    if (spinning || e.button > 0 || !canSpin()) return;
    if (e.target.closest('button, a, input')) return;
    const c = centre();
    const a = fingerAngle(e, c);
    drag = { id: e.pointerId, c, x: e.clientX, y: e.clientY, t: performance.now(), a0: a, last: a, start: angle, samples: [{ a, t: performance.now() }], moved: false };
    surface.setPointerCapture?.(e.pointerId);
  });

  surface.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    let a = fingerAngle(e, drag.c);
    while (a - drag.last > 180) a -= 360; // keep the angle continuous
    while (a - drag.last < -180) a += 360;
    drag.last = a;
    const now = performance.now();
    drag.samples.push({ a, t: now });
    if (drag.samples.length > 8) drag.samples.shift();
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) drag.moved = true;
    if (drag.moved) set(drag.start + (a - drag.a0));
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) {
      onGesture({ dir: 1, speed: 0, tap: true });
      return;
    }
    const now = performance.now();
    const recent = d.samples.filter((s) => now - s.t < 120);
    const first = recent[0] || d.samples[0];
    const speed = (d.last - first.a) / Math.max(16, now - first.t); // degrees per ms
    const dir = Math.sign(speed || d.last - d.a0) || 1;
    onGesture({ dir, speed: Math.abs(speed), tap: false });
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.id) drag = null;
  });

  /**
   * Turns to `target` (an absolute angle) and resolves when fully stopped.
   * `curve` maps time (0..1) to the share of the turn done; the default is real-bottle physics.
   */
  function spinTo(target, { duration = 4000, onTick, curve = spinCurve() } = {}) {
    spinning = true;
    const from = angle;
    const delta = target - from;
    const t0 = performance.now();
    let lastStep = Math.floor(from / TICK_EVERY);
    let lastTick = 0;
    return new Promise((resolve) => {
      function frame(now) {
        const p = Math.min(1, (now - t0) / duration);
        const a = from + delta * curve(p);
        set(a);
        const step = Math.floor(a / TICK_EVERY);
        if (step !== lastStep && now - lastTick > MIN_TICK_GAP) {
          lastTick = now;
          onTick?.();
        }
        lastStep = step;
        if (p < 1) requestAnimationFrame(frame);
        else {
          set(target);
          spinning = false;
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  return {
    spinTo,
    get angle() { return angle; },
    get spinning() { return spinning; },
  };
}
