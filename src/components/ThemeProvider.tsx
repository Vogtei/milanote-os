"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ThemeName } from "@/canvas/theme";

type Preference = ThemeName | "system";

type ThemeContextValue = {
  /** What the user picked. */
  preference: Preference;
  /** What's actually on screen right now. */
  theme: ThemeName;
  setPreference: (preference: Preference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "milanote-os:theme";

function systemTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<Preference>("dark");
  const [theme, setTheme] = useState<ThemeName>("dark");

  // Adopt whatever the pre-paint bootstrap script in the root layout already
  // put on <html>, rather than reading localStorage again. Deferring to the
  // next frame keeps the state update out of the effect body — reading it
  // during render would mismatch the server, which has no localStorage.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Preference | null;
      const initial: Preference = stored ?? "dark";
      setPreferenceState(initial);
      setTheme(initial === "system" ? systemTheme() : initial);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setTheme(media.matches ? "light" : "dark");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [preference]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setPreference = useCallback((next: Preference) => {
    setPreferenceState(next);
    setTheme(next === "system" ? systemTheme() : next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
