"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BoardEditor } from "@/canvas/editor";
import type { AnyItem } from "@/canvas/types";
import { blocksToPlainText } from "@/canvas/richText";
import { IconBtn } from "@/components/vos/IconBtn";
import {
  SearchIcon,
  UndoIcon,
  RedoIcon,
  ExportImageIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
  PdfIcon,
  PngFileIcon,
} from "@/components/icons/VosIcons";
import { CommentIcon } from "@/components/icons/ContentIcons";
import { SettingsModal } from "@/components/SettingsModal";
import { VellumMark } from "@/components/VellumMark";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { useTheme } from "@/components/ThemeProvider";
import { useClickAway } from "@/components/useClickAway";

export type ExportFormat = "png" | "pdf-standard" | "pdf-high";

export type BoardChrome = {
  title: string;
  /** Root-first ancestor chain for the nested breadcrumb — current board is
   *  rendered separately as the trailing, non-linked segment. */
  ancestors: { id: string; title: string }[];
  roleLabel: string | null;
  share?: React.ReactNode;
  user: { name: string | null; email: string };
};

export function BoardTopBar({
  editor,
  chrome,
  onExport,
  onToggleComments,
  saveState,
}: {
  editor: BoardEditor;
  chrome: BoardChrome;
  onExport: (format: ExportFormat) => void;
  onToggleComments: () => void;
  saveState: "idle" | "saving" | "error";
}) {
  useEditorTick(editor);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const readonly = editor.isReadonly();
  const { theme, setPreference } = useTheme();

  const exportRef = useClickAway(exportOpen, () => setExportOpen(false));

  // Clicking into the board collapses whatever popover the header opened —
  // Export already gets this for free from useClickAway (the canvas is
  // "outside" its wrapper), but Search has no wrapper of its own to be
  // outside of, so it listens for the editor's own pointerdown directly.
  useEffect(
    () =>
      editor.subscribe((event) => {
        if (event.type === "canvasPointerDown") setSearchOpen(false);
      }),
    [editor],
  );

  return (
    <>
      <header className="vos-panel vos-panel-shadow fixed left-0 right-0 top-0 z-[300] flex h-[52px] items-center gap-0.5 pl-3.5 pr-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <Breadcrumb chrome={chrome} />
          {chrome.roleLabel && (
            <span className="ml-2 hidden shrink-0 rounded bg-[var(--vos-hover-soft)] px-1.5 py-0.5 text-[11px] text-[var(--vos-muted)] sm:inline">
              {chrome.roleLabel}
            </span>
          )}
          {saveState === "error" && (
            <span className="ml-2 shrink-0 text-[11px] text-[var(--vos-danger)]">
              Nicht gespeichert
            </span>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <span className="pointer-events-auto truncate px-24 text-[15px] font-semibold tracking-[-0.2px] text-[var(--vos-text-strong)]">
            {chrome.title}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {!readonly && (
            <span className="hidden items-center md:flex">
              <IconBtn label="Rückgängig" disabled={!editor.canUndo()} onClick={() => editor.undo()}>
                <UndoIcon />
              </IconBtn>
              <IconBtn label="Wiederholen" disabled={!editor.canRedo()} onClick={() => editor.redo()}>
                <RedoIcon />
              </IconBtn>
            </span>
          )}

          <IconBtn label="Suchen" active={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
            <SearchIcon />
          </IconBtn>
          <IconBtn label="Kommentare" onClick={onToggleComments}>
            <CommentIcon />
          </IconBtn>

          <div ref={exportRef} className="relative">
            <IconBtn label="Exportieren" active={exportOpen} onClick={() => setExportOpen((v) => !v)}>
              <ExportImageIcon />
            </IconBtn>
            {exportOpen && (
              <ExportMenu
                onExport={(format) => {
                  setExportOpen(false);
                  onExport(format);
                }}
              />
            )}
          </div>

          {chrome.share}

          <span className="mx-1.5 h-4 w-px shrink-0 bg-[var(--vos-border)]" />

          <IconBtn
            label={theme === "dark" ? "Helles Erscheinungsbild" : "Dunkles Erscheinungsbild"}
            onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </IconBtn>
          <IconBtn label="Einstellungen" active={settingsOpen} onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconBtn>
        </div>
      </header>

      {searchOpen && <SearchPanel editor={editor} onClose={() => setSearchOpen(false)} />}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} user={chrome.user} />
    </>
  );
}

// Home + nested ancestor trail, ending with the current board as plain text —
// mirrors how Milanote's own header reads the board's position in the tree,
// replacing the earlier chevron-dropdown switcher outright rather than
// keeping both.
function Breadcrumb({ chrome }: { chrome: BoardChrome }) {
  const crumbClass =
    "shrink-0 truncate rounded-[7px] px-1.5 py-1 text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link href="/" title="Übersicht" className={`${crumbClass} flex items-center gap-2`}>
        <VellumMark size={18} />
        Home
      </Link>
      {chrome.ancestors.map((ancestor) => (
        <span key={ancestor.id} className="flex min-w-0 shrink items-center gap-2">
          <span className="text-[var(--vos-faint)]">/</span>
          <Link href={`/board/${ancestor.id}`} className={crumbClass}>
            {ancestor.title}
          </Link>
        </span>
      ))}
      {/* Current board again, as plain text — the centered title says the
          same thing, but a nav trail that stops one short of "you are here"
          isn't actually a nav trail. */}
      <span className="flex min-w-0 shrink items-center gap-2">
        <span className="text-[var(--vos-faint)]">/</span>
        <span className="shrink-0 truncate px-1.5 py-1 text-[13px] font-medium text-[var(--vos-text-strong)]">
          {chrome.title}
        </span>
      </span>
    </div>
  );
}

function ExportMenu({ onExport }: { onExport: (format: ExportFormat) => void }) {
  const row =
    "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--vos-hover-soft)]";

  return (
    <div className="vos-panel vos-panel-shadow absolute right-0 top-[42px] z-[310] flex w-80 flex-col rounded-xl p-1.5">
      <span className="px-2 pb-1 pt-1.5 text-[11px] uppercase tracking-wide text-[var(--vos-faint)]">
        Board exportieren
      </span>
      <button className={row} onClick={() => onExport("pdf-standard")}>
        <PdfIcon size={18} className="mt-0.5 shrink-0 text-[var(--vos-muted)]" />
        <span>
          <span className="block whitespace-nowrap text-[13px] text-[var(--vos-text)]">PDF Standard</span>
          <span className="block text-[11px] text-[var(--vos-faint)]">Kleine Dateigröße</span>
        </span>
      </button>
      <button className={row} onClick={() => onExport("pdf-high")}>
        <PdfIcon size={18} className="mt-0.5 shrink-0 text-[var(--vos-muted)]" />
        <span>
          <span className="block whitespace-nowrap text-[13px] text-[var(--vos-text)]">PDF hohe Qualität</span>
          <span className="block text-[11px] text-[var(--vos-faint)]">Große Dateigröße</span>
        </span>
      </button>
      <button className={row} onClick={() => onExport("png")}>
        <PngFileIcon size={18} className="mt-0.5 shrink-0 text-[var(--vos-muted)]" />
        <span className="block text-[13px] text-[var(--vos-text)]">PNG-Bild</span>
      </button>
    </div>
  );
}

// Items store plain strings, so searching is a direct read — no rich-text
// rendering pass like the tldraw version needed. Switching on the type keeps
// this honest: adding an item kind with searchable text won't silently miss it.
export function itemText(item: AnyItem): string {
  switch (item.type) {
    case "note":
      return blocksToPlainText(item.props.blocks);
    case "text":
      return item.props.text;
    case "link":
      return [item.props.title, item.props.description, item.props.url].filter(Boolean).join(" ");
    case "file":
      return item.props.name;
    case "board":
      return item.props.title;
    case "todo":
      return [item.props.title, ...item.props.entries.map((entry) => entry.text)].join(" ");
    case "image":
      return item.props.alt;
    default:
      return "";
  }
}

function SearchPanel({ editor, onClose }: { editor: BoardEditor; onClose: () => void }) {
  const [query, setQuery] = useState("");
  // Results have to survive edits made while the panel is open, so this reads
  // the store on every render rather than memoising on the query alone.
  useEditorTick(editor);

  const needle = query.trim().toLowerCase();
  const results = needle
    ? editor.store
        .getItems()
        .map((item) => ({ item, text: itemText(item).replace(/\s+/g, " ").trim() }))
        .filter((result) => result.text.toLowerCase().includes(needle))
        .slice(0, 20)
    : [];

  return (
    <div className="vos-panel vos-panel-shadow fixed left-1/2 top-[66px] z-[305] flex w-[min(640px,calc(100vw-40px))] -translate-x-1/2 flex-col rounded-xl p-2">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Auf diesem Board suchen…"
        className="rounded-lg border border-[var(--vos-border)] bg-[var(--vos-input)] px-3.5 py-2.5 text-[14px] text-[var(--vos-text)] outline-none placeholder:text-[var(--vos-faint)] focus:border-[var(--vos-text-strong)]"
      />
      {needle && (
        <div className="mt-1.5 flex max-h-72 flex-col overflow-y-auto">
          {results.length === 0 && (
            <span className="px-2 py-2 text-xs text-[var(--vos-faint)]">Keine Treffer</span>
          )}
          {results.map(({ item, text }) => (
            <button
              key={item.id}
              onClick={() => {
                editor.setSelection([item.id]);
                editor.zoomToSelection();
                onClose();
              }}
              className="truncate rounded-lg px-2 py-2 text-left text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
