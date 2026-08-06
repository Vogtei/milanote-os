import type { NoteColor } from "@/canvas/types";

// The renderer draws to a bitmap, so it can't inherit CSS. Every colour it
// needs lives here as a resolved value for both themes, and the React shell
// hands it whichever palette is active.

export type ThemeName = "dark" | "light";

export type CanvasPalette = {
  background: string;
  grid: string;
  /** Selection outline + handle stroke. */
  accent: string;
  handleFill: string;
  marquee: string;
  marqueeFill: string;
  cardBackground: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  /** Per-note-colour card fills and their readable text colour. */
  note: Record<NoteColor, { fill: string; border: string; text: string }>;
  /** Stroke colours for draw/arrow/shape items. */
  stroke: Record<NoteColor, string>;
  shadow: string;
};

const DARK_NOTES: CanvasPalette["note"] = {
  yellow: { fill: "#f3d16e", border: "#d9b74e", text: "#231f10" },
  white: { fill: "#e9e7e1", border: "#cbc9c2", text: "#1b1c20" },
  blue: { fill: "#7fa8e8", border: "#5f88c8", text: "#0f1725" },
  green: { fill: "#8ec98a", border: "#6da869", text: "#101d0f" },
  red: { fill: "#e28e88", border: "#c26e68", text: "#241110" },
  purple: { fill: "#b295dd", border: "#9275bd", text: "#180f24" },
  orange: { fill: "#eda86d", border: "#cd884d", text: "#241708" },
  grey: { fill: "#3a3b41", border: "#4d4e55", text: "#e7e5e0" },
};

const LIGHT_NOTES: CanvasPalette["note"] = {
  yellow: { fill: "#fde68a", border: "#e6cb63", text: "#3a2f07" },
  white: { fill: "#ffffff", border: "#dedcd6", text: "#1b1c20" },
  blue: { fill: "#bfd6f7", border: "#96b6e2", text: "#12233d" },
  green: { fill: "#c6e8c2", border: "#9dcd98", text: "#173219" },
  red: { fill: "#f6c5c1", border: "#dc9a95", text: "#3b1a17" },
  purple: { fill: "#d9c9f2", border: "#b7a1dd", text: "#251a3a" },
  orange: { fill: "#fbd2ab", border: "#e0ad7c", text: "#3d2610" },
  grey: { fill: "#eceae5", border: "#d5d3cc", text: "#2a2b30" },
};

const DARK_STROKES: Record<NoteColor, string> = {
  yellow: "#f0cd66",
  white: "#f4f3ef",
  blue: "#7fa8e8",
  green: "#8ec98a",
  red: "#e28e88",
  purple: "#b295dd",
  orange: "#eda86d",
  grey: "#9c998f",
};

const LIGHT_STROKES: Record<NoteColor, string> = {
  yellow: "#c9a326",
  white: "#8b8a85",
  blue: "#3b6fc4",
  green: "#3f8a3a",
  red: "#c04a42",
  purple: "#7a56b8",
  orange: "#c2762a",
  grey: "#5c5b57",
};

export const PALETTES: Record<ThemeName, CanvasPalette> = {
  dark: {
    background: "#17181c",
    grid: "rgba(255,255,255,0.10)",
    accent: "#6ea8fe",
    handleFill: "#17181c",
    marquee: "rgba(110,168,254,0.9)",
    marqueeFill: "rgba(110,168,254,0.12)",
    cardBackground: "#232428",
    cardBorder: "#3a3b41",
    text: "#f4f3ef",
    textMuted: "#9c998f",
    note: DARK_NOTES,
    stroke: DARK_STROKES,
    shadow: "rgba(0,0,0,0.45)",
  },
  light: {
    background: "#f6f5f2",
    grid: "rgba(0,0,0,0.12)",
    accent: "#2f6fd0",
    handleFill: "#ffffff",
    marquee: "rgba(47,111,208,0.9)",
    marqueeFill: "rgba(47,111,208,0.10)",
    cardBackground: "#ffffff",
    cardBorder: "#dedcd6",
    text: "#1b1c20",
    textMuted: "#6b6a65",
    note: LIGHT_NOTES,
    stroke: LIGHT_STROKES,
    shadow: "rgba(0,0,0,0.14)",
  },
};

export const NOTE_COLORS: NoteColor[] = [
  "yellow",
  "white",
  "blue",
  "green",
  "red",
  "purple",
  "orange",
  "grey",
];
