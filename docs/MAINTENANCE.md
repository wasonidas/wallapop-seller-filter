# Maintaining the Wallapop adapter

1. Disable filtering to restore the original cards. Respect access blocks and rate limits; do not retry in loops or bypass CAPTCHA.
2. Inspect a normal search and a listing it links to using browser developer tools. Keep credentials, cookies, personal profile URLs and full captures out of issues and fixtures.
3. Check `GRID_SELECTOR`, `CARD_SELECTOR` and the `/item/…` link extraction in `extension/adapters/wallapop.js`. Avoid generated CSS class names.
4. Compare the listing's embedded `item.userId` with `itemSeller.id`, then compare `stats.counters.reviews` with the displayed profile count. A different field named `reviews`, a star average or missing data is not equivalent evidence.
5. Read the badge's actual explanation before changing identity interpretation. Commercial verification is different from personal identity verification. If the current `Private + verified:true + badgeType:null` combination stops providing reliable evidence, return unknown and disable the identity control with an explanation until a reliable source is observed.
6. Add only minimal anonymized fixtures. Preserve tests for missing values, zero reviews, unknown identity and access errors. Run the checks in [TESTING.md](TESTING.md), rebuild and verify a small live sample.

| Component | Responsibility |
| --- | --- |
| `extension/adapters/wallapop.js` | Observed selectors, URLs, JSON extraction and identity meaning |
| `extension/background.js` | HTML requests, sessions, access barriers and messaging |
| `extension/core/filter.js` | Review threshold and identity rules |
| `extension/core/progress.js` | Separate unattempted, pending, unknown and failed counters |
| `extension/core/cache.js` | Local seller cache, source/date and listing associations |
| `extension/core/queue.js` | Serial requests, cadence, cancellation and cooldown |
| `extension/content.js` | Navigation lifecycle, batches, labels and restoration |
| `extension/ui/panel.js` | Integrated Spanish interface |

Unknown extraction results are not zero reviews. Manual error retry does not clear cache or repeat unknown results. Refresh clears the shared cache and can affect other open search tabs.
