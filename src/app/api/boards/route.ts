import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Used by the browser-clipper extension's board picker. Extension background
// scripts fetch this with credentials:'include', reusing the same session
// cookie as the web app — no separate extension auth flow needed.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nodes = await prisma.node.findMany({
    where: { ownerId: session.user.id, deletedAt: null },
    select: { id: true, type: true, title: true, parentId: true },
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  function pathFor(node: (typeof nodes)[number]): string {
    const parts: string[] = [];
    let current = node.parentId ? byId.get(node.parentId) : undefined;
    while (current) {
      parts.unshift(current.title);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return parts.join(" / ");
  }

  const boards = nodes
    .filter((n) => n.type === "BOARD")
    .map((n) => ({ id: n.id, title: n.title, path: pathFor(n) }))
    .sort((a, b) => (a.path + a.title).localeCompare(b.path + b.title));

  return NextResponse.json({ boards });
}
