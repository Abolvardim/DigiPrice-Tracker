# DigiPrice Chrome / Edge extension (MVP)

This extension adds a price-history panel to Digikala product pages. It requests the product's price-chart data directly from the browser extension service worker, rather than using the failed Cloudflare/Vercel proxy routes.

## Install (unpacked)

1. Download this repository as a ZIP and extract it, or clone it.
2. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the repository's `extension` folder.
5. Open or refresh a Digikala product page, for example `https://www.digikala.com/product/dkp-20109389/`.

The DigiPrice panel should appear near the top of the page.

## What it currently does

- Detects a numeric product ID from the current Digikala product URL.
- Requests `https://api.digikala.com/v1/product/{id}/price-chart/` from the extension service worker.
- Displays available marketable price observations by variant, converted from Rial to Toman.
- Shows the available observation count and min/latest/max prices.
- Caches a successful response in memory for 10 minutes to avoid repeated requests while navigating.
- Does not require a Digikala password, GitHub token, VPN, paid API, or always-on computer.

## Known limitations

- This is an MVP. The upstream API is unofficial and may change, rate-limit, or return no history for some products.
- A product page does not guarantee that Digikala exposes historical observations for it.
- Chrome/Edge desktop is the initial target. Mobile browsers are not currently supported.
- The first live test must be performed in the user's browser. A successful extension build does not prove that Digikala accepts the request from every network/browser.
- No data is fabricated. If no usable history is returned, the panel reports that condition.

## Privacy

The extension makes a read-only request to Digikala's public price-chart endpoint for the product page currently open. It does not send browsing history, credentials, or product IDs to a DigiPrice-owned server. It has no analytics or tracking code.

## Development

Manifest V3. No third-party libraries or build step are required.