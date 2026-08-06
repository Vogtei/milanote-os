"use client";

import { BaseBoxShapeUtil, HTMLContainer, stopEventPropagation } from "tldraw";
import type { TLShape } from "tldraw";
import { fileProps } from "@/lib/file-schema";
import { FileIcon } from "@/components/icons/MilanoteIcons";

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    file: {
      w: number;
      h: number;
      name: string;
      size: number;
      src: string;
    };
  }
}

export type FileShape = TLShape<"file">;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class FileShapeUtil extends BaseBoxShapeUtil<FileShape> {
  static override type = "file" as const;
  static override props = fileProps;

  override getDefaultProps(): FileShape["props"] {
    return { w: 220, h: 64, name: "Datei", size: 0, src: "" };
  }

  override canEdit() {
    return false;
  }

  override component(shape: FileShape) {
    return <FileCard shape={shape} />;
  }

  override getIndicatorPath(shape: FileShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}

function FileCard({ shape }: { shape: FileShape }) {
  return (
    <HTMLContainer style={{ pointerEvents: "all" }} onPointerDown={stopEventPropagation}>
      <div
        style={{
          width: shape.props.w,
          height: shape.props.h,
          background: "#202127",
          border: "1px solid rgb(58,59,65)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 4,
            background: "rgba(255,255,255,0.08)",
            color: "rgb(156,153,143)",
          }}
        >
          <FileIcon />
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "rgb(244,243,239)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {shape.props.name}
          </span>
          <span style={{ fontSize: 11, color: "rgb(156,153,143)" }}>
            {formatSize(shape.props.size)} ·{" "}
            <a
              href={shape.props.src}
              target="_blank"
              rel="noreferrer"
              onPointerDown={stopEventPropagation}
              style={{ color: "#6ea8fe", textDecoration: "underline" }}
            >
              Download
            </a>
          </span>
        </div>
      </div>
    </HTMLContainer>
  );
}
