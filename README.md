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
