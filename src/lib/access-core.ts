// Pure, framework-agnostic access resolution — no "use server" here so it can
// be imported both from Next server actions/routes AND the standalone sync
// server (server/sync-server.ts), which isn't part of the Next runtime.
import type { PrismaClient } from "@/generated/prisma/client";

export type BoardRole = "OWNER" | "VIEW" | "COMMENT" | "EDIT";

export type BoardAccess = {
  node: { id: string; title: string; ownerId: string; parentId: string | null };
  role: BoardRole;
};

export async function resolveBoardAccess(
  prisma: PrismaClient,
  opts: { nodeId: string; userId: string | null | undefined; shareToken?: string | null },
): Promise<BoardAccess | null> {
  const node = await prisma.node.findFirst({
    where: { id: opts.nodeId, type: "BOARD", deletedAt: null },
    select: { id: true, title: true, ownerId: true, parentId: true },
  });
  if (!node) return null;

  if (opts.userId && node.ownerId === opts.userId) {
    return { node, role: "OWNER" };
  }

  if (opts.userId && opts.shareToken) {
    const link = await prisma.shareLink.findFirst({
      where: {
        token: opts.shareToken,
        nodeId: node.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (link) return { node, role: link.role };
  }

  return null;
}

export function canWrite(role: BoardRole) {
  return role === "OWNER" || role === "EDIT";
}

export function canComment(role: BoardRole) {
  return role === "OWNER" || role === "EDIT" || role === "COMMENT";
}
