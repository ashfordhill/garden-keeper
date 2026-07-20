import { describe, expect, it } from "vitest";
import {
  FIT_CANVAS,
  fitImageBox,
  photoToCanvas,
  canvasToPhoto,
  polygonFromPhotoRegion,
  plantBoxFromPhotoBbox,
  unitsPerCanvasFromRectify,
} from "./coords";

const photo = { width: 800, height: 600 };
const image = fitImageBox(photo, { x: 400, y: 300 });

describe("fitImageBox", () => {
  it("fits long edge to FIT_CANVAS", () => {
    expect(image.width).toBe(FIT_CANVAS);
    expect(image.height).toBeCloseTo(600);
    expect(image.x + image.width / 2).toBeCloseTo(400);
  });
});

describe("photoToCanvas / canvasToPhoto", () => {
  it("round-trips corners", () => {
    const corners: [number, number][] = [
      [0, 0],
      [800, 0],
      [800, 600],
      [0, 600],
    ];
    for (const [px, py] of corners) {
      const c = photoToCanvas(px, py, photo, image);
      const back = canvasToPhoto(c, photo, image);
      expect(back.x).toBeCloseTo(px);
      expect(back.y).toBeCloseTo(py);
    }
  });
});

describe("polygonFromPhotoRegion", () => {
  it("normalizes points into 0..1 of the bbox", () => {
    const { box, points } = polygonFromPhotoRegion(
      [
        [100, 100],
        [300, 100],
        [300, 250],
        [100, 250],
      ],
      photo,
      image,
    );
    expect(points.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(
      true,
    );
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });
});

describe("plantBoxFromPhotoBbox", () => {
  it("maps bbox to canvas footprint", () => {
    const box = plantBoxFromPhotoBbox(
      { x1: 100, y1: 100, x2: 200, y2: 200 },
      photo,
      image,
    );
    expect(box.width).toBeCloseTo(100);
    expect(box.height).toBeCloseTo(100);
  });
});

describe("unitsPerCanvasFromRectify", () => {
  it("gives positive real units per canvas unit", () => {
    const u = unitsPerCanvasFromRectify({ width: 400, height: 240 }, 40);
    expect(u).toBeGreaterThan(0);
    // 400px / 40 ppu = 10 real units across; canvas width = 800 → 10/800
    expect(u).toBeCloseTo(10 / 800);
  });
});
