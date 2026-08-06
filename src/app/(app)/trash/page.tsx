import { listTrash, restoreNode } from "@/lib/nodes";
import { TopBar, WorkspaceCrumb, CrumbDivider, Crumb } from "@/components/vos/TopBar";
import { BoardIcon } from "@/components/icons/MilanoteIcons";

export default async function TrashPage() {
  const items = await listTrash();

  return (
    <div className="h-full overflow-y-auto">
      <TopBar>
        <WorkspaceCrumb label="Workspace" />
        <CrumbDivider />
        <Crumb label="Übersicht" href="/" />
        <span className="mx-1 text-[rgb(90,91,97)]">/</span>
        <Crumb label="Papierkorb" />
      </TopBar>

      <div className="mx-auto max-w-2xl px-6 pb-16 pt-[84px]">
      <h1 className="text-lg font-semibold text-[rgb(244,243,239)]">Papierkorb</h1>
      <p className="mt-1 text-sm text-[rgb(156,153,143)]">
        Gelöschte Boards. Wiederherstellen legt sie an ihren ursprünglichen Ort zurück — oder in
        die Übersicht, falls das übergeordnete Board ebenfalls gelöscht wurde.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-[rgb(120,118,112)]">Papierkorb ist leer.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-[rgb(58,59,65)] bg-[rgb(35,36,40)] px-3 py-2"
            >
              <span className="text-[rgb(120,118,112)]">
                <BoardIcon size={18} />
              </span>
              <span className="flex-1 text-sm text-[rgb(231,229,224)]">{item.title}</span>
              <span className="text-xs text-[rgb(120,118,112)]">
                {item.deletedAt?.toLocaleDateString("de-DE")}
              </span>
              <form
                action={async () => {
                  "use server";
                  await restoreNode(item.id);
                }}
              >
                <button
                  type="submit"
                  className="rounded border border-[rgb(58,59,65)] px-2 py-1 text-xs font-medium text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
                >
                  Wiederherstellen
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
