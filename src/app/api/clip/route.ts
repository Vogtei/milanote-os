import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBoardAccess, canWrite } from "@/lib/access-core";
import { unfurlUrl } from "@/lib/unfurl";
import { uploadFile } from "@/lib/storage";
import { assertPublicUrl } from "@/lib/ssrf-guard";
import { readDoc, writeDoc } from "@/lib/board-doc-store";
import { itemBounds, unionBounds } from "@/canvas/geometry";
import type { AnyItem } from "@/canvas/types";
import { DEFAULT_SIZES } from "@/canvas/types";

type ClipBody =
  | { boardId: string; kind: "text"; text: string }
  | { boardId: string; kind: "link"; url: string }
  | { boardId: string; kind: "image"; imageUrl: string };

/**
 * Used by the browser-clipper extension. Appends the clipped content to the
 * board's stored document.
 *
 * Until the multiplayer server is rebuilt there is no live room to push into,
 * so a board that's currently open won't show the clip until it's reloaded.
 * Writing straight to storage is the honest version of that — the previous
 * live-injection path went through the tldraw sync server, which is gone.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as ClipBody;

  const access = await resolveBoardAccess(prisma, {
    nodeId: body.boardId,
    userId: session.user.id,
    shareToken: null,
  });
  if (!access || !canWrite(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await readDoc(body.boardId);

  // Drop the clip below whatever is already on the board so repeated clips
  // stack downwards instead of piling up on top of each other.
  const existing = Object.values(doc.items);
  const bounds = existing.length > 0 ? unionBounds(existing.map(itemBounds)) : null;
  const at = bounds ? { x: bounds.x, y: bounds.y + bounds.h + 32 } : { x: 0, y: 0 };

  let item: AnyItem;

  try {
    if (body.kind === "text") {
      const text = body.text.trim().slice(0, 4000);
      if (!text) return NextResponse.json({ error: "Empty text" }, { status: 400 });
      item = {
        id: randomUUID(),
        type: "note",
        ...at,
        ...DEFAULT_SIZES.note,
        rotation: 0,
        props: { text, color: "yellow" },
      };
    } else if (body.kind === "link") {
      const url = body.url;
      if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
      const data = await unfurlUrl(url).catch(() => null);
      item = {
        id: randomUUID(),
        type: "link",
        ...at,
        ...DEFAULT_SIZES.link,
        rotation: 0,
        props: {
          url,
          title: data?.title ?? url,
          description: data?.description ?? "",
          image: data?.image ?? "",
          favicon: data?.favicon ?? "",
        },
      };
    } else if (body.kind === "image") {
      const imageUrl = body.imageUrl;
      if (!imageUrl) return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });

      const parsed = new URL(imageUrl);
      await assertPublicUrl(parsed);

      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return NextResponse.json({ error: "Could not fetch image" }, { status: 502 });
      const contentType = res.headers.get("content-type") || "image/png";
      if (!contentType.startsWith("image/")) {
        return NextResponse.json({ error: "Not an image" }, { status: 400 });
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Image too large" }, { status: 413 });
      }
      const ext = contentType.split("/")[1]?.split(";")[0] || "png";
      const key = `${randomUUID()}.${ext}`;
      const src = await uploadFile(key, buffer, contentType);

      item = {
        id: randomUUID(),
        type: "image",
        ...at,
        ...DEFAULT_SIZES.image,
        rotation: 0,
        props: { src, alt: "" },
      };
    } else {
      return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
    }
  } catch (err) {
    console.error("[clip] failed to build item", err);
    return NextResponse.json({ error: "Could not process clip" }, { status: 502 });
  }

  doc.items[item.id] = item;
  doc.order.push(item.id);
  await writeDoc(body.boardId, doc);

  return NextResponse.json({ ok: true });
}
