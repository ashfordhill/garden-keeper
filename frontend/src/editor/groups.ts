/**
 * Selection expansion for elements that share an optional `groupId`.
 * Used so photo-import (and similar) stay one selectable/movable unit.
 */
import type { Element } from "../document/schema";

/** Expand ids so every member of each referenced group is included. */
export function expandIdsByGroup(
  elements: readonly Element[],
  ids: readonly string[],
): string[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const out = new Set<string>();
  for (const id of ids) {
    const el = byId.get(id);
    if (!el) continue;
    if (el.groupId) {
      for (const other of elements) {
        if (other.groupId === el.groupId) out.add(other.id);
      }
    } else {
      out.add(id);
    }
  }
  return [...out];
}
