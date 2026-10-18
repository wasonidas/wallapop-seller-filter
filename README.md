# Wallapop Seller Filters

English · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Português](README.pt.md)

A local, open source **Chrome and Edge extension** that filters loaded Wallapop search results by seller review count and explicit identity verification. Manifest V3, plain JavaScript, MIT license. No backend, telemetry, subscriptions or AI calls.

**Current scope:** `https://es.wallapop.com/` only. The extension interface is in Spanish; these README translations do not add support for other Wallapop domains or translate the interface. This independent project is not affiliated with Wallapop.

## Install without development tools

1. On this repository, choose **Code → Download ZIP** and extract the archive into a permanent folder.
2. Open **Google Chrome** and enter `chrome://extensions` in the browser address bar. In **Microsoft Edge**, enter `edge://extensions`. Use the browser, not Windows File Explorer.
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the extracted **`extension` folder**, such as `wallapop-seller-filter-main/extension`. Its root must contain `manifest.json`; selecting Documents or the repository root will not work.
5. Open a search on [Wallapop Spain](https://es.wallapop.com/) and reload the tab once if it was already open. The **Reputación del vendedor** panel appears above the results.

You do not need Node.js or any development assistant to use the extension. If you build from source, you can load the generated `dist` folder instead.

## Use

| Spanish control | What it does |
| --- | --- |
| Filtrado activo | Enable or disable filtering; disabling restores the cards without reloading. |
| Mínimo de reseñas | Minimum **number of reviews**, initially 5. Exactly 5 passes a minimum of 5. This is the profile's general review total, not stars or sales-only reviews. |
| Solo identidad verificada | Require explicit evidence of personal identity verification. Commercial verification and missing badges remain unknown. |
| Mostrar sin comprobar | Show pending, unknown and failed items with labels, alongside confirmed matches. |
| Comprobar 10 más | Process up to ten previously unattempted listing URLs. New results require manual continuation after the first batch. |
| Reintentar errores | Retry up to ten failed URLs without clearing the cache or repeating known/unknown results. |
| Actualizar datos | Clear the shared cache and process another batch of up to ten. |
| Reanudar consultas | Resume manually after an access block or rate limit. |

Strict mode is enabled initially: only checked matches are shown. The counters separate matches, exclusions, in-progress requests, unattempted items, unknown data and errors. **Processed does not mean verified.** No new items remain when the continue button is disabled after all loaded items were processed; unknown data and errors have their own counts.

Hidden cards keep their layout space and original order to avoid moving scroll triggers. The filter covers **loaded and processed results**, not Wallapop's entire catalogue. Zero confirmed matches with incomplete data does not prove that no suitable sellers exist.

## Requests and privacy

- One request at a time across tabs, at least three seconds between request starts, ten distinct URLs per batch.
- Reads the public HTML of linked listings. No invented API endpoints or remotely downloaded executable code.
- Local cache with a 24-hour validity period: seller ID, review count, identity evidence, check date, source URL and listing-to-seller links. Expired entries are purged when the cache is accessed; this is not a scheduled background deletion.
- Preferences and access-pause state are also stored locally. The extension does not inspect or store cookie values or credentials, and does not retain names, phone numbers or review text. Ordinary requests to Wallapop can include the browser's existing Wallapop session cookies.
- Permission scope: `storage` and `https://es.wallapop.com/*`. No access to every website, backend or analytics service.
- HTTP 429 pauses requests and honors `Retry-After`; HTTP 401/403 and CAPTCHA stop affected requests until manual action. Errors never become zero reviews.

New listings do not expose a seller ID in the observed cards. Two unseen listings from the same seller can require two listing requests to discover that relationship; known listing-to-seller links reuse the seller cache.

## Update or remove

Keep the extension in a permanent folder. Replace it with the new version, press the extension's reload button on the browser extensions page, then reload Wallapop. Preferences survive a normal reload. To uninstall, choose **Remove** on the extensions page and reload open Wallapop tabs.

## Development and validation

Node.js versions are listed in `package.json`. The core has no package dependencies and needs no `npm install`:

```sh
npm run check
npm test
npm run build
```

Build output: `dist/` and `wallapop-seller-filters.zip`, with the manifest and MIT license at the archive root. Optional installed-browser fixture tests:

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

You can set `BROWSER_EXECUTABLE` or `PLAYWRIGHT_MODULE` for an existing installation. These tests use a separate profile, loopback-only debugging and intercepted responses; they do not query Wallapop. CI runs syntax checks, core tests and the build. Browser tests are separate.

Live research checked three listings and profiles; a user also demonstrated filtering in a real Chrome search. Full per-profile checking in that user's browser and an Edge run remain outstanding. Fixtures do not establish live integration. See [testing](docs/TESTING.md), [research](docs/RESEARCH.md) and [maintenance](docs/MAINTENANCE.md).

## Contribute and license

Bug reports, extraction fixes and translation improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md). Do not include session data or unredacted captures in issues.

[MIT License](LICENSE) · Copyright © 2026 wasonidas.

![Extension running with synthetic test data](docs/preview.png)

The image shows a controlled fixture, not a live Wallapop validation.
