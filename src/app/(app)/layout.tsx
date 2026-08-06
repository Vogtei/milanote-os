import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Sidebar } from "@/components/Sidebar";
import { SidebarToggle } from "@/components/SidebarToggle";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="flex h-dvh bg-[#17181c]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-[rgb(58,59,65)] bg-[rgba(34,35,40,0.84)] px-4 py-2 text-xs text-[rgb(156,153,143)]">
          <SidebarToggle />
          <span>{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button className="hover:text-[rgb(244,243,239)]">
              Abmelden
            </button>
          </form>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
