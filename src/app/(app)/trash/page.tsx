import { listTrash, restoreNode } from "@/lib/nodes";

export default async function TrashPage() {
  const items = await listTrash();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Papierkorb</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Gelöschte Boards. Wiederherstellen legt sie an ihren ursprünglichen Ort zurück — oder in
        die Übersicht, falls das übergeordnete Board ebenfalls gelöscht wurde.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-400">Papierkorb ist leer.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span>🗒️</span>
              <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{item.title}</span>
              <span className="text-xs text-zinc-400">
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
                  className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
