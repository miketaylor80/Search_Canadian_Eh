/**
 * HubSpot Contacts → CSV
 * Scrapes only currently visible contact rows from the contacts index table.
 *
 * Target pages (typical):
 *   https://app.hubspot.com/contacts/{portalId}/objects/0-1/views/all/list
 *   https://app.hubspot.com/contacts/{portalId}/contacts/list/view/all/
 *   Saved contact list/table views under /contacts/...
 *
 * DOM assumptions (defensive — multiple fallbacks):
 *   Table: [data-test-id="contacts-table"], [data-attribute="contacts-table"],
 *          table[role="grid"], table.table, or any table with contact record links
 *   Name:  header matching /^name$/i OR .name-cell a OR a[href*="/contact/"] / a[href*="/record/0-1/"]
 *   Phone: header matching /phone/i OR .column-phone
 *   URL:   absolute URL from the name-cell anchor href
 */
(function () {
  "use strict";

  // Idempotent: popup may re-inject this file via chrome.scripting.executeScript.
  if (window.__hubspotContactsCsvLoaded) {
    return;
  }
  window.__hubspotContactsCsvLoaded = true;

  const CONTACT_HREF_RE =
    /\/(?:contact|contacts)\/\d+(?:\/|$)|\/record\/0-1\/\d+|\/objects\/0-1\/record\/\d+/i;

  function normalizeText(el) {
    if (!el) return "";
    return (el.innerText || el.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function absoluteUrl(href) {
    if (!href) return "";
    try {
      return new URL(href, location.href).href;
    } catch {
      return href;
    }
  }

  function isContactLink(a) {
    if (!a || !a.getAttribute) return false;
    const href = a.getAttribute("href") || "";
    return CONTACT_HREF_RE.test(href);
  }

  function findTables() {
    const selectors = [
      '[data-test-id="contacts-table"]',
      '[data-attribute="contacts-table"]',
      'table[data-test-id*="contact"]',
      'table[role="grid"]',
      "table.table",
      "table",
    ];

    const seen = new Set();
    const tables = [];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((t) => {
        if (seen.has(t)) return;
        seen.add(t);
        tables.push(t);
      });
    }

    // Prefer tables that already contain contact record links.
    tables.sort((a, b) => {
      const score = (t) =>
        Array.from(t.querySelectorAll("a[href]")).filter(isContactLink).length;
      return score(b) - score(a);
    });

    return tables;
  }

  function headerCells(table) {
    const fromThead = Array.from(table.querySelectorAll("thead th, thead td"));
    if (fromThead.length) return fromThead;

    const firstRow = table.querySelector("tr");
    if (!firstRow) return [];
    const cells = Array.from(firstRow.querySelectorAll("th, td"));
    // Treat as headers if th present or role=columnheader
    if (
      cells.some(
        (c) =>
          c.tagName === "TH" ||
          c.getAttribute("role") === "columnheader" ||
          c.getAttribute("scope") === "col"
      )
    ) {
      return cells;
    }
    return [];
  }

  function dataRows(table) {
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    if (bodyRows.length) {
      return bodyRows.filter((r) => r.querySelector("td"));
    }

    const all = Array.from(table.querySelectorAll("tr"));
    const headers = headerCells(table);
    const headerRow = headers[0] && headers[0].closest("tr");
    return all.filter((r) => r !== headerRow && r.querySelector("td"));
  }

  function indexByHeader(headers, matcher) {
    for (let i = 0; i < headers.length; i++) {
      const label = normalizeText(headers[i]).toLowerCase();
      if (matcher(label)) return i;
    }
    return -1;
  }

  function cellAt(row, index) {
    if (index < 0) return null;
    const cells = Array.from(row.querySelectorAll("td, [role='gridcell']"));
    return cells[index] || null;
  }

  function findNameLink(row, nameCell) {
    const scopes = [nameCell, row].filter(Boolean);
    for (const scope of scopes) {
      const preferred =
        scope.querySelector(".name-cell a[href]") ||
        scope.querySelector('a[data-test-id*="name" i]') ||
        scope.querySelector('a[data-selenium-test*="name" i]');
      if (preferred && isContactLink(preferred)) return preferred;

      const links = Array.from(scope.querySelectorAll("a[href]"));
      const contact = links.find(isContactLink);
      if (contact) return contact;
      if (preferred) return preferred;
      if (links[0]) return links[0];
    }
    return null;
  }

  function phoneFromCell(cell, row) {
    if (cell) {
      const nested =
        cell.querySelector(".column-phone") ||
        cell.querySelector('[data-test-id*="phone" i]') ||
        cell;
      const text = normalizeText(nested);
      if (text && text !== "--" && text !== "—") return text;
    }

    const legacy = row.querySelector(
      '.column-phone, [data-test-id*="phone" i], td[data-column*="phone" i]'
    );
    if (legacy) {
      const text = normalizeText(legacy);
      if (text && text !== "--" && text !== "—") return text;
    }
    return "";
  }

  function scrapeVisibleContacts() {
    const tables = findTables();
    if (!tables.length) {
      return {
        ok: false,
        error:
          "No contacts table found on this page. Open a HubSpot Contacts list/table view, then try again.",
        rows: [],
        meta: { url: location.href },
      };
    }

    let best = { rows: [], tableIndex: 0, nameIdx: -1, phoneIdx: -1 };

    tables.forEach((table, tableIndex) => {
      const headers = headerCells(table);
      const nameIdx = indexByHeader(
        headers,
        (l) => l === "name" || l === "contact" || l === "full name" || l.startsWith("name")
      );
      const phoneIdx = indexByHeader(
        headers,
        (l) =>
          l.includes("phone number") ||
          l === "phone" ||
          l.includes("phone") ||
          l.includes("mobile")
      );

      const scraped = [];
      for (const row of dataRows(table)) {
        // Skip checkbox-only / empty spacer rows
        if (!normalizeText(row)) continue;

        const nameCell =
          cellAt(row, nameIdx) ||
          row.querySelector(".name-cell") ||
          row.querySelector("td");

        const link = findNameLink(row, nameCell);
        const name = normalizeText(link || nameCell);
        const recordUrl = absoluteUrl(link && link.getAttribute("href"));

        // Require a contact-looking link or a non-empty name from the name column
        if (!name && !recordUrl) continue;
        if (recordUrl && !CONTACT_HREF_RE.test(recordUrl) && nameIdx < 0 && !link) {
          continue;
        }

        const phoneCell = cellAt(row, phoneIdx);
        const phone = phoneFromCell(phoneCell, row);

        scraped.push({
          name: name || "",
          phone: phone || "",
          recordUrl: recordUrl || "",
        });
      }

      // Deduplicate by recordUrl+name within this table
      const seen = new Set();
      const unique = scraped.filter((r) => {
        const key = `${r.recordUrl}|${r.name}|${r.phone}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (unique.length > best.rows.length) {
        best = { rows: unique, tableIndex, nameIdx, phoneIdx };
      }
    });

    if (!best.rows.length) {
      return {
        ok: false,
        error:
          "Found a table but no contact rows with Name / record links. Ensure the view is Table (not Board) and Name is visible. Scroll so rows are rendered before scraping.",
        rows: [],
        meta: { url: location.href },
      };
    }

    return {
      ok: true,
      rows: best.rows,
      meta: {
        url: location.href,
        count: best.rows.length,
        tableIndex: best.tableIndex,
        nameColumnIndex: best.nameIdx,
        phoneColumnIndex: best.phoneIdx,
        note: "Only currently rendered/visible rows are included (HubSpot virtualizes long lists).",
      },
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === "SCRAPE_CONTACTS") {
      try {
        sendResponse(scrapeVisibleContacts());
      } catch (err) {
        sendResponse({
          ok: false,
          error: String(err && err.message ? err.message : err),
          rows: [],
        });
      }
      return true;
    }
  });

  // Expose for popup executeScript fallback / local test page
  window.__hubspotContactsCsvScrape = scrapeVisibleContacts;
})();
