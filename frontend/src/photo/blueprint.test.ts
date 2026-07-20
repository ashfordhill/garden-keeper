import { describe, expect, it } from "vitest";
import {
  regionToSurface,
  surfaceToPolygonElement,
  surfacesToCanvasElements,
} from "./blueprint";
import type { LayoutRegion } from "./api";
import type { LandscapeSurface } from "../document/schema";
import { FIT_CANVAS } from "./coords";

describe("regionToSurface", () => {
  it("normalizes polygon into 0..1", () => {
    const region: LayoutRegion = {
      role: "grass",
      polygon: [
        [0, 0],
        [100, 0],
        [100, 50],
        [0, 50],
      ],
      bbox: { x1: 0, y1: 0, x2: 100, y2: 50 },
      areaPx: 5000,
      score: 0.8,
    };
    const s = regionToSurface(region, { width: 100, height: 50 });
    expect(s.material).toBe("grass");
    expect(s.points[2]).toEqual({ x: 1, y: 1 });
  });
});

describe("surfaceToPolygonElement", () => {
  it("maps grass → path with MATERIAL_STYLES colors", () => {
    const surface: LandscapeSurface = {
      id: "s1",
      material: "grass",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    };
    const photo = { width: 200, height: 100 };
    const siteBox = { x: 0, y: 0, width: FIT_CANVAS, height: FIT_CANVAS / 2 };
    const el = surfaceToPolygonElement(surface, photo, siteBox);
    expect(el.type).toBe("polygon");
    expect(el.role).toBe("path");
    expect(el.style.fillColor).toBe("#5a9e5ecc");
    expect(el.style.strokeColor).toBe("#2e6b34");
  });

  it("maps mulch → bed and hardscape → hardscape", () => {
    const photo = { width: 100, height: 100 };
    const siteBox = { x: 10, y: 10, width: 400, height: 400 };
    const mulch: LandscapeSurface = {
      id: "m",
      material: "mulch",
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.1 },
        { x: 0.5, y: 0.5 },
      ],
    };
    const hard: LandscapeSurface = {
      id: "h",
      material: "hardscape",
      points: [
        { x: 0.6, y: 0.6 },
        { x: 0.9, y: 0.6 },
        { x: 0.9, y: 0.9 },
      ],
    };
    expect(surfaceToPolygonElement(mulch, photo, siteBox).role).toBe("bed");
    expect(surfaceToPolygonElement(hard, photo, siteBox).role).toBe(
      "hardscape",
    );
  });
});

describe("surfacesToCanvasElements", () => {
  it("puts dimmed image first, then polygons", () => {
    const surfaces: LandscapeSurface[] = [
      {
        id: "g",
        material: "grass",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 },
        ],
      },
    ];
    const els = surfacesToCanvasElements({
      surfaces,
      photo: { width: 100, height: 80 },
      siteBox: { x: 0, y: 0, width: 500, height: 400 },
      overlayHref: "/api/photos/abc/image",
      overlayImageId: "abc",
    });
    expect(els[0]?.type).toBe("image");
    if (els[0]?.type === "image") {
      expect(els[0].dimmed).toBe(true);
      expect(els[0].imageId).toBe("abc");
    }
    expect(els[1]?.type).toBe("polygon");
  });

  it("assigns a shared groupId so import moves as one unit", () => {
    const surfaces: LandscapeSurface[] = [
      {
        id: "g",
        material: "grass",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 },
        ],
      },
      {
        id: "m",
        material: "mulch",
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.5, y: 0.8 },
        ],
      },
    ];
    const els = surfacesToCanvasElements({
      surfaces,
      photo: { width: 100, height: 80 },
      siteBox: { x: 0, y: 0, width: 500, height: 400 },
      overlayHref: "/api/photos/abc/image",
      overlayImageId: "abc",
    });
    const groupIds = els.map((el) => el.groupId);
    expect(groupIds.every((g) => typeof g === "string" && g.length > 0)).toBe(
      true,
    );
    expect(new Set(groupIds).size).toBe(1);
    // Material colors stay distinct (not flattened).
    const polys = els.filter((el) => el.type === "polygon");
    expect(polys.map((p) => p.style.fillColor)).toEqual([
      "#5a9e5ecc",
      "#6b4a35cc",
    ]);
  });
});
