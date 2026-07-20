import { describe, expect, it } from "vitest";
import type { Element } from "../document/schema";
import { expandIdsByGroup } from "./groups";

function rect(
  id: string,
  groupId?: string,
): Element {
  return {
    id,
    type: "rect",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    angle: 0,
    seed: 1,
    opacity: 1,
    locked: false,
    groupId,
    style: {
      fillColor: "#000",
      strokeColor: "#000",
      strokeWidth: 1,
    },
    role: "generic",
  };
}

describe("expandIdsByGroup", () => {
  it("leaves ungrouped ids alone", () => {
    const els = [rect("a"), rect("b")];
    expect(expandIdsByGroup(els, ["a"])).toEqual(["a"]);
  });

  it("expands to all members of the same groupId", () => {
    const els = [rect("a", "g1"), rect("b", "g1"), rect("c", "g2")];
    expect(expandIdsByGroup(els, ["a"]).sort()).toEqual(["a", "b"]);
  });

  it("merges multiple groups and singles", () => {
    const els = [rect("a", "g1"), rect("b", "g1"), rect("c"), rect("d", "g2")];
    expect(expandIdsByGroup(els, ["b", "c"]).sort()).toEqual(["a", "b", "c"]);
  });
});
