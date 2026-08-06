import { listTrash, restoreNode } from "@/lib/nodes";

export default async function TrashPage() {
  const items = await listTrash();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
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
              className="flex items-center gap-3 rounded-md border border-[rgb(58,59,65)] px-3 py-2"
            >
              <span>🗒️</span>
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
  );
}
