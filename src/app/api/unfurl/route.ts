import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { unfurlUrl } from "@/lib/unfurl";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const data = await unfurlUrl(rawUrl);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not unfurl URL" }, { status: 502 });
  }
}
