# Contributing

Issues, pull requests and README translations are welcome. English and Spanish are both fine for discussion.

- For bugs, include extension version, browser/version, steps, expected behavior and observed behavior. Redact screenshots. Do not include cookies, credentials, seller names or personal profile links.
- Extraction changes need an observed source and a minimal anonymized fixture. Missing information must remain unknown; commercial status must not stand in for identity.
- Keep runtime code local and dependencies minimal. Preserve limited host permissions, conservative batches, manual retries and original card order.
- Run `npm run check`, `npm test` and `npm run build`. Run `npm run test:browser` for lifecycle or interface changes. State separately what used fixtures and what was checked against Wallapop.
- Keep all README translations consistent about supported domains, Spanish-only interface, installation folders, privacy and validation limits. Technical reference documents currently remain in English.

Pull requests are reviewed under the project's [MIT License](LICENSE). Follow [docs/MAINTENANCE.md](docs/MAINTENANCE.md) for adapter repairs.
