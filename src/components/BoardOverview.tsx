"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createNode, deleteNode, listChildren } from "@/lib/nodes";
import { NodeType } from "@/generated/prisma/enums";
import { TopBar, WorkspaceCrumb, CrumbDivider, Crumb, TopBarSpacer } from "@/components/vos/TopBar";
import { IconBtn } from "@/components/vos/IconBtn";
import { KebabIcon, PlusIcon, SearchIcon } from "@/components/icons/VosIcons";
import { BoardIcon, TrashIcon } from "@/components/icons/MilanoteIcons";
import { signOutAction } from "@/lib/auth-actions";

type BoardNode = { id: string; title: string };

// Replaces the old left sidebar: with the board tree gone from the chrome,
// this page is where you pick or create a board.
export function BoardOverview({ email }: { email: string }) {
  const [boards, setBoards] = useState<BoardNode[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function reload() {
    setBoards((await listChildren(null)) as BoardNode[]);
  }

  useEffect(() => {
    let cancelled = false;
    listChildren(null).then((kids) => {
      if (!cancelled) setBoards(kids as BoardNode[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    startTransition(async () => {
      await createNode(NodeType.BOARD, name, null);
      setTitle("");
      setCreating(false);
      await reload();
    });
  }

  async function handleDelete(node: BoardNode) {
    if (!confirm(`"${node.title}" löschen?`)) return;
    try {
      await deleteNode(node.id);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  const visible = (boards ?? []).filter((b) =>
    b.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="h-full overflow-y-auto">
      <TopBar>
        <WorkspaceCrumb label="Workspace" />
        <CrumbDivider />
        <Crumb label="Übersicht" />
        <TopBarSpacer />
        <div className="relative mr-1 hidden sm:block">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--vos-faint)]">
            <SearchIcon size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Boards durchsuchen…"
            className="h-[34px] w-52 rounded-lg border border-[var(--vos-border)] bg-[var(--vos-bg)] pl-7 pr-2 text-[13px] text-[var(--vos-text)] outline-none placeholder:text-[var(--vos-faint)] focus:border-[var(--vos-faint)]"
          />
        </div>
        <div className="relative">
          <IconBtn label="Menü" active={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <KebabIcon />
          </IconBtn>
          {menuOpen && <AccountMenu email={email} onClose={() => setMenuOpen(false)} />}
        </div>
      </TopBar>

      <div className="mx-auto max-w-5xl px-6 pb-16 pt-[84px]">
        {boards === null ? (
          <p className="text-sm text-[var(--vos-faint)]">Lädt…</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {visible.map((board) => (
              <div key={board.id} className="group relative">
                <Link
                  href={`/board/${board.id}`}
                  className="flex h-32 flex-col justify-between rounded-xl border border-[var(--vos-border)] bg-[var(--vos-panel-solid)] p-3.5 text-[var(--vos-muted)] transition-colors hover:border-[var(--vos-faint)] hover:bg-[var(--vos-hover-soft)]"
                >
                  <BoardIcon size={22} />
                  <span className="truncate text-sm font-medium text-[var(--vos-text-strong)]">
                    {board.title}
                  </span>
                </Link>
                <button
                  onClick={() => handleDelete(board)}
                  aria-label={`${board.title} löschen`}
                  className="absolute right-2 top-2 hidden rounded-md p-1.5 text-[var(--vos-faint)] hover:bg-[var(--vos-hover-soft)] hover:text-red-400 group-hover:block"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}

            {creating ? (
              <form
                onSubmit={handleCreate}
                className="flex h-32 flex-col justify-end rounded-xl border border-[var(--vos-faint)] bg-[var(--vos-panel-solid)] p-3.5"
              >
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => !title && setCreating(false)}
                  onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
                  placeholder="Board-Name"
                  disabled={isPending}
                  className="w-full rounded-lg border border-[var(--vos-border)] bg-[var(--vos-bg)] px-2 py-1.5 text-sm text-[var(--vos-text)] outline-none placeholder:text-[var(--vos-faint)] focus:border-[var(--vos-faint)]"
                />
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--vos-border)] text-[var(--vos-faint)] hover:border-[var(--vos-faint)] hover:text-[var(--vos-text-strong)]"
              >
                <PlusIcon size={22} />
                <span className="text-sm">Neues Board</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountMenu({ email, onClose }: { email: string; onClose: () => void }) {
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
      className="vos-panel vos-panel-shadow absolute right-0 top-[42px] z-[310] flex w-60 flex-col rounded-xl p-1.5"
    >
      <span className="truncate px-2 py-1.5 text-xs text-[var(--vos-faint)]">{email}</span>
      <Link
        href="/trash"
        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      >
        <TrashIcon /> Papierkorb
      </Link>
      <span className="my-1 h-px bg-[var(--vos-border)]" />
      <form action={signOutAction}>
        <button className="w-full rounded-lg px-2 py-2 text-left text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]">
          Abmelden
        </button>
      </form>
    </div>
  );
}
