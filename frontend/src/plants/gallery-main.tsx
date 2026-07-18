/** Standalone entry for the dev plant gallery (served at /gallery.html). */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PlantGallery } from "./PlantGallery";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlantGallery />
  </StrictMode>,
);
