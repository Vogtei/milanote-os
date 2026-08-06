// Chrome icons for the floating topbar / rail / zoom controls. Same 24-grid,
// 1.6 stroke language as MilanoteIcons.tsx so the two sets sit together in the
// same rail without looking mismatched.
type IconProps = { className?: string; size?: number };

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

export function SelectIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M5.5 3.8 18 11.4l-5.4 1.3-2.4 5.1Z" />
    </svg>
  );
}

export function TextIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M5 6.5V5h14v1.5" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </svg>
  );
}

export function ShapesIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="8.5" cy="8.5" r="4.5" />
      <rect x="10.5" y="10.5" width="9" height="9" rx="1.5" />
    </svg>
  );
}

export function ArrowIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M4 12h15" />
      <path d="M13.5 6.5 19 12l-5.5 5.5" />
    </svg>
  );
}

export function SearchIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="11" cy="11" r="6" />
      <line x1="15.5" y1="15.5" x2="20" y2="20" />
    </svg>
  );
}

export function UndoIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M4 9h9a5 5 0 0 1 0 10h-4" />
      <path d="M7.5 5.5 4 9l3.5 3.5" />
    </svg>
  );
}

export function RedoIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M20 9h-9a5 5 0 0 0 0 10h4" />
      <path d="M16.5 5.5 20 9l-3.5 3.5" />
    </svg>
  );
}

export function SettingsIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M4.9 7.8l1.8 1M17.3 15.2l1.8 1M4.9 16.2l1.8-1M17.3 8.8l1.8-1" />
    </svg>
  );
}

export function ExportImageIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="M3.5 16 9 11l3 3 3.5-3.5 5 5" />
    </svg>
  );
}

export function ShareIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="17.5" cy="6" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="M8.8 10.8 15.3 7.3M8.8 13.2l6.5 3.5" />
    </svg>
  );
}

export function KebabIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronDownIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <polyline points="7,10 12,15 17,10" />
    </svg>
  );
}

export function FitIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </svg>
  );
}

export function PlusIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <line x1="12" y1="5.5" x2="12" y2="18.5" />
      <line x1="5.5" y1="12" x2="18.5" y2="12" />
    </svg>
  );
}

export function MinusIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <line x1="5.5" y1="12" x2="18.5" y2="12" />
    </svg>
  );
}

export function SunIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M3 12h2M19 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
    </svg>
  );
}

export function MoonIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function LockIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function UnlockIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.8" />
    </svg>
  );
}

export function CopyIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9" />
    </svg>
  );
}

export function ImagePlaceholderIcon({ className, size }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="M3.5 16 9 11l3 3 3.5-3.5 5 5" />
    </svg>
  );
}
