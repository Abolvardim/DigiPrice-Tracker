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
SITE = "https://www.digikala.com/"
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
    "Origin": "https://www.digikala.com",
    "Referer": SITE,
    "x-web-client": "desktop",
    "x-web-client-id": "web",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}


def summarize(payload: dict) -> dict:
    data = payload.get("data") or {}
    variants = data.get("variants") or []
    valid = []
    for variant in variants:
        days = variant.get("days") or []
        prices = []
        for day in days:
            if isinstance(day, dict):
                value = day.get("price") or day.get("amount") or day.get("value")
                if isinstance(value, (int, float)) and value > 0:
                    prices.append(value)
            elif isinstance(day, (int, float)) and day > 0:
                prices.append(day)
        lowest = variant.get("lowest")
        if prices or (isinstance(lowest, (int, float)) and lowest > 0):
            valid.append({
                "variant_id": variant.get("id"),
                "days_count": len(days),
                "observed_price_points": len(prices),
                "lowest": lowest,
                "highest": variant.get("highest"),
            })
    return {
        "variant_count": len(variants),
        "variants_with_history": len(valid),
        "history": valid,
        "top_level_keys": sorted(data.keys()) if isinstance(data, dict) else [],
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
        results.append(item)
        time.sleep(2)

    output = {
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "Digikala public product price-chart endpoint",
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
