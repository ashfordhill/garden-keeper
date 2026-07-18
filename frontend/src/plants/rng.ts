/**
 * Tiny seeded PRNG (mulberry32) + helpers for deterministic hand-drawn
 * wobble. Same seed => identical sequence, so saved gardens never shimmer.
 */

/** Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Uniform float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Symmetric jitter in [-amount, amount). */
export function jitter(rng: Rng, amount: number): number {
  return (rng() - 0.5) * 2 * amount;
}
