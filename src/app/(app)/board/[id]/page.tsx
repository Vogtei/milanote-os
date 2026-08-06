import Link from "next/link";
import { notFound } from "next/navigation";
import { getNode } from "@/lib/nodes";
import { BoardCanvas } from "@/components/BoardCanvas";

export default async function BoardPage(props: PageProps<"/board/[id]">) {
  const { id } = await props.params;

  const node = await getNode(id);
  if (!node || node.type !== "BOARD") notFound();

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
      </div>
      <div className="min-h-0 flex-1">
        <BoardCanvas id={id} />
      </div>
    </div>
  );
}
