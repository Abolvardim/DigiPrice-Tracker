"""Fetch one Digikala product history and save a compact public JSON cache."""
from __future__ import annotations
import json, os, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from curl_cffi import requests

API = "https://api.digikala.com/v1/product/{}/price-chart/"
PRODUCT_ID = os.environ.get("PRODUCT_ID", "")
REQUEST_ID = os.environ.get("REQUEST_ID", "")
if not re.fullmatch(r"\d{1,10}", PRODUCT_ID):
    raise SystemExit("Invalid product ID")
if not re.fullmatch(r"[a-f0-9-]{16,64}", REQUEST_ID):
    raise SystemExit("Invalid request ID")

headers = {
    "Accept": "application/json",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "Origin": "https://www.digikala.com",
    "Referer": f"https://www.digikala.com/product/dkp-{PRODUCT_ID}/",
    "x-web-client": "desktop",
    "x-web-client-id": "web",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}
session = requests.Session(impersonate="chrome")
last_error = None
payload = None
for attempt in range(3):
    try:
        response = session.get(API.format(PRODUCT_ID), headers=headers, timeout=30, allow_redirects=True)
        if response.status_code == 200:
            payload = response.json()
            break
        last_error = f"Digikala HTTP {response.status_code}: {response.text[:200]}"
        if response.status_code not in (429, 500, 502, 503, 504):
            raise RuntimeError(last_error)
    except Exception as exc:
        last_error = str(exc)
    if attempt < 2:
        time.sleep(3 * (attempt + 1))
if payload is None:
    raise SystemExit(last_error or "Unable to fetch history")

data = payload.get("data") or {}
charts = data.get("price_chart")
if not isinstance(charts, list):
    raise SystemExit("Unexpected Digikala response: price_chart missing")
variants = []
for index, chart in enumerate(charts):
    points = []
    for point in chart.get("history") or []:
        price = point.get("selling_price")
        if point.get("is_marketable") is True and isinstance(price, (int, float)) and price > 0 and point.get("day"):
            points.append({"day": str(point["day"]), "priceRial": int(price), "seller": str(point.get("seller") or "")})
    points.sort(key=lambda p: p["day"])
    variants.append({"id": str(chart.get("id", index)), "title": str(chart.get("title") or f"تنوع {index+1}"), "points": points})

result = {
    "productId": PRODUCT_ID,
    "requestId": REQUEST_ID,
    "fetchedAt": datetime.now(timezone.utc).isoformat(),
    "today": data.get("today"),
    "chartSelectionTitle": data.get("chart_selection_title") or "تنوع محصول",
    "variants": variants,
}
if not any(v["points"] for v in variants):
    raise SystemExit("No marketable price history returned")
out = Path("data/history") / f"{PRODUCT_ID}.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Saved {sum(len(v['points']) for v in variants)} observations to {out}")
