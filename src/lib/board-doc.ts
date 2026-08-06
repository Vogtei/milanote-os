"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canWrite, resolveBoardAccess } from "@/lib/access-core";
import type { Doc } from "@/canvas/types";
import { emptyDoc } from "@/canvas/types";
import { looksLikeTldrawSnapshot, migrateTldrawSnapshot } from "@/canvas/migrate-tldraw";

// BoardDoc.state is a Bytes column that used to hold a tldraw room snapshot.
// It now holds this envelope. The version tag is what lets loadBoardDoc tell
// the two apart without guessing at the payload's shape.
const DOC_VERSION = 2;

type Envelope = { v: number; doc: Doc };

async function requireAccess(nodeId: string, write: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cookieStore = await cookies();
  const shareToken = cookieStore.get(`share_${nodeId}`)?.value ?? null;

  const access = await resolveBoardAccess(prisma, {
    nodeId,
    userId: session.user.id,
    shareToken,
  });
  if (!access) throw new Error("Not found");
  if (write && !canWrite(access.role)) throw new Error("Forbidden");
  return access;
}

export async function loadBoardDoc(nodeId: string): Promise<Doc> {
  await requireAccess(nodeId, false);

  const record = await prisma.boardDoc.findUnique({ where: { nodeId } });
  if (!record?.state) return emptyDoc();

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(record.state).toString("utf-8"));
  } catch {
    console.error(`[board-doc] unparseable state for board ${nodeId}`);
    return emptyDoc();
  }

  if (typeof parsed === "object" && parsed !== null && (parsed as Envelope).v === DOC_VERSION) {
    return (parsed as Envelope).doc;
  }

  // Pre-swap board: convert on read. The new format is written back on the
  // next save, so this path runs at most once per board in practice — but it
  // stays in place, because a board nobody edits is never rewritten.
  if (looksLikeTldrawSnapshot(parsed)) return migrateTldrawSnapshot(parsed);

  return emptyDoc();
}

export async function saveBoardDoc(nodeId: string, doc: Doc): Promise<void> {
  await requireAccess(nodeId, true);

  const envelope: Envelope = { v: DOC_VERSION, doc };
  const state = Buffer.from(JSON.stringify(envelope), "utf-8");

  await prisma.boardDoc.upsert({
    where: { nodeId },
    create: { nodeId, state },
    update: { state },
  });
}
