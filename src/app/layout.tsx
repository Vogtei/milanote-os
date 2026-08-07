import type { Metadata } from "next";
import { Inter, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CanvasPrefsProvider } from "@/components/CanvasPrefsProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "milanote-os",
  description: "Selbst gehostetes visuelles Board",
};

// Runs before first paint so the stored theme is already on <html> when the
// page renders. Without it the app paints dark, then corrects itself to light
// once React hydrates — a visible flash on every navigation.
const THEME_BOOTSTRAP = `
try {
  var pref = localStorage.getItem('milanote-os:theme') || 'dark';
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
      className={`${inter.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
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
