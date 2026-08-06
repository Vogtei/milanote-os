"use client";

import { createContext, useContext, useRef, useState } from "react";
import { useEditor, useValue } from "tldraw";
import {
  NoteIcon,
  LinkIcon,
  TodoIcon,
  BoardIcon,
  ImageIcon,
  UploadIcon,
  DrawIcon,
} from "@/components/icons/MilanoteIcons";
import {
  SelectIcon,
  TextIcon,
  ShapesIcon,
  ArrowIcon,
} from "@/components/icons/VosIcons";
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
  // readonly-board behavior (topbar actions are hidden the same way).
  if (isReadonly) return null;

  return (
    // pointer-events-auto is load-bearing: tldraw renders the Toolbar slot
    // inside `.tlui-layout__bottom__main`, which sets pointer-events:none so
    // clicks fall straight through to the canvas — without it the rail is
    // visible but completely dead. maxHeight keeps it clear of the floating
    // topbar above and the zoom pill below on short viewports.
    <aside
      className="vos-panel pointer-events-auto absolute left-2.5 top-1/2 z-[290] flex w-16 -translate-y-1/2 flex-col items-center gap-0.5 overflow-y-auto rounded-[15px] py-2.5"
      style={{ maxHeight: "calc(100% - 130px)" }}
    >
      <RailButton
        icon={<SelectIcon size={22} />}
        label="Wählen"
        active={activeToolId === "select"}
        onClick={() => editor.setCurrentTool("select")}
      />
      <RailButton
        icon={<NoteIcon size={22} />}
        label="Notiz"
        active={activeToolId === "note"}
        dragToolId="note"
        onClick={() => editor.setCurrentTool("note")}
      />
      <RailButton
        icon={<TextIcon size={22} />}
        label="Text"
        active={activeToolId === "text"}
        dragToolId="text"
        onClick={() => editor.setCurrentTool("text")}
      />

      <Popover
        open={boardOpen}
        trigger={
          <RailButton
            icon={<BoardIcon size={22} />}
            label="Board"
            active={boardOpen}
            dragToolId="board"
            onClick={() => rail && setBoardOpen((v) => !v)}
          />
        }
      >
        <form onSubmit={submitBoard} className="flex gap-1">
          <input
            autoFocus
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setBoardOpen(false)}
            placeholder="Board-Name"
            disabled={boardPending}
            className={popoverInputClass}
          />
          <button type="submit" disabled={boardPending || !boardTitle.trim()} className={popoverSubmitClass}>
            Erstellen
          </button>
        </form>
      </Popover>

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImagePick} />
      <RailButton
        icon={<ImageIcon size={22} />}
        label="Bild"
        dragToolId="asset"
        onClick={() => imageInputRef.current?.click()}
      />

      <input ref={uploadInputRef} type="file" hidden onChange={handleUploadPick} />
      <RailButton
        icon={<UploadIcon size={22} />}
        label="Datei"
        dragToolId="upload"
        onClick={() => uploadInputRef.current?.click()}
      />

      <Popover
        open={linkOpen}
        trigger={
          <RailButton
            icon={<LinkIcon size={22} />}
            label="Link"
            active={linkOpen}
            dragToolId="link"
            onClick={() => setLinkOpen((v) => !v)}
          />
        }
      >
        <form onSubmit={submitLink} className="flex gap-1">
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setLinkOpen(false)}
            placeholder="https://…"
            className={`${popoverInputClass} w-52`}
          />
          <button type="submit" className={popoverSubmitClass}>
            Einfügen
          </button>
        </form>
      </Popover>

      <RailButton icon={<TodoIcon size={22} />} label="To-do" dragToolId="todo" onClick={insertTodo} />
      <RailButton
        icon={<ShapesIcon size={22} />}
        label="Formen"
        active={activeToolId === "geo"}
        dragToolId="geo"
        onClick={() => editor.setCurrentTool("geo")}
      />
      <RailButton
        icon={<DrawIcon size={22} />}
        label="Zeichnen"
        active={activeToolId === "draw"}
        dragToolId="draw"
        onClick={() => editor.setCurrentTool("draw")}
      />
      <RailButton
        icon={<ArrowIcon size={22} />}
        label="Pfeil"
        active={activeToolId === "arrow"}
        dragToolId="arrow"
        onClick={() => editor.setCurrentTool("arrow")}
      />
    </aside>
  );
}

const popoverInputClass =
  "w-40 rounded border border-[rgb(58,59,65)] bg-[#17181c] px-2 py-1.5 text-xs text-[rgb(231,229,224)] outline-none placeholder:text-[rgb(120,118,112)] focus:border-[rgb(120,118,112)]";

const popoverSubmitClass =
  "shrink-0 rounded bg-[rgb(244,243,239)] px-2.5 text-xs font-semibold text-[#17181c] disabled:opacity-50";

function Popover({
  open,
  trigger,
  children,
}: {
  open: boolean;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {trigger}
      {open && (
        <div className="vos-panel vos-panel-shadow absolute left-[60px] top-0 z-[400] rounded-lg p-1.5">
          {children}
        </div>
      )}
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
      className={`flex h-[50px] w-[52px] shrink-0 flex-col items-center gap-[3px] rounded-[10px] border-0 pb-1.5 pt-2 text-[10px] font-medium ${
        dragToolId ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${
        active
          ? "bg-[rgba(255,255,255,0.118)] text-[rgb(244,243,239)]"
          : "bg-transparent text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
      }`}
    >
      <span className="flex h-[22px] w-[22px] items-center justify-center text-inherit">{icon}</span>
      <span className="leading-none text-inherit">{label}</span>
    </button>
  );
}
