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
      <div className="flex items-center gap-2 border-b border-[rgb(58,59,65)] bg-[rgba(34,35,40,0.84)] px-4 py-1.5 text-xs">
        <span className="h-3 w-3 flex-shrink-0 rounded-sm bg-[rgb(90,91,97)]" />
        <Link
          href={backHref}
          className="text-[rgb(156,153,143)] hover:text-[rgb(244,243,239)]"
        >
          {backLabel}
        </Link>
        <span className="text-[rgb(90,91,97)]">/</span>
        <span className="font-medium text-[rgb(200,198,192)]">{node.title}</span>
        {role !== "OWNER" && (
          <span className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[11px] text-[rgb(156,153,143)]">
            {role === "VIEW" ? "Nur ansehen" : role === "COMMENT" ? "Kommentieren" : "Bearbeiten"}
          </span>
        )}
      </div>
      <div className="relative flex items-center justify-center border-b border-[rgb(58,59,65)] bg-[rgba(34,35,40,0.84)] px-4 py-3">
        <h1 className="font-serif text-xl font-bold text-[rgb(244,243,239)]">{node.title}</h1>
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
