import { describe, it, expect } from 'vitest';
import { freeAngle, nextSeat, spinPlan, spinCurve, startFactor, random, seatTarget, angleDistance, norm, NEAR } from '../../src/picker.js';

describe('bottle without names', () => {
  it('never stops close to its last stop', () => {
    let last = null;
    for (let i = 0; i < 5000; i++) {
      const a = freeAngle(last);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(360);
      if (last != null) expect(angleDistance(a, last)).toBeGreaterThanOrEqual(NEAR);
      last = a;
    }
  });
});

describe('bottle with names', () => {
  it('fair mode: everyone plays once per round, never twice in a row', () => {
    for (const n of [2, 3, 5, 8, 20]) {
      const state = { queue: [], last: -1 };
      let prev = -1;
      for (let round = 0; round < 50; round++) {
        const picked = [];
        for (let i = 0; i < n; i++) {
          const s = nextSeat(n, state, true);
          expect(s).not.toBe(prev);
          prev = s;
          picked.push(s);
        }
        expect(new Set(picked).size).toBe(n);
      }
    }
  });

  it('two players simply alternate', () => {
    const state = { queue: [], last: -1 };
    const seq = Array.from({ length: 40 }, () => nextSeat(2, state, true));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });

  it('random mode never repeats the last player', () => {
    const state = { queue: [], last: -1 };
    let prev = -1;
    for (let i = 0; i < 2000; i++) {
      const s = nextSeat(4, state, false);
      expect(s).not.toBe(prev);
      prev = s;
    }
  });

  it('random mode (Fair turns off) is really random, not rounds in disguise', () => {
    const n = 4;
    const N = 40000;
    const state = { queue: [], last: -1 };
    const seq = Array.from({ length: N }, () => nextSeat(n, state, false));
    // Everyone is picked about equally often (about 1 in 4).
    const counts = new Array(n).fill(0);
    for (const s of seq) counts[s]++;
    for (const c of counts) expect(Math.abs(c - N / n)).toBeLessThan((N / n) * 0.05);
    // After any player, each of the other three is equally likely to be next (about 1 in 3).
    const after = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 1; i < N; i++) after[seq[i - 1]][seq[i]]++;
    for (let a = 0; a < n; a++) {
      const total = after[a].reduce((x, y) => x + y, 0);
      for (let b = 0; b < n; b++) {
        if (a === b) expect(after[a][b]).toBe(0);
        else expect(Math.abs(after[a][b] / total - 1 / 3)).toBeLessThan(0.03);
      }
    }
    // Not rounds: a block of 4 turns has all 4 players only about 2 times in 9 (fair mode: always).
    let full = 0;
    for (let i = 0; i + n <= N; i += n) if (new Set(seq.slice(i, i + n)).size === n) full++;
    expect(Math.abs(full / (N / n) - 2 / 9)).toBeLessThan(0.03);
    // Someone can be picked again before everyone has played, and someone can wait a long time.
    const lastSeen = new Array(n).fill(-1);
    let longestWait = 0;
    seq.forEach((s, i) => {
      if (lastSeen[s] >= 0) longestWait = Math.max(longestWait, i - lastSeen[s]);
      lastSeen[s] = i;
    });
    expect(longestWait).toBeGreaterThan(2 * n); // impossible in fair mode
  });

  it('switching Fair turns off and on mid-game works straight away', () => {
    const state = { queue: [], last: -1 };
    for (let i = 0; i < 3; i++) nextSeat(5, state, true); // part-way through a fair round
    let prev = state.last;
    for (let i = 0; i < 500; i++) {
      const s = nextSeat(5, state, false);
      expect(s).not.toBe(prev);
      prev = s;
    }
    // The game clears the round when the switch is flipped (sheets.js), then fair rounds start fresh.
    const fresh = { queue: [], last: prev };
    const round = Array.from({ length: 5 }, () => nextSeat(5, fresh, true));
    expect(new Set(round).size).toBe(5);
    expect(round[0]).not.toBe(prev);
  });

  it('stops well inside the picked seat, away from the lines between seats', () => {
    for (const n of [2, 3, 6, 12, 20]) {
      const width = 360 / n;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 50; k++) {
          const a = seatTarget(i, n);
          expect(angleDistance(a, width * i)).toBeLessThan(width / 2 - 0.1 * width);
        }
      }
    }
  });
});

describe('spin like a real bottle', () => {
  it('always lands exactly on the chosen direction, 4 to 12 turns, the way the finger moved', () => {
    for (let i = 0; i < 3000; i++) {
      const current = Math.random() * 5000 - 2500;
      const target = Math.random() * 360;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = Math.random() < 0.3 ? 0 : Math.random() * 4;
      const { end, duration } = spinPlan(current, target, { dir, speed });
      expect(norm(end)).toBeCloseTo(norm(target), 6);
      const turns = ((end - current) * dir) / 360;
      expect(turns).toBeGreaterThanOrEqual(4);
      expect(turns).toBeLessThan(13);
      expect(duration).toBeGreaterThanOrEqual(3500);
      expect(duration).toBeLessThanOrEqual(6000);
    }
  });

  it('slows down smoothly, never goes backwards, and stops firmly', () => {
    const p = spinCurve();
    expect(p(0)).toBeCloseTo(0, 9);
    expect(p(1)).toBe(1);
    let last = 0;
    let lastStep = Infinity;
    for (let k = 1; k <= 1000; k++) {
      const v = p(k / 1000);
      const step = v - last;
      expect(step).toBeGreaterThan(0); // always moving forward
      expect(step).toBeLessThanOrEqual(lastStep + 1e-12); // always slowing down
      last = v;
      lastStep = step;
    }
    // Firm stop: in the last 2% of the time it still moves a little (friction), not an endless crawl.
    expect(p(1) - p(0.98)).toBeGreaterThan(0);
    expect(p(1) - p(0.98)).toBeLessThan(0.002);
  });

  it('starts at the speed of the flick, and a harder flick spins longer', () => {
    const medium = spinPlan(0, 90, { speed: 1.6 });
    const startSpeed = ((medium.end - 0) * startFactor()) / medium.duration; // degrees per ms
    expect(startSpeed).toBeGreaterThan(1.6 * 0.75);
    expect(startSpeed).toBeLessThan(1.6 * 1.3);
    expect(spinPlan(0, 90, { speed: 3 }).duration).toBeGreaterThan(spinPlan(0, 90, { speed: 1 }).duration);
  });

  it('uses evenly spread secure random numbers', () => {
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) buckets[Math.floor(random() * 10)]++;
    for (const b of buckets) {
      expect(b).toBeGreaterThan(1700);
      expect(b).toBeLessThan(2300);
    }
  });
});

describe('pointing at names placed on screen', () => {
  it('points close to the name and far from its neighbours', async () => {
    const { towardsSeat } = await import('../../src/picker.js');
    const angles = [0, 20, 35, 90, 170, 185, 300]; // uneven, like names on a tall screen
    for (let i = 0; i < angles.length; i++) {
      for (let k = 0; k < 200; k++) {
        const a = towardsSeat(angles, i);
        const here = angleDistance(a, angles[i]);
        const others = angles.filter((_, j) => j !== i).map((b) => angleDistance(a, b));
        expect(here).toBeLessThan(Math.min(...others));
        expect(here).toBeLessThanOrEqual(4.01);
      }
    }
  });
});


describe('numbered parts of the circle (no names)', () => {
  it('never picks the same part twice in a row, nor its neighbours when there are 12', async () => {
    const { nextPart } = await import('../../src/picker.js');
    for (const n of [6, 8, 12]) {
      let last = null;
      const counts = new Array(n).fill(0);
      for (let i = 0; i < 12000; i++) {
        const p = nextPart(n, last);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(n);
        if (last != null) {
          expect(p).not.toBe(last);
          if (n >= 10) {
            expect(p).not.toBe((last + 1) % n);
            expect(p).not.toBe((last - 1 + n) % n);
          }
        }
        counts[p]++;
        last = p;
      }
      // Every part comes up about equally often.
      for (const c of counts) expect(Math.abs(c - 12000 / n)).toBeLessThan((12000 / n) * 0.15);
    }
  });

  it('stops well inside the part, away from its lines', () => {
    for (const n of [6, 8, 12]) {
      const half = 360 / n / 2;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 100; k++) {
          expect(angleDistance(seatTarget(i, n), (360 / n) * i)).toBeLessThan(half * 0.5);
        }
      }
    }
  });
});
