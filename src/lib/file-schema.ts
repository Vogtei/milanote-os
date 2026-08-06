import { T } from "@tldraw/validate";

// Shared between the client shape (FileShapeUtil) and the sync server's
// schema, so both sides validate/serialize "file" records identically.
export const fileProps = {
  w: T.number,
  h: T.number,
  name: T.string,
  size: T.number,
  src: T.string,
};
