import { T } from "@tldraw/validate";

// Shared between the client shape (BoardLinkShapeUtil) and the sync server's
// schema, so both sides validate/serialize "board-link" records identically.
export const boardLinkProps = {
  w: T.number,
  h: T.number,
  nodeId: T.string,
  title: T.string,
};
