import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user) {
    const callbackUrl = `/share/${token}`;
    return NextResponse.redirect(
      new URL(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.url),
    );
  }

  const link = await prisma.shareLink.findFirst({
    where: { token, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });
  if (!link) {
    return NextResponse.redirect(new URL("/?shareError=invalid", req.url));
  }

  const res = NextResponse.redirect(new URL(`/board/${link.nodeId}`, req.url));
  res.cookies.set(`share_${link.nodeId}`, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
