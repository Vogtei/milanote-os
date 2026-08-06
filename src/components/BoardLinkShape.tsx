"use client";

import { BaseBoxShapeUtil, HTMLContainer, stopEventPropagation } from "tldraw";
import type { TLShape } from "tldraw";
import { useRouter } from "next/navigation";
import { boardLinkProps } from "@/lib/board-link-schema";

// tldraw registers custom shape types by augmenting this map (see
// TLGlobalShapePropsMap in @tldraw/tlschema) rather than a plain union type.
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    "board-link": {
      w: number;
      h: number;
      nodeId: string;
      title: string;
    };
  }
}

export type BoardLinkShape = TLShape<"board-link">;

export class BoardLinkShapeUtil extends BaseBoxShapeUtil<BoardLinkShape> {
  static override type = "board-link" as const;
  static override props = boardLinkProps;

  override getDefaultProps(): BoardLinkShape["props"] {
    return { w: 220, h: 120, nodeId: "", title: "Board" };
  }

  override canEdit() {
    return false;
  }

  override component(shape: BoardLinkShape) {
    return <BoardLinkCard shape={shape} />;
  }

  override getIndicatorPath(shape: BoardLinkShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}

function BoardLinkCard({ shape }: { shape: BoardLinkShape }) {
  const router = useRouter();

  return (
    <HTMLContainer
      style={{ pointerEvents: "all" }}
      onPointerDown={stopEventPropagation}
      onDoubleClick={() => router.push(`/board/${shape.props.nodeId}`)}
    >
      <div
        style={{
          width: shape.props.w,
          height: shape.props.h,
          background: "white",
          border: "1px solid #d4d4d8",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontFamily: "sans-serif",
          color: "#27272a",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 22 }}>🗒️</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{shape.props.title}</span>
        <span style={{ fontSize: 10, fontWeight: 400, color: "#71717a" }}>
          Doppelklick zum Öffnen
        </span>
      </div>
    </HTMLContainer>
  );
}
