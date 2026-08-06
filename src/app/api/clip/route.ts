import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBoardAccess, canWrite } from "@/lib/access-core";
import { unfurlUrl } from "@/lib/unfurl";
import { uploadFile } from "@/lib/storage";
import { assertPublicUrl } from "@/lib/ssrf-guard";
import { createShapeId, AssetRecordType, toRichText } from "@tldraw/tlschema";

const INTERNAL_URL = `http://127.0.0.1:${process.env.SYNC_INTERNAL_PORT ?? 5859}/inject-shape`;
const INTERNAL_SECRET = process.env.SYNC_INTERNAL_SECRET ?? "";

type ClipBody =
  | { boardId: string; kind: "text"; text: string }
  | { boardId: string; kind: "link"; url: string }
  | { boardId: string; kind: "image"; imageUrl: string };

// Used by the browser-clipper extension. Builds the tldraw record(s) for the
// clipped content, then hands them to the sync server's internal endpoint so
// they land in the *live* room (not just Postgres) and broadcast to anyone
// viewing the board.
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

  let shape: Record<string, unknown>;

  try {
    if (body.kind === "text") {
      const text = body.text.trim().slice(0, 4000);
      if (!text) return NextResponse.json({ error: "Empty text" }, { status: 400 });

      shape = {
        id: createShapeId(),
        type: "note",
        x: 100,
        y: 100,
        props: {
          color: "yellow",
          labelColor: "black",
          size: "m",
          font: "draw",
          fontSizeAdjustment: null,
          align: "middle",
          verticalAlign: "middle",
          growY: 0,
          url: "",
          richText: toRichText(text),
          scale: 1,
          textLastEditedBy: null,
        },
      };
    } else if (body.kind === "link") {
      const url = body.url;
      if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
      const data = await unfurlUrl(url).catch(() => null);
      const assetId = AssetRecordType.createId();

      shape = {
        id: createShapeId(),
        type: "bookmark",
        x: 100,
        y: 100,
        props: { w: 300, h: 320, assetId, url },
        asset: {
          id: assetId,
          typeName: "asset",
          type: "bookmark",
          meta: {},
          props: {
            src: url,
            title: data?.title ?? url,
            description: data?.description ?? "",
            image: data?.image ?? "",
            favicon: data?.favicon ?? "",
          },
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
      const assetId = AssetRecordType.createId();

      shape = {
        id: createShapeId(),
        type: "image",
        x: 100,
        y: 100,
        props: {
          w: 300,
          h: 200,
          playing: true,
          url: "",
          assetId,
          crop: null,
          flipX: false,
          flipY: false,
          altText: "",
        },
        asset: {
          id: assetId,
          typeName: "asset",
          type: "image",
          meta: {},
          props: {
            w: 300,
            h: 200,
            name: key,
            isAnimated: false,
            mimeType: contentType,
            src,
          },
        },
      };
    } else {
      return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
    }
  } catch (err) {
    console.error("[clip] failed to build shape", err);
    return NextResponse.json({ error: "Could not process clip" }, { status: 502 });
  }

  const injectRes = await fetch(INTERNAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ boardId: body.boardId, shape }),
  });
  if (!injectRes.ok) {
    return NextResponse.json({ error: "Failed to save to board" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
