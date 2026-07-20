/**
 * Minimal sun / moon theme control for the chrome corner.
 */
import { useThemeStore } from "./theme";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...STROKE}>
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.6 4.6l1.3 1.3M14.1 14.1l1.3 1.3M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...STROKE}>
      <path d="M12.5 3.2A6.8 6.8 0 1016.8 12 5.2 5.2 0 0112.5 3.2z" />
    </svg>
  );
}

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isDark = theme === "dark";

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-gk-line bg-gk-panel p-0.5 shadow-md"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        title="Light mode"
        aria-pressed={!isDark}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          !isDark
            ? "bg-gk-accent-soft text-gk-accent"
            : "text-gk-muted hover:bg-gk-hover hover:text-gk-ink"
        }`}
        onClick={() => setTheme("light")}
      >
        <SunIcon />
      </button>
      <button
        type="button"
        title="Dark mode"
        aria-pressed={isDark}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          isDark
            ? "bg-gk-accent-soft text-gk-accent"
            : "text-gk-muted hover:bg-gk-hover hover:text-gk-ink"
        }`}
        onClick={() => setTheme("dark")}
      >
        <MoonIcon />
      </button>
    </div>
  );
}
