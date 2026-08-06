import "dotenv/config";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { TLSocketRoom } from "@tldraw/sync-core";
import {
  createTLSchema,
  defaultShapeSchemas,
  defaultBindingSchemas,
  defaultAssetSchemas,
} from "@tldraw/tlschema";
import type { TLRecord } from "@tldraw/tlschema";
import { boardLinkProps } from "../src/lib/board-link-schema";
import { prisma } from "../src/lib/prisma";

const PORT = Number(process.env.SYNC_SERVER_PORT ?? 5858);
const SAVE_DEBOUNCE_MS = 2000;

const schema = createTLSchema({
  shapes: { ...defaultShapeSchemas, "board-link": { props: boardLinkProps } },
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

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", async (socket: WebSocket, req) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const boardId = url.searchParams.get("boardId");
  const sessionId = url.searchParams.get("sessionId") ?? randomUUID();

  if (!boardId) {
    socket.close(1008, "missing boardId");
    return;
  }

  const room = await getOrCreateRoom(boardId);
  room.handleSocketConnect({ sessionId, socket });
});

console.log(`[sync] listening on ws://localhost:${PORT}`);

process.on("SIGINT", () => {
  wss.close();
  process.exit(0);
});
