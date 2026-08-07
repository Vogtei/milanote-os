"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { resolveBoardAccess, canComment } from "@/lib/access-core";
import { revalidatePath } from "next/cache";

export type Comment = {
  id: string;
  text: string;
  x: number | null;
  y: number | null;
  createdAt: string | Date;
  author: { name: string | null; email: string };
};

async function requireAccess(boardId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const cookieStore = await cookies();
  const shareToken = cookieStore.get(`share_${boardId}`)?.value ?? null;

  const access = await resolveBoardAccess(prisma, { nodeId: boardId, userId, shareToken });
  if (!access) throw new Error("Not found");
  return { userId, access };
}

export async function listComments(boardId: string) {
  const { access } = await requireAccess(boardId);
  return prisma.comment.findMany({
    where: { boardId: access.node.id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, email: true } } },
  });
}

/** x/y place the comment as a pin on the canvas — the tool that creates one
 *  always has a point (the click/drop location), so this is effectively
 *  required in practice even though the column stays nullable for the
 *  pre-pin comments already in the table. */
export async function createComment(boardId: string, text: string, x?: number, y?: number) {
  const { userId, access } = await requireAccess(boardId);
  if (!canComment(access.role)) throw new Error("Forbidden");

  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty comment");

  const comment = await prisma.comment.create({
    data: { boardId: access.node.id, authorId: userId, text: trimmed, x, y },
    include: { author: { select: { name: true, email: true } } },
  });
  revalidatePath(`/board/${boardId}`);
  return comment;
}
