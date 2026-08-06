import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBoardAccess } from "@/lib/access-core";
import { getNode } from "@/lib/nodes";
import { BoardCanvas } from "@/components/BoardCanvas";
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
  const backHref = parent?.type === "BOARD" ? `/board/${parent.id}` : "/";
  const backLabel = parent ? parent.title : "Übersicht";

  // Full-bleed canvas: every piece of chrome (breadcrumbs, actions, tool rail,
  // zoom) floats over it as its own panel, so the board itself never gets
  // squeezed by a header or a sidebar.
  return (
    <BoardCanvas
      id={id}
      readonly={role === "VIEW" || role === "COMMENT"}
      canComment={role !== "VIEW"}
      userName={session.user.name || session.user.email || undefined}
      chrome={{
        title: node.title,
        parentHref: backHref,
        parentLabel: backLabel,
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
