type IconProps = { className?: string; size?: number };

// `size` lets the same glyphs serve both the 22px rail and the 20px topbar
// buttons without a second copy of every path.
function svgProps(size = 20) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function NoteIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
    </svg>
  );
}

export function LinkIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5L16 11.5" />
      <path d="M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5" />
    </svg>
  );
}

export function TodoIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="4" y="5" width="5" height="5" rx="1" />
      <path d="M5.3 7.5 6.3 8.5 7.7 6.7" />
      <line x1="12" y1="7.5" x2="20" y2="7.5" />
      <rect x="4" y="14" width="5" height="5" rx="1" />
      <line x1="12" y1="16.5" x2="20" y2="16.5" />
    </svg>
  );
}

export function LineIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M5 19 18 6" />
      <path d="M11 6h7v7" />
    </svg>
  );
}

export function BoardIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function ColumnIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <line x1="4" y1="9" x2="20" y2="9" />
    </svg>
  );
}

export function CommentIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="13" x2="15" y2="13" />
      <line x1="6" y1="17" x2="12" y2="17" />
    </svg>
  );
}

export function MoreIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ImageIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M4 16.5 9 12l3 3 3.5-3.5L20 15" />
    </svg>
  );
}

export function UploadIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M7 8V6a2 2 0 0 1 2-2h4l4 4v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1" />
      <path d="M13 4v4h4" />
      <path d="M9 15.5 12 12.5 15 15.5" />
      <line x1="12" y1="12.5" x2="12" y2="19" />
    </svg>
  );
}

export function DrawIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M14.5 5.5 18.5 9.5 8 20H4v-4Z" />
      <line x1="13" y1="7" x2="17" y2="11" />
    </svg>
  );
}

export function TrashIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M5 7h14" />
      <path d="M9 7V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7" />
      <line x1="10" y1="10.5" x2="10" y2="17" />
      <line x1="14" y1="10.5" x2="14" y2="17" />
    </svg>
  );
}

export function HeadlineIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M5 6v12M13 6v12M5 12h8" />
      <path d="M16 10h2.5a1.5 1.5 0 0 1 0 3H16v3h3" />
    </svg>
  );
}

export function SublineIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M5 7v10M11 7v10M5 12h6" />
      <path d="M14.5 10.5a1.5 1.5 0 0 1 3 0c0 1-1 1.3-1.7 2.1L14.5 15h3.2" />
    </svg>
  );
}

export function BodyTextIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <line x1="5" y1="6.5" x2="19" y2="6.5" />
      <line x1="5" y1="11" x2="19" y2="11" />
      <line x1="5" y1="15.5" x2="14" y2="15.5" />
    </svg>
  );
}

export function CodeIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M9 8 5 12l4 4" />
      <path d="M15 8l4 4-4 4" />
    </svg>
  );
}

export function FileIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M7 4h6l4 4v12H7Z" />
      <path d="M13 4v4h4" />
    </svg>
  );
}
