"""Validate Digikala's public price-chart endpoint for unrelated product IDs.

This is a connectivity/coverage probe, not a scraper or a source of fabricated history.
The script deliberately makes a small, sequential number of requests.
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests

API = "https://api.digikala.com"
SITE = "https://abolvardim.github.io/DigiPrice-Tracker/"
ORIGIN = "https://abolvardim.github.io"
PRODUCT_IDS = [
    20109389,  # Samsung Galaxy A07 (upstream project's live-test fixture)
    20110013,  # another product used by upstream comparison tests
    20110012,  # another product used by upstream comparison tests
    21013179,  # another product used by upstream comparison tests
    4369031,   # Digikala Fresh product (different product vertical)
]
HEADERS = {
    "Accept": "application/json",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "Origin": ORIGIN,
    "Referer": SITE,
    "x-web-client": "desktop",
    "x-web-client-id": "web",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}


def summarize(payload: dict) -> dict:
    """Summarize the raw Digikala price-chart payload without inventing observations."""
    data = payload.get("data") or {}
    charts = data.get("price_chart") or []
    valid = []
    for chart in charts:
        history = chart.get("history") or []
        observations = [
            {
                "day": point.get("day"),
                "selling_price_rial": point.get("selling_price"),
            }
            for point in history
            if point.get("is_marketable")
            and isinstance(point.get("selling_price"), (int, float))
            and point.get("selling_price") > 0
        ]
        if observations:
            prices = [point["selling_price_rial"] for point in observations]
            valid.append({
                "variant_id": chart.get("id"),
                "variant_title": chart.get("title"),
                "history_points": len(observations),
                "first_day": observations[0]["day"],
                "last_day": observations[-1]["day"],
                "lowest_rial": min(prices),
                "highest_rial": max(prices),
            })
    return {
        "today": data.get("today"),
        "variant_count": len(charts),
        "variants_with_history": len(valid),
        "history": valid,
        "top_level_data_keys": sorted(data.keys()) if isinstance(data, dict) else [],
    }

def main() -> int:
    session = requests.Session(impersonate="chrome")
    results = []
    for product_id in PRODUCT_IDS:
        url = f"{API}/v1/product/{product_id}/price-chart/"
        item = {"product_id": product_id, "url": url}
        try:
            response = session.get(url, headers=HEADERS, timeout=25, allow_redirects=True)
            item["http_status"] = response.status_code
            item["final_url"] = str(response.url)
            item["cors_allow_origin"] = response.headers.get("access-control-allow-origin")
            item["cors_allow_methods"] = response.headers.get("access-control-allow-methods")
            if response.status_code != 200:
                item["status"] = "http_error"
                item["body_preview"] = response.text[:300]
            else:
                try:
                    payload = response.json()
                except Exception:
                    item["status"] = "non_json"
                    item["body_preview"] = response.text[:300]
                else:
                    item.update(summarize(payload))
                    api_status = payload.get("status")
                    item["api_status"] = api_status
                    item["status"] = (
                        "history_found"
                        if item["variants_with_history"] > 0
                        else "no_history_or_unexpected_schema"
                    )
        except Exception as exc:  # record network errors per ID; continue with remaining probes
            item["status"] = "network_error"
            item["error"] = f"{type(exc).__name__}: {exc}"
        # Probe browser preflight once: the custom x-web-client headers trigger CORS OPTIONS.
        if product_id == PRODUCT_IDS[0]:
            try:
                preflight = session.options(
                    url,
                    headers={
                        "Origin": ORIGIN,
                        "Access-Control-Request-Method": "GET",
                        "Access-Control-Request-Headers": "x-web-client,x-web-client-id",
                        "Referer": SITE,
                    },
                    timeout=20,
                    allow_redirects=True,
                )
                item["cors_preflight"] = {
                    "http_status": preflight.status_code,
                    "allow_origin": preflight.headers.get("access-control-allow-origin"),
                    "allow_methods": preflight.headers.get("access-control-allow-methods"),
                    "allow_headers": preflight.headers.get("access-control-allow-headers"),
                }
            except Exception as exc:
                item["cors_preflight"] = {"error": f"{type(exc).__name__}: {exc}"}
        results.append(item)
        time.sleep(2)

    output = {
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "Digikala public price-chart endpoint; CORS tested for GitHub Pages origin",
        "results": results,
        "summary": {
            "products_tested": len(results),
            "products_with_history": sum(x.get("status") == "history_found" for x in results),
            "http_or_network_errors": sum(x.get("status") in {"http_error", "network_error"} for x in results),
        },
    }
    Path("validation-results.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if output["summary"]["products_with_history"] else 1


if __name__ == "__main__":
    sys.exit(main())
