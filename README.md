# DigiPrice Tracker

Free, open-source Digikala price-history lookup and analytics.

## Project goals

- Look up a Digikala product by product URL or numeric product ID, whether or not it has been on a personal watchlist.
- Display upstream price history (target: approximately 30 days) only when Digikala actually provides it.
- Calculate transparent price statistics and trends from returned observations.
- Keep a separate, clearly labeled archive collected by this project for products monitored after launch.
- No paid APIs, paid subscriptions, VPN dependency, or always-on personal computer.

## Important coverage distinction

**Universal lookup** depends on Digikala returning price history for the requested product. A valid product ID does not guarantee that historical observations exist.

**Project archive** starts only when this project begins collecting a product. It cannot retroactively create historical observations and does not imply complete coverage of the Digikala catalog.

No missing price points are synthesized.

## Current development stage

The first milestone is a small live validation of Digikala's public price-chart endpoint from GitHub Actions. It tests several product IDs sequentially and publishes a short-lived JSON artifact. The dashboard and long-term collector will be added only after endpoint access, response schema, and product coverage have been verified.

## Run the validation locally

Python 3.10+ is required.

```bash
python -m pip install "curl-cffi>=0.16.3"
python scripts/validate_upstream.py
```

The script writes `validation-results.json` and exits non-zero if no tested product returns usable history.

## License

MIT. See [LICENSE](LICENSE).


## Cloudflare Worker API proxy (free tier)

The browser cannot call Digikala's API directly because Digikala does not return the required CORS headers. The Worker in `worker/index.js` is a small, read-only proxy that adds those headers for the GitHub Pages site.

### Deploy it from the Cloudflare dashboard

1. Create/sign in to a Cloudflare account: https://dash.cloudflare.com/sign-up
2. Open **Workers & Pages** → **Create application** → **Create Worker** → **Deploy**.
3. Name it `digiprice-api` and deploy the starter Worker once.
4. Open **Edit code** (or **Quick edit**), replace the starter code with the complete contents of [worker/index.js](worker/index.js), then **Deploy**.
5. Open the Worker's **Settings** and ensure its usage plan remains **Workers Free**. Do not upgrade to Workers Paid or enable paid add-ons.
6. Test the deployed address:
   - `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health`
   - `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/history?id=20109389`

Cloudflare's published Free allowance is 100,000 Worker requests per day and 10 ms CPU time per invocation. This project is designed for low-volume personal lookup; requests beyond the free allowance may fail until the daily reset. No credit card or paid service should be needed for the intended Free setup; if Cloudflare asks you to add a payment method or choose a paid plan, stop and do not proceed.

### Worker endpoints

- `GET /health` — deployment check.
- `GET /api/search?q=عبارت` — first page of Digikala search results (up to 20).
- `GET /api/history?id=20109389` — upstream price-chart history for any product ID / Digikala product URL.
- `GET /api/product?id=20109389` — product API data.

The Worker allows browser requests only from `https://abolvardim.github.io`. It does not require Digikala login, credentials, or a VPN. Upstream availability can still change if Digikala blocks or modifies its public API.


## Vercel upstream connectivity probe (diagnostic only)

The Cloudflare Worker could not retrieve a valid upstream response in the initial test. A minimal Vercel Edge Function is therefore included as an alternative egress test. It is **not yet the production API** and does not imply that Vercel can reach Digikala.

### Deploy the probe

1. Sign in to Vercel and import `Abolvardim/DigiPrice-Tracker` from GitHub.
2. Keep the project on the **Hobby** plan. Do not add paid services or enable paid add-ons.
3. Use the repository root as the project root and deploy with the default settings.
4. After deployment, open:
   `https://YOUR-VERCEL-DOMAIN/api/probe?id=20109389`
5. Repeat with a few unrelated product IDs, for example `20110013` and `4369031`.

A successful result contains `"ok": true`, HTTP 200 from Digikala, and one or more variants with history points. A 403, 429, redirect, timeout, or other error means this hosting route is not currently suitable as the live backend. Do not interpret a successful deployment/build as a successful upstream connection.

The endpoint is intentionally a narrow diagnostic: it accepts only a numeric product ID, calls only Digikala's price-chart endpoint, and returns a compact summary rather than proxying arbitrary URLs.
