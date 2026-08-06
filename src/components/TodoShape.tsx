"use client";

import { BaseBoxShapeUtil, HTMLContainer, stopEventPropagation, useEditor } from "tldraw";
import type { TLShape } from "tldraw";
import { todoProps } from "@/lib/todo-schema";

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    todo: {
      w: number;
      h: number;
      title: string;
      items: { id: string; text: string; done: boolean }[];
    };
  }
}

export type TodoShape = TLShape<"todo">;

export class TodoShapeUtil extends BaseBoxShapeUtil<TodoShape> {
  static override type = "todo" as const;
  static override props = todoProps;

  override getDefaultProps(): TodoShape["props"] {
    return { w: 220, h: 180, title: "Todo", items: [{ id: crypto.randomUUID(), text: "", done: false }] };
  }

  override canEdit() {
    return false;
  }

  override component(shape: TodoShape) {
    return <TodoCard shape={shape} />;
  }

  override getIndicatorPath(shape: TodoShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}

function TodoCard({ shape }: { shape: TodoShape }) {
  const editor = useEditor();

  function updateItems(items: TodoShape["props"]["items"]) {
    editor.updateShape({ id: shape.id, type: "todo", props: { ...shape.props, items } });
  }

  function setTitle(title: string) {
    editor.updateShape({ id: shape.id, type: "todo", props: { ...shape.props, title } });
  }

  function toggle(id: string) {
    updateItems(shape.props.items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }

  function setText(id: string, text: string) {
    updateItems(shape.props.items.map((it) => (it.id === id ? { ...it, text } : it)));
  }

  function remove(id: string) {
    updateItems(shape.props.items.filter((it) => it.id !== id));
  }

  function addItem() {
    updateItems([...shape.props.items, { id: crypto.randomUUID(), text: "", done: false }]);
  }

  return (
    <HTMLContainer style={{ pointerEvents: "all" }} onPointerDown={stopEventPropagation}>
      <div
        style={{
          width: shape.props.w,
          height: shape.props.h,
          background: "#FEF3C7",
          border: "1px solid #e4c874",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          padding: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        <input
          value={shape.props.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Todo"
          style={{
            border: "none",
            background: "transparent",
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 6,
            outline: "none",
            color: "#3f2d00",
          }}
        />
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {shape.props.items.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} />
              <input
                value={item.text}
                onChange={(e) => setText(item.id, e.target.value)}
                placeholder="Eintrag…"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  fontSize: 12,
                  textDecoration: item.done ? "line-through" : "none",
                  color: item.done ? "#a1a1aa" : "#3f2d00",
                  outline: "none",
                }}
              />
              <button
                onClick={() => remove(item.id)}
                style={{ border: "none", background: "transparent", color: "#a1a1aa", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addItem}
          style={{
            marginTop: 6,
            border: "none",
            background: "transparent",
            color: "#8a6d00",
            fontSize: 12,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          + Eintrag
        </button>
      </div>
    </HTMLContainer>
  );
}
