const GH_API = "https://api.github.com";
const REPO = "Abolvardim/DigiPrice-Tracker";
const WORKFLOW = "fetch-history.yml";
const RAW_ROOT = "https://raw.githubusercontent.com/Abolvardim/DigiPrice-Tracker/main/data/history/";

function productIdFrom(value) {
  const text = String(value || "").trim();
  if (/^\d{1,10}$/.test(text)) return text;
  const match = text.match(/(?:dkp-|\/product\/)(\d{1,10})/i);
  return match ? match[1] : null;
}

function headers(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function getToken() {
  const { githubToken } = await chrome.storage.local.get(["githubToken"]);
  if (!githubToken) throw new Error("ابتدا توکن GitHub را در تنظیمات افزونه ذخیره کن.");
  return githubToken;
}

async function githubError(response) {
  let detail = "";
  try { detail = (await response.json()).message || ""; } catch {}
  if (response.status === 401) return "GitHub token نامعتبر یا منقضی شده است؛ تنظیمات افزونه را بررسی کن.";
  if (response.status === 403) return "GitHub دسترسی را رد کرد. مجوزهای Actions و Contents باید Read and write باشند.";
  if (response.status === 404) return "Workflow پیدا نشد؛ افزونه را از نسخهٔ جدید مخزن بارگذاری کن.";
  return "خطای GitHub: HTTP " + response.status + (detail ? " — " + detail : "");
}

async function startHistory(rawId) {
  const id = productIdFrom(rawId);
  if (!id) throw new Error("شناسهٔ محصول دیجی‌کالا از نشانی صفحه پیدا نشد.");
  const token = await getToken();
  const requestId = crypto.randomUUID();
  const response = await fetch(
    GH_API + "/repos/" + REPO + "/actions/workflows/" + WORKFLOW + "/dispatches",
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { product_id: id, request_id: requestId } }),
      cache: "no-store"
    }
  );
  if (response.status !== 204) throw new Error(await githubError(response));
  return { productId: id, requestId };
}

async function pollHistory(rawId, requestId) {
  const id = productIdFrom(rawId);
  if (!id || typeof requestId !== "string" || !/^[a-f0-9-]{16,64}$/.test(requestId)) {
    throw new Error("شناسهٔ درخواست نامعتبر است؛ دوباره بارگذاری کن.");
  }
  const token = await getToken();
  const auth = headers(token);
  const runsResponse = await fetch(
    GH_API + "/repos/" + REPO + "/actions/workflows/" + WORKFLOW + "/runs?per_page=30",
    { headers: auth, cache: "no-store" }
  );
  if (!runsResponse.ok) throw new Error(await githubError(runsResponse));
  const runsData = await runsResponse.json();
  const run = (runsData.workflow_runs || []).find(item =>
    item.event === "workflow_dispatch" &&
    item.head_branch === "main" &&
    String(item.display_title || "").includes(requestId)
  );
  if (!run) return { state: "queued" };
  if (run.status !== "completed") return { state: "running" };
  if (run.conclusion !== "success") {
    throw new Error("اجرای GitHub Actions ناموفق بود. جزئیات: https://github.com/" + REPO + "/actions/runs/" + run.id);
  }

  const rawUrl = RAW_ROOT + id + ".json?request=" + encodeURIComponent(requestId);
  const rawResponse = await fetch(rawUrl, { cache: "no-store" });
  if (!rawResponse.ok) throw new Error("Workflow تمام شد اما فایل تاریخچه در دسترس نیست (HTTP " + rawResponse.status + ").");
  const result = await rawResponse.json();
  if (result.productId !== id || result.requestId !== requestId) {
    throw new Error("فایل برگشتی متعلق به همین درخواست نیست؛ برای جلوگیری از نمایش دادهٔ اشتباه، آن را رد کردم.");
  }
  return { state: "done", data: result };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "DIGIPRICE_START_HISTORY") {
    startHistory(message.productId)
      .then(data => sendResponse({ ok: true, ...data }))
      .catch(error => sendResponse({ ok: false, error: error.message || "خطای نامشخص" }));
    return true;
  }
  if (message?.type === "DIGIPRICE_POLL_HISTORY") {
    pollHistory(message.productId, message.requestId)
      .then(data => sendResponse({ ok: true, ...data }))
      .catch(error => sendResponse({ ok: false, error: error.message || "خطای نامشخص" }));
    return true;
  }
  return false;
});
