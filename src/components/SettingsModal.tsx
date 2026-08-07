"use client";

import { useRef, useState } from "react";
import { signOutAction } from "@/lib/auth-actions";
import { exportAllBoards, importBoards } from "@/lib/backup";
import { useCanvasPrefs } from "@/components/CanvasPrefsProvider";
import { CloseIcon, ExportImageIcon, UploadIcon } from "@/components/icons/VosIcons";

type Tab = "profile" | "canvas" | "data";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profil" },
  { id: "canvas", label: "Canvas-Einstellungen" },
  { id: "data", label: "Konto & Daten" },
];

export function SettingsModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string | null; email: string };
}) {
  const [tab, setTab] = useState<Tab>("profile");
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="vos-panel vos-panel-shadow flex h-[min(560px,100%)] w-[min(720px,100%)] flex-col overflow-hidden rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--vos-border)] px-5 py-3.5">
          <span className="text-[15px] font-semibold text-[var(--vos-text-strong)]">Einstellungen</span>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-[var(--vos-border)] p-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
                  tab === t.id
                    ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
                    : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-6">
            {tab === "profile" && <ProfileTab user={user} />}
            {tab === "canvas" && <CanvasTab />}
            {tab === "data" && <DataTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user }: { user: { name: string | null; email: string } }) {
  const label = user.name || user.email;
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--vos-text-strong)] text-xl font-semibold text-[var(--vos-bg)]">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold text-[var(--vos-text-strong)]">{label}</div>
          <div className="truncate text-[13px] text-[var(--vos-muted)]">{user.email}</div>
        </div>
      </div>

      <span className="h-px bg-[var(--vos-border)]" />

      <form action={signOutAction}>
        <button className="rounded-lg border border-[var(--vos-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]">
          Abmelden
        </button>
      </form>
    </div>
  );
}

function CanvasTab() {
  const { showGrid, setShowGrid } = useCanvasPrefs();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between py-2.5">
        <div>
          <div className="text-[13px] font-medium text-[var(--vos-text)]">Raster anzeigen</div>
          <div className="text-[12px] text-[var(--vos-faint)]">Gepunktetes Raster auf dem Board</div>
        </div>
        <button
          role="switch"
          aria-checked={showGrid}
          onClick={() => setShowGrid(!showGrid)}
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
            showGrid ? "bg-[var(--vos-text-strong)]" : "bg-[var(--vos-border)]"
          }`}
        >
          {/* left-0.5 is an explicit baseline, not decoration — leaving left
           *  unset made its "auto" static position depend on the button's
           *  inherited text-align, so the translate below landed the knob
           *  half outside the track instead of sliding it edge to edge. */}
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--vos-bg)] transition-transform ${
              showGrid ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function DataTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const backup = await exportAllBoards();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `milanote-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const { imported } = await importBoards(parsed);
      setMessage(`${imported} Board${imported === 1 ? "" : "s"} importiert.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[13px] font-medium text-[var(--vos-text)]">Backup exportieren</div>
        <p className="mt-0.5 text-[12px] text-[var(--vos-faint)]">
          Lädt alle deine Boards als eine JSON-Datei herunter.
        </p>
        <button
          onClick={handleExport}
          disabled={busy}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--vos-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)] disabled:opacity-40"
        >
          <ExportImageIcon size={16} /> Backup exportieren
        </button>
      </div>

      <span className="h-px bg-[var(--vos-border)]" />

      <div>
        <div className="text-[13px] font-medium text-[var(--vos-text)]">Backup importieren</div>
        <p className="mt-0.5 text-[12px] text-[var(--vos-faint)]">
          Boards aus einer zuvor exportierten Datei werden als Kopien hinzugefügt — nichts Bestehendes
          wird überschrieben.
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--vos-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)] disabled:opacity-40"
        >
          <UploadIcon size={16} /> Backup importieren
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
      </div>

      {message && <p className="text-[12px] text-[var(--vos-muted)]">{message}</p>}
    </div>
  );
}
