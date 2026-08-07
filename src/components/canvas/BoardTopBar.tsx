"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BoardEditor } from "@/canvas/editor";
import type { AnyItem } from "@/canvas/types";
import { blocksToPlainText } from "@/canvas/richText";
import { TopBar, TopBarSpacer } from "@/components/vos/TopBar";
import { IconBtn } from "@/components/vos/IconBtn";
import {
  SearchIcon,
  UndoIcon,
  RedoIcon,
  ExportImageIcon,
  KebabIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
} from "@/components/icons/VosIcons";
import { CommentIcon, TrashIcon } from "@/components/icons/MilanoteIcons";
import { signOutAction } from "@/lib/auth-actions";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { useTheme } from "@/components/ThemeProvider";

export type BoardChrome = {
  title: string;
  parentHref: string;
  parentLabel: string;
  /** Other boards under the same parent, for the switcher dropdown — current
   *  board already excluded by the caller. */
  siblings: { id: string; title: string }[];
  roleLabel: string | null;
  share?: React.ReactNode;
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
  onExport: () => void;
  onToggleComments: () => void;
  saveState: "idle" | "saving" | "error";
}) {
  useEditorTick(editor);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const readonly = editor.isReadonly();
  const { theme, setPreference } = useTheme();

  return (
    <>
      <TopBar>
        <BoardSwitcher chrome={chrome} />
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

        <TopBarSpacer />

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
        <span className="hidden sm:inline">
          <IconBtn label="Kommentare" onClick={onToggleComments}>
            <CommentIcon />
          </IconBtn>
        </span>
        <span className="hidden md:inline">
          <IconBtn label="Ansicht als PNG speichern" onClick={onExport}>
            <ExportImageIcon />
          </IconBtn>
        </span>
        {chrome.share}
        <IconBtn
          label={theme === "dark" ? "Helles Erscheinungsbild" : "Dunkles Erscheinungsbild"}
          onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <MoonIcon /> : <SunIcon />}
        </IconBtn>
        <div className="relative">
          <IconBtn label="Menü" active={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <KebabIcon />
          </IconBtn>
          {menuOpen && (
            <BoardMenu
              onClose={() => setMenuOpen(false)}
              onExport={onExport}
              onToggleComments={onToggleComments}
            />
          )}
        </div>
      </TopBar>

      {searchOpen && <SearchPanel editor={editor} onClose={() => setSearchOpen(false)} />}
    </>
  );
}

// Current board's title + chevron, standing in for the old static path
// breadcrumb — click opens a switcher to move up a level or sideways to a
// sibling board, instead of only ever reading where you already are.
function BoardSwitcher({ chrome }: { chrome: BoardChrome }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  const row =
    "flex w-full min-w-0 items-center gap-2 truncate rounded-lg px-2 py-2 text-left text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]";

  return (
    <div ref={ref} className="relative min-w-0 shrink">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-1 rounded-[7px] px-1 py-1 text-[var(--vos-text)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      >
        <span className="truncate text-[15px] font-medium tracking-[-0.2px]">{chrome.title}</span>
        <ChevronDownIcon size={14} className="shrink-0" />
      </button>
      {open && (
        <div className="vos-panel vos-panel-shadow absolute left-0 top-[38px] z-[310] flex w-64 flex-col rounded-xl p-1.5">
          <Link href={chrome.parentHref} onClick={() => setOpen(false)} className={row}>
            ↑ {chrome.parentLabel}
          </Link>
          {chrome.siblings.length > 0 && (
            <>
              <span className="my-1 h-px bg-[var(--vos-border)]" />
              {chrome.siblings.map((board) => (
                <Link key={board.id} href={`/board/${board.id}`} onClick={() => setOpen(false)} className={row}>
                  {board.title}
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BoardMenu({
  onClose,
  onExport,
  onToggleComments,
}: {
  onClose: () => void;
  onExport: () => void;
  onToggleComments: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [onClose]);

  const row =
    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]";

  return (
    <div
      ref={ref}
      className="vos-panel vos-panel-shadow absolute right-0 top-[42px] z-[310] flex w-60 flex-col rounded-xl p-1.5"
    >
      {/* Duplicates of topbar buttons that are hidden on narrow screens —
          the menu is the only place they exist on a phone. */}
      <button className={`${row} sm:hidden`} onClick={() => { onClose(); onToggleComments(); }}>
        <CommentIcon size={18} /> Kommentare
      </button>
      <button className={`${row} md:hidden`} onClick={() => { onClose(); onExport(); }}>
        <ExportImageIcon size={18} /> Als PNG speichern
      </button>

      <span className="my-1 h-px bg-[var(--vos-border)]" />
      <Link href="/trash" className={row}>
        <TrashIcon size={18} /> Papierkorb
      </Link>
      <form action={signOutAction}>
        <button className={row}>Abmelden</button>
      </form>
    </div>
  );
}

// Items store plain strings, so searching is a direct read — no rich-text
// rendering pass like the tldraw version needed. Switching on the type keeps
// this honest: adding an item kind with searchable text won't silently miss it.
function itemText(item: AnyItem): string {
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
