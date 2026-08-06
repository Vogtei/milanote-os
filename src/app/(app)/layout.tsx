import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Sidebar } from "@/components/Sidebar";
import { SidebarToggle } from "@/components/SidebarToggle";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
          <SidebarToggle />
          <span>{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Abmelden
            </button>
          </form>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
