import { prisma } from "@/lib/prisma";
import type { Doc } from "@/canvas/types";
import { emptyDoc } from "@/canvas/types";
import { looksLikeTldrawSnapshot, migrateTldrawSnapshot } from "@/canvas/migrate-tldraw";

// Storage only — no auth, no request context. Callers are responsible for
// access control, which lets both the server actions and the clipper's route
// handler share one definition of how a board is persisted.
//
// BoardDoc.state is a Bytes column that used to hold a tldraw room snapshot;
// it now holds this envelope, and the version tag is what lets readDoc tell
// the two apart without guessing at the payload's shape.
const DOC_VERSION = 2;

type Envelope = { v: number; doc: Doc };

export async function readDoc(nodeId: string): Promise<Doc> {
  const record = await prisma.boardDoc.findUnique({ where: { nodeId } });
  if (!record?.state) return emptyDoc();

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(record.state).toString("utf-8"));
  } catch {
    console.error(`[board-doc] unparseable state for board ${nodeId}`);
    return emptyDoc();
  }

  if (typeof parsed === "object" && parsed !== null && (parsed as Envelope).v === DOC_VERSION) {
    return (parsed as Envelope).doc;
  }

  // Pre-swap board: convert on read. The new format is written back on the
  // next save, so this runs at most once per board that's still being edited —
  // but it stays in place, because a board nobody touches is never rewritten.
  if (looksLikeTldrawSnapshot(parsed)) return migrateTldrawSnapshot(parsed);

  return emptyDoc();
}

export async function writeDoc(nodeId: string, doc: Doc): Promise<void> {
  const envelope: Envelope = { v: DOC_VERSION, doc };
  const state = Buffer.from(JSON.stringify(envelope), "utf-8");
  await prisma.boardDoc.upsert({
    where: { nodeId },
    create: { nodeId, state },
    update: { state },
  });
}
