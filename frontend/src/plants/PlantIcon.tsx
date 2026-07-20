/**
 * FROZEN CONTRACT (Wave 1): the parametric plant icon renderer.
 *
 * - Renders a single SVG <g> element, centered at the origin.
 * - The icon fits within the box [-size/2, -size/2] .. [size/2, size/2].
 * - Output is deterministic for a given (archetype, params, seed, size).
 * - Pure SVG primitives only (paths, circles, ellipses) — no <image>, no
 *   filters that break SVG export.
 *
 * Rendering approach:
 * - Trees: horizon / side-view silhouettes (trunk + branching + canopy),
 *   not a top-down plan blob. Branching.pattern drives structure.
 * - Shrubs / vines: top-down wobbly canopy + branch strokes.
 * - Grasses: radial blade tuft (soft under-disk + filled blades).
 * - Groundcovers: soft mat canopy + dense leaflet scatter.
 * - Rosettes: concentric pointed leaves (succulents, etc.).
 * - All wobble comes from a seeded mulberry32 PRNG, so output never shimmers.
 * - Node count stays tiny: detail lives in path *data* (merged subpaths).
 */
import type { ReactNode } from "react";
import type {
  Archetype,
  BloomShape,
  BranchingPattern,
  FoliageShape,
  VisualParams,
} from "../document/schema";
import { jitter, mulberry32, range, type Rng } from "./rng";

export interface PlantIconProps {
  archetype: Archetype;
  params: VisualParams;
  /** Deterministic wobble seed (comes from the PlantElement). */
  seed: number;
  /** Icon box size in canvas units. */
  size: number;
}

// ---------------------------------------------------------------------------
// Small numeric / color / path helpers
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

const N = (v: number) => Math.round(v * 100) / 100;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const polar = (a: number, r: number): Pt => ({
  x: Math.cos(a) * r,
  y: Math.sin(a) * r,
});

/** Multiply an #rgb/#rrggbb color's channels by `factor` (clamped). */
function shade(color: string, factor: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const num = parseInt(hex, 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = ch((num >> 16) & 255);
  const g = ch((num >> 8) & 255);
  const b = ch(num & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Closed Catmull-Rom spline through `pts` as cubic beziers. */
function smoothClosed(pts: Pt[]): string {
  const n = pts.length;
  let d = `M${N(pts[0].x)} ${N(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += `C${N(p1.x + (p2.x - p0.x) / 6)} ${N(p1.y + (p2.y - p0.y) / 6)} ${N(
      p2.x - (p3.x - p1.x) / 6,
    )} ${N(p2.y - (p3.y - p1.y) / 6)} ${N(p2.x)} ${N(p2.y)}`;
  }
  return d + "Z";
}

function linearClosed(pts: Pt[]): string {
  return "M" + pts.map((p) => `${N(p.x)} ${N(p.y)}`).join("L") + "Z";
}

/** Circle as a path subpath (lets many circles merge into one element). */
function circleSub(cx: number, cy: number, r: number): string {
  return `M${N(cx - r)} ${N(cy)}a${N(r)} ${N(r)} 0 1 0 ${N(2 * r)} 0a${N(
    r,
  )} ${N(r)} 0 1 0 ${N(-2 * r)} 0`;
}

/** Curved radial stroke from radius r0 to r1 at angle `a`, bent sideways. */
function radialStroke(a: number, r0: number, r1: number, bend: number): string {
  const s = polar(a, r0);
  const e = polar(a, r1);
  const mid = polar(a, (r0 + r1) / 2);
  const o = bend * (r1 - r0);
  return `M${N(s.x)} ${N(s.y)}Q${N(mid.x - Math.sin(a) * o)} ${N(
    mid.y + Math.cos(a) * o,
  )} ${N(e.x)} ${N(e.y)}`;
}

/** Pointed leaf/petal from `base` toward angle `a`, length `len`. */
function pointedLeaf(
  bx: number,
  by: number,
  a: number,
  len: number,
  halfAngle: number,
): string {
  const tip = { x: bx + Math.cos(a) * len, y: by + Math.sin(a) * len };
  const s1 = {
    x: bx + Math.cos(a + halfAngle) * len * 0.55,
    y: by + Math.sin(a + halfAngle) * len * 0.55,
  };
  const s2 = {
    x: bx + Math.cos(a - halfAngle) * len * 0.55,
    y: by + Math.sin(a - halfAngle) * len * 0.55,
  };
  return `M${N(bx)} ${N(by)}Q${N(s1.x)} ${N(s1.y)} ${N(tip.x)} ${N(
    tip.y,
  )}Q${N(s2.x)} ${N(s2.y)} ${N(bx)} ${N(by)}Z`;
}

// ---------------------------------------------------------------------------
// Canopy silhouette
// ---------------------------------------------------------------------------

/** Edge treatment per foliage shape: point count, lobe amplitude, wobble. */
const EDGE: Record<
  FoliageShape,
  { n: number; amp: number; wob: number; smooth: boolean }
> = {
  round: { n: 9, amp: 0, wob: 0.06, smooth: true },
  oval: { n: 9, amp: 0, wob: 0.05, smooth: true },
  heart: { n: 7, amp: 0.05, wob: 0.09, smooth: true },
  lobed: { n: 12, amp: 0.11, wob: 0.05, smooth: true },
  feathery: { n: 18, amp: 0.07, wob: 0.04, smooth: true },
  spiky: { n: 18, amp: 0.16, wob: 0.05, smooth: false },
  needle: { n: 28, amp: 0.08, wob: 0.03, smooth: false },
  blade: { n: 16, amp: 0.24, wob: 0.06, smooth: false },
};

function canopyPath(
  rng: Rng,
  r: number,
  shape: FoliageShape,
  pattern: BranchingPattern,
  archetype: Archetype,
  axis: number,
): string {
  const e = EDGE[shape];
  const norm = 1 + e.amp + e.wob; // keep peaks within r
  const ph1 = range(rng, 0, TAU);
  const ph2 = range(rng, 0, TAU);
  const squash = shape === "oval" ? 0.84 : 1;
  const pts: Pt[] = [];
  for (let i = 0; i < e.n; i++) {
    const a = (i / e.n) * TAU + jitter(rng, (Math.PI / e.n) * 0.5);
    let rad = (r / norm) * (1 + jitter(rng, e.wob));
    rad *= 1 + (i % 2 === 0 ? e.amp : -e.amp);
    if (pattern === "spreading") {
      rad *= (1 + 0.2 * Math.cos(2 * (a - axis))) / 1.2;
    } else if (pattern === "vase") {
      rad *= (1 + 0.08 * Math.cos(2 * (a - axis))) / 1.08;
    } else if (pattern === "clumping") {
      rad *= 1 + 0.08 * Math.sin(3 * a + ph1);
    }
    if (archetype === "groundcover" || archetype === "vine") {
      rad *= (1 + 0.14 * Math.sin(2 * a + ph1) + 0.1 * Math.sin(5 * a + ph2)) / 1.14;
    }
    pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad * squash });
  }
  return e.smooth ? smoothClosed(pts) : linearClosed(pts);
}

// ---------------------------------------------------------------------------
// Branch strokes
// ---------------------------------------------------------------------------

function branchesPath(
  rng: Rng,
  reach: number,
  pattern: BranchingPattern,
  density: number,
  axis: number,
): string {
  let d = "";
  switch (pattern) {
    case "upright": {
      const n = 5 + Math.round(density * 5);
      const off = range(rng, 0, TAU);
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * TAU + jitter(rng, 0.25);
        d += radialStroke(a, reach * 0.05, reach * range(rng, 0.34, 0.52), jitter(rng, 0.15));
      }
      break;
    }
    case "vase": {
      const n = 4 + Math.round(density * 4);
      const off = range(rng, 0, TAU);
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * TAU + jitter(rng, 0.2);
        d += radialStroke(a, reach * 0.06, reach * range(rng, 0.72, 0.9), jitter(rng, 0.18));
      }
      break;
    }
    case "umbrella": {
      const n = 5 + Math.round(density * 4);
      const swirl = rng() < 0.5 ? 1 : -1;
      const off = range(rng, 0, TAU);
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * TAU + jitter(rng, 0.15);
        d += radialStroke(a, reach * 0.04, reach * range(rng, 0.88, 0.98), swirl * range(rng, 0.22, 0.34));
      }
      break;
    }
    case "weeping": {
      // trailing stems that all swirl the same way, tips curling gently
      const n = 6 + Math.round(density * 5);
      const swirl = rng() < 0.5 ? 1 : -1;
      const off = range(rng, 0, TAU);
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * TAU + jitter(rng, 0.25);
        const curl = range(rng, 0.35, 0.55) * swirl;
        const len = range(rng, 0.72, 0.96);
        const c1 = polar(a, reach * 0.45 * len);
        const c2 = polar(a + curl * 0.5, reach * 0.98 * len);
        const end = polar(a + curl, reach * 0.85 * len);
        const s = polar(a, reach * 0.05);
        d += `M${N(s.x)} ${N(s.y)}C${N(c1.x)} ${N(c1.y)} ${N(c2.x)} ${N(
          c2.y,
        )} ${N(end.x)} ${N(end.y)}`;
      }
      break;
    }
    case "spreading": {
      const n = 4 + Math.round(density * 3);
      const perSide = Math.ceil(n / 2);
      for (let k = 0; k < n; k++) {
        // fan strokes around both directions of the elongation axis
        const side = k % 2 === 0 ? 0 : Math.PI;
        const i = Math.floor(k / 2);
        const fan = perSide > 1 ? (i / (perSide - 1) - 0.5) * 1.6 : 0;
        const a = axis + side + fan + jitter(rng, 0.2);
        const r1 = reach * range(rng, 0.72, 0.94);
        d += radialStroke(a, reach * 0.05, r1, jitter(rng, 0.2));
        // short fork near the tip
        const fa = a + (rng() < 0.5 ? 1 : -1) * range(rng, 0.3, 0.5);
        const base = polar(a, r1 * 0.6);
        const tip = {
          x: base.x + Math.cos(fa) * reach * 0.25,
          y: base.y + Math.sin(fa) * reach * 0.25,
        };
        d += `M${N(base.x)} ${N(base.y)}L${N(tip.x)} ${N(tip.y)}`;
      }
      break;
    }
    case "clumping": {
      const n = 8 + Math.round(density * 10);
      const off = range(rng, 0, TAU);
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * TAU + jitter(rng, 0.3);
        d += radialStroke(a, reach * 0.03, reach * range(rng, 0.5, 0.95), jitter(rng, 0.35));
      }
      break;
    }
    case "rosette":
      // rendered as filled leaves elsewhere
      break;
  }
  return d;
}

/** Rosette pattern: concentric rings of pointed leaves instead of a blob. */
function rosettePath(rng: Rng, r: number, density: number, volume: number): string {
  let d = "";
  const halfAngle = 0.2 + 0.16 * clamp01(volume);
  const rings = [
    { n: 7 + Math.round(density * 4), len: r },
    { n: 5 + Math.round(density * 2), len: r * 0.55 },
  ];
  for (const ring of rings) {
    const off = range(rng, 0, TAU);
    for (let k = 0; k < ring.n; k++) {
      const a = off + (k / ring.n) * TAU + jitter(rng, 0.08);
      const len = ring.len * range(rng, 0.85, 1);
      d += pointedLeaf(0, 0, a, len, halfAngle);
    }
  }
  return d;
}

/**
 * Top-down ornamental grass tuft: soft under-disk + filled radiating blades.
 * Avoids the old "spiky blob canopy" look that read poorly at plan scale.
 */
function grassTuft(
  rng: Rng,
  r: number,
  volume: number,
  density: number,
): { base: string; blades: string; stems: string } {
  const vol = clamp01(volume);
  const n = 12 + Math.round(density * 16) + Math.round(vol * 6);
  const off = range(rng, 0, TAU);
  let blades = "";
  let stems = "";
  for (let k = 0; k < n; k++) {
    const a = off + (k / n) * TAU + jitter(rng, 0.22);
    const len = r * (0.42 + 0.58 * vol) * range(rng, 0.55, 1);
    const half = range(rng, 0.07, 0.13);
    // Slight lateral bend so blades don't look like a rigid star.
    const bend = jitter(rng, 0.14);
    const tip = polar(a + bend, len);
    const midL = polar(a + bend * 0.4 + half, len * 0.52);
    const midR = polar(a + bend * 0.4 - half, len * 0.52);
    const baseL = polar(a + half * 0.35, len * 0.06);
    const baseR = polar(a - half * 0.35, len * 0.06);
    blades += `M${N(baseL.x)} ${N(baseL.y)}Q${N(midL.x)} ${N(midL.y)} ${N(
      tip.x,
    )} ${N(tip.y)}Q${N(midR.x)} ${N(midR.y)} ${N(baseR.x)} ${N(baseR.y)}Z`;
    if (vol < 0.08) {
      // Winter / cut-back: thin standing stems instead of leafy blades.
      stems += radialStroke(a, r * 0.02, len * range(rng, 0.55, 0.85), jitter(rng, 0.2));
    }
  }
  // Soft oval under-disk (soil shadow) — only when leafy.
  const br = r * (0.22 + 0.18 * vol);
  const base =
    vol > 0.08
      ? `M${N(-br * 1.15)} ${N(0)}a${N(br * 1.15)} ${N(br * 0.85)} 0 1 0 ${N(
          br * 2.3,
        )} 0a${N(br * 1.15)} ${N(br * 0.85)} 0 1 0 ${N(-br * 2.3)} 0`
      : "";
  return { base, blades, stems };
}

// ---------------------------------------------------------------------------
// Side-view (horizon) trees
// ---------------------------------------------------------------------------

interface SideTreeLayers {
  trunk: string;
  branches: string;
  canopy: string;
  highlight: string;
  /** Crown center Y and radii — used to scatter blooms. */
  canopyCy: number;
  canopyRx: number;
  canopyRy: number;
}

/**
 * Classic 2D landscape-tree silhouette: trunk rises from the bottom of the
 * icon box; canopy engulfs the upper trunk/branches so it never reads as a
 * "stick with a hat". `branching.pattern` changes fork geometry.
 *
 * Only `needle` foliage uses conical evergreen tiers — `spiky` is deciduous
 * (palmate / jagged crown), not a spruce hat.
 */
function sideViewTree(
  rng: Rng,
  R: number,
  shape: FoliageShape,
  pattern: BranchingPattern,
  density: number,
  volume: number,
): SideTreeLayers {
  const vol = clamp01(volume);
  const dens = clamp01(density);
  const groundY = R * 0.92;
  const evergreen = shape === "needle";
  const leafed = vol > 0.04;

  // Crown geometry — sized so foliage overlaps the upper trunk.
  let canopyCy = -R * 0.22;
  let canopyRx = R * (0.58 + 0.18 * vol);
  let canopyRy = R * (0.48 + 0.2 * vol);
  // Trunk tip ends inside the crown (not below it).
  let trunkTopY = canopyCy + canopyRy * 0.15;

  switch (pattern) {
    case "umbrella":
      // Broad dome (Japanese maple habit): wide, medium-tall crown.
      canopyCy = -R * 0.18;
      canopyRx = R * (0.78 + 0.1 * vol);
      canopyRy = R * (0.48 + 0.16 * vol);
      trunkTopY = canopyCy + canopyRy * 0.35;
      break;
    case "vase":
      canopyCy = -R * 0.32;
      canopyRx = R * (0.5 + 0.16 * vol);
      canopyRy = R * (0.52 + 0.16 * vol);
      trunkTopY = canopyCy + canopyRy * 0.25;
      break;
    case "weeping":
      canopyCy = -R * 0.12;
      canopyRx = R * (0.55 + 0.14 * vol);
      canopyRy = R * (0.58 + 0.18 * vol);
      trunkTopY = canopyCy + canopyRy * 0.1;
      break;
    case "spreading":
      canopyCy = -R * 0.1;
      canopyRx = R * (0.82 + 0.08 * vol);
      canopyRy = R * (0.4 + 0.14 * vol);
      trunkTopY = canopyCy + canopyRy * 0.3;
      break;
    case "clumping":
      canopyCy = -R * 0.2;
      canopyRx = R * (0.66 + 0.14 * vol);
      canopyRy = R * (0.46 + 0.16 * vol);
      trunkTopY = canopyCy + canopyRy * 0.2;
      break;
    case "upright":
    default:
      if (evergreen) {
        canopyCy = -R * 0.12;
        canopyRx = R * (0.42 + 0.12 * vol);
        canopyRy = R * (0.68 + 0.16 * vol);
        trunkTopY = canopyCy + canopyRy * 0.55;
      } else {
        canopyCy = -R * 0.28;
        canopyRx = R * (0.52 + 0.18 * vol);
        canopyRy = R * (0.5 + 0.18 * vol);
        trunkTopY = canopyCy + canopyRy * 0.2;
      }
      break;
  }

  // Foliage shape nudges the crown proportions.
  if (shape === "oval") {
    canopyRy *= 1.1;
    canopyRx *= 0.92;
  } else if (shape === "lobed" || shape === "spiky") {
    // Palmate / toothed deciduous crowns — a bit wider, gently scalloped later.
    canopyRx *= 1.06;
    canopyRy *= 1.04;
  } else if (shape === "heart") {
    canopyRy *= 1.05;
  } else if (shape === "feathery") {
    canopyRx *= 1.08;
  }

  let trunk = "";
  let branches = "";

  const trunkLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    bend = 0,
  ): string => {
    const mx = (x0 + x1) / 2 + bend;
    const my = (y0 + y1) / 2;
    return `M${N(x0)} ${N(y0)}Q${N(mx)} ${N(my)} ${N(x1)} ${N(y1)}`;
  };

  if (pattern === "clumping") {
    const stems = 2 + Math.round(dens * 2);
    for (let i = 0; i < stems; i++) {
      const t = stems === 1 ? 0 : i / (stems - 1) - 0.5;
      const baseX = t * R * 0.22 + jitter(rng, R * 0.03);
      const topX = t * R * 0.28 + jitter(rng, R * 0.04);
      const topY = trunkTopY + jitter(rng, R * 0.05);
      trunk += trunkLine(baseX, groundY, topX, topY, jitter(rng, R * 0.04));
    }
  } else if (pattern === "vase") {
    const forkY = groundY * 0.45 + trunkTopY * 0.55;
    trunk += trunkLine(0, groundY, 0, forkY, jitter(rng, R * 0.02));
    const spread = R * (0.16 + 0.1 * dens);
    trunk += trunkLine(0, forkY, -spread, trunkTopY, -R * 0.04);
    trunk += trunkLine(0, forkY, spread, trunkTopY, R * 0.04);
  } else {
    trunk += trunkLine(
      0,
      groundY,
      jitter(rng, R * 0.02),
      trunkTopY,
      jitter(rng, R * 0.03),
    );
  }

  // Branches: when leafy, keep them short and aimed into the crown so the
  // canopy covers their tips; when bare, let them read clearly.
  const branchCount = leafed
    ? 2 + Math.round(dens * 3)
    : 4 + Math.round(dens * 5);
  // Attach near the canopy underside — not mid-trunk below a floating hat.
  const attachLo = 0.55;
  const attachHi = 0.92;
  for (let k = 0; k < branchCount; k++) {
    const t =
      attachLo +
      (k / Math.max(1, branchCount - 1)) * (attachHi - attachLo);
    const by = groundY + (trunkTopY - groundY) * t;
    const side = k % 2 === 0 ? -1 : 1;

    // Target a point inside the canopy mass.
    let targetX =
      side * canopyRx * range(rng, leafed ? 0.35 : 0.55, leafed ? 0.75 : 0.95);
    let targetY =
      canopyCy +
      canopyRy *
        range(rng, leafed ? -0.15 : -0.35, leafed ? 0.45 : 0.55);

    if (pattern === "umbrella") {
      targetY = canopyCy + canopyRy * range(rng, 0.05, leafed ? 0.55 : 0.7);
      // Gentle upward-then-out arc into the dome.
    } else if (pattern === "weeping") {
      targetY = canopyCy + canopyRy * range(rng, 0.35, 0.95);
    } else if (pattern === "spreading") {
      targetY = canopyCy + canopyRy * range(rng, 0.1, 0.65);
    } else if (pattern === "vase") {
      targetY = canopyCy + canopyRy * range(rng, -0.2, 0.4);
    } else if (evergreen) {
      targetX =
        side * canopyRx * range(rng, 0.4, 0.9) * (1.05 - t * 0.35);
      targetY = canopyCy + canopyRy * range(rng, -0.3, 0.5);
    }

    if (pattern === "weeping") {
      const midX = targetX * 0.55;
      const midY = by + (targetY - by) * 0.3 - R * 0.06;
      const endY = targetY + (leafed ? R * 0.02 : R * range(rng, 0.08, 0.2));
      branches += `M${N(0)} ${N(by)}Q${N(midX)} ${N(midY)} ${N(targetX)} ${N(
        endY,
      )}`;
      if (!leafed && rng() > 0.35) {
        const tipY = endY + R * range(rng, 0.08, 0.16);
        branches += `M${N(targetX)} ${N(endY)}Q${N(
          targetX + side * R * 0.05,
        )} ${N((endY + tipY) / 2)} ${N(targetX + side * R * 0.02)} ${N(tipY)}`;
      }
    } else {
      const midX = targetX * 0.45 + side * R * 0.03;
      const midY = by + (targetY - by) * 0.4 - R * (pattern === "umbrella" ? 0.08 : 0.02);
      branches += `M${N(jitter(rng, R * 0.015))} ${N(by)}Q${N(midX)} ${N(
        midY,
      )} ${N(targetX)} ${N(targetY)}`;
      if (!leafed && dens > 0.35 && rng() > 0.4) {
        const fx = targetX + side * R * range(rng, 0.08, 0.18);
        const fy = targetY + R * range(rng, -0.06, 0.1);
        branches += `M${N(targetX * 0.75)} ${N(
          by + (targetY - by) * 0.7,
        )}L${N(fx)} ${N(fy)}`;
      }
    }
  }

  // Canopy silhouette (filled when leafy) — drawn after branches so tips tuck in.
  let canopy = "";
  let highlight = "";
  if (leafed) {
    if (evergreen) {
      // Layered triangular / conical tiers (true conifers only).
      const tiers = 3 + Math.round(dens * 2);
      for (let i = 0; i < tiers; i++) {
        const u = i / tiers;
        const top = canopyCy - canopyRy * (0.95 - u * 0.12);
        const bot = canopyCy + canopyRy * (-0.05 + u * 0.9);
        const half =
          canopyRx *
          (0.35 + 0.65 * ((i + 1) / tiers)) *
          range(rng, 0.92, 1.05);
        const lean = jitter(rng, R * 0.03);
        canopy += `M${N(lean)} ${N(top)}L${N(lean + half)} ${N(bot)}L${N(
          lean - half,
        )} ${N(bot)}Z`;
      }
    } else {
      // Soft cloud / dome of overlapping lobes — never a single hard triangle.
      const lobes =
        shape === "lobed" || shape === "spiky" || shape === "feathery"
          ? 7 + Math.round(dens * 3)
          : shape === "heart"
            ? 6
            : 6 + Math.round(dens * 2);
      const pts: Pt[] = [];
      for (let i = 0; i < lobes; i++) {
        const a = -Math.PI / 2 + (i / lobes) * TAU;
        // Flatten underside slightly so the crown cradles the trunk.
        const underside = Math.sin(a) > 0.35;
        let rx = canopyRx * (underside ? 0.88 : 1) * (1 + jitter(rng, 0.07));
        let ry = canopyRy * (underside ? 0.9 : 1) * (1 + jitter(rng, 0.07));
        if (shape === "lobed" || shape === "spiky") {
          rx *= 1 + (i % 2 === 0 ? 0.14 : -0.07);
          ry *= 1 + (i % 2 === 0 ? 0.1 : -0.05);
        }
        if (pattern === "umbrella") {
          // Domed top, fuller sides — classic maple / umbrella silhouette.
          ry *= 1 + 0.12 * Math.cos(a);
          if (underside) ry *= 1.05;
        }
        if (pattern === "weeping" && underside) {
          ry *= 1.2;
        }
        if (shape === "heart" && a > -2.2 && a < -0.9) {
          ry *= 0.85;
          rx *= 1.05;
        }
        pts.push({
          x: Math.cos(a) * rx,
          y: canopyCy + Math.sin(a) * ry,
        });
      }
      canopy = smoothClosed(pts);

      if (vol > 0.4) {
        const hPts = pts.map((p) => ({
          x: p.x * 0.55 + jitter(rng, R * 0.02),
          y: canopyCy + (p.y - canopyCy) * 0.45 - R * 0.05,
        }));
        highlight = smoothClosed(hPts);
      }
    }
  }

  return {
    trunk,
    branches,
    canopy,
    highlight,
    canopyCy,
    canopyRx,
    canopyRy,
  };
}

/** Dense mat texture for groundcovers: many tiny leaflets over a soft canopy. */
function groundcoverLeaflets(
  rng: Rng,
  canR: number,
  shape: FoliageShape,
  density: number,
): string {
  const n = 14 + Math.round(density * 18);
  let d = "";
  for (let k = 0; k < n; k++) {
    const p = polar(range(rng, 0, TAU), canR * Math.sqrt(rng()) * 0.92);
    const a = range(rng, 0, TAU);
    const len = canR * range(rng, 0.1, 0.22);
    if (shape === "needle" || shape === "blade") {
      d += pointedLeaf(p.x, p.y, a, len, 0.18);
    } else {
      const rx = len * range(rng, 0.35, 0.55);
      const ry = len * range(rng, 0.22, 0.38);
      d += `M${N(p.x - rx)} ${N(p.y)}a${N(rx)} ${N(ry)} 0 1 0 ${N(
        2 * rx,
      )} 0a${N(rx)} ${N(ry)} 0 1 0 ${N(-2 * rx)} 0`;
    }
  }
  return d;
}

// ---------------------------------------------------------------------------
// Foliage texture hints (interior detail)
// ---------------------------------------------------------------------------

function texturePath(rng: Rng, canR: number, shape: FoliageShape): string {
  let d = "";
  switch (shape) {
    case "round":
    case "oval":
    case "heart":
    case "lobed": {
      // short "cloud shading" smile arcs
      for (let k = 0; k < 3; k++) {
        const p = polar(range(rng, 0, TAU), canR * range(rng, 0.15, 0.55));
        const a = range(rng, 0, TAU);
        const len = canR * 0.28;
        const e = { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len };
        const mid = {
          x: (p.x + e.x) / 2 - Math.sin(a) * len * 0.28,
          y: (p.y + e.y) / 2 + Math.cos(a) * len * 0.28,
        };
        d += `M${N(p.x)} ${N(p.y)}Q${N(mid.x)} ${N(mid.y)} ${N(e.x)} ${N(e.y)}`;
      }
      break;
    }
    case "feathery": {
      // gentle frond curves from center outward
      const off = range(rng, 0, TAU);
      for (let k = 0; k < 4; k++) {
        const a = off + (k / 4) * TAU + jitter(rng, 0.3);
        d += radialStroke(a, canR * 0.12, canR * 0.75, jitter(rng, 0.3));
      }
      break;
    }
    case "needle": {
      // short tick marks toward the edge (kept inside lumpy silhouettes)
      for (let k = 0; k < 8; k++) {
        const a = range(rng, 0, TAU);
        d += radialStroke(a, canR * 0.5, canR * 0.74, 0);
      }
      break;
    }
    case "spiky":
    case "blade":
      break; // the jagged edge / blades carry the texture already
  }
  return d;
}

// ---------------------------------------------------------------------------
// Blooms
// ---------------------------------------------------------------------------

const BLOOM_MAX: Record<Archetype, number> = {
  tree: 11,
  shrub: 9,
  grass: 7,
  flower: 8,
  succulent: 5,
  groundcover: 11,
  vine: 8,
};

interface BloomLayers {
  fill: string;
  centers: string;
  centerColor: string;
  stroke: string;
}

function buildBlooms(
  rng: Rng,
  shape: BloomShape,
  count: number,
  plotR: number,
  canR: number,
  bs: number,
  color: string,
): BloomLayers {
  const layers: BloomLayers = { fill: "", centers: "", centerColor: "", stroke: "" };
  const scatter = (): Pt => polar(range(rng, 0, TAU), plotR * Math.sqrt(rng()));
  switch (shape) {
    case "dot": {
      for (let k = 0; k < count; k++) {
        const p = scatter();
        layers.fill += circleSub(p.x, p.y, bs * range(rng, 0.4, 0.55));
      }
      break;
    }
    case "cluster": {
      for (let k = 0; k < count; k++) {
        const p = scatter();
        const off = range(rng, 0, TAU);
        for (let j = 0; j < 3; j++) {
          const q = polar(off + (j / 3) * TAU, bs * 0.42);
          layers.fill += circleSub(p.x + q.x, p.y + q.y, bs * range(rng, 0.36, 0.46));
        }
      }
      break;
    }
    case "daisy": {
      // dark cone center (rudbeckia/echinacea); reads as a ring for pale petals
      layers.centerColor = shade(color, 0.45);
      for (let k = 0; k < count; k++) {
        const p = scatter();
        const off = range(rng, 0, TAU);
        for (let j = 0; j < 5; j++) {
          layers.fill += pointedLeaf(p.x, p.y, off + (j / 5) * TAU, bs, 0.5);
        }
        layers.centers += circleSub(p.x, p.y, bs * 0.34);
      }
      break;
    }
    case "star": {
      for (let k = 0; k < count; k++) {
        const p = scatter();
        const off = range(rng, 0, TAU);
        const pts: Pt[] = [];
        for (let j = 0; j < 10; j++) {
          const rr = j % 2 === 0 ? bs : bs * 0.45;
          const q = polar(off + (j / 10) * TAU, rr);
          pts.push({ x: p.x + q.x, y: p.y + q.y });
        }
        layers.fill += linearClosed(pts);
      }
      break;
    }
    case "bell": {
      for (let k = 0; k < count; k++) {
        const p = scatter();
        const w = bs * 0.55;
        const h = bs * 0.95;
        layers.fill += `M${N(p.x - w)} ${N(p.y + h * 0.5)}Q${N(p.x - w)} ${N(
          p.y - h * 0.6,
        )} ${N(p.x)} ${N(p.y - h * 0.6)}Q${N(p.x + w)} ${N(p.y - h * 0.6)} ${N(
          p.x + w,
        )} ${N(p.y + h * 0.5)}Q${N(p.x)} ${N(p.y + h * 0.2)} ${N(p.x - w)} ${N(
          p.y + h * 0.5,
        )}Z`;
      }
      break;
    }
    case "trumpet": {
      layers.centerColor = shade(color, 0.62);
      for (let k = 0; k < count; k++) {
        const p = scatter();
        const off = range(rng, 0, TAU);
        const pts: Pt[] = [];
        for (let j = 0; j < 10; j++) {
          const rr = j % 2 === 0 ? bs : bs * 0.62;
          const q = polar(off + (j / 10) * TAU, rr);
          pts.push({ x: p.x + q.x, y: p.y + q.y });
        }
        layers.fill += smoothClosed(pts);
        layers.centers += circleSub(p.x, p.y, bs * 0.28);
      }
      break;
    }
    case "spike": {
      // slim tapered spikes peeking out past the canopy edge
      const off = range(rng, 0, TAU);
      for (let k = 0; k < count; k++) {
        const a = off + (k / count) * TAU + jitter(rng, 0.2);
        const base = polar(a, canR * 0.52);
        const tip = polar(a + jitter(rng, 0.06), canR * range(rng, 0.94, 1.06));
        const px = -Math.sin(a) * bs * 0.22;
        const py = Math.cos(a) * bs * 0.22;
        layers.fill += `M${N(base.x + px)} ${N(base.y + py)}L${N(tip.x)} ${N(
          tip.y,
        )}L${N(base.x - px)} ${N(base.y - py)}Z`;
      }
      break;
    }
    case "plume": {
      // fluffy stroked arcs curving out past the tuft
      const off = range(rng, 0, TAU);
      for (let k = 0; k < count; k++) {
        const a = off + (k / count) * TAU + jitter(rng, 0.25);
        const dir = k % 2 === 0 ? 1 : -1;
        const s = polar(a, canR * 0.35);
        const c = polar(a + dir * 0.18, canR * 0.8);
        const e = polar(a + dir * 0.32, canR * range(rng, 0.95, 1.05));
        layers.stroke += `M${N(s.x)} ${N(s.y)}Q${N(c.x)} ${N(c.y)} ${N(
          e.x,
        )} ${N(e.y)}`;
        // little side wisps near the tip
        for (let j = 0; j < 2; j++) {
          const t = polar(a + dir * (0.2 + j * 0.1), canR * (0.85 + j * 0.08));
          const w = polar(a + dir * (0.2 + j * 0.1) + 0.5, canR * 0.12);
          layers.stroke += `M${N(t.x)} ${N(t.y)}l${N(w.x)} ${N(w.y)}`;
        }
      }
      break;
    }
  }
  return layers;
}

// ---------------------------------------------------------------------------
// The renderer
// ---------------------------------------------------------------------------

export function PlantIcon({ archetype, params, seed, size }: PlantIconProps) {
  const rng = mulberry32(seed);
  const R = (size / 2) * 0.94;
  const { foliage, bloom, branching } = params;
  const volume = clamp01(foliage.volume);
  const leafed = volume > 0.04;
  const canR = R * (0.42 + 0.58 * volume);
  // groundcover runners stay tucked under the lumpy mat edge
  const reachScale = archetype === "groundcover" && leafed ? 0.72 : 1;
  const reach = (leafed ? canR : R * 0.85) * reachScale;
  const axis = range(rng, 0, Math.PI); // shared elongation axis
  const isRosette = branching.pattern === "rosette";

  const foliageEdge = shade(foliage.color, 0.68);
  const nodes: ReactNode[] = [];

  if (archetype === "tree") {
    const tree = sideViewTree(
      rng,
      R,
      foliage.shape,
      branching.pattern,
      branching.density,
      volume,
    );
    const trunkStroke = size * (branching.pattern === "clumping" ? 0.045 : 0.055);
    if (tree.trunk) {
      nodes.push(
        <path
          key="trunk"
          d={tree.trunk}
          fill="none"
          stroke={branching.color}
          strokeWidth={trunkStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      );
    }
    if (tree.branches) {
      nodes.push(
        <path
          key="branches"
          d={tree.branches}
          fill="none"
          stroke={branching.color}
          strokeWidth={size * 0.028}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={leafed ? 0.75 : 1}
        />,
      );
    }
    if (leafed && tree.canopy) {
      nodes.push(
        <path
          key="canopy"
          d={tree.canopy}
          fill={foliage.color}
          stroke={foliageEdge}
          strokeWidth={size * 0.02}
          strokeLinejoin="round"
        />,
      );
      if (tree.highlight) {
        nodes.push(
          <path
            key="highlight"
            d={tree.highlight}
            fill={shade(foliage.color, 1.25)}
            opacity={0.45}
          />,
        );
      }
    }

    // Blooms clustered in the crown (side-view scatter).
    const density = clamp01(bloom.density);
    const count =
      density <= 0.02 ? 0 : Math.max(1, Math.round(density * BLOOM_MAX.tree));
    if (count > 0) {
      const plotR = leafed
        ? Math.min(tree.canopyRx, tree.canopyRy) * 0.75
        : R * 0.35;
      const bs = size * 0.055;
      // Offset bloom scatter into the canopy center via a translated group.
      const layers = buildBlooms(
        rng,
        bloom.shape,
        count,
        plotR,
        leafed ? Math.min(tree.canopyRx, tree.canopyRy) : R * 0.4,
        bs,
        bloom.color,
      );
      const bloomNodes: ReactNode[] = [];
      if (layers.fill) {
        bloomNodes.push(
          <path
            key="blooms"
            d={layers.fill}
            fill={bloom.color}
            stroke={shade(bloom.color, 0.7)}
            strokeWidth={size * 0.006}
            strokeLinejoin="round"
          />,
        );
      }
      if (layers.centers) {
        bloomNodes.push(
          <path key="bloom-centers" d={layers.centers} fill={layers.centerColor} />,
        );
      }
      if (layers.stroke) {
        bloomNodes.push(
          <path
            key="bloom-strokes"
            d={layers.stroke}
            fill="none"
            stroke={bloom.color}
            strokeWidth={size * 0.02}
            strokeLinecap="round"
          />,
        );
      }
      if (bloomNodes.length > 0) {
        nodes.push(
          <g
            key="bloom-group"
            transform={`translate(0 ${N(tree.canopyCy)})`}
          >
            {bloomNodes}
          </g>,
        );
      }
    }

    return <g>{nodes}</g>;
  }

  if (archetype === "grass") {
    const tuft = grassTuft(rng, R, volume, branching.density);
    if (tuft.base) {
      nodes.push(
        <path
          key="grass-base"
          d={tuft.base}
          fill={shade(foliage.color, 0.75)}
          opacity={0.35}
        />,
      );
    }
    if (leafed && tuft.blades) {
      nodes.push(
        <path
          key="grass-blades"
          d={tuft.blades}
          fill={foliage.color}
          stroke={foliageEdge}
          strokeWidth={size * 0.008}
          strokeLinejoin="round"
        />,
      );
    } else if (tuft.stems) {
      nodes.push(
        <path
          key="grass-stems"
          d={tuft.stems}
          fill="none"
          stroke={branching.color}
          strokeWidth={size * 0.018}
          strokeLinecap="round"
          opacity={0.85}
        />,
      );
    }
  } else if (isRosette) {
    const d = rosettePath(rng, R * (0.5 + 0.5 * volume), branching.density, volume);
    nodes.push(
      <path
        key="rosette"
        d={d}
        fill={foliage.color}
        stroke={foliageEdge}
        strokeWidth={size * 0.014}
        strokeLinejoin="round"
      />,
      <circle key="core" r={size * 0.045} fill={foliageEdge} />,
    );
  } else {
    if (leafed) {
      nodes.push(
        <path
          key="canopy"
          d={canopyPath(rng, canR, foliage.shape, branching.pattern, archetype, axis)}
          fill={foliage.color}
          stroke={foliageEdge}
          strokeWidth={size * 0.02}
          strokeLinejoin="round"
        />,
      );
      if (volume > 0.5 && EDGE[foliage.shape].smooth) {
        // soft inner highlight for depth
        const off = polar(range(rng, 0, TAU), canR * 0.16);
        const inner = canopyPath(
          rng,
          canR * 0.55,
          foliage.shape,
          branching.pattern,
          archetype,
          axis,
        );
        nodes.push(
          <path
            key="highlight"
            d={inner}
            transform={`translate(${N(off.x)} ${N(off.y)})`}
            fill={shade(foliage.color, 1.25)}
            opacity={0.5}
          />,
        );
      }
      if (archetype === "groundcover") {
        const leaflets = groundcoverLeaflets(
          rng,
          canR,
          foliage.shape,
          branching.density,
        );
        if (leaflets) {
          nodes.push(
            <path
              key="gc-leaflets"
              d={leaflets}
              fill={shade(foliage.color, 1.12)}
              stroke={foliageEdge}
              strokeWidth={size * 0.006}
              opacity={0.85}
            />,
          );
        }
      }
    }
    const branches = branchesPath(rng, reach, branching.pattern, branching.density, axis);
    if (branches) {
      nodes.push(
        <path
          key="branches"
          d={branches}
          fill="none"
          stroke={branching.color}
          strokeWidth={size * (branching.pattern === "clumping" ? 0.022 : 0.028)}
          strokeLinecap="round"
          opacity={leafed ? (archetype === "groundcover" ? 0.45 : 0.8) : 1}
        />,
      );
    }
    if (leafed && volume > 0.35 && archetype !== "groundcover") {
      const tex = texturePath(rng, canR, foliage.shape);
      if (tex) {
        nodes.push(
          <path
            key="texture"
            d={tex}
            fill="none"
            stroke={foliageEdge}
            strokeWidth={size * 0.013}
            strokeLinecap="round"
            opacity={0.55}
          />,
        );
      }
    }
  }

  // Blooms (drawn even on bare branches — e.g. redbud in early spring)
  const density = clamp01(bloom.density);
  const count = density <= 0.02 ? 0 : Math.max(1, Math.round(density * BLOOM_MAX[archetype]));
  if (count > 0) {
    const plotR = (leafed ? canR : R * 0.6) * 0.78;
    const bs = size * (archetype === "flower" ? 0.085 : 0.07);
    const layers = buildBlooms(rng, bloom.shape, count, plotR, leafed ? canR : R * 0.7, bs, bloom.color);
    if (layers.fill) {
      nodes.push(
        <path
          key="blooms"
          d={layers.fill}
          fill={bloom.color}
          stroke={shade(bloom.color, 0.7)}
          strokeWidth={size * 0.006}
          strokeLinejoin="round"
        />,
      );
    }
    if (layers.centers) {
      nodes.push(
        <path key="bloom-centers" d={layers.centers} fill={layers.centerColor} />,
      );
    }
    if (layers.stroke) {
      nodes.push(
        <path
          key="bloom-strokes"
          d={layers.stroke}
          fill="none"
          stroke={bloom.color}
          strokeWidth={size * 0.02}
          strokeLinecap="round"
        />,
      );
    }
  }

  return <g>{nodes}</g>;
}
