# Vellum — Brand- und Web-Typografie-Guide

Version 1.0 · August 2026

## 1. Markenidee

Vellum ist ein visueller, selbst gehosteter Workspace für die gemeinsame Entwicklung von Konzepten. Die Anwendung verbindet die Offenheit eines Notizbuchs mit der Struktur eines professionellen Kundenraums.

**Markenwirkung:** ruhig, präzise, hochwertig, vertrauenswürdig und kollaborativ.

## 2. Icon-System

Das verbindliche Zeichen ist das **Open-Folio-Symbol**. Die Form verbindet drei Bedeutungen:

- ein geöffnetes Notizbuch beziehungsweise zwei Seiten,
- ein negatives oder positives V für Vellum,
- zwei Parteien, die an einem gemeinsamen Konzept arbeiten.

### Varianten

- **Primär:** schwarzes Zeichen auf weißem Squircle.
- **Reverse / Dark Mode:** weißes Zeichen auf schwarzem Squircle.
- Beide Versionen verwenden exakt dieselbe Geometrie.

### Nutzungsregeln

- Keine Verläufe, Schatten, Konturen oder zusätzlichen Farben.
- Das Symbol nicht stauchen, drehen oder beschneiden.
- Die Squircle-Geometrie und die Innenabstände bleiben unverändert.
- Light Mode nutzt Schwarz auf Weiß.
- Dark Mode nutzt Weiß auf Schwarz.
- Das Icon darf nicht durch einen Buchstaben, Stift oder eine zusätzliche Dokumentkontur ergänzt werden.

## 3. Typografie

### Primäre Schrift: Manrope

Manrope ist die einzige benötigte Marken- und Interface-Schrift. Ihre geometrische Struktur passt zur massiven Form des Icons, während die subtil gerundeten Details dessen weiche Außenkanten aufgreifen.

**Quelle:** Google Fonts  
**Variable Achse:** Gewicht 200–800  
**Sprachumfang:** Lateinisch inklusive deutscher Umlaute und ß

### Wordmark

Der Name wird immer als **Vellum** gesetzt.

```css
.vellum-wordmark {
  font-family: "Manrope", sans-serif;
  font-size: 24px;
  font-weight: 650;
  line-height: 1;
  letter-spacing: -0.045em;
}
```

Regeln:

- Title Case: `Vellum`
- kein Punkt hinter dem Namen
- nicht vollständig in Versalien
- keine kursive Schreibweise
- bevorzugtes Gewicht: 650
- horizontaler Abstand zwischen Icon und Wordmark: ungefähr 35 % der Icon-Höhe

## 4. Typografische Hierarchie

### Display / Landingpage

```css
.vellum-display {
  font-size: clamp(2.75rem, 6vw, 5.5rem);
  font-weight: 600;
  line-height: 0.98;
  letter-spacing: -0.055em;
}
```

### Seitenüberschrift

```css
.vellum-heading {
  font-size: clamp(1.75rem, 3vw, 2.75rem);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.04em;
}
```

### Fließtext

```css
.vellum-body {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.65;
  letter-spacing: -0.012em;
}
```

### UI, Buttons und Navigation

```css
.vellum-ui {
  font-size: 0.875rem;
  font-weight: 550;
  line-height: 1.25;
  letter-spacing: -0.015em;
}
```

## 5. Next.js-Einbindung

Das Projekt verwendet Next.js. Die Schrift sollte über `next/font/google` eingebunden werden. Next.js stellt die Fontdateien beim Build lokal bereit; im Browser ist keine direkte Google-Fonts-Anfrage nötig.

### `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Vellum",
    template: "%s — Vellum",
  },
  description:
    "A visual workspace for turning ideas into shared concepts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
```

## 6. Tailwind CSS v4

### `app/globals.css`

```css
@import "tailwindcss";

@theme inline {
  --font-sans:
    var(--font-manrope),
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

:root {
  --vellum-black: #000000;
  --vellum-ink: #111111;
  --vellum-muted: #6b6b6b;
  --vellum-border: #e8e8e8;
  --vellum-surface: #ffffff;
  --vellum-canvas: #f7f7f7;
}

html {
  font-family: var(--font-manrope), sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

body {
  background: var(--vellum-canvas);
  color: var(--vellum-ink);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.55;
  letter-spacing: -0.01em;
}

@media (prefers-color-scheme: dark) {
  :root {
    --vellum-ink: #ffffff;
    --vellum-muted: #a3a3a3;
    --vellum-border: #292929;
    --vellum-surface: #111111;
    --vellum-canvas: #000000;
  }
}
```

## 7. Brand-Lockup

```tsx
<a className="inline-flex items-center gap-2.5 text-neutral-950 no-underline dark:text-white" href="/">
  <img
    src="/brand/vellum-icon-light.png"
    alt=""
    className="size-8 rounded-[22%] dark:hidden"
  />
  <img
    src="/brand/vellum-icon-dark.png"
    alt=""
    className="hidden size-8 rounded-[22%] dark:block"
  />
  <span className="font-sans text-xl font-[650] leading-none tracking-[-0.045em]">
    Vellum
  </span>
</a>
```

## 8. Komponentenbeispiele

### Headline und Text

```tsx
<h1 className="font-sans text-5xl font-semibold leading-[0.98] tracking-[-0.05em] md:text-7xl">
  Concepts, clearly shared.
</h1>

<p className="max-w-xl text-base leading-7 tracking-[-0.012em] text-neutral-600 dark:text-neutral-400">
  Discuss ideas, collect feedback and turn decisions into action.
</p>
```

### Primärer Button

```tsx
<button className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold tracking-[-0.015em] text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black">
  Create board
</button>
```

### Sekundärer Button

```tsx
<button className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium tracking-[-0.015em] text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-black dark:text-white dark:hover:bg-neutral-900">
  Share with client
</button>
```

## 9. Barrierefreiheit und technische Regeln

- Fließtext sollte nicht kleiner als 15 px gesetzt werden.
- Kleine UI-Texte dürfen 13–14 px verwenden, benötigen aber mindestens Gewicht 500.
- Text und Hintergrund müssen mindestens WCAG-AA-Kontrast erreichen.
- Reines Schwarz und Weiß bleiben dem Logo und primären Aktionen vorbehalten.
- Für längere Texte wird `#111111` statt reinem Schwarz empfohlen.
- `font-synthesis: none` verhindert künstlich erzeugte Fett- und Kursivschnitte.
- Die Fallback-Kette muss auch ohne geladenen Webfont ein stabiles Layout liefern.

## 10. Dateibenennung

Empfohlene Ablage im Repository:

```text
public/brand/vellum-icon-light.png
public/brand/vellum-icon-dark.png
docs/brand/vellum-brand-web-guide.md
docs/brand/vellum-typography-overview.pdf
```
