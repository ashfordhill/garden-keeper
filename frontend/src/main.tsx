import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { loadAutosave, startAutosave } from "./document/persistence";
import { useEditorStore } from "./document/store";

const autosaved = loadAutosave();
if (autosaved) {
  useEditorStore.getState().loadDocument(autosaved);
}
startAutosave();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
