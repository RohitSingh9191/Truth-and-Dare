// Who the bottle points at, and how it gets there.
// The result is chosen first (with the browser's strong random numbers, the kind used for
// passwords), then the bottle is turned to it. So nobody can aim, a flick only changes how long
// and which way it spins, and the bottle always stops clearly on one place.

/** Without names the bottle never stops within this many degrees of its last stop. */
export const NEAR = 45;

export const norm = (a) => ((a % 360) + 360) % 360;

const word = new Uint32Array(1);
/** A random number from 0 up to (not including) 1, from the browser's secure random source. */
export function random() {
  try {
    globalThis.crypto.getRandomValues(word);
    return word[0] / 4294967296;
  } catch {
    return Math.random();
  }
}

export function angleDistance(a, b) {
  const d = norm(a - b);
  return Math.min(d, 360 - d);
}

export function shuffle(list, rnd = random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A random direction (0 = top, clockwise) that is not close to the last stop. */
export function freeAngle(last, rnd = random) {
  for (let i = 0; i < 64; i++) {
    const a = rnd() * 360;
    if (last == null || angleDistance(a, last) >= NEAR) return a;
  }
  return norm((last ?? 0) + 180);
}

/** Names sit evenly around the circle, the first one at the top, then clockwise. */
export function seatAngle(index, count) {
  return (360 / count) * index;
}

/** A point inside the seat, away from the lines between seats. */
export function seatTarget(index, count, rnd = random) {
  const width = 360 / count;
  const wobble = Math.min(width * 0.3, 16);
  return norm(seatAngle(index, count) + (rnd() - 0.5) * wobble);
}

/**
 * The direction of a name placed on screen (angles in seating order), with a small wobble that
 * stays well away from the neighbours, so the pick is always clear.
 */
export function towardsSeat(angles, index, rnd = random) {
  const n = angles.length;
  const here = angles[index];
  const gap = Math.min(
    angleDistance(here, angles[(index + 1) % n]),
    angleDistance(here, angles[(index - 1 + n) % n]),
  );
  const wobble = Math.min(gap * 0.3, 8);
  return norm(here + (rnd() - 0.5) * wobble);
}

/**
 * Picks a numbered part of the circle (used when there are no names). Never the same part
 * twice in a row; with 10 or more parts not the parts right next to it either, because
 * one player often sits across two neighbouring parts.
 */
export function nextPart(count, last, rnd = random) {
  const blocked = new Set();
  if (last != null && last >= 0 && last < count) {
    blocked.add(last);
    if (count >= 10) {
      blocked.add((last + 1) % count);
      blocked.add((last - 1 + count) % count);
    }
  }
  const options = [...Array(count).keys()].filter((i) => !blocked.has(i));
  return options[Math.floor(rnd() * options.length)];
}

/**
 * Picks the next player. Fair mode: everyone plays once per round, in a new random order
 * each round, and nobody twice in a row. Random mode: anyone except the last player.
 * `state` is { queue: number[], last: number } and is updated in place.
 */
export function nextSeat(count, state, fair = true, rnd = random) {
  if (count < 2) return 0;
  if (!fair) {
    let i;
    do { i = Math.floor(rnd() * count); } while (i === state.last);
    state.last = i;
    return i;
  }
  state.queue = (state.queue || []).filter((i) => i < count);
  if (!state.queue.length) {
    const order = shuffle([...Array(count).keys()], rnd);
    if (order[0] === state.last) [order[0], order[1]] = [order[1], order[0]];
    state.queue = order;
  }
  const i = state.queue.shift();
  state.last = i;
  return i;
}

// ---------- How a real bottle slows down ----------
// A spinning bottle is slowed by air drag (strong while it is fast) and by friction with the
// table (steady). Together: dω/dt = −a − b·ω. That gives a fast start, a long smooth slow-down
// and a firm stop, never an endless crawl. With x = time / duration and k = b · duration,
// the share of the turn done is p(x) = (e^k − e^(k(1−x)) − k·x) / (e^k − 1 − k).

/** How much of the slowing is air drag (bigger = more drag, longer gentle tail). */
export const DRAG = 2.6;

export function spinCurve(k = DRAG) {
  const ek = Math.exp(k);
  const den = ek - 1 - k;
  return (x) => (x >= 1 ? 1 : (ek - Math.exp(k * (1 - x)) - k * x) / den);
}

/** Starting speed as a multiple of the average speed (the slope of the curve at the start). */
export function startFactor(k = DRAG) {
  const ek = Math.exp(k);
  return (k * ek) / (ek - 1 - k);
}

/**
 * Plans one spin. `speed` is how fast the finger flicked, in degrees per millisecond
 * (0 for a tap or the SPIN button). A harder flick spins longer and more turns, starting at
 * the finger's speed; the end point is always exactly the chosen direction.
 * Returns { end (absolute angle), duration (ms) }.
 */
export function spinPlan(current, target, { dir = 1, speed = 0, rnd = random } = {}) {
  const s = speed > 0.3 ? Math.min(speed, 3.2) : 1.25 + rnd() * 0.5; // degrees per ms
  const duration = Math.round(Math.min(6000, Math.max(3500, 2800 + s * 1000)));
  const wanted = (s * duration) / startFactor(); // degrees that make the start match the flick
  const turns = Math.min(12, Math.max(4, Math.floor(wanted / 360)));
  const end = dir >= 0
    ? current + turns * 360 + norm(target - current)
    : current - turns * 360 - norm(current - target);
  return { end, duration };
}
