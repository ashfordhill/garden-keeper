/**
 * OWNED BY AGENT A (Wave 2). Placeholder toolbar with save/load; Agent A adds
 * tool buttons wired to single-key hotkeys (V select, H hand, R rect,
 * E ellipse, P polygon, D freehand, T text) and undo/redo.
 */
import { useEditorStore } from "../document/store";
import {
  downloadDocument,
  openDocumentFromFile,
} from "../document/persistence";

export function Toolbar() {
  const doc = useEditorStore((s) => s.document);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const newDocument = useEditorStore((s) => s.newDocument);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 shadow-md">
      <span className="text-sm font-semibold">Garden Keeper</span>
      <span className="text-neutral-300">|</span>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-neutral-100"
        onClick={newDocument}
      >
        New
      </button>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-neutral-100"
        onClick={() => openDocumentFromFile().then(loadDocument, console.error)}
      >
        Open
      </button>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-neutral-100"
        onClick={() => downloadDocument(doc)}
      >
        Save
      </button>
    </div>
  );
}
