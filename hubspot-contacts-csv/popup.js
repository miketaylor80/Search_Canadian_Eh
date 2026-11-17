(function () {
  "use strict";

  const scrapeBtn = document.getElementById("scrapeBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const statusEl = document.getElementById("status");
  const previewWrap = document.getElementById("previewWrap");
  const previewBody = document.getElementById("previewBody");
  const countLabel = document.getElementById("countLabel");

  /** @type {{name:string,phone:string,recordUrl:string}[]} */
  let rows = [];

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.classList.remove("error", "ok");
    if (kind) statusEl.classList.add(kind);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPreview(data) {
    rows = Array.isArray(data) ? data : [];
    previewBody.innerHTML = "";

    if (!rows.length) {
      previewWrap.classList.add("hidden");
      downloadBtn.disabled = true;
      return;
    }

    const frag = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement("tr");
      const url = row.recordUrl || "";
      tr.innerHTML = `
        <td>${escapeHtml(row.name || "")}</td>
        <td>${escapeHtml(row.phone || "")}</td>
        <td>${
          url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
            : ""
        }</td>`;
      frag.appendChild(tr);
    }
    previewBody.appendChild(frag);
    countLabel.textContent = `${rows.length} contact${rows.length === 1 ? "" : "s"} ready`;
    previewWrap.classList.remove("hidden");
    downloadBtn.disabled = false;
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function toCsv(data) {
    const header = ["Name", "Phone Number", "HubSpot URL"];
    const lines = [header.map(csvEscape).join(",")];
    for (const r of data) {
      lines.push(
        [r.name || "", r.phone || "", r.recordUrl || ""].map(csvEscape).join(",")
      );
    }
    // UTF-8 BOM helps Excel open international characters correctly
    return "\uFEFF" + lines.join("\r\n");
  }

  function downloadCsv(data) {
    const blob = new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `hubspot-contacts-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function isSupportedUrl(url) {
    if (!url) return false;
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") {
        if (
          u.hostname === "app.hubspot.com" ||
          u.hostname.endsWith(".hubspot.com") ||
          u.hostname === "127.0.0.1" ||
          u.hostname === "localhost"
        ) {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  async function scrapeActiveTab() {
    setStatus("Scraping…");
    downloadBtn.disabled = true;

    const tab = await getActiveTab();
    if (!tab || tab.id == null) {
      setStatus("No active tab found.", "error");
      renderPreview([]);
      return;
    }

    if (!isSupportedUrl(tab.url)) {
      setStatus(
        "Open a HubSpot contacts list (app.hubspot.com) — or the local test page — then scrape.",
        "error"
      );
      renderPreview([]);
      return;
    }

    // Ensure content script is present (covers localhost test page + SPA navigations)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch (err) {
      setStatus(
        `Could not inject into this tab: ${err && err.message ? err.message : err}`,
        "error"
      );
      renderPreview([]);
      return;
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_CONTACTS" });
    } catch (err) {
      setStatus(
        `Scrape failed: ${err && err.message ? err.message : err}`,
        "error"
      );
      renderPreview([]);
      return;
    }

    if (!response || !response.ok) {
      setStatus((response && response.error) || "No contacts found.", "error");
      renderPreview([]);
      return;
    }

    renderPreview(response.rows);
    const note = response.meta && response.meta.note ? ` ${response.meta.note}` : "";
    setStatus(`Scraped ${response.rows.length} visible row(s).${note}`, "ok");
  }

  scrapeBtn.addEventListener("click", () => {
    scrapeActiveTab().catch((err) => {
      setStatus(String(err && err.message ? err.message : err), "error");
      renderPreview([]);
    });
  });

  downloadBtn.addEventListener("click", () => {
    if (!rows.length) return;
    downloadCsv(rows);
    setStatus(`Downloaded ${rows.length} row(s) as CSV.`, "ok");
  });
})();
