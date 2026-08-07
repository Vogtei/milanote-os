import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CanvasPrefsProvider } from "@/components/CanvasPrefsProvider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Vellum",
    template: "%s — Vellum",
  },
  description: "A visual workspace for turning ideas into shared concepts.",
};

// Runs before first paint so the stored theme is already on <html> when the
// page renders. Without it the app paints dark, then corrects itself to light
// once React hydrates — a visible flash on every navigation.
const THEME_BOOTSTRAP = `
try {
  var pref = localStorage.getItem('vellum:theme') || 'dark';
  var theme = pref === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : pref;
  document.documentElement.dataset.theme = theme;
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      data-theme="dark"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <ThemeProvider>
          <CanvasPrefsProvider>{children}</CanvasPrefsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
