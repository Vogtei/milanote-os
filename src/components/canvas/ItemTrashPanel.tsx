"use client";

import type { BoardEditor } from "@/canvas/editor";
import type { AnyItem, TrashEntry } from "@/canvas/types";
import { itemText } from "@/components/canvas/BoardTopBar";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { CloseIcon } from "@/components/icons/VosIcons";
import {
  NoteIcon,
  LinkIcon,
  TodoIcon,
  ImageIcon,
  DrawIcon,
  BoardIcon,
} from "@/components/icons/ContentIcons";
import {
  TextIcon,
  ShapesIcon,
  ArrowIcon,
  DocumentIcon,
} from "@/components/icons/VosIcons";

// Per-board recycle bin for individually deleted canvas items (a card, an
// image, a stroke) — not the board/folder trash at /trash, a different
// granularity entirely. Same browse-only sidebar shell as CommentsPanel.
const TYPE_ICON: Record<AnyItem["type"], (props: { size?: number }) => React.ReactElement> = {
  note: NoteIcon,
  text: TextIcon,
  image: ImageIcon,
  link: LinkIcon,
  file: DocumentIcon,
  board: BoardIcon,
  document: DocumentIcon,
  todo: TodoIcon,
  shape: ShapesIcon,
  draw: DrawIcon,
  arrow: ArrowIcon,
};

const TYPE_LABEL: Record<AnyItem["type"], string> = {
  note: "Notiz",
  text: "Text",
  image: "Bild",
  link: "Link",
  file: "Datei",
  board: "Board",
  document: "Dokument",
  todo: "To-do",
  shape: "Form",
  draw: "Zeichnung",
  arrow: "Pfeil",
};

function itemLabel(item: AnyItem): string {
  const text = itemText(item).replace(/\s+/g, " ").trim();
  return text || TYPE_LABEL[item.type];
}

export function ItemTrashPanel({
  editor,
  open,
  onClose,
}: {
  editor: BoardEditor;
  open: boolean;
  onClose: () => void;
}) {
  useEditorTick(editor);
  if (!open) return null;
  const entries = editor.getTrashedItems();

  return (
    <div className="vos-panel fixed left-0 top-[52px] bottom-0 z-[300] flex w-80 flex-col border-r border-[var(--vos-border)]">
      <div className="flex items-center justify-between border-b border-[var(--vos-border)] px-3.5 py-3">
        <span className="text-[13px] font-semibold text-[var(--vos-text-strong)]">Papierkorb</span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {entries.length === 0 && (
          <li className="px-2.5 py-2 text-xs text-[var(--vos-faint)]">Papierkorb ist leer.</li>
        )}
        {entries.map((entry: TrashEntry) => {
          const Icon = TYPE_ICON[entry.item.type];
          return (
            <li key={entry.item.id} className="flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--vos-hover-soft)]">
              <span className="mt-0.5 shrink-0 text-[var(--vos-muted)]">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-snug text-[var(--vos-text)]">
                  {itemLabel(entry.item)}
                </span>
                <span className="block text-[11px] text-[var(--vos-faint)]">
                  {relativeTime(new Date(entry.deletedAt))}
                </span>
              </span>
              <button
                type="button"
                onClick={() => editor.restoreItem(entry.item.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--vos-muted)] hover:bg-[var(--vos-hover)] hover:text-[var(--vos-text-strong)]"
              >
                Wiederherstellen
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function relativeTime(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return `vor ${days} Tg.`;
}
