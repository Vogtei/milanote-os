"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// A small sibling to ThemeProvider — same localStorage-backed-context shape,
// for canvas-level display prefs that live outside any single board (the
// dot grid is a global taste setting, not per-board state).
type CanvasPrefsValue = {
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
};

const CanvasPrefsContext = createContext<CanvasPrefsValue | null>(null);

const STORAGE_KEY = "milanote-os:showGrid";

export function CanvasPrefsProvider({ children }: { children: React.ReactNode }) {
  const [showGrid, setShowGridState] = useState(true);

  // Deferred to the next frame, same as ThemeProvider's bootstrap read: the
  // server has no localStorage, so reading it during render would mismatch
  // the SSR'd markup — and setState belongs in a callback here, not directly
  // in the effect body.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setShowGridState(stored === "1");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const setShowGrid = useCallback((value: boolean) => {
    setShowGridState(value);
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  }, []);

  return (
    <CanvasPrefsContext.Provider value={{ showGrid, setShowGrid }}>
      {children}
    </CanvasPrefsContext.Provider>
  );
}

export function useCanvasPrefs(): CanvasPrefsValue {
  const value = useContext(CanvasPrefsContext);
  if (!value) throw new Error("useCanvasPrefs must be used inside CanvasPrefsProvider");
  return value;
}
