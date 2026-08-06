"use client";

import { DefaultRichTextToolbar, useEditor, useValue } from "tldraw";
import { HeadlineIcon, SublineIcon, BodyTextIcon, CodeIcon } from "@/components/icons/MilanoteIcons";

// tldraw renders `<RichTextToolbar />` with no props (see its TldrawUi.tsx),
// so we reuse DefaultRichTextToolbar purely for its positioning/selection
// logic and swap in our own button content via its `children` slot.
export function MilanoteRichTextToolbar() {
  return (
    <DefaultRichTextToolbar>
      <MilanoteRichTextToolbarContent />
    </DefaultRichTextToolbar>
  );
}

function MilanoteRichTextToolbarContent() {
  const editor = useEditor();
  const textEditor = useValue("textEditor", () => editor.getRichTextEditor(), [editor]);
  if (!textEditor) return null;

  function run(op: () => void) {
    if (!textEditor?.view) return;
    op();
  }

  const isHeadline = textEditor.isActive("heading", { level: 1 });
  const isSubline = textEditor.isActive("heading", { level: 2 });
  const isBody = !isHeadline && !isSubline && !textEditor.isActive("codeBlock");
  const isCode = textEditor.isActive("codeBlock");
  const isBold = textEditor.isActive("bold");
  const isItalic = textEditor.isActive("italic");
  const isInlineCode = textEditor.isActive("code");
  const isBulletList = textEditor.isActive("bulletList");
  const isHighlight = textEditor.isActive("highlight");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: 3, background: "#18181b", borderRadius: 8 }}>
      <TB active={isHeadline} label="Headline" onClick={() => run(() => textEditor.chain().focus().toggleHeading({ level: 1 }).run())}>
        <HeadlineIcon />
      </TB>
      <TB active={isSubline} label="Subline" onClick={() => run(() => textEditor.chain().focus().toggleHeading({ level: 2 }).run())}>
        <SublineIcon />
      </TB>
      <TB active={isBody} label="Body" onClick={() => run(() => textEditor.chain().focus().setParagraph().run())}>
        <BodyTextIcon />
      </TB>
      <TB active={isCode} label="Code" onClick={() => run(() => textEditor.chain().focus().toggleCodeBlock().run())}>
        <CodeIcon />
      </TB>

      <Divider />

      <TB active={isBold} label="Fett" onClick={() => run(() => textEditor.chain().focus().toggleBold().run())}>
        <span style={{ fontWeight: 800 }}>B</span>
      </TB>
      <TB active={isItalic} label="Kursiv" onClick={() => run(() => textEditor.chain().focus().toggleItalic().run())}>
        <span style={{ fontStyle: "italic" }}>I</span>
      </TB>
      <TB active={isInlineCode} label="Inline-Code" onClick={() => run(() => textEditor.chain().focus().toggleCode().run())}>
        <span style={{ fontFamily: "monospace" }}>{"</>"}</span>
      </TB>
      <TB active={isBulletList} label="Liste" onClick={() => run(() => textEditor.chain().focus().toggleBulletList().run())}>
        •
      </TB>
      <TB
        active={isHighlight}
        label="Markieren"
        onClick={() =>
          run(() => {
            // @ts-expect-error Highlight's command isn't in tldraw's base ChainedCommands type; tldraw's own toolbar has the same suppression.
            textEditor.chain().focus().toggleHighlight().run();
          })
        }
      >
        <span style={{ background: "#fde047", color: "#000", padding: "0 2px", borderRadius: 2 }}>H</span>
      </TB>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, alignSelf: "stretch", background: "#3f3f46", margin: "0 2px" }} />;
}

function TB({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        border: "none",
        borderRadius: 5,
        background: active ? "#4f6ef7" : "transparent",
        color: active ? "#fff" : "#e4e4e7",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}
