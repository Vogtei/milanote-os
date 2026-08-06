import { T } from "@tldraw/validate";

// Shared between the client shape (TodoShapeUtil) and the sync server's
// schema, so both sides validate/serialize "todo" records identically.
export const todoItemValidator = T.object({
  id: T.string,
  text: T.string,
  done: T.boolean,
});

export const todoProps = {
  w: T.number,
  h: T.number,
  title: T.string,
  items: T.arrayOf(todoItemValidator),
};
