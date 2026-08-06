import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { uploadFile } from "@/lib/storage";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 8) return fromName.toLowerCase();
  const fromType = file.type.split("/").pop();
  return fromType?.toLowerCase() || "bin";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${randomUUID()}.${extensionFor(file)}`;

  try {
    const src = await uploadFile(key, buffer, file.type || "application/octet-stream");
    return NextResponse.json({ src });
  } catch (err) {
    console.error("[upload] failed", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
}
