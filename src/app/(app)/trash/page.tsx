import { listTrash, restoreNode } from "@/lib/nodes";
import { TopBar, WorkspaceCrumb, CrumbDivider, Crumb } from "@/components/vos/TopBar";
import { BoardIcon } from "@/components/icons/ContentIcons";

export default async function TrashPage() {
  const items = await listTrash();

  return (
    <div className="h-full overflow-y-auto">
      <TopBar>
        <WorkspaceCrumb label="Workspace" />
        <CrumbDivider />
        <Crumb label="Übersicht" href="/" />
        <span className="mx-1 text-[var(--vos-faint)]">/</span>
        <Crumb label="Papierkorb" />
      </TopBar>

      <div className="mx-auto max-w-2xl px-6 pb-16 pt-[84px]">
      <h1 className="text-lg font-semibold text-[var(--vos-text-strong)]">Papierkorb</h1>
      <p className="mt-1 text-sm text-[var(--vos-muted)]">
        Gelöschte Boards. Wiederherstellen legt sie an ihren ursprünglichen Ort zurück — oder in
        die Übersicht, falls das übergeordnete Board ebenfalls gelöscht wurde.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--vos-faint)]">Papierkorb ist leer.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--vos-border)] bg-[var(--vos-panel-solid)] px-3 py-2"
            >
              <span className="text-[var(--vos-faint)]">
                <BoardIcon size={18} />
              </span>
              <span className="flex-1 text-sm text-[var(--vos-text)]">{item.title}</span>
              <span className="text-xs text-[var(--vos-faint)]">
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
                  className="rounded border border-[var(--vos-border)] px-2 py-1 text-xs font-medium text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
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
