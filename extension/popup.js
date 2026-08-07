const APP_ORIGIN = "http://localhost:3000";

const previewEl = document.getElementById("preview");
const selectEl = document.getElementById("board");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

let pendingClip = null;

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || "";
}

function renderPreview(clip) {
  if (clip.kind === "text") {
    previewEl.textContent = clip.text;
  } else if (clip.kind === "image") {
    previewEl.textContent = clip.imageUrl;
  } else if (clip.kind === "link") {
    previewEl.textContent = clip.url;
  }
}

async function loadPendingClip() {
  const { pendingClip: stored } = await chrome.storage.session.get("pendingClip");
  if (!stored) {
    setStatus("Kein Inhalt zum Speichern gefunden.", "error");
    return null;
  }
  return stored;
}

async function loadBoards() {
  const res = await fetch(`${APP_ORIGIN}/api/boards`, { credentials: "include" });
  if (res.status === 401) {
    setStatus("Bitte zuerst in Vellum einloggen.", "error");
    previewEl.innerHTML = `<a href="${APP_ORIGIN}/signin" target="_blank">Jetzt einloggen</a>`;
    return null;
  }
  if (!res.ok) {
    setStatus("Boards konnten nicht geladen werden.", "error");
    return null;
  }
  const data = await res.json();
  return data.boards;
}

function populateBoards(boards) {
  selectEl.innerHTML = "";
  if (boards.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "Noch keine Boards vorhanden";
    selectEl.appendChild(opt);
    return;
  }
  for (const board of boards) {
    const opt = document.createElement("option");
    opt.value = board.id;
    opt.textContent = board.path ? `${board.path} / ${board.title}` : board.title;
    selectEl.appendChild(opt);
  }
  selectEl.disabled = false;
}

async function restoreLastBoard(boards) {
  const { lastBoardId } = await chrome.storage.local.get("lastBoardId");
  if (lastBoardId && boards.some((b) => b.id === lastBoardId)) {
    selectEl.value = lastBoardId;
  }
}

async function save() {
  if (!pendingClip) return;
  saveBtn.disabled = true;
  setStatus("Speichere…");

  const boardId = selectEl.value;
  await chrome.storage.local.set({ lastBoardId: boardId });

  try {
    const res = await fetch(`${APP_ORIGIN}/api/clip`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId, ...pendingClip }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Fehler ${res.status}`);
    }
    setStatus("Gespeichert ✓", "ok");
    await chrome.storage.session.remove("pendingClip");
    setTimeout(() => window.close(), 800);
  } catch (err) {
    setStatus(String(err.message || err), "error");
    saveBtn.disabled = false;
  }
}

async function init() {
  pendingClip = await loadPendingClip();
  if (!pendingClip) return;
  renderPreview(pendingClip);

  const boards = await loadBoards();
  if (!boards) return;

  populateBoards(boards);
  await restoreLastBoard(boards);
  saveBtn.disabled = boards.length === 0;
  setStatus("");
}

saveBtn.addEventListener("click", save);
init();
