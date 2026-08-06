"use client";

import { useEffect, useState, useTransition } from "react";
import { createShareLink, listShareLinks, revokeShareLink } from "@/lib/share";
import { ShareRole } from "@/generated/prisma/enums";

type Link = {
  id: string;
  token: string;
  role: "VIEW" | "COMMENT" | "EDIT";
  createdAt: string | Date;
};

const roleLabel: Record<Link["role"], string> = {
  VIEW: "Nur ansehen",
  COMMENT: "Kommentieren",
  EDIT: "Bearbeiten",
};

export function ShareDialog({ nodeId }: { nodeId: string }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<Link[] | null>(null);
  const [role, setRole] = useState<Link["role"]>("EDIT");
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) void reload();
  }, [open]);

  async function reload() {
    const data = await listShareLinks(nodeId);
    setLinks(data as Link[]);
  }

  function handleCreate() {
    startTransition(async () => {
      await createShareLink(nodeId, ShareRole[role]);
      await reload();
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeShareLink(id, nodeId);
      await reload();
    });
  }

  function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Teilen
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-[400] w-80 rounded-md border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Link["role"])}
              className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="VIEW">Nur ansehen</option>
              <option value="COMMENT">Kommentieren</option>
              <option value="EDIT">Bearbeiten</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="rounded bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Link erstellen
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-1.5">
            {links === null && <li className="text-xs text-zinc-400">Lädt…</li>}
            {links?.length === 0 && (
              <li className="text-xs text-zinc-400">Noch keine Links.</li>
            )}
            {links?.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-2 rounded border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-800"
              >
                <span className="flex-1 text-zinc-700 dark:text-zinc-300">
                  {roleLabel[link.role]}
                </span>
                <button
                  onClick={() => copyLink(link.token, link.id)}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {copiedId === link.id ? "Kopiert" : "Kopieren"}
                </button>
                <button
                  onClick={() => handleRevoke(link.id)}
                  className="text-zinc-400 hover:text-red-600"
                >
                  Widerrufen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
