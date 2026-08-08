import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// No chrome here on purpose: each page draws its own floating topbar over a
// full-bleed surface (see BoardTopBar / OverviewTopBar), so the layout is
// nothing but the dark ground everything sits on.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  // A user who arrived here via a magic-link click (first-time activation,
  // or "Passwort vergessen?") is already fully signed in — this is the one
  // gate that sends them to set a password before using the app, so they
  // don't have to repeat the email round-trip on every future visit. See
  // src/lib/password-auth.ts.
  if (session.user.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });
    if (!user?.password) redirect("/signin/set-password");
  }

  return <div className="relative h-dvh overflow-hidden bg-[var(--vos-bg)]">{children}</div>;
}
