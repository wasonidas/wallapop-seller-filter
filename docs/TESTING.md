# Testing

Core tests, installed-browser fixture tests and live checks are reported separately.

## Core tests

```sh
npm run check
npm test
npm run build
```

No packages need to be installed for these commands. Tests cover the inclusive threshold at 0/4/5/6 and missing values, stars versus review counts, identity states, preference changes, cache expiry and persistence, request serialization, cancellation, Retry-After and access blocks.

The progress regression models 53 processed cards with 20 matches, 30 unknown results and three errors. It proves that the latter states do not count as new, unattempted items. It does not claim the reason for unknown data in a user's screenshot.

Build output includes the MIT license. The source folder `extension/` can also be loaded directly without building.

## Installed-extension browser tests

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

An existing compatible browser can be selected with `BROWSER_EXECUTABLE`; `PLAYWRIGHT_MODULE` selects an existing Playwright package. Tests create a separate profile and loopback-only debugging endpoint, load the real unpacked extension and intercept all Wallapop responses with synthetic HTML. They make **no live Wallapop requests**.

They exercise batches, strict visibility, state counters, preferences shared with the popup, dynamic results, reused cards, internal navigation, history navigation, cache reuse, rate limits and manual retries of errors. Retrying errors must preserve confirmed and unknown results, with no more than ten failed URLs per retry batch.

Layout height and order are checked after filtering. The fixture does not implement Wallapop's infinite loader; geometry stability is not a live infinite-scroll test. Synthetic `PageTransitionEvent` events exercise restoration handlers but do not prove a real browser bfcache freeze and restoration.

Results and the fixture screenshot are saved under ignored `.local/`. The published `docs/preview.png` is a synthetic screenshot, not a user capture.

## Live validation

Three real listings and profiles were compared during normal browsing, including review totals and badge explanations. A user demonstrated the installed panel on a real Chrome search. Detailed cross-checking of multiple resulting profiles in that browser, other site experiments and Edge execution remain outstanding. See [RESEARCH.md](RESEARCH.md).

For a manual check, install the extension, process a batch in an accessible search, compare several labels against listing/profile counters, change the threshold, toggle identity filtering, disable and re-enable the extension, load more results and navigate back/forward. Stop at CAPTCHA or access limits. Record browser version and the outcome without saving session credentials or personal profile data.

CI runs syntax checks, core tests and the build on Node.js 24. Browser and live tests are not run by CI.
