import { EditorCanvas } from "./editor/EditorCanvas";
import { ImportWizard } from "./import/ImportWizard";
import { Toolbar } from "./ui/Toolbar";
import { Sidebar } from "./ui/Sidebar";
import { SelectionPanel } from "./ui/SelectionPanel";
import { ToolOptionsPanel } from "./ui/ToolOptionsPanel";
import { PlantToolPanel } from "./ui/PlantToolPanel";
import { ThemeToggle } from "./ui/ThemeToggle";
import { SeasonBar } from "./ui/SeasonBar";
import { useEditorStore } from "./document/store";
import { isLandscapeDrawTool } from "./landscape/drawTools";

function RightPanel() {
  const activeTool = useEditorStore((s) => s.activeTool);
  if (isLandscapeDrawTool(activeTool)) {
    return <ToolOptionsPanel />;
  }
  if (activeTool === "plant") {
    return <PlantToolPanel />;
  }
  return <SelectionPanel />;
}

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gk-canvas text-gk-ink">
      <EditorCanvas />
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="pointer-events-auto relative flex items-start justify-center p-3">
          <Toolbar />
          <div className="absolute right-3 top-3">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-start justify-between px-3">
          <div className="pointer-events-auto max-h-full overflow-y-auto">
            <Sidebar />
          </div>
          <div className="pointer-events-auto max-h-full overflow-y-auto">
            <RightPanel />
          </div>
        </div>
        <div className="pointer-events-auto flex justify-center p-3">
          <SeasonBar />
        </div>
      </div>
      <ImportWizard />
    </div>
  );
}
