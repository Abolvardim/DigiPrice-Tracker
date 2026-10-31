export const config = { runtime: "edge" };

const API = "https://api.digikala.com";
const ALLOWED_ORIGIN = "https://abolvardim.github.io";

function send(res, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "cache-control": "no-store",
      "vary": "Origin",
    },
  });
}

export default async function handler(request) {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": ALLOWED_ORIGIN,
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "access-control-max-age": "86400",
        "vary": "Origin",
      },
    });
  }
  if (origin && origin !== ALLOWED_ORIGIN) {
    return send({ error: "Origin not allowed." }, 403);
  }
  if (request.method !== "GET") return send({ error: "Method not allowed." }, 405);

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!/^\d{1,10}$/.test(id)) {
    return send({ error: "Provide a numeric Digikala product ID using ?id=..." }, 400);
  }

  const upstreamUrl = `${API}/v1/product/${id}/price-chart/`;
  try {
    const upstream = await fetch(upstreamUrl, {
      redirect: "manual",
      headers: {
        "accept": "application/json",
        "accept-language": "fa-IR,fa;q=0.9,en;q=0.8",
        "origin": "https://www.digikala.com",
        "referer": "https://www.digikala.com/",
        "x-web-client": "desktop",
        "x-web-client-id": "web",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
    });

    const diagnostic = {
      upstream_status: upstream.status,
      upstream_url: upstreamUrl,
      location: upstream.headers.get("location"),
      server: upstream.headers.get("server"),
      cf_ray: upstream.headers.get("cf-ray"),
      content_type: upstream.headers.get("content-type"),
    };

    if (upstream.status >= 300 && upstream.status < 400) {
      return send({ ok: false, reason: "upstream_redirect", ...diagnostic }, 502);
    }
    if (!upstream.ok) {
      return send({ ok: false, reason: "upstream_http_error", ...diagnostic }, 502);
    }

    const payload = await upstream.json();
    const charts = payload?.data?.price_chart || [];
    const variants = charts.map((chart) => {
      const points = (chart.history || []).filter(
        (point) => point.is_marketable && Number(point.selling_price) > 0
      );
      return {
        variant_id: chart.id ?? null,
        title: chart.title || "",
        points: points.length,
        first_day: points[0]?.day ?? null,
        last_day: points[points.length - 1]?.day ?? null,
      };
    });

    return send({
      ok: true,
      product_id: id,
      today: payload?.data?.today ?? null,
      variant_count: charts.length,
      variants_with_history: variants.filter((v) => v.points > 0).length,
      variants,
      ...diagnostic,
    });
  } catch (error) {
    return send({
      ok: false,
      reason: "fetch_failed",
      message: error instanceof Error ? error.message : String(error),
      upstream_url: upstreamUrl,
    }, 502);
  }
}
