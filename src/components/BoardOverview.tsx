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
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[rgb(120,118,112)]">
            <SearchIcon size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Boards durchsuchen…"
            className="h-[34px] w-52 rounded-lg border border-[rgb(58,59,65)] bg-[#17181c] pl-7 pr-2 text-[13px] text-[rgb(231,229,224)] outline-none placeholder:text-[rgb(120,118,112)] focus:border-[rgb(120,118,112)]"
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
          <p className="text-sm text-[rgb(120,118,112)]">Lädt…</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {visible.map((board) => (
              <div key={board.id} className="group relative">
                <Link
                  href={`/board/${board.id}`}
                  className="flex h-32 flex-col justify-between rounded-xl border border-[rgb(58,59,65)] bg-[rgb(35,36,40)] p-3.5 text-[rgb(156,153,143)] transition-colors hover:border-[rgb(90,91,97)] hover:bg-[rgba(255,255,255,0.045)]"
                >
                  <BoardIcon size={22} />
                  <span className="truncate text-sm font-medium text-[rgb(244,243,239)]">
                    {board.title}
                  </span>
                </Link>
                <button
                  onClick={() => handleDelete(board)}
                  aria-label={`${board.title} löschen`}
                  className="absolute right-2 top-2 hidden rounded-md p-1.5 text-[rgb(120,118,112)] hover:bg-[rgba(255,255,255,0.06)] hover:text-red-400 group-hover:block"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}

            {creating ? (
              <form
                onSubmit={handleCreate}
                className="flex h-32 flex-col justify-end rounded-xl border border-[rgb(90,91,97)] bg-[rgb(35,36,40)] p-3.5"
              >
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => !title && setCreating(false)}
                  onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
                  placeholder="Board-Name"
                  disabled={isPending}
                  className="w-full rounded-lg border border-[rgb(58,59,65)] bg-[#17181c] px-2 py-1.5 text-sm text-[rgb(231,229,224)] outline-none placeholder:text-[rgb(120,118,112)] focus:border-[rgb(120,118,112)]"
                />
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgb(58,59,65)] text-[rgb(120,118,112)] hover:border-[rgb(90,91,97)] hover:text-[rgb(244,243,239)]"
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
      <span className="truncate px-2 py-1.5 text-xs text-[rgb(120,118,112)]">{email}</span>
      <Link
        href="/trash"
        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
      >
        <TrashIcon /> Papierkorb
      </Link>
      <span className="my-1 h-px bg-[rgb(58,59,65)]" />
      <form action={signOutAction}>
        <button className="w-full rounded-lg px-2 py-2 text-left text-[13px] text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]">
          Abmelden
        </button>
      </form>
    </div>
  );
}
