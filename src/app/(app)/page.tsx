import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BoardOverview } from "@/components/BoardOverview";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return <BoardOverview email={session.user.email ?? ""} />;
}
