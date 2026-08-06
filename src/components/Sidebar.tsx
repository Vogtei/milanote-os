"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createNode, deleteNode, listChildren } from "@/lib/nodes";
import { NodeType } from "@/generated/prisma/enums";

type Node = {
  id: string;
  type: "FOLDER" | "BOARD";
  title: string;
  parentId: string | null;
};

function NewNodeForm({
  parentId,
  onCreated,
}: {
  parentId: string | null;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState<null | "FOLDER" | "BOARD">(null);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex gap-2 pl-1 text-xs text-zinc-500">
        <button onClick={() => setOpen("FOLDER")} className="hover:text-zinc-900 dark:hover:text-zinc-100">
          + Ordner
        </button>
        <button onClick={() => setOpen("BOARD")} className="hover:text-zinc-900 dark:hover:text-zinc-100">
          + Board
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex gap-1 pl-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        startTransition(async () => {
          await createNode(open === "FOLDER" ? NodeType.FOLDER : NodeType.BOARD, title, parentId);
          setTitle("");
          setOpen(null);
          onCreated();
        });
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && setOpen(null)}
        placeholder={open === "FOLDER" ? "Ordnername" : "Board-Name"}
        className="w-full rounded border border-zinc-300 px-1.5 py-0.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
        disabled={isPending}
      />
    </form>
  );
}

function NodeRow({ node, depth, onChanged }: { node: Node; depth: number; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<Node[] | null>(null);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const active = pathname === `/board/${node.id}`;

  async function loadChildren() {
    setLoading(true);
    const kids = await listChildren(node.id);
    setChildren(kids as Node[]);
    setLoading(false);
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && children === null) void loadChildren();
  }

  function refreshChildren() {
    if (expanded) void loadChildren();
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${node.title}" löschen?`)) return;
    try {
      await deleteNode(node.id);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  const rowContent = (
    <>
      {node.type === "FOLDER" ? (
        <button
          onClick={toggle}
          className="w-4 shrink-0 text-zinc-400"
          aria-label={expanded ? "Zuklappen" : "Aufklappen"}
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="shrink-0">{node.type === "FOLDER" ? "📁" : "🗒️"}</span>
      <span className="truncate">{node.title}</span>
      <button
        onClick={handleDelete}
        className="ml-auto hidden shrink-0 text-zinc-400 hover:text-red-600 group-hover:inline"
        aria-label="Löschen"
      >
        ✕
      </button>
    </>
  );

  return (
    <li>
      {node.type === "BOARD" ? (
        <Link
          href={`/board/${node.id}`}
          className={`group flex items-center gap-1.5 rounded px-1.5 py-1 text-sm ${
            active
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          {rowContent}
        </Link>
      ) : (
        <div
          className="group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-sm text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={toggle}
        >
          {rowContent}
        </div>
      )}

      {expanded && (
        <ul>
          {loading && (
            <li className="py-0.5 text-xs text-zinc-400" style={{ paddingLeft: `${(depth + 1) * 14 + 26}px` }}>
              Lädt…
            </li>
          )}
          {children?.map((child) => (
            <NodeRow key={child.id} node={child} depth={depth + 1} onChanged={refreshChildren} />
          ))}
          <li style={{ paddingLeft: `${(depth + 1) * 14 + 26}px` }} className="py-0.5">
            <NewNodeForm parentId={node.id} onCreated={refreshChildren} />
          </li>
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const [roots, setRoots] = useState<Node[] | null>(null);

  async function reload() {
    const kids = await listChildren(null);
    setRoots(kids as Node[]);
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-3">
        <Link href="/" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          milanote-os
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2">
        <ul>
          {roots === null && <li className="px-2 py-1 text-xs text-zinc-400">Lädt…</li>}
          {roots?.map((node) => (
            <NodeRow key={node.id} node={node} depth={0} onChanged={reload} />
          ))}
        </ul>
        <div className="mt-1 px-2">
          <NewNodeForm parentId={null} onCreated={reload} />
        </div>
      </nav>
    </aside>
  );
}
