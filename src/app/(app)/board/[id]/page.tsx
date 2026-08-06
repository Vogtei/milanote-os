import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBoardAccess } from "@/lib/access-core";
import { getNode } from "@/lib/nodes";
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

  // Full-bleed canvas: breadcrumbs, tools, zoom and selection controls all
  // float over it as their own panels, so the board is never squeezed by a
  // header or a sidebar.
  return (
    <BoardShell
      boardId={id}
      initialDoc={doc}
      readonly={role === "VIEW" || role === "COMMENT"}
      canComment={role !== "VIEW"}
      chrome={{
        title: node.title,
        parentHref: parent?.type === "BOARD" ? `/board/${parent.id}` : "/",
        parentLabel: parent ? parent.title : "Übersicht",
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
