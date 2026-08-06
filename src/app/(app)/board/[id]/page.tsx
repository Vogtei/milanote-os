import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBoardAccess } from "@/lib/access-core";
import { getNode } from "@/lib/nodes";
import { BoardCanvas } from "@/components/BoardCanvas";
import { ShareDialog } from "@/components/ShareDialog";
import { CommentsPanel } from "@/components/CommentsPanel";

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
        <Link
          href={backHref}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← {backLabel}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="font-medium text-zinc-900 dark:text-zinc-50">
          {node.title}
        </span>
        {role !== "OWNER" && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {role === "VIEW" ? "Nur ansehen" : role === "COMMENT" ? "Kommentieren" : "Bearbeiten"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <CommentsPanel boardId={id} canPost={role !== "VIEW"} />
          {role === "OWNER" && <ShareDialog nodeId={id} />}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <BoardCanvas
          id={id}
          readonly={role === "VIEW" || role === "COMMENT"}
          userName={session.user.name || session.user.email || undefined}
        />
      </div>
    </div>
  );
}
