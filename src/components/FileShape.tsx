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
          background: "#fff",
          border: "1px solid #e4e4e7",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
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
            background: "#f4f4f5",
            color: "#71717a",
          }}
        >
          <FileIcon />
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "#27272a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {shape.props.name}
          </span>
          <span style={{ fontSize: 11, color: "#71717a" }}>
            {formatSize(shape.props.size)} ·{" "}
            <a
              href={shape.props.src}
              target="_blank"
              rel="noreferrer"
              onPointerDown={stopEventPropagation}
              style={{ color: "#3b82f6", textDecoration: "underline" }}
            >
              Download
            </a>
          </span>
        </div>
      </div>
    </HTMLContainer>
  );
}
