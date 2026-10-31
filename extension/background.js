const API_ROOT = "https://api.digikala.com/v1/product/";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const inFlight = new Map();
const cooldowns = new Map();

function extractProductId(value) {
  const text = String(value || "").trim();
  if (/^\d{1,10}$/.test(text)) return text;
  const match = text.match(/(?:dkp-|\/product\/)(\d{1,10})/i);
  return match ? match[1] : null;
}

async function loadHistory(rawId) {
  const id = extractProductId(rawId);
  if (!id) throw new Error("شناسهٔ محصول دیجی‌کالا از نشانی صفحه پیدا نشد.");

  const cached = cache.get(id);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.data;

  const blockedUntil = cooldowns.get(id) || 0;
  if (Date.now() < blockedUntil) {
    const seconds = Math.ceil((blockedUntil - Date.now()) / 1000);
    throw new Error("درخواست این محصول به‌دلیل محدودیت دیجی‌کالا موقتاً متوقف شده است. حدود " + seconds + " ثانیه صبر کن و سپس دوباره امتحان کن.");
  }
  if (inFlight.has(id)) return inFlight.get(id);

  const task = (async () => {
    const url = API_ROOT + id + "/price-chart/";
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
          "x-web-client": "desktop",
          "x-web-client-id": "web"
        },
        credentials: "omit",
        cache: "no-store"
      });
    } catch (error) {
      throw new Error("ارتباط با سرویس تاریخچهٔ دیجی‌کالا برقرار نشد. ممکن است دسترسی از شبکه یا مرورگر محدود شده باشد.");
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      let waitMs = 60 * 1000;
      if (retryAfter) {
        const seconds = Number(retryAfter);
        const dateMs = Date.parse(retryAfter);
        if (Number.isFinite(seconds) && seconds > 0) waitMs = seconds * 1000;
        else if (Number.isFinite(dateMs) && dateMs > Date.now()) waitMs = dateMs - Date.now();
      }
      waitMs = Math.min(Math.max(waitMs, 30 * 1000), 60 * 60 * 1000);
      cooldowns.set(id, Date.now() + waitMs);
      throw new Error("دیجی‌کالا درخواست تاریخچه را محدود کرده است (HTTP 429). برای جلوگیری از تشدید محدودیت، تا حدود " + Math.ceil(waitMs / 1000) + " ثانیه برای این محصول درخواست تازه نمی‌فرستیم.");
    }
    if (!response.ok) {
      throw new Error("پاسخ ناموفق از دیجی‌کالا: HTTP " + response.status);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("پاسخ دیجی‌کالا JSON معتبر نبود؛ احتمالاً ساختار یا دسترسی API تغییر کرده است.");
    }

    const source = payload?.data?.price_chart;
    if (!Array.isArray(source)) {
      throw new Error("برای این محصول دادهٔ تاریخچه در پاسخ دیجی‌کالا موجود نیست.");
    }

    const variants = source.map((variant, index) => {
      const points = (Array.isArray(variant.history) ? variant.history : [])
        .filter(point => point && point.is_marketable === true && Number(point.selling_price) > 0)
        .map(point => ({
          day: String(point.day || ""),
          priceRial: Number(point.selling_price),
          seller: point.seller || ""
        }))
        .filter(point => point.day && Number.isFinite(point.priceRial))
        .sort((a, b) => a.day.localeCompare(b.day));

      return {
        id: String(variant.id ?? index),
        title: String(variant.title || ("تنوع " + (index + 1))),
        points
      };
    });

    const result = {
      productId: id,
      today: payload?.data?.today || null,
      chartSelectionTitle: payload?.data?.chart_selection_title || "تنوع محصول",
      variants
    };
    cache.set(id, { savedAt: Date.now(), data: result });
    return result;
  })();

  inFlight.set(id, task);
  try {
    return await task;
  } finally {
    inFlight.delete(id);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DIGIPRICE_GET_HISTORY") return false;
  loadHistory(message.productId)
    .then(data => sendResponse({ ok: true, data }))
    .catch(error => sendResponse({ ok: false, error: error.message || "خطای نامشخص" }));
  return true;
});