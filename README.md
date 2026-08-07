# Vellum

A self-hostable visual workspace for turning ideas into shared concepts — an infinite canvas for organizing notes, images, links, and to-dos into moodboards and project boards. Inspired by [Milanote](https://milanote.com).

Own your boards. No subscription, no vendor lock-in, no third-party server holding your data.

## Features

- **Infinite canvas board** — a custom HTML5-canvas renderer (no external whiteboard library) with notes, rich text, to-do checklists, images, file/document cards, links with auto-fetched previews, freehand drawing, arrows (with live shape binding), and twelve shape types
- **Nested boards** — boards can contain boards
- **Per-board item trash** — deleted cards are recoverable, not gone the instant you hit delete
- **Comments** — drop a pin anywhere on the board and browse them in a dedicated sidebar
- **Sharing** — generate view/comment/edit links per board, redeemable by anyone with the link
- **Export** — PNG and PDF export of a full board
- **Presentation mode** — full-screen, chrome-free view for walking a board with a client
- **JSON backup** — export and re-import all your boards as a single file, no lock-in
- **Browser clipper extension** — save a page, image, or selection straight to a board from the browser's context menu
- **Light & dark themes**
- **Magic-link auth** — no passwords to manage

## Stack

| Layer | Tech |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router), React, TypeScript |
| Canvas engine | Hand-rolled — own model/store/camera/renderer, no tldraw/Fabric/Konva |
| Database | PostgreSQL via [Prisma](https://www.prisma.io) |
| Auth | [Auth.js](https://authjs.dev) (NextAuth v5), email magic links via Nodemailer |
| File storage | S3-compatible object storage ([MinIO](https://min.io) for local dev) |
| Styling | Tailwind CSS v4 |
| Export | jsPDF |

## Running locally

```bash
docker compose up -d      # Postgres, MinIO, Maildev (catches magic-link emails at :1080)
cp .env.example .env      # fill in the values
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Browser extension

A small clipper extension lives in [`extension/`](extension) — load it unpacked via your browser's extensions page to save content from any page directly to a board.
