"use client";

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { use } from "react";

export default function BoardPage(props: PageProps<"/board/[id]">) {
  const { id } = use(props.params);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw persistenceKey={id} />
    </div>
  );
}
