Moved → docs/legacy/web/README.md
Canonical doc → docs/web/data_indexing.md

Operational note:
- Auth-gated routes now require `PT_PASSWORD` and `MECHANICS_PASSWORD` in the runtime environment.
- Charting no longer has a separate password; it uses the site login gate.
- The login routes fail closed with `503` when their expected password env var is missing.
- Local development can use `web/.env.local`; hosted deployments must define the same vars separately because `.env.local` is ignored.
