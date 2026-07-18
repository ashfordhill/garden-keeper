/**
 * Save/load for .garden.json files plus localStorage autosave.
 */
import { GardenDocument } from "./schema";
import { useEditorStore } from "./store";

export const FILE_EXTENSION = ".garden.json";
const AUTOSAVE_KEY = "garden-keeper:autosave";
const AUTOSAVE_DEBOUNCE_MS = 800;

export function serializeDocument(doc: GardenDocument): string {
  return JSON.stringify(doc, null, 2);
}

/** Parses and validates document JSON. Throws on schema mismatch. */
export function parseDocument(json: string): GardenDocument {
  return GardenDocument.parse(JSON.parse(json));
}

export function downloadDocument(doc: GardenDocument): void {
  const blob = new Blob([serializeDocument(doc)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.name.replace(/[^\w\- ]+/g, "").trim() || "garden"}${FILE_EXTENSION}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function openDocumentFromFile(): Promise<GardenDocument> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error("No file selected"));
      try {
        resolve(parseDocument(await file.text()));
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

export function loadAutosave(): GardenDocument | null {
  const json = localStorage.getItem(AUTOSAVE_KEY);
  if (!json) return null;
  try {
    return parseDocument(json);
  } catch {
    // Stale or incompatible autosave; ignore rather than block startup.
    return null;
  }
}

/** Call once at app startup. Returns an unsubscribe function. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = useEditorStore.subscribe((state, prev) => {
    if (state.document === prev.document) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state.document));
    }, AUTOSAVE_DEBOUNCE_MS);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
