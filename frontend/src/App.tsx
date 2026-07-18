/**
 * App shell. Layout slots only — each slot component is owned by one
 * workstream, so parallel agents never edit this file:
 *
 * - Toolbar, EditorCanvas: Agent A (editor core)
 * - Sidebar, SeasonBar:    Agent D (catalog + seasons)
 * - PhotoPanel:            Agent E (photo pipeline)
 */
import { EditorCanvas } from "./editor/EditorCanvas";
import { Toolbar } from "./ui/Toolbar";
import { Sidebar } from "./ui/Sidebar";
import { SeasonBar } from "./ui/SeasonBar";
import { PhotoPanel } from "./photo/PhotoPanel";

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-white text-neutral-900">
      <EditorCanvas />
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="pointer-events-auto flex justify-center p-3">
          <Toolbar />
        </div>
        <div className="flex min-h-0 flex-1 items-start justify-between px-3">
          <div className="pointer-events-auto max-h-full overflow-y-auto">
            <Sidebar />
          </div>
          <div className="pointer-events-auto max-h-full overflow-y-auto">
            <PhotoPanel />
          </div>
        </div>
        <div className="pointer-events-auto flex justify-center p-3">
          <SeasonBar />
        </div>
      </div>
    </div>
  );
}
