"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canWrite, resolveBoardAccess } from "@/lib/access-core";
import type { Doc } from "@/canvas/types";
import { readDoc, writeDoc } from "@/lib/board-doc-store";

// Auth/access-control wrapper around board-doc-store.ts, which owns the
// actual storage format (and every migration on top of it) so there's one
// definition shared with the clipper's route handler — not two copies of the
// same parsing logic silently drifting apart.

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
  return readDoc(nodeId);
}

export async function saveBoardDoc(nodeId: string, doc: Doc): Promise<void> {
  await requireAccess(nodeId, true);
  await writeDoc(nodeId, doc);
}
