import Link from "next/link";
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-1.5 text-xs dark:border-zinc-800">
        <span className="h-3 w-3 flex-shrink-0 rounded-sm bg-zinc-200 dark:bg-zinc-700" />
        <Link
          href={backHref}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {backLabel}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{node.title}</span>
        {role !== "OWNER" && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {role === "VIEW" ? "Nur ansehen" : role === "COMMENT" ? "Kommentieren" : "Bearbeiten"}
          </span>
        )}
      </div>
      <div className="relative flex items-center justify-center border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-50">{node.title}</h1>
        {role === "OWNER" && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <ShareDialog nodeId={id} />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <BoardCanvas
          id={id}
          readonly={role === "VIEW" || role === "COMMENT"}
          canComment={role !== "VIEW"}
          userName={session.user.name || session.user.email || undefined}
        />
      </div>
    </div>
  );
}
