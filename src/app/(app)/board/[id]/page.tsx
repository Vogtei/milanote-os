import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBoardAccess } from "@/lib/access-core";
import { getNode, listChildren } from "@/lib/nodes";
import { loadBoardDoc } from "@/lib/board-doc";
import { BoardShell } from "@/components/canvas/BoardShell";
import { ShareDialog } from "@/components/ShareDialog";

export default async function BoardPage(props: PageProps<"/board/[id]">) {
  const { id } = await props.params;

  const session = await auth();
  if (!session?.user) redirect("/signin");

  const cookieStore = await cookies();
  const shareToken = cookieStore.get(`share_${id}`)?.value ?? null;

  const access = await resolveBoardAccess(prisma, {
    nodeId: id,
    userId: session.user.id,
    shareToken,
  });
  if (!access) notFound();

  const { node, role } = access;
  const parent = node.parentId ? await getNode(node.parentId) : null;
  const doc = await loadBoardDoc(id);

  // Powers the board-switcher dropdown in the header — other boards the user
  // can jump to sideways without going back to the overview first.
  const children = await listChildren(node.parentId);
  const siblings = children
    .filter((child) => child.type === "BOARD" && child.id !== node.id)
    .map((child) => ({ id: child.id, title: child.title }));

  // Folder cards show how much is inside them. The canvas can't know that, and
  // storing the number on the card would go stale the moment the other board
  // changes — so it's resolved here, fresh on every load.
  const nested = Object.values(doc.items)
    .filter((item) => item.type === "board")
    .map((item) => (item as { props: { nodeId: string } }).props.nodeId)
    .filter(Boolean);
  const counts = nested.length
    ? await prisma.node.groupBy({
        by: ["parentId"],
        where: { parentId: { in: nested }, deletedAt: null },
        _count: { _all: true },
      })
    : [];
  const boardCounts = Object.fromEntries(
    counts.map((row) => [row.parentId as string, row._count._all]),
  );

  // Full-bleed canvas: breadcrumbs, tools, zoom and selection controls all
  // float over it as their own panels, so the board is never squeezed by a
  // header or a sidebar.
  return (
    <BoardShell
      boardId={id}
      initialDoc={doc}
      boardCounts={boardCounts}
      readonly={role === "VIEW" || role === "COMMENT"}
      canComment={role !== "VIEW"}
      chrome={{
        title: node.title,
        parentHref: parent?.type === "BOARD" ? `/board/${parent.id}` : "/",
        parentLabel: parent ? parent.title : "Übersicht",
        siblings,
        roleLabel:
          role === "OWNER"
            ? null
            : role === "VIEW"
              ? "Nur ansehen"
              : role === "COMMENT"
                ? "Kommentieren"
                : "Bearbeiten",
        share: role === "OWNER" ? <ShareDialog nodeId={id} /> : null,
      }}
    />
  );
}
