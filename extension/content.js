(() => {
  const ROOT_ID = "digiprice-extension-root";
  function getProductId() {
    const match = location.pathname.match(/(?:dkp-|\/product\/)(\d{1,10})/i);
    return match?.[1] || null;
  }
  let productId = getProductId();
  if (document.getElementById(ROOT_ID)) return;

  const host = document.createElement("section");
  host.id = ROOT_ID;
  host.style.cssText = "display:block;width:100%;max-width:1200px;margin:20px auto;clear:both;position:relative;z-index:5;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; direction: rtl; font-family: Tahoma, Arial, sans-serif; color:#202124; }
      * { box-sizing:border-box; }
      .card { background:#fff; border:1px solid #e3e5e8; border-radius:14px; padding:18px; box-shadow:0 2px 10px rgba(0,0,0,.045); }
      .top { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px; }
      .brand { font-size:16px;font-weight:700; }
      .sub { color:#69707a;font-size:12px;margin-top:5px; }
      .controls { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
      select,button { font:inherit;border:1px solid #d8dce1;border-radius:8px;padding:8px 10px;background:#fff;color:#202124; }
      button { cursor:pointer;background:#f7f8fa; }
      button:disabled { opacity:.55;cursor:wait; }
      .status { font-size:13px;color:#606770;line-height:1.9;padding:8px 0; }
      .error { color:#a52828; }
      .table-wrap { width:100%;overflow:auto;max-height:440px;border:1px solid #eceff1;border-radius:9px; }
      table { width:100%;border-collapse:collapse;font-size:13px;text-align:right; }
      th,td { padding:10px 12px;border-bottom:1px solid #eceff1;white-space:nowrap; }
      th { position:sticky;top:0;background:#f7f8fa;font-weight:700; }
      tbody tr:last-child td { border-bottom:0; }
      .stats { display:flex;gap:18px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:#5f6368; }
      .stats strong { color:#202124;font-size:13px;display:block;margin-top:4px; }
      .foot { color:#858b94;font-size:11px;line-height:1.8;margin-top:12px;border-top:1px solid #f0f1f2;padding-top:9px; }
      @media(max-width:600px){.card{padding:12px}.top{align-items:flex-start}.brand{font-size:14px}}
    </style>
    <div class="card" dir="rtl">
      <div class="top">
        <div>
          <div class="brand">DigiPrice | تاریخچهٔ قیمت</div>
          <div class="sub">تاریخچهٔ قابل‌دسترس این محصول در دیجی‌کالا</div>
        </div>
        <div class="controls">
          <select id="variant" aria-label="انتخاب تنوع" hidden></select>
          <button id="reload" type="button">بارگذاری مجدد</button>
        </div>
      </div>
      <div id="status" class="status">در حال دریافت تاریخچهٔ قیمت…</div>
      <div id="chart" class="table-wrap"></div>
      <div id="stats" class="stats"></div>
      <div class="foot">قیمت‌ها به تومان نمایش داده می‌شوند. منبع: API عمومی دیجی‌کالا. فقط نقاطی نمایش داده می‌شوند که در دادهٔ منبع قابل‌فروش علامت خورده‌اند؛ نبود داده به معنی صفر بودن قیمت نیست.</div>
    </div>
  `;

  const statusEl = shadow.getElementById("status");
  const chartEl = shadow.getElementById("chart");
  const statsEl = shadow.getElementById("stats");
  const variantEl = shadow.getElementById("variant");
  const reloadEl = shadow.getElementById("reload");
  let historyData = null;

  const fmt = value => Math.round(value).toLocaleString("fa-IR");
  function renderChart() {
    const variant = historyData?.variants?.find(v => v.id === variantEl.value) || historyData?.variants?.[0];
    const points = variant?.points || [];
    chartEl.replaceChildren();
    statsEl.replaceChildren();

    if (!points.length) {
      statusEl.textContent = "برای این محصول/تنوع، تاریخچهٔ قیمت قابل‌نمایشی از دیجی‌کالا دریافت نشد.";
      statusEl.className = "status";
      return;
    }

    statusEl.textContent = points.length + " رکورد قیمت در دادهٔ منبع موجود است" +
      (historyData.today ? " · آخرین تاریخ اعلام‌شده: " + historyData.today : "");
    statusEl.className = "status";

    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>تاریخ</th><th>قیمت (تومان)</th><th>فروشنده</th></tr></thead>";
    const tbody = document.createElement("tbody");
    [...points].reverse().forEach(point => {
      const tr = document.createElement("tr");
      const day = document.createElement("td");
      day.textContent = point.day;
      const price = document.createElement("td");
      price.textContent = fmt(point.priceRial / 10);
      const seller = document.createElement("td");
      seller.textContent = point.seller || "—";
      tr.append(day, price, seller);
      tbody.append(tr);
    });
    table.append(tbody);
    chartEl.append(table);

    const prices = points.map(p => p.priceRial / 10);
    const values = [
      ["آخرین قیمت", prices[prices.length - 1]],
      ["کمترین قیمت", Math.min(...prices)],
      ["بیشترین قیمت", Math.max(...prices)]
    ];
    values.forEach(([label, value]) => {
      const box = document.createElement("div");
      box.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = fmt(value) + " تومان";
      box.append(strong);
      statsEl.append(box);
    });
  }

  function showError(message) {
    statusEl.textContent = message;
    statusEl.className = "status error";
    chartEl.replaceChildren();
    statsEl.replaceChildren();
  }

  function extensionContextAlive() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function load() {
    if (!extensionContextAlive()) {
      reloadEl.disabled = true;
      showError("افزونه به‌روزرسانی شده است؛ این صفحه را یک‌بار کامل Refresh کن.");
      return;
    }
    reloadEl.disabled = true;
    statusEl.textContent = "در حال دریافت تاریخچهٔ قیمت…";
    statusEl.className = "status";
    try {
      chrome.runtime.sendMessage({ type:"DIGIPRICE_GET_HISTORY", productId }, response => {
        try {
          if (!extensionContextAlive()) {
            showError("افزونه به‌روزرسانی شده است؛ این صفحه را یک‌بار کامل Refresh کن.");
            return;
          }
          if (chrome.runtime.lastError) {
            reloadEl.disabled = false;
            showError("ارتباط با افزونه برقرار نشد. صفحه را Refresh کن.");
            return;
          }
          reloadEl.disabled = false;
          if (!response?.ok) {
            showError(response?.error || "دریافت تاریخچه ناموفق بود.");
            return;
          }
          historyData = response.data;
          const variants = historyData.variants || [];
          variantEl.replaceChildren();
          variants.forEach((variant,index)=>{
            const option=document.createElement("option");
            option.value=variant.id;
            option.textContent=variant.title + (variant.points.length ? " ("+variant.points.length+")" : " (بدون داده)");
            variantEl.append(option);
            if (index===0) variantEl.value=variant.id;
          });
          variantEl.hidden = variants.length < 2;
          renderChart();
        } catch {
          reloadEl.disabled = false;
          showError("ارتباط افزونه قطع شد؛ صفحه را کامل Refresh کن.");
        }
      });
    } catch {
      reloadEl.disabled = false;
      showError("افزونه به‌روزرسانی شده است؛ این صفحه را یک‌بار کامل Refresh کن.");
    }
  }

  variantEl.addEventListener("change", renderChart);
  reloadEl.addEventListener("click", load);

  function mount() {
    if (!productId) {
      document.getElementById(ROOT_ID)?.remove();
      return false;
    }
    if (document.getElementById(ROOT_ID)) return true;
    const candidates = [
      document.querySelector("main"),
      document.querySelector("[data-testid*='product']"),
      document.querySelector("main article"),
      document.body
    ].filter(Boolean);
    const target = candidates[0];
    if (target) {
      if (target === document.body) target.prepend(host);
      else target.prepend(host);
      load();
      return true;
    }
    return false;
  }

  if (productId && !mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  // Digikala can change product routes without a full page reload.
  let previousProductId = productId;
  const routeTimer = setInterval(() => {
    if (!extensionContextAlive()) {
      clearInterval(routeTimer);
      return;
    }
    const nextProductId = getProductId();
    if (nextProductId === previousProductId) return;
    previousProductId = nextProductId;
    productId = nextProductId;
    historyData = null;
    if (!productId) {
      host.remove();
      return;
    }
    if (host.isConnected) load();
    else if (!mount()) {
      const observer = new MutationObserver(() => {
        if (mount()) observer.disconnect();
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(()=>observer.disconnect(),15000);
    }
  }, 800);
})();
