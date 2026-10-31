# DigiPrice Tracker

Free, open-source Keepa-style price-history display for Digikala.

## Browser extension (first MVP)

The first user-facing implementation is a Chrome / Edge Manifest V3 extension that inserts a price-history panel into Digikala product pages.

### Install

1. Open the repository: https://github.com/Abolvardim/DigiPrice-Tracker
2. Use **Code → Download ZIP** and extract the archive.
3. In Chrome, open `chrome://extensions` (in Edge: `edge://extensions`).
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the extracted `extension` folder.
6. Open or refresh a Digikala product page such as `https://www.digikala.com/product/dkp-20109389/`.

The panel should appear near the top of the product page. It also follows product-to-product navigation inside Digikala without a full page reload. If it does not appear, refresh the product page once after installation.

### Current functionality

- Detects the product ID from the Digikala product URL.
- Calls Digikala's public price-chart endpoint from the extension service worker. This avoids relying on the Cloudflare/Vercel proxy routes that previously returned redirects.
- Shows available daily price points, separated by product variant.
- Converts source prices from Rial to Toman and shows latest, lowest, and highest observed prices.
- Caches successful results in extension memory for 10 minutes.
- No Digikala login, GitHub token, VPN, paid API, external database, or always-on computer is required.

### Important limitations

- This is an early MVP and needs a live test in Chrome/Edge. Host permissions in the extension allow cross-origin requests, but do not guarantee that Digikala will accept requests from every browser/network.
- Digikala's endpoint is unofficial and may change, rate-limit, or stop returning history.
- Not every product or variant is guaranteed to have 30 observations. The extension reports missing history rather than inventing data.
- The initial target is desktop Chrome and Edge. Mobile browser support is not included yet.

## Data-source validation

The `.github/workflows/validate-digikala.yml` workflow probes a small set of product IDs from GitHub Actions. Its results validate only those samples and do not guarantee full catalog coverage.

## Privacy

The extension makes a read-only request to Digikala for the product page currently open. It does not send browsing history, credentials, or product IDs to a DigiPrice-owned server. It includes no analytics or tracking code.

## License

MIT. See [LICENSE](LICENSE).
