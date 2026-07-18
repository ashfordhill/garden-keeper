/**
 * Dev-only visual inspection gallery: every catalog species at every defined
 * seasonal phase. Served standalone at /gallery.html — NOT wired into the app.
 */
import { useState } from "react";
import {
  SEASON_PHASES,
  type PlantSpecies,
  type SeasonPhase,
} from "../document/schema";
import { BUILTIN_SPECIES } from "./catalog";
import { PlantIcon } from "./PlantIcon";

const CELL = 132;

const styles = {
  page: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: "#f6f2e8",
    minHeight: "100vh",
    padding: "24px 32px",
    color: "#3a3730",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 16,
    marginBottom: 20,
  },
  speciesRow: {
    marginBottom: 28,
  },
  speciesName: {
    fontSize: 15,
    fontWeight: 600 as const,
    marginBottom: 2,
  },
  botanical: {
    fontSize: 12,
    fontStyle: "italic" as const,
    color: "#8a8577",
    fontWeight: 400 as const,
    marginLeft: 8,
  },
  tags: {
    fontSize: 11,
    color: "#a09a89",
    marginBottom: 8,
  },
  cells: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
  },
  cell: (highlight: boolean) => ({
    background: highlight ? "#fdf9ec" : "#fffdf7",
    border: highlight ? "2px solid #d9a441" : "1px solid #e4ddcc",
    borderRadius: 10,
    padding: "8px 8px 6px",
    textAlign: "center" as const,
    boxShadow: "0 1px 2px rgba(80,70,40,0.06)",
  }),
  phaseLabel: {
    fontSize: 10.5,
    color: "#8a8577",
    marginTop: 2,
  },
} as const;

function Cell({
  species,
  phase,
  seed,
  size,
}: {
  species: PlantSpecies;
  phase: SeasonPhase;
  seed: number;
  size: number;
}) {
  const params = species.forms[phase]!;
  const highlight = phase === species.displayPhase;
  return (
    <div style={styles.cell(highlight)}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        <svg
          width={size}
          height={size}
          viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        >
          <PlantIcon
            archetype={species.archetype}
            params={params}
            seed={seed}
            size={size}
          />
        </svg>
        {/* small copy: readability check at map scale */}
        <svg width={40} height={40} viewBox="-20 -20 40 40">
          <PlantIcon
            archetype={species.archetype}
            params={params}
            seed={seed}
            size={40}
          />
        </svg>
      </div>
      <div style={styles.phaseLabel}>
        {phase}
        {highlight ? " ★" : ""}
      </div>
    </div>
  );
}

export function PlantGallery() {
  const [seed, setSeed] = useState(7);
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={{ fontSize: 20, margin: 0 }}>
          Garden Keeper — Plant Gallery
        </h1>
        <span style={{ fontSize: 12, color: "#8a8577" }}>
          {BUILTIN_SPECIES.length} species · ★ = display phase · small copy =
          40px readability check
        </span>
        <button
          onClick={() => setSeed((s) => s + 1)}
          style={{
            marginLeft: "auto",
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid #cfc7b2",
            background: "#fffdf7",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Reroll wobble (seed {seed})
        </button>
      </div>
      {BUILTIN_SPECIES.map((species) => {
        const phases = SEASON_PHASES.filter((p) => species.forms[p]);
        return (
          <div key={species.id} style={styles.speciesRow}>
            <div style={styles.speciesName}>
              {species.commonName}
              <span style={styles.botanical}>{species.botanicalName}</span>
              <span style={styles.botanical}>({species.archetype})</span>
            </div>
            <div style={styles.tags}>{species.tags.join(" · ")}</div>
            <div style={styles.cells}>
              {phases.map((phase) => (
                <Cell
                  key={phase}
                  species={species}
                  phase={phase}
                  seed={seed}
                  size={CELL}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
