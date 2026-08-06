import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { TLSocketRoom } from "@tldraw/sync-core";
import {
  createTLSchema,
  defaultShapeSchemas,
  defaultBindingSchemas,
  defaultAssetSchemas,
} from "@tldraw/tlschema";
import type { TLRecord } from "@tldraw/tlschema";
import { getIndexAbove } from "@tldraw/utils";
import { boardLinkProps } from "../src/lib/board-link-schema";
import { todoProps } from "../src/lib/todo-schema";
import { prisma } from "../src/lib/prisma";
import { resolveBoardAccess, canWrite } from "../src/lib/access-core";

const PORT = Number(process.env.SYNC_SERVER_PORT ?? 5858);
const SAVE_DEBOUNCE_MS = 2000;

const schema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    "board-link": { props: boardLinkProps },
    todo: { props: todoProps },
  },
  bindings: defaultBindingSchemas,
  assets: defaultAssetSchemas,
});

const rooms = new Map<string, TLSocketRoom<TLRecord>>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function loadInitialSnapshot(boardId: string) {
  const doc = await prisma.boardDoc.findUnique({ where: { nodeId: boardId } });
  if (!doc?.state) return undefined;
  try {
    return JSON.parse(Buffer.from(doc.state).toString("utf-8"));
  } catch {
    console.error(`[sync] failed to parse stored snapshot for board ${boardId}`);
    return undefined;
  }
}

function scheduleSave(boardId: string, room: TLSocketRoom<TLRecord>) {
  clearTimeout(saveTimers.get(boardId));
  saveTimers.set(
    boardId,
    setTimeout(async () => {
      const snapshot = room.getCurrentSnapshot();
      const state = Buffer.from(JSON.stringify(snapshot), "utf-8");
      await prisma.boardDoc.upsert({
        where: { nodeId: boardId },
        create: { nodeId: boardId, state },
        update: { state },
      });
    }, SAVE_DEBOUNCE_MS),
  );
}

async function getOrCreateRoom(boardId: string) {
  const existing = rooms.get(boardId);
  if (existing) return existing;

  const initialSnapshot = await loadInitialSnapshot(boardId);
  const room = new TLSocketRoom({
    schema,
    initialSnapshot,
    onCommittedChanges: () => scheduleSave(boardId, room),
  });
  rooms.set(boardId, room);
  return room;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

async function resolveSessionUserId(cookies: Record<string, string>) {
  const token = cookies["authjs.session-token"] ?? cookies["__Secure-authjs.session-token"];
  if (!token) return null;

  const session = await prisma.session.findUnique({ where: { sessionToken: token } });
  if (!session || session.expires < new Date()) return null;
  return session.userId;
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", async (socket: WebSocket, req) => {
  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const boardId = url.searchParams.get("boardId");
    const sessionId = url.searchParams.get("sessionId") ?? randomUUID();
    console.log(`[sync] connection attempt boardId=${boardId} cookieHeader=${req.headers.cookie ? "present" : "MISSING"}`);

    if (!boardId) {
      socket.close(1008, "missing boardId");
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const userId = await resolveSessionUserId(cookies);
    const shareToken = cookies[`share_${boardId}`] ?? null;
    console.log(`[sync] resolved userId=${userId} shareToken=${shareToken ? "present" : "none"}`);

    const access = await resolveBoardAccess(prisma, { nodeId: boardId, userId, shareToken });
    console.log(`[sync] access=${access ? access.role : "DENIED"}`);
    if (!access) {
      socket.close(4401, "unauthorized");
      return;
    }

    const room = await getOrCreateRoom(boardId);
    room.handleSocketConnect({ sessionId, socket, isReadonly: !canWrite(access.role) });
  } catch (err) {
    console.error("[sync] connection handler error", err);
    try {
      socket.close(1011, "internal error");
    } catch {}
  }
});

console.log(`[sync] listening on ws://localhost:${PORT}`);

// Internal-only endpoint so the Next.js /api/clip route (used by the browser
// clipper extension) can inject a shape into a *live* room. Writing to
// Postgres directly wouldn't reach connected viewers and would race with
// this room's own autosave, so the injection has to go through the room
// that's actually holding the current in-memory document.
const INTERNAL_PORT = Number(process.env.SYNC_INTERNAL_PORT ?? 5859);
const INTERNAL_SECRET = process.env.SYNC_INTERNAL_SECRET ?? "";

const internalServer = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/inject-shape") {
    res.writeHead(404).end();
    return;
  }
  if (!INTERNAL_SECRET || req.headers["x-internal-secret"] !== INTERNAL_SECRET) {
    res.writeHead(403).end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { boardId, shape } = JSON.parse(body);
      if (!boardId || !shape?.id || !shape?.type) {
        res.writeHead(400).end("missing boardId/shape");
        return;
      }

      const room = await getOrCreateRoom(boardId);
      await room.updateStore((store) => {
        const page = store.getAll().find((r) => r.typeName === "page");
        store.put({
          id: shape.id,
          typeName: "shape",
          type: shape.type,
          x: shape.x ?? 100,
          y: shape.y ?? 100,
          rotation: 0,
          index: getIndexAbove(),
          parentId: page?.id ?? "page:page",
          isLocked: false,
          opacity: 1,
          meta: {},
          props: shape.props,
        } as TLRecord);

        if (shape.asset) {
          store.put(shape.asset as TLRecord);
        }
      });

      // updateStore is a server-initiated change — onCommittedChanges only
      // fires for client pushes, so trigger the debounced save explicitly.
      scheduleSave(boardId, room);

      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("[sync] inject-shape failed", err);
      res.writeHead(500).end();
    }
  });
});

internalServer.listen(INTERNAL_PORT, "127.0.0.1", () => {
  console.log(`[sync] internal endpoint on http://127.0.0.1:${INTERNAL_PORT}`);
});

process.on("SIGINT", () => {
  wss.close();
  internalServer.close();
  process.exit(0);
});
