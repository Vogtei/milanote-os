const APP_ORIGIN = "http://localhost:3000";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "clip-selection",
    title: 'Auswahl "%s" an Milanote-OS senden',
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "clip-image",
    title: "Bild an Milanote-OS senden",
    contexts: ["image"],
  });
  chrome.contextMenus.create({
    id: "clip-link",
    title: "Link an Milanote-OS senden",
    contexts: ["link"],
  });
  chrome.contextMenus.create({
    id: "clip-page",
    title: "Diese Seite an Milanote-OS senden",
    contexts: ["page"],
  });
});

function openPicker(pending) {
  chrome.storage.session.set({ pendingClip: pending }, () => {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 360,
      height: 420,
    });
  });
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "clip-selection" && info.selectionText) {
    openPicker({ kind: "text", text: info.selectionText });
  } else if (info.menuItemId === "clip-image" && info.srcUrl) {
    openPicker({ kind: "image", imageUrl: info.srcUrl });
  } else if (info.menuItemId === "clip-link" && info.linkUrl) {
    openPicker({ kind: "link", url: info.linkUrl });
  } else if (info.menuItemId === "clip-page" && info.pageUrl) {
    openPicker({ kind: "link", url: info.pageUrl });
  }
});

// Toolbar icon click (no context menu involved) — clip the current tab's URL.
chrome.action.onClicked.addListener((tab) => {
  if (tab.url) {
    openPicker({ kind: "link", url: tab.url });
  }
});
