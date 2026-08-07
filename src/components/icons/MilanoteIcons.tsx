// Companion icon set to VosIcons.tsx, backed by lucide-react. `size` lets the
// same wrapper serve both the 22px rail and the 20px topbar buttons.
import {
  StickyNote,
  Link2,
  ListChecks,
  MessageSquare,
  Image,
  Pencil,
  Trash2,
  Folder,
  type LucideIcon,
} from "lucide-react";

type IconProps = { className?: string; size?: number };

function wrap(Icon: LucideIcon) {
  return function Wrapped({ className, size = 20 }: IconProps) {
    return <Icon size={size} strokeWidth={1.6} className={className} />;
  };
}

export const NoteIcon = wrap(StickyNote);
export const LinkIcon = wrap(Link2);
export const TodoIcon = wrap(ListChecks);
export const CommentIcon = wrap(MessageSquare);
export const ImageIcon = wrap(Image);
export const DrawIcon = wrap(Pencil);
export const TrashIcon = wrap(Trash2);
export const BoardIcon = wrap(Folder);
