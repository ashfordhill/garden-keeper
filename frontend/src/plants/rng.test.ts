import { describe, expect, it } from "vitest";
import { jitter, mulberry32, range } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("outputs floats in [0, 1)", () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("handles negative and float seeds via uint coercion", () => {
    expect(() => mulberry32(-42)()).not.toThrow();
    expect(mulberry32(-42)()).toBe(mulberry32(-42)());
  });
});

describe("helpers", () => {
  it("range stays within bounds", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = range(rng, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(5);
    }
  });

  it("jitter is symmetric around zero", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = jitter(rng, 0.5);
      expect(Math.abs(v)).toBeLessThanOrEqual(0.5);
    }
  });
});
