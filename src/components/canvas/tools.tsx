"use client";

import type { ToolId } from "@/canvas/editor";
import {
  NoteIcon,
  LinkIcon,
  TodoIcon,
  BoardIcon,
  ImageIcon,
  UploadIcon,
  DrawIcon,
} from "@/components/icons/MilanoteIcons";
import { SelectIcon, TextIcon, ShapesIcon, ArrowIcon } from "@/components/icons/VosIcons";

/** MIME type used when a rail button is dragged onto the canvas. */
export const DRAG_MIME = "application/x-milanote-tool";

export type ToolSpec = {
  id: ToolId;
  label: string;
  icon: (props: { size?: number }) => React.ReactElement;
  /** Needs a follow-up dialog (URL, filename, board name) before anything is
   *  created, so it can't be placed directly by a click or a drop. */
  prompts?: "link" | "board" | "image" | "file";
};

// Order mirrors the reference app's rail, top to bottom.
export const TOOLS: ToolSpec[] = [
  { id: "select", label: "Wählen", icon: SelectIcon },
  { id: "note", label: "Notiz", icon: NoteIcon },
  { id: "text", label: "Text", icon: TextIcon },
  { id: "board", label: "Board", icon: BoardIcon, prompts: "board" },
  { id: "image", label: "Bild", icon: ImageIcon, prompts: "image" },
  { id: "file", label: "Datei", icon: UploadIcon, prompts: "file" },
  { id: "link", label: "Link", icon: LinkIcon, prompts: "link" },
  { id: "todo", label: "To-do", icon: TodoIcon },
  { id: "shape", label: "Formen", icon: ShapesIcon },
  { id: "draw", label: "Zeichnen", icon: DrawIcon },
  { id: "arrow", label: "Pfeil", icon: ArrowIcon },
];
