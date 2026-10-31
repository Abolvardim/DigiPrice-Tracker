const GH_API = "https://api.github.com";
const REPO = "Abolvardim/DigiPrice-Tracker";
const WORKFLOW = "fetch-history.yml";
const RAW_ROOT = "https://raw.githubusercontent.com/Abolvardim/DigiPrice-Tracker/main/data/history/";
const cache = new Map();
const inFlight = new Map();

function productIdFrom(value) {
  const text = String(value || "").trim();
  if (/^\d{1,10}$/.test(text)) return text;
  const match = text.match(/(?:dkp-|\/product\/)(\d{1,10})/i);
  return match ? match[1] : null;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}
async function githubError(response) {
  let detail = "";
  try { detail = (await response.json()).message || ""; } catch {}
  if (response.status === 401) return "GitHub token نامعتبر یا منقضی شده است؛ تنظیمات افزونه را بررسی کن.";
  if (response.status === 403) return "GitHub دسترسی را رد کرد. مجوزهای Actions و Contents باید Read and write باشند.";
  if (response.status === 404) return "Workflow پیدا نشد؛ مطمئن شو آخرین نسخه افزونه و فایل‌های مخزن به‌روز هستند.";
  return "خطای GitHub: HTTP " + response.status + (detail ? " — " + detail : "");
}

async function fetchViaActions(id) {
  const { githubToken } = await chrome.storage.local.get(["githubToken"]);
  if (!githubToken) throw new Error("ابتدا توکن GitHub را در تنظیمات افزونه ذخیره کن.");
  const token = githubToken;
  const requestId = crypto.randomUUID();
  const headers = await githubHeaders(token);
  const dispatchUrl = GH_API + "/repos/" + REPO + "/actions/workflows/" + WORKFLOW + "/dispatches";

  const dispatch = await fetch(dispatchUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { product_id: id, request_id: requestId } })
  });
  if (dispatch.status !== 204) throw new Error(await githubError(dispatch));

  const runsUrl = GH_API + "/repos/" + REPO + "/actions/workflows/" + WORKFLOW + "/runs?per_page=20";
  let matchedRun = null;
  const deadline = Date.now() + 4 * 60 * 1000;
  while (Date.now() < deadline && !matchedRun) {
    await sleep(3000);
    const response = await fetch(runsUrl, { headers });
    if (!response.ok) throw new Error(await githubError(response));
    const data = await response.json();
    matchedRun = (data.workflow_runs || []).find(run =>
      run.event === "workflow_dispatch" &&
      run.head_branch === "main" &&
      String(run.display_title || "").includes(requestId)
    ) || null;
  }
  if (!matchedRun) throw new Error("GitHub اجرای درخواست را پیدا نکرد؛ در تب Actions وضعیت workflow را بررسی کن.");

  let run = matchedRun;
  while (Date.now() < deadline) {
    if (run.status === "completed") {
      if (run.conclusion !== "success") throw new Error("اجرای GitHub Actions ناموفق بود. جزئیات در تب Actions مخزن قابل مشاهده است.");
      const rawUrl = RAW_ROOT + id + ".json?request=" + encodeURIComponent(requestId);
      const rawResponse = await fetch(rawUrl, { cache: "no-store" });
      if (!rawResponse.ok) throw new Error("Workflow تمام شد اما فایل تاریخچه هنوز در دسترس نیست.");
      const result = await rawResponse.json();
      if (result.productId !== id || result.requestId !== requestId) {
        throw new Error("فایل برگشتی متعلق به همین درخواست نیست؛ برای جلوگیری از نمایش دادهٔ اشتباه، آن را رد کردم.");
      }
      return result;
    }
    await sleep(3000);
    const response = await fetch(GH_API + "/repos/" + REPO + "/actions/runs/" + run.id, { headers });
    if (!response.ok) throw new Error(await githubError(response));
    run = await response.json();
  }
  throw new Error("دریافت تاریخچه بیش از ۴ دقیقه طول کشید. اجرای workflow را در GitHub Actions بررسی کن.");
}

async function loadHistory(rawId) {
  const id = productIdFrom(rawId);
  if (!id) throw new Error("شناسهٔ محصول دیجی‌کالا از نشانی صفحه پیدا نشد.");
  if (cache.has(id)) return cache.get(id);
  if (inFlight.has(id)) return inFlight.get(id);
  const task = fetchViaActions(id);
  inFlight.set(id, task);
  try {
    const result = await task;
    cache.set(id, result);
    return result;
  } finally {
    inFlight.delete(id);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "DIGIPRICE_GET_HISTORY") {
    loadHistory(message.productId)
      .then(data => sendResponse({ ok: true, data }))
      .catch(error => sendResponse({ ok: false, error: error.message || "خطای نامشخص" }));
    return true;
  }
  if (message?.type === "DIGIPRICE_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
