const API = "https://api.digikala.com";
const ALLOWED_ORIGIN = "https://abolvardim.github.io";

function cors(origin) {
  const allowed = origin === ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(data, status, origin, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=120",
      ...cors(origin),
      ...extra,
    },
  });
}

function productIdFrom(input) {
  const value = (input || "").trim();
  if (/^\d{1,10}$/.test(value)) return value;
  const match = value.match(/(?:dkp-|product\/)(\d{1,10})/i) || value.match(/\/products\/(\d{1,10})/i);
  return match ? match[1] : null;
}

async function digikala(path, params) {
  const url = new URL(path, API);
  if (params) for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
      "Origin": "https://www.digikala.com",
      "Referer": "https://www.digikala.com/",
      "x-web-client": "desktop",
      "x-web-client-id": "web",
    },
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    const diagnosticHeaders = {};
    for (const name of ["location", "retry-after", "server", "cf-ray", "content-type", "via", "x-cache"]) {
      const value = response.headers.get(name);
      if (value) diagnosticHeaders[name] = value;
    }
    throw new Error(JSON.stringify({
      type: "upstream_redirect",
      status: response.status,
      url: url.toString(),
      headers: diagnosticHeaders
    }));
  }
  if (response.status === 429) {
    const diagnosticHeaders = {};
    for (const name of ["retry-after", "server", "cf-ray", "content-type", "via", "x-cache"]) {
      const value = response.headers.get(name);
      if (value) diagnosticHeaders[name] = value;
    }
    throw new Error(JSON.stringify({
      type: "upstream_rate_limited",
      status: response.status,
      url: url.toString(),
      headers: diagnosticHeaders
    }));
  }
  const bodyText = await response.text();
  let body;
  try { body = JSON.parse(bodyText); }
  catch { throw new Error(`Digikala returned non-JSON (HTTP ${response.status}).`); }
  if (!response.ok || (Number(body?.status) >= 300)) {
    throw new Error(`Digikala API error: HTTP ${response.status}, API status ${body?.status ?? "unknown"}.`);
  }
  return body;
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: "Origin not allowed." }, 403, origin);
    }
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, origin);
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") {
        return json({ ok: true, service: "DigiPrice API proxy", upstream: "Digikala" }, 200, origin);
      }
      if (url.pathname === "/api/history") {
        const id = productIdFrom(url.searchParams.get("id") || url.searchParams.get("url"));
        if (!id) return json({ error: "Send a Digikala product URL or numeric product ID." }, 400, origin);
        const payload = await digikala(`/v1/product/${id}/price-chart/`);
        return json({ product_id: id, data: payload.data || {} }, 200, origin);
      }
      if (url.pathname === "/api/search") {
        const q = (url.searchParams.get("q") || "").trim();
        if (q.length < 2 || q.length > 100) return json({ error: "Search text must be 2–100 characters." }, 400, origin);
        const payload = await digikala("/v1/search/", { q, has_selling_stock: "1", page: "1" });
        const products = (payload.data?.products || []).slice(0, 20).map(p => ({
          id: p.id,
          title: p.title_fa || p.title,
          image: p.images?.main?.url?.[0] || p.images?.main?.url || null,
          price_rial: p.default_variant?.price?.selling_price ?? p.price?.selling_price ?? null,
          url: p.url?.uri || p.url || `https://www.digikala.com/product/dkp-${p.id}/`,
          rating: p.rating?.rate ?? null,
        }));
        return json({ query: q, products, total: payload.data?.pager?.total_items ?? null }, 200, origin);
      }
      if (url.pathname === "/api/product") {
        const id = productIdFrom(url.searchParams.get("id") || url.searchParams.get("url"));
        if (!id) return json({ error: "Send a Digikala product URL or numeric product ID." }, 400, origin);
        const payload = await digikala(`/product/v1/products/${id}/`);
        return json({ product_id: id, data: payload.data || {} }, 200, origin);
      }
      return json({ error: "Not found. Available routes: /health, /api/search, /api/history, /api/product." }, 404, origin);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Unexpected upstream error." }, 502, origin);
    }
  },
};
