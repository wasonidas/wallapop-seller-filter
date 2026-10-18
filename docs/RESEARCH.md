# Data sources and interpretation

Observed on **2026-10-18** through normal navigation on the public Spanish Wallapop website. Three listing pages and their three seller profiles were compared. Personal profile links and development-session records are omitted from this public report.

## Listing-to-seller relationship

Search cards were `article` elements inside `[aria-label="Items list"]`, with links to `/item/…`. Those cards did not expose the seller ID or review count in the observed layout.

Directly loaded listing pages contained `script#__NEXT_DATA__`. Within `props.pageProps`, `item.userId` equaled `itemSeller.id` in all three examples. The adapter requires that equality and reads a non-negative integer from `itemSeller.stats.counters.reviews`.

| Anonymized sample | Profile review total | Star average | Other `stats.ratings.reviews` field |
| --- | --- | --- | --- |
| A | 525 | 4.8 | 96 |
| B | 1 | 5 | 0 |
| C | 12 | 5 | 100 |

The displayed totals matched `stats.counters.reviews`, not the star average or the other field called `reviews`. The meaning of that other field was not established and it is not used. The profile's reviews view offered **all / seller / buyer** role filters: the selected count is the general profile total, not a sales-only counter.

The extension reads the HTML at the exact listing URL linked by the card. It does not invent an API endpoint, execute scripts from the fetched document or request the full review list. A search page's embedded data can remain stale after internal navigation and is not treated as the current seller inventory.

## Identity evidence

The regular profile in sample C displayed a personal verification badge. Its explanation described an identity check managed by the payment provider. The listing data had `verified: true`, `sellerType: "Private"`, and `badgeType: null`. That exact combination is treated as positive evidence, not as a guarantee about a person or transaction.

Sample A also had `verified: true`, but was a shop with `sellerType: "Shop"` and `badgeType: "shop"`. Its badge explanation concerned verification of commercial information. Personal identity remains unknown.

Sample B had no badge and `verified: false`, with `sellerType: null`. The meaning of this negative value for personal identity was not established, so it remains unknown. The rules support verified / not verified / unknown, but the current extractor only produces positive or unknown personal identity. PRO status, top profiles, age, stars and review count are not identity substitutes.

## Request limits and cache

One request at a time, a three-second minimum interval between starts, ten distinct listing URLs per batch. Further batches are manual. A listing reveals seller identity and count together. Two new listing URLs from one seller may each need to be read before that relationship is known; previously associated URLs reuse the seller cache.

Cache validity is 24 hours, with up to 1,000 sellers and 1,000 associations. Expired entries are removed on cache access. Transient errors are not stored as zero reviews. Rate limits honor `Retry-After`; authentication errors, forbidden responses and CAPTCHA stop requests until manual intervention.

## Evidence limits

The development Chrome instance received a CloudFront 403. A separate browser session allowed the live observations above. A user later showed the installed panel filtering a real Chrome search. This does not establish correctness for every profile, experiment, region or future layout. Full per-profile verification in that user's browser and an Edge run remain outstanding.

Fixtures are anonymized minimal examples, not full HTTP responses. Installed-extension fixture tests use intercepted responses and do not prove live integration. See [TESTING.md](TESTING.md).
