"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderPlaintextFromRichText, useValue } from "tldraw";
import type { Editor, TLShape } from "tldraw";
import { TopBar, WorkspaceCrumb, CrumbDivider, Crumb, CrumbSeparator, TopBarSpacer } from "@/components/vos/TopBar";
import { IconBtn } from "@/components/vos/IconBtn";
import {
  SearchIcon,
  UndoIcon,
  RedoIcon,
  ExportImageIcon,
  KebabIcon,
} from "@/components/icons/VosIcons";
import { CommentIcon, TrashIcon } from "@/components/icons/MilanoteIcons";
import { signOutAction } from "@/lib/auth-actions";
import Link from "next/link";

export type BoardTopBarProps = {
  title: string;
  parentHref: string;
  parentLabel: string;
  roleLabel: string | null;
  editor: Editor | null;
  readonly: boolean;
  onExport: () => void;
  // Absent in offline mode — comments live on the server, so there's nothing
  // to show until the board reconnects.
  onToggleComments?: () => void;
  onGoOffline?: () => void;
  share?: React.ReactNode;
};

export function BoardTopBar({
  title,
  parentHref,
  parentLabel,
  roleLabel,
  editor,
  readonly,
  onExport,
  onToggleComments,
  onGoOffline,
  share,
}: BoardTopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <TopBar>
        <WorkspaceCrumb label="Workspace" />
        <CrumbDivider />
        <Crumb label={parentLabel} href={parentHref} />
        <CrumbSeparator />
        <Crumb label={title} />
        {roleLabel && (
          <span className="ml-2 shrink-0 rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[11px] text-[rgb(156,153,143)]">
            {roleLabel}
          </span>
        )}

        <TopBarSpacer />

        {editor && !readonly && <HistoryButtons editor={editor} />}

        <IconBtn label="Suchen" active={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
          <SearchIcon />
        </IconBtn>
        {onToggleComments && (
          <IconBtn label="Kommentare" onClick={onToggleComments}>
            <CommentIcon />
          </IconBtn>
        )}
        {!readonly && (
          <IconBtn label="Ansicht als PNG speichern" onClick={onExport}>
            <ExportImageIcon />
          </IconBtn>
        )}
        {share}
        <div className="relative">
          <IconBtn label="Menü" active={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <KebabIcon />
          </IconBtn>
          {menuOpen && (
            <BoardMenu onClose={() => setMenuOpen(false)} onGoOffline={onGoOffline} />
          )}
        </div>
      </TopBar>

      {searchOpen && editor && (
        <SearchPanel editor={editor} onClose={() => setSearchOpen(false)} />
      )}
    </>
  );
}

function HistoryButtons({ editor }: { editor: Editor }) {
  const canUndo = useValue("can undo", () => editor.getCanUndo(), [editor]);
  const canRedo = useValue("can redo", () => editor.getCanRedo(), [editor]);
  return (
    <>
      <IconBtn label="Rückgängig" disabled={!canUndo} onClick={() => editor.undo()}>
        <UndoIcon />
      </IconBtn>
      <IconBtn label="Wiederholen" disabled={!canRedo} onClick={() => editor.redo()}>
        <RedoIcon />
      </IconBtn>
    </>
  );
}

function BoardMenu({
  onClose,
  onGoOffline,
}: {
  onClose: () => void;
  onGoOffline?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="vos-panel vos-panel-shadow absolute right-0 top-[42px] z-[310] flex w-56 flex-col rounded-xl p-1.5"
    >
      <Link
        href="/trash"
        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
      >
        <TrashIcon /> Papierkorb
      </Link>
      {onGoOffline && (
        <button
          onClick={() => {
            onClose();
            onGoOffline();
          }}
          className="rounded-lg px-2 py-2 text-left text-[13px] text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
        >
          Offline arbeiten
        </button>
      )}
      <span className="my-1 h-px bg-[rgb(58,59,65)]" />
      <form action={signOutAction}>
        <button className="w-full rounded-lg px-2 py-2 text-left text-[13px] text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]">
          Abmelden
        </button>
      </form>
    </div>
  );
}

// Text of a shape, whichever prop it happens to live in — note/text/geo use
// tldraw's rich text, our own shapes use plain string props.
function shapeText(editor: Editor, shape: TLShape): string {
  const props = shape.props as Record<string, unknown>;
  const parts: string[] = [];
  if (props.richText) parts.push(renderPlaintextFromRichText(editor, props.richText as never));
  for (const key of ["text", "title", "name"]) {
    if (typeof props[key] === "string") parts.push(props[key] as string);
  }
  return parts.join(" ").trim();
}

function SearchPanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return editor
      .getCurrentPageShapes()
      .map((shape) => ({ shape, text: shapeText(editor, shape) }))
      .filter((r) => r.text.toLowerCase().includes(q))
      .slice(0, 20);
  }, [query, editor]);

  return (
    <div className="vos-panel vos-panel-shadow absolute right-2.5 top-[66px] z-[305] flex w-80 flex-col rounded-xl p-2">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Auf diesem Board suchen…"
        className="rounded-lg border border-[rgb(58,59,65)] bg-[#17181c] px-2.5 py-2 text-[13px] text-[rgb(231,229,224)] outline-none placeholder:text-[rgb(120,118,112)] focus:border-[rgb(120,118,112)]"
      />
      {query.trim() && (
        <div className="mt-1.5 flex max-h-72 flex-col overflow-y-auto">
          {results.length === 0 && (
            <span className="px-2 py-2 text-xs text-[rgb(120,118,112)]">Keine Treffer</span>
          )}
          {results.map(({ shape, text }) => (
            <button
              key={shape.id}
              onClick={() => {
                editor.select(shape.id);
                editor.zoomToSelection({ animation: { duration: 200 } });
                onClose();
              }}
              className="truncate rounded-lg px-2 py-2 text-left text-[13px] text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
