/**
 * GardenDocument schema — the single source of truth for what a saved garden is.
 *
 * FROZEN CONTRACT (Wave 1): the editor (src/editor), plant system (src/plants),
 * catalog UI (src/ui) and photo pipeline (src/photo) all code against these
 * types. Additive changes only; coordinate before changing existing fields.
 *
 * Documents are portable, self-contained JSON files (like .excalidraw files):
 * the species catalog used by a garden is embedded in the document itself.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export const SEASON_PHASES = [
  "early-spring",
  "mid-spring",
  "late-spring",
  "early-summer",
  "mid-summer",
  "late-summer",
  "early-fall",
  "mid-fall",
  "late-fall",
  "winter",
] as const;

export const SeasonPhase = z.enum(SEASON_PHASES);
export type SeasonPhase = z.infer<typeof SeasonPhase>;

// ---------------------------------------------------------------------------
// Plant visual model
//
// One uniform parameter set across ALL archetypes. A succulent is low
// branching density + rosette pattern; an oak vs. a japanese maple differ in
// branching pattern and foliage shape. One renderer, many looks.
// ---------------------------------------------------------------------------

export const FoliageShape = z.enum([
  "round",
  "oval",
  "lobed",
  "spiky",
  "feathery",
  "needle",
  "blade",
  "heart",
]);
export type FoliageShape = z.infer<typeof FoliageShape>;

export const BloomShape = z.enum([
  "dot",
  "daisy",
  "star",
  "bell",
  "spike",
  "cluster",
  "trumpet",
  "plume",
]);
export type BloomShape = z.infer<typeof BloomShape>;

export const BranchingPattern = z.enum([
  "upright",
  "vase",
  "umbrella",
  "weeping",
  "spreading",
  "clumping",
  "rosette",
]);
export type BranchingPattern = z.infer<typeof BranchingPattern>;

/** All colors are CSS color strings (hex preferred for portability). */
export const VisualParams = z.object({
  foliage: z.object({
    shape: FoliageShape,
    color: z.string(),
    /** 0 = bare (no leaves), 1 = fully leafed out. */
    volume: z.number().min(0).max(1),
  }),
  bloom: z.object({
    shape: BloomShape,
    color: z.string(),
    /** 0 = not blooming, 1 = peak bloom. */
    density: z.number().min(0).max(1),
  }),
  branching: z.object({
    pattern: BranchingPattern,
    /** 0 = single stem, 1 = densely branched. */
    density: z.number().min(0).max(1),
    color: z.string(),
  }),
});
export type VisualParams = z.infer<typeof VisualParams>;

export const Archetype = z.enum([
  "tree",
  "shrub",
  "grass",
  "flower",
  "succulent",
  "groundcover",
  "vine",
]);
export type Archetype = z.infer<typeof Archetype>;

export const PlantSpecies = z.object({
  id: z.string(),
  commonName: z.string(),
  botanicalName: z.string().optional(),
  archetype: Archetype,
  /** Free-form filter tags, e.g. "red", "ornamental", "native", "evergreen". */
  tags: z.array(z.string()).default([]),
  /**
   * The phase shown in default "display" mode — the plant's best look,
   * usually its bloom period.
   */
  displayPhase: SeasonPhase,
  /**
   * Sparse map of season phase -> visual form. At least one entry required.
   * Renderers resolve a missing phase to the nearest defined phase
   * (see resolveSeasonalForm in src/plants/forms.ts).
   */
  forms: z.partialRecord(SeasonPhase, VisualParams),
});
export type PlantSpecies = z.infer<typeof PlantSpecies>;

// ---------------------------------------------------------------------------
// Canvas elements
//
// Excalidraw-style model: every element has an axis-aligned box (x, y, width,
// height in canvas units) plus rotation angle (radians, around box center).
// `seed` drives deterministic hand-drawn wobble.
// ---------------------------------------------------------------------------

export const Point = z.object({ x: z.number(), y: z.number() });
export type Point = z.infer<typeof Point>;

const elementBase = {
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  angle: z.number().default(0),
  seed: z.number().int(),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
  /** Shared id: select/move treats members as one unit (e.g. photo import). */
  groupId: z.string().optional(),
};

export const ShapeStyle = z.object({
  strokeColor: z.string().default("#1e1e1e"),
  fillColor: z.string().default("transparent"),
  strokeWidth: z.number().default(2),
});
export type ShapeStyle = z.infer<typeof ShapeStyle>;

/** Garden-specific meaning of a drawn shape (styling/filter hints, optional). */
export const ShapeRole = z.enum([
  "generic",
  "bed",
  "border",
  "path",
  "hardscape",
  "water",
]);
export type ShapeRole = z.infer<typeof ShapeRole>;

export const RectElement = z.object({
  ...elementBase,
  type: z.literal("rect"),
  style: ShapeStyle,
  role: ShapeRole.default("generic"),
});

export const EllipseElement = z.object({
  ...elementBase,
  type: z.literal("ellipse"),
  style: ShapeStyle,
  role: ShapeRole.default("generic"),
});

/** Closed polygon; points are normalized to the element box (0..1 range). */
export const PolygonElement = z.object({
  ...elementBase,
  type: z.literal("polygon"),
  points: z.array(Point),
  style: ShapeStyle,
  role: ShapeRole.default("generic"),
});

/** Open freehand stroke; points normalized to the element box (0..1 range). */
export const FreehandElement = z.object({
  ...elementBase,
  type: z.literal("freehand"),
  points: z.array(Point),
  style: ShapeStyle,
});

export const TextElement = z.object({
  ...elementBase,
  type: z.literal("text"),
  text: z.string(),
  fontSize: z.number().default(20),
  color: z.string().default("#1e1e1e"),
});

/**
 * Photo reference layer (photo pipeline). Rendered dimmed & behind vector
 * content while tracing; hidden or deleted when tracing is done.
 */
export const ImageElement = z.object({
  ...elementBase,
  type: z.literal("image"),
  /** Data URL (self-contained docs) or backend photo URL (/api/photos/...). */
  href: z.string(),
  /** Backend imageId when the photo was uploaded for segmentation. */
  imageId: z.string().optional(),
  visible: z.boolean().default(true),
  dimmed: z.boolean().default(true),
});

/** A placed plant. Its box is the plant's footprint; icon fills the box. */
export const PlantElement = z.object({
  ...elementBase,
  type: z.literal("plant"),
  speciesId: z.string(),
  showLabel: z.boolean().default(false),
  /** Per-instance nickname, e.g. "front-left hydrangea". */
  label: z.string().optional(),
  /** Free-form notes / description for this planting. */
  notes: z.string().optional(),
  /** Instance tags (separate from species catalog tags). */
  tags: z.array(z.string()).optional(),
  /** Date planted, ISO `YYYY-MM-DD`. */
  plantedAt: z.string().optional(),
});

export const Element = z.discriminatedUnion("type", [
  RectElement,
  EllipseElement,
  PolygonElement,
  FreehandElement,
  TextElement,
  ImageElement,
  PlantElement,
]);
export type Element = z.infer<typeof Element>;
export type PolygonElement = z.infer<typeof PolygonElement>;
export type ImageElement = z.infer<typeof ImageElement>;
export type PlantElement = z.infer<typeof PlantElement>;
export type ElementType = Element["type"];

// ---------------------------------------------------------------------------
// Views & document
// ---------------------------------------------------------------------------

export const ViewKind = z.enum(["topdown", "elevation"]);
export type ViewKind = z.infer<typeof ViewKind>;

export const MeasureUnit = z.enum(["ft", "m"]);
export type MeasureUnit = z.infer<typeof MeasureUnit>;

/**
 * Structural ground materials. Keep this small and stable — seasonal looks
 * (e.g. grass going brown in fall/winter) hang off these keys later, not
 * off ad-hoc shape roles.
 */
export const LandscapeMaterial = z.enum(["grass", "mulch", "hardscape"]);
export type LandscapeMaterial = z.infer<typeof LandscapeMaterial>;

/** One painted/extracted surface inside the site rectangle. Points are 0..1. */
export const LandscapeSurface = z.object({
  id: z.string(),
  material: LandscapeMaterial,
  points: z.array(Point),
});
export type LandscapeSurface = z.infer<typeof LandscapeSurface>;

/**
 * Locked background layer for a view: one clean site rectangle (the calibrated
 * "big square") filled with grass/mulch/hardscape surfaces. Plants and drawn
 * shapes sit above this; edit via the Import wizard, not the select tool.
 */
export const GroundLayer = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  surfaces: z.array(LandscapeSurface),
  /** Rectified (or original) photo for the "original overlay" toggle. */
  overlay: z
    .object({
      href: z.string(),
      imageId: z.string().optional(),
      visible: z.boolean().default(false),
      opacity: z.number().min(0).max(1).default(0.5),
    })
    .optional(),
});
export type GroundLayer = z.infer<typeof GroundLayer>;

export const GardenView = z.object({
  id: z.string(),
  name: z.string(),
  kind: ViewKind,
  elements: z.array(Element),
  /** Locked landscape background from the import wizard. */
  ground: GroundLayer.optional(),
  /** Real-world scale, set during photo calibration. Optional until calibrated. */
  scale: z
    .object({
      unitsPerCanvasUnit: z.number().positive(),
      unit: MeasureUnit,
    })
    .optional(),
});
export type GardenView = z.infer<typeof GardenView>;

export const SCHEMA_VERSION = 1;

export const GardenDocument = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  views: z.array(GardenView).min(1),
  activeViewId: z.string(),
  /** Embedded species catalog: id -> species. Documents are self-contained. */
  species: z.record(z.string(), PlantSpecies),
});
export type GardenDocument = z.infer<typeof GardenDocument>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function newId(): string {
  return crypto.randomUUID();
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function createEmptyDocument(name = "Untitled Garden"): GardenDocument {
  const now = new Date().toISOString();
  const topdownId = newId();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    views: [
      { id: topdownId, name: "Plan (top-down)", kind: "topdown", elements: [] },
      { id: newId(), name: "Elevation", kind: "elevation", elements: [] },
    ],
    activeViewId: topdownId,
    species: {},
  };
}
