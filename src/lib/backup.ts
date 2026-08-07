"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Doc } from "@/canvas/types";
import { readDoc, writeDoc } from "@/lib/board-doc-store";
import { NodeType } from "@/generated/prisma/enums";

// Stands in for "Ordner & Workspace"'s local-folder sync in the reference
// app: we're server/Postgres-backed, so there's no local folder to connect,
// but a portable JSON bundle of every board covers the same need (move
// account to another instance, restore after deleting the wrong thing).
const BACKUP_VERSION = 1;

type BackupNode = { id: string; title: string; parentId: string | null };
type Backup = {
  version: number;
  exportedAt: string;
  nodes: BackupNode[];
  docs: Record<string, Doc>;
};

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function exportAllBoards(): Promise<Backup> {
  const ownerId = await requireUserId();
  const nodes = await prisma.node.findMany({
    where: { ownerId, deletedAt: null, type: NodeType.BOARD },
    select: { id: true, title: true, parentId: true },
  });

  const docs: Record<string, Doc> = {};
  for (const node of nodes) {
    docs[node.id] = await readDoc(node.id);
  }

  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), nodes, docs };
}

/** Recreates every board under fresh ids, owned by the importing user —
 *  never overwrites existing data. Board-link items pointing at a nested
 *  board get their nodeId remapped too, so the imported tree stays wired
 *  together instead of pointing at whatever id happened to already exist. */
export async function importBoards(backup: Backup): Promise<{ imported: number }> {
  const ownerId = await requireUserId();
  if (!backup || backup.version !== BACKUP_VERSION || !Array.isArray(backup.nodes)) {
    throw new Error("Ungültiges Backup-Format");
  }

  const idMap = new Map<string, string>();
  const remaining = [...backup.nodes];
  let progressed = true;
  while (remaining.length && progressed) {
    progressed = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const node = remaining[i];
      if (node.parentId !== null && !idMap.has(node.parentId)) continue;
      const created = await prisma.node.create({
        data: {
          type: NodeType.BOARD,
          title: node.title,
          ownerId,
          parentId: node.parentId ? idMap.get(node.parentId)! : null,
        },
      });
      idMap.set(node.id, created.id);
      remaining.splice(i, 1);
      progressed = true;
    }
  }
  // Anything left has a parentId that was never in the bundle (corrupt
  // export) — drop it under the top level rather than losing it silently.
  for (const node of remaining) {
    const created = await prisma.node.create({
      data: { type: NodeType.BOARD, title: node.title, ownerId, parentId: null },
    });
    idMap.set(node.id, created.id);
  }

  for (const [oldId, newId] of idMap) {
    const doc = backup.docs?.[oldId];
    if (!doc) continue;
    const items = { ...doc.items };
    for (const [itemId, item] of Object.entries(items)) {
      if (item.type === "board" && item.props.nodeId && idMap.has(item.props.nodeId)) {
        items[itemId] = { ...item, props: { ...item.props, nodeId: idMap.get(item.props.nodeId)! } };
      }
    }
    await writeDoc(newId, { ...doc, items });
  }

  revalidatePath("/");
  return { imported: idMap.size };
}
