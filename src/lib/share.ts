"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ShareRole } from "@/generated/prisma/enums";

async function requireOwner(nodeId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const node = await prisma.node.findFirst({
    where: { id: nodeId, ownerId: userId, deletedAt: null },
  });
  if (!node) throw new Error("Not found");
  return node;
}

export async function listShareLinks(nodeId: string) {
  await requireOwner(nodeId);
  return prisma.shareLink.findMany({
    where: { nodeId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
}

export async function createShareLink(nodeId: string, role: ShareRole) {
  await requireOwner(nodeId);
  const link = await prisma.shareLink.create({ data: { nodeId, role } });
  revalidatePath(`/board/${nodeId}`);
  return link;
}

export async function revokeShareLink(id: string, nodeId: string) {
  await requireOwner(nodeId);
  await prisma.shareLink.delete({ where: { id } });
  revalidatePath(`/board/${nodeId}`);
}
