"use client";

import { useEffect, useRef, useState } from "react";
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
  ChevronDownIcon,
  HomeIcon,
  PdfIcon,
  PngFileIcon,
  PresentIcon,
  MinusIcon,
  PlusIcon,
  FitIcon,
} from "@/components/icons/VosIcons";
import { CommentIcon, TrashIcon } from "@/components/icons/MilanoteIcons";
import { SettingsModal } from "@/components/SettingsModal";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { useTheme } from "@/components/ThemeProvider";

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

/** Shared close-on-outside-click behaviour for the topbar's popovers. The
 *  ref goes on the wrapper that contains BOTH the trigger button and the
 *  popover — not the popover alone — so a second click on the trigger
 *  counts as "inside" and is left to the button's own toggle handler.
 *  Attaching it to the popover only made every trigger's second click race
 *  its own toggle against this close, since pointerdown (which this listens
 *  for) fires before the button's click event. */
function useClickAway(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open, onClose]);
  return ref;
}

export function BoardTopBar({
  editor,
  chrome,
  onExport,
  onToggleComments,
  onPresent,
  saveState,
}: {
  editor: BoardEditor;
  chrome: BoardChrome;
  onExport: (format: ExportFormat) => void;
  onToggleComments: () => void;
  onPresent: () => void;
  saveState: "idle" | "saving" | "error";
}) {
  useEditorTick(editor);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const readonly = editor.isReadonly();
  const { theme, setPreference } = useTheme();

  const exportRef = useClickAway(exportOpen, () => setExportOpen(false));
  const zoomRef = useClickAway(zoomOpen, () => setZoomOpen(false));

  return (
    <>
      <header className="vos-panel vos-panel-shadow fixed left-0 right-0 top-0 z-[300] flex h-[52px] items-center gap-0.5 overflow-hidden rounded-b-2xl pl-3.5 pr-1.5">
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

          <div ref={zoomRef} className="relative">
            <button
              type="button"
              title="Zoom"
              aria-label="Zoom"
              onClick={() => setZoomOpen((v) => !v)}
              className={`flex h-[34px] shrink-0 items-center gap-0.5 rounded-lg px-2 text-[12px] font-medium tabular-nums transition-colors ${
                zoomOpen
                  ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
                  : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
              }`}
            >
              {Math.round(editor.getCamera().z * 100)}%
              <ChevronDownIcon size={12} />
            </button>
            {zoomOpen && (
              <ZoomMenu
                editor={editor}
                onPresent={() => {
                  setZoomOpen(false);
                  onPresent();
                }}
              />
            )}
          </div>

          <IconBtn
            label={theme === "dark" ? "Helles Erscheinungsbild" : "Dunkles Erscheinungsbild"}
            onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </IconBtn>
          <Link
            href="/trash"
            title="Papierkorb"
            aria-label="Papierkorb"
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg text-[var(--vos-muted)] transition-colors hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
          >
            <TrashIcon />
          </Link>
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
    <div className="flex min-w-0 items-center gap-1">
      <Link href="/" title="Übersicht" className={`${crumbClass} flex items-center gap-1`}>
        <HomeIcon size={15} />
      </Link>
      {chrome.ancestors.map((ancestor) => (
        <span key={ancestor.id} className="flex min-w-0 shrink items-center gap-1">
          <span className="text-[var(--vos-faint)]">/</span>
          <Link href={`/board/${ancestor.id}`} className={crumbClass}>
            {ancestor.title}
          </Link>
        </span>
      ))}
      {/* Current board again, as plain text — the centered title says the
          same thing, but a nav trail that stops one short of "you are here"
          isn't actually a nav trail. */}
      <span className="flex min-w-0 shrink items-center gap-1">
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

const ZOOM_MIN = 10;
const ZOOM_MAX = 800;

function ZoomMenu({
  editor,
  onPresent,
}: {
  editor: BoardEditor;
  onPresent: () => void;
}) {
  const pct = Math.round(editor.getCamera().z * 100);

  return (
    <div className="vos-panel vos-panel-shadow absolute right-0 top-[42px] z-[310] flex w-64 flex-col gap-2.5 rounded-xl p-3">
      <div>
        <div className="flex items-center gap-2">
          <IconBtn label="Verkleinern" onClick={() => editor.zoomOut()}>
            <MinusIcon size={16} />
          </IconBtn>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            value={pct}
            onChange={(e) => editor.setZoom(Number(e.target.value) / 100)}
            className="flex-1 accent-[var(--vos-text-strong)]"
          />
          <IconBtn label="Vergrößern" onClick={() => editor.zoomIn()}>
            <PlusIcon size={16} />
          </IconBtn>
        </div>
        <div className="mt-1 text-center text-[12px] tabular-nums text-[var(--vos-muted)]">{pct}%</div>
      </div>

      <button
        onClick={() => editor.zoomToFit()}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--vos-border)] py-1.5 text-[12px] font-medium text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      >
        <FitIcon size={14} /> Auf Bildschirm einpassen
      </button>

      <span className="h-px bg-[var(--vos-border)]" />

      <div>
        <p className="text-[11px] leading-snug text-[var(--vos-faint)]">
          Vollbild, Werkzeugleiste und Kopfzeile ausblenden.
        </p>
        <button
          onClick={onPresent}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--vos-text-strong)] py-1.5 text-[12px] font-medium text-[var(--vos-bg)]"
        >
          <PresentIcon size={14} /> Präsentieren
        </button>
      </div>
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
    <div className="vos-panel vos-panel-shadow absolute right-2.5 top-[66px] z-[305] flex w-[min(320px,calc(100vw-20px))] flex-col rounded-xl p-2">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Auf diesem Board suchen…"
        className="rounded-lg border border-[var(--vos-border)] bg-[var(--vos-input)] px-2.5 py-2 text-[13px] text-[var(--vos-text)] outline-none placeholder:text-[var(--vos-faint)] focus:border-[var(--vos-muted)]"
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
