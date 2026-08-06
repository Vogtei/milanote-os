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
  /** Opens a dialog or file picker before the item exists. Only Link and
   *  Datei still do — Board and Bild create their item straight away. */
  prompts?: "link" | "file";
};

// Order mirrors the reference app's rail, top to bottom.
export const TOOLS: ToolSpec[] = [
  { id: "select", label: "Wählen", icon: SelectIcon },
  { id: "note", label: "Notiz", icon: NoteIcon },
  { id: "text", label: "Text", icon: TextIcon },
  { id: "board", label: "Board", icon: BoardIcon },
  { id: "image", label: "Bild", icon: ImageIcon },
  { id: "file", label: "Datei", icon: UploadIcon, prompts: "file" },
  { id: "link", label: "Link", icon: LinkIcon, prompts: "link" },
  { id: "todo", label: "To-do", icon: TodoIcon },
  { id: "shape", label: "Formen", icon: ShapesIcon },
  { id: "draw", label: "Zeichnen", icon: DrawIcon },
  { id: "arrow", label: "Pfeil", icon: ArrowIcon },
];
