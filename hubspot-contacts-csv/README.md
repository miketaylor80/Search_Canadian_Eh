# HubSpot Contacts → CSV (Chrome Extension)

Manifest V3 extension that scrapes **currently visible** rows from HubSpot’s contacts list/table UI, previews them in the popup, and downloads a CSV with:

| Column | Source |
| --- | --- |
| Name | Contact name cell / name link text |
| Phone Number | Phone column cell |
| HubSpot URL | `href` on the name link (absolute record URL) |

This is **not** an API crawl — only rows rendered in the DOM are exported. HubSpot virtualizes long lists; scroll to load more rows before scraping if you need them.

## Install (unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `hubspot-contacts-csv/`
5. Pin the extension if you like

## Use on HubSpot

1. Sign in to HubSpot and open a **Contacts** index in **Table** view, for example:
   - `https://app.hubspot.com/contacts/{portalId}/objects/0-1/views/all/list`
   - `https://app.hubspot.com/contacts/{portalId}/contacts/list/view/all/`
   - Any saved contacts list/table view under `app.hubspot.com/contacts/...`
2. Make sure **Name** and **Phone Number** (or Phone / Mobile) columns are visible (Edit columns if needed).
3. Scroll until the rows you care about are on screen.
4. Click the extension icon → **Scrape visible contacts** → review the preview → **Download CSV**.

Also works on regional hosts such as `app-eu1.hubspot.com`, `app-na2.hubspot.com`, `app-na3.hubspot.com`.

## Local test (no HubSpot login)

```bash
cd hubspot-contacts-csv
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/test/mock-hubspot-contacts.html`, then scrape from the popup. The mock page uses the same table markers the content script looks for.

## DOM selectors & assumptions

The scraper is defensive and uses several fallbacks:

**Table (first match wins after preferring tables with contact links)**

- `[data-test-id="contacts-table"]`
- `[data-attribute="contacts-table"]`
- `table[data-test-id*="contact"]`
- `table[role="grid"]`
- `table.table` / any `table`

**Name**

- Prefer a column whose header text is `Name` / `Contact` / `Full name`
- Else `.name-cell a`, or any anchor whose `href` matches a contact record pattern:
  - `/contact/{id}`, `/contacts/.../contact/{id}`
  - `/record/0-1/{id}`, `/objects/0-1/record/{id}`

**Phone**

- Prefer a column whose header matches `Phone Number`, `Phone`, or `Mobile`
- Else `.column-phone` (including nested `span` text), or `[data-test-id*="phone"]`

**Record URL**

- Absolute URL built from the name-link `href` via `new URL(href, location.href)`

**Limits**

- Only rows present in the DOM are scraped (visible / virtualized viewport).
- Board view is not supported — use Table view.
- If Phone is missing from the column set, phone cells will be blank.
- HubSpot’s DOM changes over time; if scrapes break, update the selectors in `content.js`.

## Files

```
hubspot-contacts-csv/
  manifest.json
  content.js      # scrape logic + message handler
  popup.html/js/css
  icons/
  test/mock-hubspot-contacts.html
  README.md
```

## Privacy

All processing is local in the browser. No data is sent to a server.
