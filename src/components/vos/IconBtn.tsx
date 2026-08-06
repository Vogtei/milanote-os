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
          ? "bg-[rgba(255,255,255,0.118)] text-[rgb(244,243,239)]"
          : "text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)] disabled:hover:bg-transparent"
      }`}
    >
      {children}
    </button>
  );
});
