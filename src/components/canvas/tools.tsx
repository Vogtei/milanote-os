"use client";

import type { ToolId } from "@/canvas/editor";
import { NoteIcon, LinkIcon, TodoIcon, ImageIcon, DrawIcon } from "@/components/icons/MilanoteIcons";
import {
  SelectIcon,
  TextIcon,
  ShapesIcon,
  ArrowIcon,
  FolderIcon,
  DocumentIcon,
} from "@/components/icons/VosIcons";

/** MIME type used when a rail button is dragged onto the canvas. */
export const DRAG_MIME = "application/x-milanote-tool";
/** Carried alongside DRAG_MIME="shape" when a specific glyph from the
 *  shapes popover (not the rail button itself) is dragged onto the canvas. */
export const SHAPE_KIND_MIME = "application/x-milanote-shape-kind";

export type ToolSpec = {
  id: ToolId;
  label: string;
  icon: (props: { size?: number }) => React.ReactElement;
  /** Opens its own options popover next to the rail instead of arming
   *  immediately. */
  popover?: "shape" | "draw";
};

// Order mirrors the reference app's rail, top to bottom.
export const TOOLS: ToolSpec[] = [
  { id: "select", label: "Wählen", icon: SelectIcon },
  { id: "note", label: "Notiz", icon: NoteIcon },
  { id: "text", label: "Text", icon: TextIcon },
  { id: "board", label: "Board", icon: FolderIcon },
  { id: "image", label: "Bild", icon: ImageIcon },
  { id: "document", label: "Dokument", icon: DocumentIcon },
  { id: "link", label: "Link", icon: LinkIcon },
  { id: "todo", label: "To-do", icon: TodoIcon },
  { id: "shape", label: "Formen", icon: ShapesIcon, popover: "shape" },
  { id: "draw", label: "Zeichnen", icon: DrawIcon, popover: "draw" },
  { id: "arrow", label: "Pfeil", icon: ArrowIcon },
];
