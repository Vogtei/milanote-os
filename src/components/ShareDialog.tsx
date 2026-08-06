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
        className="rounded-md border border-[rgb(58,59,65)] px-2.5 py-1 text-xs font-medium text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
      >
        Teilen
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-[400] w-80 rounded-md border border-[rgb(58,59,65)] bg-[#202127] p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Link["role"])}
              className="flex-1 rounded border border-[rgb(58,59,65)] bg-[#17181c] px-2 py-1 text-xs text-[rgb(231,229,224)]"
            >
              <option value="VIEW">Nur ansehen</option>
              <option value="COMMENT">Kommentieren</option>
              <option value="EDIT">Bearbeiten</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="rounded bg-[rgb(244,243,239)] px-2.5 py-1 text-xs font-medium text-[#17181c] disabled:opacity-40"
            >
              Link erstellen
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-1.5">
            {links === null && <li className="text-xs text-[rgb(120,118,112)]">Lädt…</li>}
            {links?.length === 0 && (
              <li className="text-xs text-[rgb(120,118,112)]">Noch keine Links.</li>
            )}
            {links?.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-2 rounded border border-[rgb(58,59,65)] px-2 py-1.5 text-xs"
              >
                <span className="flex-1 text-[rgb(200,198,192)]">
                  {roleLabel[link.role]}
                </span>
                <button
                  onClick={() => copyLink(link.token, link.id)}
                  className="text-[rgb(156,153,143)] hover:text-[rgb(244,243,239)]"
                >
                  {copiedId === link.id ? "Kopiert" : "Kopieren"}
                </button>
                <button
                  onClick={() => handleRevoke(link.id)}
                  className="text-[rgb(120,118,112)] hover:text-red-400"
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
