(() => {
  const ROOT_ID = "digiprice-extension-root";
  const ID_MATCH = location.pathname.match(/(?:dkp-|\/product\/)(\d{1,10})/i);
  const productId = ID_MATCH?.[1];
  if (!productId || document.getElementById(ROOT_ID)) return;

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
      .chart-wrap { width:100%;overflow:hidden; }
      svg { display:block;width:100%;height:auto;min-height:190px; }
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
      <div id="chart" class="chart-wrap"></div>
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
  const svgNode = (name, attrs = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

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

    statusEl.textContent = points.length + " نقطهٔ قیمتی در دادهٔ منبع موجود است" +
      (historyData.today ? " · آخرین تاریخ اعلام‌شده: " + historyData.today : "");
    statusEl.className = "status";

    const width = 900, height = 260, left = 66, right = 22, top = 18, bottom = 42;
    const prices = points.map(p => p.priceRial / 10);
    const min = Math.min(...prices), max = Math.max(...prices);
    const spread = Math.max(max - min, max * 0.03, 1);
    const low = min - spread * 0.12, high = max + spread * 0.12;
    const x = i => left + (points.length === 1 ? 0 : i * (width - left - right) / (points.length - 1));
    const y = price => top + (high - price) * (height - top - bottom) / (high - low);

    const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role:"img", "aria-label":"نمودار تاریخچه قیمت به تومان" });
    for (let i = 0; i < 4; i++) {
      const val = low + (high - low) * i / 3;
      const yy = y(val);
      svg.append(svgNode("line",{x1:left,y1:yy,x2:width-right,y2:yy,stroke:"#e9ecef","stroke-width":1}));
      const label = svgNode("text",{x:left-9,y:yy+4,"text-anchor":"end",fill:"#777","font-size":12});
      label.textContent = fmt(val);
      svg.append(label);
    }
    const path = points.map((p,i) => (i ? "L" : "M") + x(i) + " " + y(p.priceRial/10)).join(" ");
    svg.append(svgNode("path",{d:path,fill:"none",stroke:"#1677c8","stroke-width":3,"stroke-linecap":"round","stroke-linejoin":"round"}));
    points.forEach((p,i) => {
      const circle = svgNode("circle",{cx:x(i),cy:y(p.priceRial/10),r:points.length>20?3.2:4.5,fill:"#1677c8",stroke:"#fff","stroke-width":1.5});
      const title = svgNode("title");
      title.textContent = p.day + " — " + fmt(p.priceRial/10) + " تومان";
      circle.append(title); svg.append(circle);
    });
    [0, Math.floor((points.length-1)/2), points.length-1].filter((v,i,a)=>a.indexOf(v)===i).forEach(i=>{
      const label = svgNode("text",{x:x(i),y:height-13,"text-anchor":i===0?"start":i===points.length-1?"end":"middle",fill:"#777","font-size":12});
      label.textContent = points[i].day; svg.append(label);
    });
    chartEl.append(svg);

    const values = [
      ["آخرین قیمت", prices[prices.length-1]],
      ["کمترین قیمت", min],
      ["بیشترین قیمت", max]
    ];
    values.forEach(([label,value])=>{
      const box=document.createElement("div");
      box.textContent=label;
      const strong=document.createElement("strong");
      strong.textContent=fmt(value)+" تومان";
      box.append(strong); statsEl.append(box);
    });
  }

  function showError(message) {
    statusEl.textContent = message;
    statusEl.className = "status error";
    chartEl.replaceChildren();
    statsEl.replaceChildren();
  }

  function load() {
    reloadEl.disabled = true;
    statusEl.textContent = "در حال دریافت تاریخچهٔ قیمت…";
    statusEl.className = "status";
    chrome.runtime.sendMessage({ type:"DIGIPRICE_GET_HISTORY", productId }, response => {
      reloadEl.disabled = false;
      if (chrome.runtime.lastError) {
        showError("ارتباط با افزونه برقرار نشد. صفحه را Refresh کن.");
        return;
      }
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
    });
  }

  variantEl.addEventListener("change", renderChart);
  reloadEl.addEventListener("click", load);

  function mount() {
    if (document.getElementById(ROOT_ID)) return;
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

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }
})();