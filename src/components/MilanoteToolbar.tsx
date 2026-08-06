"use client";

import { createContext, useContext, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, useValue } from "tldraw";
import {
  NoteIcon,
  LinkIcon,
  TodoIcon,
  LineIcon,
  BoardIcon,
  ColumnIcon,
  CommentIcon,
  MoreIcon,
  ImageIcon,
  UploadIcon,
  DrawIcon,
  TrashIcon,
} from "@/components/icons/MilanoteIcons";
import { uploadRawFile } from "@/lib/asset-store";

// Drag-and-drop mirrors real Milanote: dragging a rail icon onto the canvas
// creates the element at the drop point instead of requiring arm-then-click.
// See BoardCanvas.tsx's onDrop for the receiving side.
export const DRAG_MIME = "application/x-milanote-tool";

// Actions that need data owned by BoardCanvas (current board id, comments
// panel state) but must be triggered from MilanoteToolbar — which tldraw
// renders itself with no props (components={{ Toolbar: MilanoteToolbar }}),
// so a React context is the only way to bridge the two.
export const MilanoteRailContext = createContext<{
  createBoard: (title: string) => Promise<void>;
  toggleComments: () => void;
} | null>(null);

const MORE_TOOLS = [
  { id: "select", label: "Auswählen" },
  { id: "hand", label: "Hand" },
  { id: "eraser", label: "Radierer" },
  { id: "text", label: "Text" },
  { id: "geo", label: "Form" },
] as const;

export function MilanoteToolbar() {
  const editor = useEditor();
  const rail = useContext(MilanoteRailContext);
  const activeToolId = useValue("current tool id", () => editor.getCurrentToolId(), [editor]);
  const isReadonly = useValue("is readonly", () => editor.getIsReadonly(), [editor]);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardTitle, setBoardTitle] = useState("");
  const [boardPending, setBoardPending] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function centerPoint() {
    return editor.getViewportPageBounds().center;
  }

  function submitLink(e: React.FormEvent) {
    e.preventDefault();
    const url = linkValue.trim();
    if (!url) return;
    editor.putExternalContent({ type: "url", url, point: centerPoint() });
    setLinkValue("");
    setLinkOpen(false);
  }

  async function submitBoard(e: React.FormEvent) {
    e.preventDefault();
    const title = boardTitle.trim();
    if (!title || !rail) return;
    setBoardPending(true);
    try {
      await rail.createBoard(title);
      setBoardTitle("");
      setBoardOpen(false);
    } finally {
      setBoardPending(false);
    }
  }

  function insertTodo() {
    editor.createShape({
      type: "todo",
      x: centerPoint().x - 110,
      y: centerPoint().y - 90,
      props: { w: 220, h: 180, title: "Todo", items: [{ id: crypto.randomUUID(), text: "", done: false }] },
    });
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await editor.putExternalContent({ type: "files", files: [file], point: centerPoint() });
  }

  async function handleUploadPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { src } = await uploadRawFile(file);
      const point = centerPoint();
      editor.createShape({
        type: "file",
        x: point.x - 110,
        y: point.y - 32,
        props: { w: 220, h: 64, name: file.name, size: file.size, src },
      });
    } catch (err) {
      console.error("[upload] failed", err);
    }
  }

  // Viewers/commenters get no creation tools, matching the rest of the app's
  // readonly-board behavior (top-right buttons are hidden the same way).
  if (isReadonly) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 76,
        zIndex: 300,
        pointerEvents: "all",
        background: "rgba(34,35,40,0.84)",
        borderRight: "1px solid rgb(58,59,65)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 12,
        gap: 2,
        overflowY: "auto",
      }}
    >
      <RailButton
        icon={<NoteIcon />}
        label="Note"
        active={activeToolId === "note"}
        dragToolId="note"
        onClick={() => editor.setCurrentTool("note")}
      />

      <div style={{ position: "relative" }}>
        <RailButton icon={<LinkIcon />} label="Link" active={linkOpen} dragToolId="link" onClick={() => setLinkOpen((v) => !v)} />
        {linkOpen && (
          <form
            onSubmit={submitLink}
            style={{
              position: "absolute",
              left: 68,
              top: 0,
              zIndex: 400,
              display: "flex",
              gap: 4,
              background: "#202127",
              border: "1px solid rgb(58,59,65)",
              borderRadius: 6,
              padding: 4,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <input
              autoFocus
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setLinkOpen(false)}
              placeholder="https://…"
              style={{
                width: 200,
                fontSize: 12,
                padding: "5px 7px",
                border: "1px solid rgb(58,59,65)",
                borderRadius: 4,
                outline: "none",
                background: "#17181c",
                color: "rgb(231,229,224)",
              }}
            />
            <button
              type="submit"
              style={{ fontSize: 12, fontWeight: 600, padding: "0 10px", borderRadius: 4, background: "#18181b", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Einfügen
            </button>
          </form>
        )}
      </div>

      <RailButton icon={<TodoIcon />} label="To-do" dragToolId="todo" onClick={insertTodo} />
      <RailButton
        icon={<LineIcon />}
        label="Line"
        active={activeToolId === "arrow"}
        dragToolId="arrow"
        onClick={() => editor.setCurrentTool("arrow")}
      />

      <div style={{ position: "relative" }}>
        <RailButton icon={<BoardIcon />} label="Board" active={boardOpen} dragToolId="board" onClick={() => rail && setBoardOpen((v) => !v)} />
        {boardOpen && (
          <form
            onSubmit={submitBoard}
            style={{
              position: "absolute",
              left: 68,
              top: 0,
              zIndex: 400,
              display: "flex",
              gap: 4,
              background: "#202127",
              border: "1px solid rgb(58,59,65)",
              borderRadius: 6,
              padding: 4,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <input
              autoFocus
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setBoardOpen(false)}
              placeholder="Board-Name"
              disabled={boardPending}
              style={{
                width: 160,
                fontSize: 12,
                padding: "5px 7px",
                border: "1px solid rgb(58,59,65)",
                borderRadius: 4,
                outline: "none",
                background: "#17181c",
                color: "rgb(231,229,224)",
              }}
            />
            <button
              type="submit"
              disabled={boardPending || !boardTitle.trim()}
              style={{ fontSize: 12, fontWeight: 600, padding: "0 10px", borderRadius: 4, background: "#18181b", color: "#fff", border: "none", cursor: "pointer", opacity: boardPending ? 0.5 : 1 }}
            >
              Erstellen
            </button>
          </form>
        )}
      </div>

      <RailButton
        icon={<ColumnIcon />}
        label="Column"
        active={activeToolId === "frame"}
        dragToolId="frame"
        onClick={() => editor.setCurrentTool("frame")}
      />
      <RailButton icon={<CommentIcon />} label="Comment" onClick={() => rail?.toggleComments()} />

      <div style={{ position: "relative" }}>
        <RailButton icon={<MoreIcon />} label="" active={moreOpen} onClick={() => setMoreOpen((v) => !v)} />
        {moreOpen && (
          <div
            style={{
              position: "absolute",
              left: 68,
              top: 0,
              zIndex: 400,
              display: "flex",
              flexDirection: "column",
              background: "#202127",
              border: "1px solid rgb(58,59,65)",
              borderRadius: 6,
              padding: 4,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              minWidth: 130,
            }}
          >
            {MORE_TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  editor.setCurrentTool(t.id);
                  setMoreOpen(false);
                }}
                style={{
                  textAlign: "left",
                  fontSize: 12,
                  padding: "6px 8px",
                  border: "none",
                  background: activeToolId === t.id ? "rgba(255,255,255,0.118)" : "transparent",
                  borderRadius: 4,
                  cursor: "pointer",
                  color: activeToolId === t.id ? "rgb(244,243,239)" : "rgb(156,153,143)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 44, borderTop: "1px solid rgb(58,59,65)", margin: "4px 0" }} />

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImagePick} />
      <RailButton icon={<ImageIcon />} label="Add image" dragToolId="asset" onClick={() => imageInputRef.current?.click()} />

      <input ref={uploadInputRef} type="file" hidden onChange={handleUploadPick} />
      <RailButton icon={<UploadIcon />} label="Upload" dragToolId="upload" onClick={() => uploadInputRef.current?.click()} />

      <RailButton
        icon={<DrawIcon />}
        label="Draw"
        active={activeToolId === "draw"}
        dragToolId="draw"
        onClick={() => editor.setCurrentTool("draw")}
      />

      <div style={{ flex: 1 }} />

      <Link href="/trash" style={{ textDecoration: "none" }}>
        <RailButton icon={<TrashIcon />} label="Trash" />
      </Link>
    </div>
  );
}

function RailButton({
  icon,
  label,
  active,
  dragToolId,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  dragToolId?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      draggable={!!dragToolId}
      onDragStart={
        dragToolId
          ? (e) => {
              e.dataTransfer.setData(DRAG_MIME, dragToolId);
              e.dataTransfer.effectAllowed = "copy";
            }
          : undefined
      }
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        width: 60,
        border: "none",
        borderRadius: 6,
        background: active ? "rgba(255,255,255,0.118)" : "transparent",
        color: active ? "rgb(244,243,239)" : "rgb(156,153,143)",
        cursor: dragToolId ? "grab" : "pointer",
        padding: "8px 0 6px",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          color: "inherit",
        }}
      >
        {icon}
      </span>
      {label && <span style={{ fontSize: 10, color: "inherit", lineHeight: 1 }}>{label}</span>}
    </button>
  );
}
