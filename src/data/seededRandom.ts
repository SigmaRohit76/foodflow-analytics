/**
 * Mulberry32 seeded PRNG — deterministic, fast, good distribution.
 * Using a fixed seed means the synthetic dataset is identical on every run,
 * so charts and KPIs don't flicker on hot-reload.
 */
export function createRng(seed: number) {
  let s = seed >>> 0;
  return function (): number {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random item from an array using the provided rng */
export function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Pick a weighted random item. weights must match arr length. */
export function weightedPick<T>(
  arr: readonly T[],
  weights: readonly number[],
  rng: () => number
): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

/** Return an integer in [min, max] inclusive */
export function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Return a float in [min, max) */
export function randFloat(min: number, max: number, rng: () => number): number {
  return rng() * (max - min) + min;
}

/** Normal-ish distribution via Box-Muller (clamped to [min, max]) */
export function randNormal(
  mean: number,
  stddev: number,
  min: number,
  max: number,
  rng: () => number
): number {
  const u1 = rng() || 1e-10;
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.min(max, Math.max(min, mean + z * stddev));
}
