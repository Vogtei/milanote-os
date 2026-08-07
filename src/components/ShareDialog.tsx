"use client";

import { useEffect, useState, useTransition } from "react";
import { createShareLink, listShareLinks, revokeShareLink } from "@/lib/share";
import { ShareRole } from "@/generated/prisma/enums";
import { IconBtn } from "@/components/vos/IconBtn";
import { ShareIcon } from "@/components/icons/VosIcons";
import { useClickAway } from "@/components/useClickAway";

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
  const ref = useClickAway(open, () => setOpen(false));

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
    <div ref={ref} className="relative">
      <IconBtn label="Teilen" active={open} onClick={() => setOpen((v) => !v)}>
        <ShareIcon />
      </IconBtn>

      {open && (
        <div className="vos-panel vos-panel-shadow absolute right-0 top-[42px] z-[400] w-80 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Link["role"])}
              className="flex-1 rounded border border-[var(--vos-border)] bg-[var(--vos-bg)] px-2 py-1 text-xs text-[var(--vos-text)]"
            >
              <option value="VIEW">Nur ansehen</option>
              <option value="COMMENT">Kommentieren</option>
              <option value="EDIT">Bearbeiten</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="rounded bg-[var(--vos-text-strong)] px-2.5 py-1 text-xs font-medium text-[var(--vos-bg)] disabled:opacity-40"
            >
              Link erstellen
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-1.5">
            {links === null && <li className="text-xs text-[var(--vos-faint)]">Lädt…</li>}
            {links?.length === 0 && (
              <li className="text-xs text-[var(--vos-faint)]">Noch keine Links.</li>
            )}
            {links?.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-2 rounded border border-[var(--vos-border)] px-2 py-1.5 text-xs"
              >
                <span className="flex-1 text-[var(--vos-text)]">
                  {roleLabel[link.role]}
                </span>
                <button
                  onClick={() => copyLink(link.token, link.id)}
                  className="text-[var(--vos-muted)] hover:text-[var(--vos-text-strong)]"
                >
                  {copiedId === link.id ? "Kopiert" : "Kopieren"}
                </button>
                <button
                  onClick={() => handleRevoke(link.id)}
                  className="text-[var(--vos-faint)] hover:text-red-400"
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
