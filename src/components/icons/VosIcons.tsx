// Chrome icons for the floating topbar / rail / zoom controls, backed by
// lucide-react instead of hand-rolled SVG paths. Thin wrappers keep every
// consumer's import (`@/components/icons/VosIcons`, name + {className,size}
// props) unchanged — only this file's insides moved to a real icon pack.
import {
  MousePointer2,
  Type,
  Shapes,
  ArrowRight,
  Search,
  Undo2,
  Redo2,
  Download,
  Share2,
  MoreVertical,
  ChevronDown,
  Maximize2,
  Plus,
  Minus,
  Sun,
  Moon,
  Lock,
  Unlock,
  Copy,
  Folder,
  FileText,
  Eraser,
  Highlighter,
  type LucideIcon,
} from "lucide-react";

type IconProps = { className?: string; size?: number };

function wrap(Icon: LucideIcon) {
  return function Wrapped({ className, size = 20 }: IconProps) {
    return <Icon size={size} strokeWidth={1.6} className={className} />;
  };
}

export const SelectIcon = wrap(MousePointer2);
export const TextIcon = wrap(Type);
export const ShapesIcon = wrap(Shapes);
export const ArrowIcon = wrap(ArrowRight);
export const SearchIcon = wrap(Search);
export const UndoIcon = wrap(Undo2);
export const RedoIcon = wrap(Redo2);
export const ExportImageIcon = wrap(Download);
export const ShareIcon = wrap(Share2);
export const KebabIcon = wrap(MoreVertical);
export const ChevronDownIcon = wrap(ChevronDown);
export const FitIcon = wrap(Maximize2);
export const PlusIcon = wrap(Plus);
export const MinusIcon = wrap(Minus);
export const SunIcon = wrap(Sun);
export const MoonIcon = wrap(Moon);
export const LockIcon = wrap(Lock);
export const UnlockIcon = wrap(Unlock);
export const CopyIcon = wrap(Copy);
export const FolderIcon = wrap(Folder);
export const DocumentIcon = wrap(FileText);
export const EraserIcon = wrap(Eraser);
export const HighlighterIcon = wrap(Highlighter);
