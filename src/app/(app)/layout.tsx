import { redirect } from "next/navigation";
import { auth } from "@/auth";

// No chrome here on purpose: each page draws its own floating topbar over a
// full-bleed surface (see BoardTopBar / OverviewTopBar), so the layout is
// nothing but the dark ground everything sits on.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return <div className="relative h-dvh overflow-hidden bg-[var(--vos-bg)]">{children}</div>;
}
