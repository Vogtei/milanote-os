"use client";

import { forwardRef } from "react";

// 34x34 / 8px-radius square icon button — the unit the whole topbar action
// area is built out of.
export const IconBtn = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
  }
>(function IconBtn({ label, active, disabled, onClick, children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-40 ${
        active
          ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
          : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)] disabled:hover:bg-transparent"
      }`}
    >
      {children}
    </button>
  );
});
