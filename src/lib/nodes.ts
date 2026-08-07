"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { NodeType } from "@/generated/prisma/enums";

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function listChildren(parentId: string | null) {
  const ownerId = await requireUserId();
  return prisma.node.findMany({
    where: { ownerId, parentId, deletedAt: null },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
}

/** Root-first ancestor chain for the breadcrumb trail — walks parentId up
 *  one lean lookup at a time rather than a recursive query, since board
 *  nesting in practice runs a handful of levels deep. The depth cap is only
 *  a guard against a corrupt/cyclic parentId chain, not a real limit. */
export async function getAncestors(parentId: string | null): Promise<{ id: string; title: string }[]> {
  const ownerId = await requireUserId();
  const chain: { id: string; title: string }[] = [];
  let current = parentId;
  for (let i = 0; i < 50 && current; i++) {
    const node = await prisma.node.findFirst({
      where: { id: current, ownerId, deletedAt: null },
      select: { id: true, title: true, parentId: true },
    });
    if (!node) break;
    chain.push({ id: node.id, title: node.title });
    current = node.parentId;
  }
  return chain.reverse();
}

export async function getNode(id: string) {
  const ownerId = await requireUserId();
  return prisma.node.findFirst({
    where: { id, ownerId, deletedAt: null },
  });
}

export async function createNode(
  type: NodeType,
  title: string,
  parentId: string | null,
) {
  const ownerId = await requireUserId();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title required");

  if (parentId) {
    // ownership check — refuse to nest under a node the caller doesn't own
    const parent = await prisma.node.findFirst({
      where: { id: parentId, ownerId, deletedAt: null },
    });
    if (!parent) throw new Error("Parent not found");
  }

  const node = await prisma.node.create({
    data: { type, title: trimmed, parentId, ownerId },
  });

  revalidatePath("/");
  if (parentId) revalidatePath(`/board/${parentId}`);
  return node;
}

export async function renameNode(id: string, title: string) {
  const ownerId = await requireUserId();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title required");

  const node = await prisma.node.findFirst({ where: { id, ownerId, deletedAt: null } });
  if (!node) throw new Error("Not found");

  await prisma.node.update({ where: { id }, data: { title: trimmed } });

  revalidatePath("/");
  revalidatePath(`/board/${id}`);
  if (node.parentId) revalidatePath(`/board/${node.parentId}`);
}

export async function deleteNode(id: string) {
  const ownerId = await requireUserId();
  const node = await prisma.node.findFirst({
    where: { id, ownerId, deletedAt: null },
  });
  if (!node) throw new Error("Not found");

  const childCount = await prisma.node.count({
    where: { parentId: id, deletedAt: null },
  });
  if (childCount > 0) {
    throw new Error("Cannot delete a folder or board that still has children");
  }

  await prisma.node.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/");
  if (node.parentId) revalidatePath(`/board/${node.parentId}`);
}

export async function listTrash() {
  const ownerId = await requireUserId();
  return prisma.node.findMany({
    where: { ownerId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });
}

export async function restoreNode(id: string) {
  const ownerId = await requireUserId();
  const node = await prisma.node.findFirst({
    where: { id, ownerId, NOT: { deletedAt: null } },
  });
  if (!node) throw new Error("Not found");

  // If the parent is gone or also deleted, restore to the top level instead
  // of leaving the node reachable only by direct link.
  let parentId = node.parentId;
  if (parentId) {
    const parent = await prisma.node.findFirst({
      where: { id: parentId, ownerId, deletedAt: null },
    });
    if (!parent) parentId = null;
  }

  await prisma.node.update({
    where: { id },
    data: { deletedAt: null, parentId },
  });

  revalidatePath("/");
  revalidatePath("/trash");
}
