const COMMON_EPD_FILE = "Steel pedestals for system floors.pdf";
const COMMON_IMAGE_FILE = "stütze.jpg";

const state = {
  rows: [],
  scenarioInfo: [],
  moduleInfo: [],
  selectedScenarios: [1],
  theme: "dark",
  expandedProductStage: false,
  expandedConstruction: false,
  expandedEndOfLife: false,
  expandedBenefits: false
};

const dom = {};

const COMMON_MODULES = [
  {
    key: "A4",
    code: "A4",
    title: "Transport to site",
    desc: "Transport to construction site.",
    area: "area-a4",
    tone: "tone-construction",
    codeClass: "code-construction"
  },
  {
    key: "A5",
    code: "A5",
    title: "Installation",
    desc: "Assembly and installation.",
    area: "area-a5",
    tone: "tone-construction",
    codeClass: "code-construction"
  }
];

const SCENARIO_MODULES = [
  {
    key: "C1",
    code: "C1",
    title: "Deconstruction / demolition",
    desc: "Removal at end of life.",
    area: "area-c1",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    key: "C2",
    code: "C2",
    title: "Transport",
    desc: "Transport after removal.",
    area: "area-c2",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    key: "C3",
    code: "C3",
    title: "Waste processing",
    desc: "Sorting or processing before final treatment.",
    area: "area-c3",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    key: "C4",
    code: "C4",
    title: "Disposal",
    desc: "Final disposal stage.",
    area: "area-c4",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  }
];



document.addEventListener("DOMContentLoaded", async () => {
  cacheDom();
  bindEvents();
  initTheme();
  updateDashboardVisibility();
  await loadData();
  populateClassifications();
  renderEmptyState("Choose classification, pedestal type and variant to load the dashboard.");
});

function cacheDom() {
  dom.classificationSelect = document.getElementById("classificationSelect");
  dom.pedestalSelect = document.getElementById("pedestalSelect");
  dom.variantSelect = document.getElementById("variantSelect");
  dom.selectionSummary = document.getElementById("selectionSummary");
  

  dom.epdDownloadBtn = document.getElementById("epdDownloadBtn");
  dom.reportDownloadBtn = document.getElementById("reportDownloadBtn");
  dom.themeToggle = document.getElementById("themeToggle");
  dom.themeLabel = document.getElementById("themeLabel");

  dom.productImage = document.getElementById("productImage");
  dom.productImagePlaceholder = document.getElementById("productImagePlaceholder");
  dom.selectedProductType = document.getElementById("selectedProductType");
  dom.selectedProductVariant = document.getElementById("selectedProductVariant");
  dom.issueDateValue = document.getElementById("issueDateValue");
  dom.validToValue = document.getElementById("validToValue");

  dom.technicalGrid = document.getElementById("technicalGrid");
  dom.scenarioList = document.getElementById("scenarioList");
  dom.scenarioPicker = document.getElementById("scenarioPicker");
  dom.resultsLifecycleGrid = document.getElementById("resultsLifecycleGrid");
  dom.moduleBarChart = document.getElementById("moduleBarChart");
  dom.mainLayout = document.querySelector("#lindnerView .main-layout");
  dom.welcomePanel = document.getElementById("welcomePanel");
  dom.bottomSection = document.getElementById("bottomSection");
  dom.exportPdfBtn = document.getElementById("exportPdfBtn");
}

function bindEvents() {
  dom.classificationSelect.addEventListener("change", onClassificationChange);
  dom.pedestalSelect.addEventListener("change", onPedestalChange);
  dom.variantSelect.addEventListener("change", onVariantChange);
  if (dom.themeToggle) dom.themeToggle.addEventListener("click", toggleTheme);
    // ── Competitor tab toggle ──
  const cmpBtn = document.getElementById("competitorTabBtn");
  if (cmpBtn) {
    cmpBtn.addEventListener("click", () => {
      const isOpen = cmpBtn.getAttribute("aria-pressed") === "true";
      toggleCompetitorPanel(!isOpen);
    });
  }
  // Lindner tab — bind to ALL non-competitor tabs
  document.querySelectorAll(".tool-tab:not(#competitorTabBtn)").forEach(tab => {
    tab.addEventListener("click", () => toggleCompetitorPanel(false));
  });

  // ── Export PDF button ──
  const exportBtn = document.getElementById("exportPdfBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (exportBtn.classList.contains("disabled")) return;
      const isCmp = document.getElementById("competitorTabBtn")?.getAttribute("aria-pressed") === "true";
      if (isCmp) { if (typeof exportCmpPdf === "function") exportCmpPdf(); }
      else exportPdf();
    });
  }

  [dom.epdDownloadBtn, dom.reportDownloadBtn].forEach((button) => {
    button.addEventListener("click", (event) => {
      if (button.classList.contains("disabled")) {
        event.preventDefault();
      }
    });
  });
}

function updateDashboardVisibility() {
  const ready = Boolean(
    dom.classificationSelect.value &&
    dom.pedestalSelect.value &&
    dom.variantSelect.value
  );
  dom.selectionSummary.classList.toggle("hidden-until-ready", !ready);
  dom.mainLayout.classList.toggle("hidden-until-ready", !ready);
  if (dom.bottomSection) dom.bottomSection.classList.toggle("hidden-until-ready", !ready);
  if (dom.welcomePanel) dom.welcomePanel.classList.toggle("hidden-until-ready", ready);
}

async function loadData() {
  try {
    const [rows, scenarioInfo, moduleInfo] = await Promise.all([
      fetchCsv("typesTable.csv"),
      fetchCsv("scenario_info.csv").catch(() => []),
      fetchCsv("module_info.csv").catch(() => [])
    ]);
    state.rows = rows;
    state.scenarioInfo = scenarioInfo;
    state.moduleInfo = moduleInfo;
  } catch (error) {
    console.error(error);
    renderEmptyState("Failed to load typesTable.csv");
  }
}

async function fetchCsv(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  const text = await response.text();
  return parseCsv(text);
}

function parseCsv(text) {
  const rows = csvToRows(text.replace(/^\uFEFF/, ""));
  if (!rows.length) return [];

  const headers = rows[0].map(canonicalHeader);

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => normalizeText(cell) !== ""))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = normalizeText(row[index] ?? "");
      });
      return record;
    });
}

function csvToRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanKeyText(value) {
  return normalizeText(value).toLowerCase();
}

function canonicalHeader(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, "");
}

function field(record, key) {
  return record?.[canonicalHeader(key)] ?? "";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function sumValues(values) {
  const numbers = values.map(toNumber).filter((value) => value !== null);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0);
}
function formatMetric(value) {
  const number = typeof value === "number" ? value : toNumber(value);
  if (number === null) return "—";
  return number.toFixed(2);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildPath(...parts) {
  return parts
    .filter(Boolean)
    .flatMap((part) => String(part).split("/"))
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function setOptions(select, items, placeholder, enabled = true) {
  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.appendChild(first);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });

  select.disabled = !enabled;
}

function populateClassifications() {
  const classifications = uniqueSorted(
    state.rows.map((row) => field(row, "classification"))
  );

  setOptions(dom.classificationSelect, classifications, "Select classification", true);
  setOptions(dom.pedestalSelect, [], "Select pedestal type", false);
  setOptions(dom.variantSelect, [], "Select variant", false);
}

function resetExpansionState() {
  state.expandedProductStage = false;
  state.expandedConstruction = false;
  state.expandedEndOfLife = false;
  state.expandedBenefits = false;
}

function onClassificationChange() {
  const classification = dom.classificationSelect.value;
  resetExpansionState();

  setOptions(dom.variantSelect, [], "Select variant", false);

  if (!classification) {
    setOptions(dom.pedestalSelect, [], "Select pedestal type", false);
    updateSelectionSummary();
    updateDashboardVisibility();
    renderEmptyState("Choose classification, pedestal type and variant to load the dashboard.");
    return;
  }

  const pedestalTypes = uniqueSorted(
    state.rows
      .filter((row) => cleanKeyText(field(row, "classification")) === cleanKeyText(classification))
      .map((row) => field(row, "Pedestal type"))
  );

  setOptions(dom.pedestalSelect, pedestalTypes, "Select pedestal type", true);
  updateSelectionSummary();
  updateDashboardVisibility();
  renderEmptyState("Classification selected. Choose a pedestal type.");
}

function onPedestalChange() {
  const classification = dom.classificationSelect.value;
  const pedestal = dom.pedestalSelect.value;
  resetExpansionState();

  if (!classification || !pedestal) {
    setOptions(dom.variantSelect, [], "Select variant", false);
    updateSelectionSummary();
    updateDashboardVisibility();
    renderEmptyState("Choose a variant to continue.");
    return;
  }

  const variants = uniqueSorted(
    state.rows
      .filter(
        (row) =>
          cleanKeyText(field(row, "classification")) === cleanKeyText(classification) &&
          cleanKeyText(field(row, "Pedestal type")) === cleanKeyText(pedestal)
      )
      .map((row) => field(row, "Variant"))
  );

  setOptions(dom.variantSelect, variants, "Select variant", true);
  updateSelectionSummary();
  updateDashboardVisibility();
  renderEmptyState("Pedestal type selected. Choose a variant.");
}

function onVariantChange() {
  updateSelectionSummary();
  updateDashboardVisibility();

  if (!dom.variantSelect.value) {
    renderEmptyState("Choose a variant to continue.");
    return;
  }

  const record = findSelectedRecord();
  if (!record) {
    renderEmptyState("No matching product was found for the selected combination.");
    return;
  }

  resetExpansionState();
  state.selectedScenarios = [1];
  renderDashboard();
}

function findSelectedRecord() {
  const classification = dom.classificationSelect.value;
  const pedestal = dom.pedestalSelect.value;
  const variant = dom.variantSelect.value;

  return state.rows.find(
    (row) =>
      cleanKeyText(field(row, "classification")) === cleanKeyText(classification) &&
      cleanKeyText(field(row, "Pedestal type")) === cleanKeyText(pedestal) &&
      cleanKeyText(field(row, "Variant")) === cleanKeyText(variant)
  );
}

function getScenario() {
  return {
    id: 1,
    name: "95% Recycling · 5% landfilling"
  };
}

function calculateModules(record) {
  const weight = toNumber(field(record, "Wt of installation kit (kg)"));
  if (weight === null) return null;

  const x = weight - 0.18;

  const values = {
    "A1-A3": 2.37770482179021 * x + 0.128719095432339,
    "A4": 0.00981137514570162 * x + 0.00178844305645018,
    "A5": 0.0738221792872456 * x,
    "C1": 0,
    "C2": 0.00441947648597122 * x + 0.000805593702931929,
    "C3": 0.168928508185918,
    "C4": 0.000768418074781768 * x,
    "D": -1.56466494946565 * x
  };

  values["A1-C4"] =
    values["A1-A3"] +
    values["A4"] +
    values["A5"] +
    values["C1"] +
    values["C2"] +
    values["C3"] +
    values["C4"];

  return values;
}

function renderDashboard() {
  const record = findSelectedRecord();
  const scenario = getScenario();
  const values = calculateModules(record);

  if (!record || !values) {
    renderEmptyState("No matching product was found for the selected combination.");
    return;
  }

  renderDownloads(record);
  renderProductOverview(record);
  renderTechnicalDetails(record);
  renderScenarios(scenario);
  renderResults(values, scenario);

  if (dom.exportPdfBtn) {
    dom.exportPdfBtn.classList.remove("disabled");
    dom.exportPdfBtn.setAttribute("aria-disabled", "false");
  }
}

function renderDownloads(record) {
  const epdHref = buildPath(COMMON_EPD_FILE);
  const reportFile = field(record, "pdf");
  const reportHref = reportFile ? buildPath("report", reportFile) : "";

  setLinkState(dom.epdDownloadBtn, epdHref);
  setLinkState(dom.reportDownloadBtn, reportHref);
}

function setLinkState(link, href) {
  if (href) {
    link.href = href;
    link.classList.remove("disabled");
    link.setAttribute("aria-disabled", "false");
    link.setAttribute("download", "");
  } else {
    link.href = "#";
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
    link.removeAttribute("download");
  }
}

function renderProductOverview(record) {
  const classification = field(record, "classification");
  const variant = field(record, "Variant");

  dom.selectedProductType.textContent = classification || "—";
  dom.selectedProductVariant.textContent = variant || "—";
  dom.issueDateValue.textContent = "17.02.2026";
  dom.validToValue.textContent = "16.02.2031";

  const imagePath = buildPath(COMMON_IMAGE_FILE);

  dom.productImage.style.display = "none";
  dom.productImagePlaceholder.style.display = "grid";
  dom.productImagePlaceholder.textContent = "Product image will appear here";

  dom.productImage.onload = () => {
    dom.productImage.style.display = "block";
    dom.productImagePlaceholder.style.display = "none";
  };

  dom.productImage.onerror = () => {
    dom.productImage.style.display = "none";
    dom.productImagePlaceholder.style.display = "grid";
    dom.productImagePlaceholder.textContent = "Product image will appear here";
  };

  dom.productImage.src = imagePath;
}

function renderTechnicalDetails(record) {
  const weight = field(record, "Wt of installation kit (kg)");

  dom.technicalGrid.className = "metrics-grid single-metric";
  dom.technicalGrid.innerHTML = `
    <div class="metric-box">
      <div>
        <span class="metric-label">Wt of installation kit (kg)</span>
        <div class="metric-value">${formatMetric(weight)}</div>
      </div>
    </div>
  `;
}

function renderScenarios(scenario) {
  const hasInfo = !!getScenarioInfo(scenario.name);
  dom.scenarioList.classList.remove("empty-grid");
  dom.scenarioList.innerHTML = `
    <div class="scenario-info-card selected">
      <div class="scenario-title-row">
        <div class="scenario-name">${scenario.name}</div>
        ${hasInfo ? `<button class="info-icon-btn" data-scenario-name="${escapeHtml(scenario.name)}" aria-label="Learn more">
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.6"/><text x="10" y="14.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" font-family="Helvetica,Arial,sans-serif">i</text></svg>
        </button>` : ""}
      </div>
    </div>
  `;
  dom.scenarioList.querySelectorAll(".info-icon-btn[data-scenario-name]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const name = btn.dataset.scenarioName;
      const desc = getScenarioInfo(name);
      if (desc) openInfoPopup(name, "i", "info-badge-scenario", `<p>${desc}</p>`);
    });
  });

  dom.scenarioPicker.innerHTML = `
    <button type="button" class="scenario-filter-btn active" disabled>
      ${scenario.name}
    </button>
  `;
}

function renderResults(values, scenario) {
  const parts = [];

  parts.push(
    createExpandableSummaryTile({
      area: "area-a13",
      tone: "tone-production",
      codeClass: "code-production",
      code: "A1-A3",
      title: "Product stage",
      value: values["A1-A3"],
      desc: "Raw materials, transport and manufacturing.",
      expanded: state.expandedProductStage,
      toggleTarget: "productStage"
    })
  );

  if (state.expandedConstruction) {
    parts.push(createSingleValueTile(COMMON_MODULES[0], values["A4"], "construction"));
    parts.push(createSingleValueTile(COMMON_MODULES[1], values["A5"], "construction"));
  } else {
    parts.push(
      createExpandableSummaryTile({
        area: "area-construction",
        tone: "tone-construction",
        codeClass: "code-construction",
        code: "A4-A5",
        title: "Construction stage",
        value: values["A4"] + values["A5"],
        desc: "Transport to site and installation.",
        expanded: false,
        toggleTarget: "construction"
      })
    );
  }

  if (state.expandedEndOfLife) {
    parts.push(...SCENARIO_MODULES.map((module) => createSingleValueTile(module, values[module.key], "endOfLife")));
  } else {
    parts.push(createEndOfLifeSummaryTile(values, scenario));
  }

  parts.push(createBenefitsTile(values, scenario));
  parts.push(createTotalTile(values, scenario));

  dom.resultsLifecycleGrid.className = `results-lifecycle-grid ${getResultsGridMode()}`;
  dom.resultsLifecycleGrid.innerHTML = parts.join("");

  bindResultToggleEvents();
  bindResultInfoEvents(scenario);
  renderModuleBarChart(values, scenario);
}

function getResultsGridMode() {
  if (state.expandedConstruction && state.expandedEndOfLife) return "mode-both-expanded";
  if (state.expandedConstruction && !state.expandedEndOfLife) return "mode-construction-expanded";
  if (!state.expandedConstruction && state.expandedEndOfLife) return "mode-eol-expanded";
  return "mode-collapsed";
}

function bindResultToggleEvents() {
  dom.resultsLifecycleGrid.querySelectorAll("[data-toggle-target]").forEach((element) => {
    element.addEventListener("click", () => {
      const target = element.dataset.toggleTarget;

      if (target === "productStage") state.expandedProductStage = !state.expandedProductStage;
      if (target === "construction") state.expandedConstruction = !state.expandedConstruction;
      if (target === "endOfLife") state.expandedEndOfLife = !state.expandedEndOfLife;
      if (target === "benefits") state.expandedBenefits = !state.expandedBenefits;

      const record = findSelectedRecord();
      const values = calculateModules(record);
      if (values) renderResults(values, getScenario());
    });
  });
}
function bindResultInfoEvents(scenario) {
  dom.resultsLifecycleGrid.querySelectorAll(".tile-info-btn[data-module]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const module = btn.dataset.module;
      const general = getModuleInfo(module);
      const sub = getModuleSubInfo();
      let body = "";
      if (cleanKeyText(module) === "a1-a3" && sub) {
        const subs = [
          { code: "A1", label: "Raw material supply", desc: sub.a1 },
          { code: "A2", label: "Transport to manufacturer", desc: sub.a2 },
          { code: "A3", label: "Manufacturing", desc: sub.a3 }
        ];
        body = (general ? `<p>${general}</p>` : "") + subs.filter(s => s.desc).map(s => `
          <div class="popup-sub-row"><div class="popup-sub-head">
            <span class="result-code code-production popup-sub-badge">${s.code}</span>
            <span class="popup-sub-label">${s.label}</span></div>
            <p class="popup-scenario-desc">${s.desc}</p></div>`).join("");
      } else if (["C1","C2","C3","C4","D"].includes(module)) {
        const sDesc = getModuleScenarioDesc(module, 1);
        body = (general ? `<p>${general}</p>` : "") + (sDesc ? `<div class="popup-scenario-row"><span class="popup-scenario-label">${escapeHtml(scenario.name)}</span><p class="popup-scenario-desc">${sDesc}</p></div>` : "");
      } else {
        body = general ? `<p>${general}</p>` : "";
      }
      if (!body) return;
      const badgeMap = { "A1-A3":"code-production","A4":"code-construction","A5":"code-construction","C1":"code-endlife","C2":"code-endlife","C3":"code-endlife","C4":"code-endlife","D":"code-benefits" };
      openInfoPopup(btn.dataset.title || module, module, `result-code ${badgeMap[module] || "code-total"}`, body);
    });
  });
}
function createExpandableSummaryTile({ area, tone, codeClass, code, title, value, desc, expanded, toggleTarget }) {
  return `
    <div class="result-tile ${area} ${tone} toggle-tile ${expanded ? "is-open" : ""}" data-toggle-target="${toggleTarget}">
      <div class="result-head">
        <div class="result-head-left"><h4 class="result-title">${title}</h4></div>
        <div class="result-head-right">${infoBtn(code, title)}<span class="result-code ${codeClass}">${code}</span></div>
      </div>
      <div class="single-value">${formatMetric(value)}</div>
      <div class="tile-detail ${expanded ? "show" : ""}">
        <p class="result-desc detail-desc">${desc}</p>
      </div>
    </div>
  `;
}

function createSingleValueTile(module, value, toggleTarget = "") {
  const isToggle = Boolean(toggleTarget);
  return `
    <div class="result-tile ${module.area} ${module.tone} tile-appearing ${isToggle ? "toggle-tile" : ""}" ${isToggle ? `data-toggle-target="${toggleTarget}"` : ""}>
      <div class="result-head">
        <div class="result-head-left">
          <h4 class="result-title">${module.title}</h4>
          <p class="result-desc">${module.desc}</p>
        </div>
        <div class="result-head-right">${infoBtn(module.code, module.title)}<span class="result-code ${module.codeClass}">${module.code}</span></div>
      </div>
      <div class="single-value">${formatMetric(value)}</div>
    </div>
  `;
}

function createEndOfLifeSummaryTile(values, scenario) {
  const total = values["C1"] + values["C2"] + values["C3"] + values["C4"];
  return `
    <div class="result-tile area-eol tone-endlife toggle-tile" data-toggle-target="endOfLife">
      <div class="result-head">
        <div class="result-head-left"><h4 class="result-title">End of life stage</h4></div>
        <div class="result-head-right">${infoBtn("C1", "End of life stage")}<span class="result-code code-endlife">C1-C4</span></div>
      </div>
      <div class="compare-stack">
        ${createScenarioValueLines([{ name: scenario.name, value: total }])}
      </div>
    </div>
  `;
}

function createBenefitsTile(values, scenario) {
  return `
    <div class="result-tile area-d tone-benefits toggle-tile ${state.expandedBenefits ? "is-open" : ""}" data-toggle-target="benefits">
      <div class="result-head">
        <div class="result-head-left"><h4 class="result-title">Benefits beyond life cycle stage</h4></div>
        <div class="result-head-right">${infoBtn("D", "Benefits beyond life cycle stage")}<span class="result-code code-benefits">D</span></div>
      </div>
      <div class="compare-stack">
        ${createScenarioValueLines([{ name: scenario.name, value: values["D"] }])}
      </div>
      <div class="tile-detail ${state.expandedBenefits ? "show" : ""}">
        <p class="result-desc detail-desc">Potential benefits or loads beyond the system boundary.</p>
      </div>
    </div>
  `;
}

function createScenarioValueLines(rows) {
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return rows
    .map((row) => {
      const width = (Math.abs(row.value) / maxAbs) * 100;
      const type = row.value >= 0 ? "positive" : "negative";

      return `
        <div class="compare-line">
          <div class="compare-meta">
            <span>${escapeHtml(row.name)}</span>
            <strong>${formatMetric(row.value)}</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${type}" style="--w:${width}"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function createTotalTile(values, scenario) {
  return `
    <div class="result-tile area-total tone-total">
      <div class="result-head">
        <div>
          <h4 class="result-title">A1-C4 Total (kg/m²)</h4>
          <p class="result-desc">Combined result up to end of life for the selected scenario.</p>
        </div>
        <span class="result-code code-total">A1-C4</span>
      </div>

      <div class="total-grid">
        <div class="total-card">
          <span>${escapeHtml(scenario.name)}</span>
          <strong>${formatMetric(values["A1-C4"])}</strong>
        </div>
      </div>
    </div>
  `;
}
/* ─── Info lookups (producttype is always "ALL" for stutzen) ─── */
function getScenarioInfo(scenarioName) {
  const row = state.scenarioInfo.find(r =>
    cleanKeyText(field(r, "scenario_name")) === cleanKeyText(scenarioName)
  );
  return row ? field(row, "description") : null;
}
function getModuleInfo(module) {
  const row = state.moduleInfo.find(r =>
    cleanKeyText(field(r, "module")) === cleanKeyText(module)
  );
  return row ? (field(row, "description_general") || null) : null;
}
function getModuleScenarioDesc(module, sIndex) {
  const row = state.moduleInfo.find(r =>
    cleanKeyText(field(r, "module")) === cleanKeyText(module)
  );
  if (!row) return null;
  return field(row, `description_s${sIndex}`) || null;
}
function getModuleSubInfo() {
  const row = state.moduleInfo.find(r =>
    cleanKeyText(field(r, "module")) === "a1-a3"
  );
  if (!row) return null;
  const a1 = field(row, "description_a1"), a2 = field(row, "description_a2"), a3 = field(row, "description_a3");
  if (!a1 && !a2 && !a3) return null;
  return { a1, a2, a3 };
}

/* ─── Info popup ─── */
function openInfoPopup(title, badge, badgeClass, body) {
  let overlay = document.getElementById("infoPopupOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "infoPopupOverlay";
    overlay.className = "info-popup-overlay";
    overlay.innerHTML = `
      <div class="info-popup-card" role="dialog" aria-modal="true">
        <div class="info-popup-head">
          <div class="info-popup-title-row">
            <span class="info-popup-badge ${badgeClass}">${badge}</span>
            <h3 class="info-popup-title">${title}</h3>
          </div>
          <button class="info-popup-close" aria-label="Close">\u00D7</button>
        </div>
        <div class="info-popup-body">${body}</div>
      </div>`;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector(".info-popup-badge").className = `info-popup-badge ${badgeClass}`;
    overlay.querySelector(".info-popup-badge").textContent = badge;
    overlay.querySelector(".info-popup-title").textContent = title;
    overlay.querySelector(".info-popup-body").innerHTML = body;
  }
  requestAnimationFrame(() => overlay.classList.add("open"));
}
function closeInfoPopup() {
  const overlay = document.getElementById("infoPopupOverlay");
  if (overlay) overlay.classList.remove("open");
}
document.addEventListener("click", e => {
  if (e.target.classList && e.target.classList.contains("info-popup-overlay")) closeInfoPopup();
  if (e.target.closest && e.target.closest(".info-popup-close")) closeInfoPopup();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeInfoPopup(); });

function infoBtn(module, title) {
  return `<button class="tile-info-btn" data-module="${module}" data-title="${escapeHtml(title)}" aria-label="More info">
    <svg viewBox="0 0 20 20" fill="none" width="15" height="15"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.6"/><text x="10" y="14.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" font-family="Helvetica,Arial,sans-serif">i</text></svg>
  </button>`;
}
function renderEmptyState(message) {
  dom.selectedProductType.textContent = "—";
  dom.selectedProductVariant.textContent = message;
  dom.issueDateValue.textContent = "—";
  dom.validToValue.textContent = "—";

  dom.productImage.removeAttribute("src");
  dom.productImage.style.display = "none";
  dom.productImagePlaceholder.style.display = "grid";
  dom.productImagePlaceholder.textContent = "Product image will appear here";

  dom.technicalGrid.className = "metrics-grid empty-grid";
  dom.technicalGrid.innerHTML = `<div class="empty-panel">Technical details will load here.</div>`;

  dom.scenarioList.className = "scenario-list empty-grid";
  dom.scenarioList.innerHTML = `<div class="empty-panel">Scenario details will appear here.</div>`;
  dom.scenarioPicker.innerHTML = "";

  dom.resultsLifecycleGrid.className = "results-lifecycle-grid empty-grid";
  dom.resultsLifecycleGrid.innerHTML = `<div class="empty-panel">${message}</div>`;

  dom.moduleBarChart.className = "module-bar-chart empty-grid";
  dom.moduleBarChart.innerHTML = `<div class="empty-panel">${message}</div>`;

  setLinkState(dom.epdDownloadBtn, "");
  setLinkState(dom.reportDownloadBtn, "");
}

function updateSelectionSummary() {
  const classification = dom.classificationSelect.value;
  const pedestal = dom.pedestalSelect.value;
  const variant = dom.variantSelect.value;

  if (!classification || !pedestal || !variant) return;
  dom.selectionSummary.textContent = `Loaded configuration: ${classification} · ${variant}`;
}

function renderModuleBarChart(values, scenario) {
  const chart = dom.moduleBarChart;
  if (!chart) return;
  if (!values) {
    chart.className = "module-bar-chart empty-grid";
    chart.innerHTML = `<div class="empty-panel">No graph data available.</div>`;
    return;
  }

  // Stutzen accessor — reads directly from the calculated values object
  // Single scenario, so s is always the one scenario object
  const getVal = (key, s) => {
    if (key === "(A1-C4)") return values["A1-C4"] ?? null;
    return values[key] ?? null;
  };

  const dispToggle = `
    <div class="chart-disp-toggle">
      <button class="chart-disp-btn ${state.chartDisplayMode === "values" ? "active" : ""}" data-disp="values">Values</button>
      <button class="chart-disp-btn ${state.chartDisplayMode === "percent" ? "active" : ""}" data-disp="percent">%</button>
    </div>`;

  // Single scenario array for pie/donut/legend functions
  const scenarioArr = [scenario];

  if (state.chartView === "modules") {
    const allGroups = buildModuleChartGroups(values, scenario);
    const modPills = allGroups.map(g => `
      <button class="chart-mod-btn ${!state.activeModules || state.activeModules.has(g.key) ? "active" : ""}"
        data-mod-key="${g.key}" title="${g.sub}">${g.label}</button>`).join("");

    if (state.chartDisplayMode === "percent") {
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row"><div></div>${dispToggle}</div>
        ${_renderModulePieChartsBase(scenarioArr, "xpie", getVal)}`;
      _bindExplodingPie(chart);
      return;
    }

    let groups = allGroups;
    if (state.activeModules) groups = groups.filter(g => state.activeModules.has(g.key));
    if (!groups.length) {
      chart.className = "module-bar-chart empty-grid";
      chart.innerHTML = `<div class="empty-panel">No graph data available.</div>`;
      return;
    }
    const scale = getChartScale(groups);
    chart.className = "module-bar-chart";
    chart.innerHTML = `
      <div class="chart-controls-row"><div class="chart-mod-selector">${modPills}</div>${dispToggle}</div>
      ${renderModuleChartLegend(scenarioArr)}
      <div class="module-chart-canvas">
        <div class="module-chart-plot">
          ${groups.map((g, i) => createModuleChartGroup(g, scale, i)).join("")}
        </div>
        <div class="module-chart-note">Click module buttons above to filter.</div>
      </div>`;
  } else if (state.chartView === "a1c4") {
    const a1c4Val = values["A1-C4"] ?? null;
    const dVal = values["D"] ?? null;
    const netVal = (a1c4Val !== null && dVal !== null) ? a1c4Val + dVal : null;

    if (state.chartDisplayMode === "percent") {
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row"><div></div>${dispToggle}</div>
        ${renderModuleChartLegend(scenarioArr)}
        ${_renderDonutRingsSavedBase(scenarioArr,
          s => a1c4Val,
          s => dVal)}`;
    } else {
      const a1c4Group = { key: "A1-C4", label: "A1-C4", sub: "Total", tone: "total",
        bars: [{ label: scenario.name, seriesIndex: 0, value: a1c4Val }].filter(b => b.value !== null) };
      const dGroup = { key: "D", label: "D", sub: "Benefit (Module D)", tone: "benefits",
        bars: [{ label: scenario.name, seriesIndex: 0, value: dVal }].filter(b => b.value !== null) };
      const netGroup = { key: "Net", label: "Net Carbon", sub: "A1-C4 + D", tone: "total",
        bars: [{ label: scenario.name, seriesIndex: 0, value: netVal }].filter(b => b.value !== null) };
      const groups = [a1c4Group, dGroup, netGroup].filter(g => g.bars.length > 0);
      const scale = getChartScale(groups);
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row"><div></div>${dispToggle}</div>
        ${renderModuleChartLegend(scenarioArr)}
        <div class="module-chart-canvas">
          <div class="module-chart-plot chart-plot-wide">
            ${groups.map((g, i) => createModuleChartGroup(g, scale, i)).join("")}
          </div>
          <div class="module-chart-note">A1-C4 total \u00B7 Module D benefit \u00B7 Net Carbon (A1-C4 + D).</div>
        </div>`;
    }
  }
}

function buildModuleChartGroups(values, scenario) {
  const groups = [];
  const eolMap = { C1: "Deconstruction", C2: "Transport", C3: "Waste processing", C4: "Disposal" };

  // A1-A3
  groups.push({ key: "A1-A3", label: "A1-A3", sub: "Product stage", tone: "production",
    bars: [{ label: scenario.name, value: values["A1-A3"] ?? null, seriesIndex: 0 }].filter(b => b.value !== null) });

  // A4
  groups.push({ key: "A4", label: "A4", sub: "Transport to site", tone: "construction",
    bars: [{ label: scenario.name, value: values["A4"] ?? null, seriesIndex: 0 }].filter(b => b.value !== null) });

  // A5
  groups.push({ key: "A5", label: "A5", sub: "Installation", tone: "construction",
    bars: [{ label: scenario.name, value: values["A5"] ?? null, seriesIndex: 0 }].filter(b => b.value !== null) });

  // C1–C4
  ["C1", "C2", "C3", "C4"].forEach(base => {
    groups.push({ key: base, label: base, sub: eolMap[base], tone: "endlife",
      bars: [{ label: scenario.name, value: values[base] ?? null, seriesIndex: 0 }].filter(b => b.value !== null) });
  });

  // D
  groups.push({ key: "D", label: "D", sub: "Benefits beyond", tone: "benefits",
    bars: [{ label: scenario.name, value: values["D"] ?? null, seriesIndex: 0 }].filter(b => b.value !== null) });

  return groups.filter(g => g.bars.length > 0);
}
function getChartScale(groups) {
  const values = groups
    .flatMap((group) => group.bars.map((bar) => bar.value))
    .filter((value) => value !== null);

  const positives = values.filter((value) => value > 0);
  const negatives = values.filter((value) => value < 0).map((value) => Math.abs(value));

  const rawMaxPositive = positives.length ? Math.max(...positives) : 0;
  const rawMaxNegative = negatives.length ? Math.max(...negatives) : 0;
  const paddingFactor = 1.08;

  const maxPositive = rawMaxPositive * paddingFactor;
  const maxNegative = rawMaxNegative * paddingFactor;

  if (rawMaxPositive === 0 && rawMaxNegative === 0) {
    return { maxPositive: 1, maxNegative: 0, positiveZone: 100, negativeZone: 0, zeroBottom: 0 };
  }

  if (rawMaxNegative === 0) {
    return { maxPositive: maxPositive || 1, maxNegative: 0, positiveZone: 100, negativeZone: 0, zeroBottom: 0 };
  }

  if (rawMaxPositive === 0) {
    return { maxPositive: 0, maxNegative: maxNegative || 1, positiveZone: 0, negativeZone: 100, zeroBottom: 100 };
  }

  const total = maxPositive + maxNegative;
  const positiveZone = (maxPositive / total) * 100;
  const negativeZone = (maxNegative / total) * 100;

  return {
    maxPositive,
    maxNegative,
    positiveZone,
    negativeZone,
    zeroBottom: negativeZone
  };
}

function createModuleChartGroup(group, scale, groupIndex) {
  return `
    <div class="module-chart-group tone-${group.tone}" style="--group-index:${groupIndex};">
      <div class="module-chart-bars" style="--zero-line-bottom:${scale.zeroBottom}%;">
        <div class="module-chart-zero-line"></div>
        ${group.bars.map((bar, barIndex) => createModuleChartBar(group, bar, scale, barIndex)).join("")}
      </div>
      <div class="module-chart-group-label">
        ${group.label}
        <span class="module-chart-group-sub">${group.sub}</span>
      </div>
    </div>
  `;
}

function createModuleChartBar(group, bar, scale, barIndex) {
  const value = bar.value ?? 0;
  const minVisiblePct = 3;

  const positiveRaw =
    value > 0 && scale.maxPositive > 0
      ? (Math.abs(value) / scale.maxPositive) * scale.positiveZone
      : 0;

  const negativeRaw =
    value < 0 && scale.maxNegative > 0
      ? (Math.abs(value) / scale.maxNegative) * scale.negativeZone
      : 0;

  const positiveHeight =
    value > 0 ? Math.min(Math.max(positiveRaw, minVisiblePct), scale.positiveZone) : 0;

  const negativeHeight =
    value < 0 ? Math.min(Math.max(negativeRaw, minVisiblePct), scale.negativeZone) : 0;

  const barClass = bar.common ? `common ${group.tone}` : `series-${bar.seriesIndex ?? 0}`;

  const positionStyle =
    value > 0
      ? `height:${positiveHeight}%; bottom:${scale.zeroBottom}%;`
      : value < 0
      ? `height:${negativeHeight}%; bottom:calc(${scale.zeroBottom}% - ${negativeHeight}%);`
      : `height:0; bottom:${scale.zeroBottom}%;`;

  return `
    <div class="module-chart-slot">
      <div class="module-chart-tooltip">${formatMetric(value)}</div>
      <div
        class="module-chart-bar ${value >= 0 ? "positive" : "negative"} ${barClass}"
        style="${positionStyle}; --bar-index:${barIndex};"
      ></div>
    </div>
  `;
}

function renderModuleChartLegend(selectedScenarios) {
  if (!selectedScenarios.length) return "";
  return `
    <div class="module-chart-legend">
      ${selectedScenarios.map((scenario, index) => `
        <div class="module-legend-chip">
          <span class="module-legend-dot" style="${getLegendDotStyle(index)}"></span>
          <span>${escapeHtml(scenario.name)}</span>
        </div>`).join("")}
    </div>`;
}

function getLegendDotStyle(index = 0) {
  return `background: ${(SCENARIO_COLORS[index] || SCENARIO_COLORS[0]).grad};`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initTheme() {
  // Light mode deferred system-wide — stutzen is dark-only for now.
  applyTheme("dark");
}

function toggleTheme() {
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("stuetzen-lca-theme", nextTheme);
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  if (dom.themeLabel) dom.themeLabel.textContent = theme === "dark" ? "Light" : "Dark";
}
/* ════════════════════════════════════════════════════════════════════
   S.4-A — BODEN CHART ENGINE (Lindner + Competitor shared)
   ════════════════════════════════════════════════════════════════════ */

/* ─── Add chartView + chartDisplayMode + activeModules to state ─── */
// Run this once on load — patch state object
state.chartView = "modules";
state.chartDisplayMode = "values";
state.activeModules = null;

const SCENARIO_COLORS = [
  { solid: "#044459", grad: "linear-gradient(180deg, #044459, #1A8FA8)" },
  { solid: "#E40428", grad: "linear-gradient(180deg, #AE0C1E, #E40428)" },
  { solid: "#23B9D6", grad: "linear-gradient(180deg, #1A8FA8, #23B9D6)" }
];
const DONUT_ACCENT = [
  { fill: "#044459", track: "rgba(4,68,89,0.14)" },
  { fill: "#E40428", track: "rgba(228,4,40,0.14)" },
  { fill: "#23B9D6", track: "rgba(35,185,214,0.14)" }
];

function buildDonutRingSvg(pct, fillColor, trackColor, size, stroke) {
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const clamp = Math.min(Math.max(pct, 0), 100);
  const dash = `${(clamp / 100) * circ} ${circ}`;
  return `
    <svg class="donut-ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${trackColor}" stroke-width="${stroke}" class="donut-ring-track"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${fillColor}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${dash}" stroke-dashoffset="0"
        transform="rotate(-90 ${cx} ${cy})" class="donut-ring-slice"><title>${clamp.toFixed(1)}%</title></circle>
    </svg>`;
}

function _renderDonutRingsSavedBase(selectedScenarios, getA1c4Val, getDVal) {
  if (!selectedScenarios.length) return `<div class="dash-empty">No data.</div>`;
  const SIZE = 160, STROKE = 22;
  const cards = selectedScenarios.map((s, i) => {
    const a1c4 = getA1c4Val(s);
    const d = getDVal(s);
    const dNum = typeof d === "number" ? d : toNumber(d);
    const a1c4Num = typeof a1c4 === "number" ? a1c4 : toNumber(a1c4);
    const net = (a1c4Num !== null && dNum !== null) ? a1c4Num + dNum : null;
    const ac = DONUT_ACCENT[i] || DONUT_ACCENT[0];
    let savedPct = 0;
    if (a1c4Num !== null && net !== null && a1c4Num !== 0) {
      const remaining = Math.abs(net / a1c4Num) * 100;
      savedPct = (net < 0) ? 0 : Math.max(0, 100 - remaining);
    }
    const svg = buildDonutRingSvg(savedPct, ac.fill, ac.track, SIZE, STROKE);
    return `
      <div class="donut-ring-card">
        <div class="donut-ring-label">${escapeHtml(s.name)}</div>
        <div class="donut-ring-svg-wrap">
          ${svg}
          <div class="donut-ring-centre">
            <span class="donut-ring-centre-pct" style="color:${ac.fill}">${savedPct.toFixed(1)}%</span>
            <span class="donut-ring-centre-sub">SAVED</span>
          </div>
        </div>
        <div class="donut-ring-legend">
          <div class="donut-ring-legend-item"><span class="donut-ring-legend-dot" style="background:${ac.fill}"></span><span class="donut-ring-legend-name">Net Carbon</span><span class="donut-ring-legend-val">${formatMetric(net)}</span></div>
          <div class="donut-ring-legend-item"><span class="donut-ring-legend-dot" style="background:${ac.fill};opacity:0.3;border:1px solid ${ac.fill}"></span><span class="donut-ring-legend-name">A1-C4 base</span><span class="donut-ring-legend-val">${formatMetric(a1c4Num)}</span></div>
          <div class="donut-ring-legend-item"><span class="donut-ring-legend-dot" style="background:#23B9D6"></span><span class="donut-ring-legend-name">Module D</span><span class="donut-ring-legend-val">${formatMetric(dNum)}</span></div>
        </div>
      </div>`;
  }).join("");
  return `
    <div class="donut-ring-row">${cards}</div>
    <div class="donut-ring-note">Ring shows % of A1-C4 burden avoided by Module D. Net Carbon = A1-C4 + D \u00B7 Values in kg CO\u2082eq / m\u00B2.</div>`;
}

const MOD_PIE_COLOURS = {
  "A1-A3": "#E40428", "A4": "#AE0C1E", "A5": "#7A0815",
  "C1": "#044459", "C2": "#0A6680", "C3": "#1A8FA8", "C4": "#23B9D6"
};
const MOD_PIE_LABELS = {
  "A1-A3": "Product stage", "A4": "Transport", "A5": "Installation",
  "C1": "Deconstruction", "C2": "Transport (EoL)", "C3": "Waste processing", "C4": "Disposal"
};
const MOD_PIE_KEYS = ["A1-A3", "A4", "A5", "C1", "C2", "C3", "C4"];

function buildPieLegend() {
  const items = [
    { key: "A1-A3", label: "Product stage" }, { key: "A4", label: "Transport to site" },
    { key: "A5", label: "Installation" }, { key: "C1", label: "Deconstruction" },
    { key: "C2", label: "Transport (EoL)" }, { key: "C3", label: "Waste processing" },
    { key: "C4", label: "Disposal" }
  ];
  return `
    <div class="pie-legend"><div class="pie-legend-title">Lifecycle Stages</div>
      <div class="pie-legend-grid">
        ${items.map(item => `
          <div class="pie-legend-item">
            <span class="pie-legend-swatch" style="background:${MOD_PIE_COLOURS[item.key]}"></span>
            <div class="pie-legend-text"><span class="pie-legend-code">${item.key}</span><span class="pie-legend-label">${item.label}</span></div>
          </div>`).join("")}
      </div>
    </div>`;
}

function buildExplodingPie(rawVals, total, a1c4Val, cardId) {
  const SIZE = 220, STROKE = 38, GAP = 2.5, EXPLODE = 10;
  const r = (SIZE - STROKE) / 2, cx = SIZE / 2, cy = SIZE / 2, ir = r - STROKE;
  const gapRad = (GAP * Math.PI) / 180;
  const numSlices = MOD_PIE_KEYS.filter(k => rawVals[k] > 0).length;
  const totalGapRad = gapRad * numSlices;
  let angle = -Math.PI / 2;
  const slices = MOD_PIE_KEYS.map(key => {
    const val = rawVals[key] || 0;
    if (val === 0) return null;
    const frac = val / total;
    const sweep = Math.max(frac * (2 * Math.PI - totalGapRad), 0.01);
    const startA = angle + gapRad / 2;
    const endA = startA + sweep;
    angle = endA + gapRad / 2;
    const midAngle = startA + sweep / 2;
    const pct = (frac * 100).toFixed(1);
    const x1o = cx + r * Math.cos(startA), y1o = cy + r * Math.sin(startA);
    const x2o = cx + r * Math.cos(endA), y2o = cy + r * Math.sin(endA);
    const x1i = cx + ir * Math.cos(endA), y1i = cy + ir * Math.sin(endA);
    const x2i = cx + ir * Math.cos(startA), y2i = cy + ir * Math.sin(startA);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1o} ${y1o} A ${r} ${r} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${ir} ${ir} 0 ${large} 0 ${x2i} ${y2i} Z`;
    const dx = Math.cos(midAngle) * EXPLODE, dy = Math.sin(midAngle) * EXPLODE;
    const tipR = r + EXPLODE + 18;
    const tipX = cx + tipR * Math.cos(midAngle), tipY = cy + tipR * Math.sin(midAngle);
    return { key, pct, path, dx, dy, tipX, tipY, colour: MOD_PIE_COLOURS[key] };
  }).filter(Boolean);

  const sliceSvg = slices.map(sl => `
    <g class="xpie-slice-g" data-card="${cardId}" data-key="${sl.key}" data-pct="${sl.pct}"
       data-label="${escapeHtml(MOD_PIE_LABELS[sl.key])}" data-dx="${sl.dx.toFixed(2)}" data-dy="${sl.dy.toFixed(2)}"
       data-tipx="${sl.tipX.toFixed(1)}" data-tipy="${sl.tipY.toFixed(1)}" style="cursor:pointer;">
      <path d="${sl.path}" fill="transparent" stroke="transparent" stroke-width="${EXPLODE * 2 + 12}"
            stroke-linejoin="round" class="xpie-hover-zone" pointer-events="all"/>
      <path d="${sl.path}" fill="${sl.colour}" class="xpie-path" opacity="0.93" pointer-events="none"/>
    </g>`).join("");

  const tooltipSvg = `
    <g id="${cardId}-tip" style="display:none;" pointer-events="none">
      <rect id="${cardId}-tip-bg" x="0" y="0" width="60" height="22" rx="11" fill="rgba(22,28,50,0.92)"/>
      <text id="${cardId}-tip-txt" x="30" y="15" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff"></text>
    </g>`;

  return `
    <svg class="xpie-svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" overflow="visible">
      <defs><filter id="${cardId}-sh"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.2)"/></filter></defs>
      <g filter="url(#${cardId}-sh)">${sliceSvg}</g>
      ${tooltipSvg}
      <text id="${cardId}-cval" x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="13" font-weight="800" fill="#ffffff">${formatMetric(a1c4Val)}</text>
      <text id="${cardId}-csub" x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="7.5" font-weight="600" fill="rgba(255,255,255,0.55)">kg CO\u2082eq/m\u00B2</text>
      <text id="${cardId}-hmod" x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="8" font-weight="700" fill="rgba(255,255,255,0.55)" style="display:none;"></text>
      <text id="${cardId}-hpct" x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="18" font-weight="800" fill="#ffffff" style="display:none;"></text>
    </svg>`;
}

function _bindExplodingPie(container) {
  container.querySelectorAll(".xpie-slice-g").forEach(g => {
    const cardId = g.dataset.card, key = g.dataset.key, pct = g.dataset.pct, label = g.dataset.label;
    const dx = parseFloat(g.dataset.dx), dy = parseFloat(g.dataset.dy);
    const tipX = parseFloat(g.dataset.tipx), tipY = parseFloat(g.dataset.tipy);
    const colour = MOD_PIE_COLOURS[key] || "#c0001a";
    const cval = document.getElementById(`${cardId}-cval`);
    const csub = document.getElementById(`${cardId}-csub`);
    const hmod = document.getElementById(`${cardId}-hmod`);
    const hpct = document.getElementById(`${cardId}-hpct`);
    const tipG = document.getElementById(`${cardId}-tip`);
    const tipBg = document.getElementById(`${cardId}-tip-bg`);
    const tipTxt = document.getElementById(`${cardId}-tip-txt`);
    const enter = () => {
      const vp = g.querySelector(".xpie-path");
      if (vp) { vp.style.transform = `translate(${dx}px,${dy}px)`; vp.style.filter = `brightness(1.15) drop-shadow(0 4px 12px rgba(0,0,0,0.32))`; vp.style.opacity = "1"; }
      container.querySelectorAll(`.xpie-slice-g[data-card="${cardId}"]`).forEach(o => { if (o !== g) { const op = o.querySelector(".xpie-path"); if (op) op.style.opacity = "0.22"; } });
      if (cval) cval.style.display = "none"; if (csub) csub.style.display = "none";
      if (hmod) { hmod.textContent = label; hmod.style.display = "block"; }
      if (hpct) { hpct.textContent = pct + "%"; hpct.setAttribute("fill", colour); hpct.style.display = "block"; }
      if (tipG && tipBg && tipTxt) {
        const text = pct + "%", tW = Math.max(text.length * 8 + 16, 44), tH = 22;
        const tx = Math.min(Math.max(tipX - tW / 2, 2), 218 - tW), ty = Math.min(Math.max(tipY - tH / 2, 2), 218 - tH);
        tipBg.setAttribute("x", tx); tipBg.setAttribute("y", ty); tipBg.setAttribute("width", tW); tipBg.setAttribute("height", tH); tipBg.setAttribute("fill", colour);
        tipTxt.setAttribute("x", tx + tW / 2); tipTxt.setAttribute("y", ty + tH - 6); tipTxt.textContent = text;
        tipG.style.display = "block";
      }
    };
    const leave = () => {
      const vp = g.querySelector(".xpie-path");
      if (vp) { vp.style.transform = ""; vp.style.filter = ""; vp.style.opacity = "0.93"; }
      container.querySelectorAll(`.xpie-slice-g[data-card="${cardId}"]`).forEach(o => { if (o !== g) { const op = o.querySelector(".xpie-path"); if (op) op.style.opacity = "0.93"; } });
      if (cval) cval.style.display = "block"; if (csub) csub.style.display = "block";
      if (hmod) hmod.style.display = "none"; if (hpct) hpct.style.display = "none";
      if (tipG) tipG.style.display = "none";
    };
    g.addEventListener("mouseenter", enter);
    g.addEventListener("mouseleave", leave);
    g.addEventListener("touchstart", e => { e.preventDefault(); enter(); }, { passive: false });
    g.addEventListener("touchend", () => setTimeout(leave, 1400));
  });
}

function _renderModulePieChartsBase(selectedScenarios, idPrefix, getVal) {
  if (!selectedScenarios.length) return `<div class="dash-empty">No data.</div>`;
  const cards = selectedScenarios.map((s, sIdx) => {
    const rawVals = {};
    MOD_PIE_KEYS.forEach(key => { const raw = getVal(key, s); rawVals[key] = raw !== null ? Math.abs(raw) : 0; });
    const total = Object.values(rawVals).reduce((a, b) => a + b, 0);
    const a1c4Val = getVal("(A1-C4)", s);
    const cardId = `${idPrefix}-${sIdx}-${Math.random().toString(36).slice(2, 7)}`;
    if (total === 0) return `<div class="xpie-card"><div class="xpie-scenario">${escapeHtml(s.name)}</div><div class="dash-empty" style="min-height:80px">No data</div></div>`;
    return `<div class="xpie-card"><div class="xpie-scenario">${escapeHtml(s.name)}</div><div class="xpie-svg-wrap">${buildExplodingPie(rawVals, total, a1c4Val, cardId)}</div></div>`;
  }).join("");
  return `${buildPieLegend()}<div class="xpie-row">${cards}</div><div class="mod-pie-note">Each pie = A1-C4 lifecycle total (100%). Module D excluded. Hover a slice for details.</div>`;
}
/* ─── S.4 Chart control handlers ─── */
document.addEventListener("click", e => {
  // Lindner view toggle
  const viewBtn = e.target.closest(".chart-view-btn:not([data-cmp-view])");
  if (viewBtn && viewBtn.dataset.view) {
    const v = viewBtn.dataset.view;
    if (v !== state.chartView) {
      state.chartView = v; state.activeModules = null;
      document.querySelectorAll(".chart-view-btn:not([data-cmp-view])").forEach(b => b.classList.toggle("active", b.dataset.view === v));
      const record = findSelectedRecord();
      const values = record ? calculateModules(record) : null;
      if (values) renderModuleBarChart(values, getScenario());
    }
    return;
  }
  // Lindner display toggle
  const dispBtn = e.target.closest(".chart-disp-btn[data-disp]");
  if (dispBtn) {
    const m = dispBtn.dataset.disp;
    if (m !== state.chartDisplayMode) {
      state.chartDisplayMode = m;
      const record = findSelectedRecord();
      const values = record ? calculateModules(record) : null;
      if (values) renderModuleBarChart(values, getScenario());
    }
    return;
  }
  // Lindner module pills
  const modBtn = e.target.closest(".chart-mod-btn:not(.cmp-mod-btn)");
  if (modBtn) {
    const key = modBtn.dataset.modKey;
    if (!state.activeModules) state.activeModules = new Set([...document.querySelectorAll(".chart-mod-btn:not(.cmp-mod-btn)")].map(b => b.dataset.modKey));
    if (state.activeModules.has(key)) { if (state.activeModules.size > 1) state.activeModules.delete(key); }
    else state.activeModules.add(key);
    const record = findSelectedRecord();
    const values = record ? calculateModules(record) : null;
    if (values) renderModuleBarChart(values, getScenario());
    return;
  }
});

/* ════════════════════════════════════════════════════════════════════
   S.5 — COMPETITOR PANEL — Floor Pedestals (mirrors wall pattern)
   ════════════════════════════════════════════════════════════════════ */
const CMP_DIVISION = "Floor Pedestals";
const cmpState = {
  impacts: [], products: [], epds: [], pdfMap: [],
  selectedScenarios: [], chartView: "modules", chartDisplayMode: "values",
  _loaded: false, impact: null, activeModules: null, scenarios: [],
  expandedProductStage: false, expandedConstruction: false,
  expandedEndOfLife: false, expandedBenefits: false
};
const cmpDom = {};
const CMP_MODULES = [
  { key: "A1-A3", code: "A1-A3", title: "Product stage", desc: "Raw materials, transport and manufacturing.", area: "area-a13", tone: "tone-production", codeClass: "code-production" },
  { key: "A4", code: "A4", title: "Transport to site", desc: "Transport to construction site.", area: "area-a4", tone: "tone-construction", codeClass: "code-construction" },
  { key: "A5", code: "A5", title: "Installation", desc: "Assembly and installation.", area: "area-a5", tone: "tone-construction", codeClass: "code-construction" }
];
const CMP_EOL_MODULES = [
  { base: "C1", code: "C1", title: "Deconstruction / demolition", desc: "Removal at end of life.", area: "area-c1", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C2", code: "C2", title: "Transport", desc: "Transport after removal.", area: "area-c2", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C3", code: "C3", title: "Waste processing", desc: "Sorting or processing before final treatment.", area: "area-c3", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C4", code: "C4", title: "Disposal", desc: "Final disposal stage.", area: "area-c4", tone: "tone-endlife", codeClass: "code-endlife" }
];
function cmpImpactCol(base, id) { return id === 1 ? base : `${base}/${id - 1}`; }

function toggleCompetitorPanel(open) {
  const cmpBtn = document.getElementById("competitorTabBtn");
  const lindnerBtn = document.querySelector(".tool-tab:not(#competitorTabBtn)");
  const panel = document.getElementById("competitorPanel");
  const lindnerView = document.getElementById("lindnerView");
  const mainCfg = document.getElementById("mainConfigPanel");
  if (!cmpBtn || !panel) return;
  cmpBtn.setAttribute("aria-pressed", open ? "true" : "false");
  cmpBtn.classList.toggle("tool-tab-active", open);
  cmpBtn.classList.toggle("tool-tab-link", !open);
  if (lindnerBtn) lindnerBtn.classList.toggle("tool-tab-active", !open);
  panel.style.display = open ? "block" : "none";
  if (lindnerView) lindnerView.style.display = open ? "none" : "";
  if (mainCfg) mainCfg.style.display = open ? "none" : "";
  if (dom.epdDownloadBtn) dom.epdDownloadBtn.style.display = open ? "none" : "";
  if (dom.reportDownloadBtn) dom.reportDownloadBtn.style.display = open ? "none" : "";
  if (open && !cmpState._loaded) initEmbeddedCompetitor();
}

async function initEmbeddedCompetitor() {
  cmpState._loaded = true;
  cmpDom.productFamilySelect = document.getElementById("cmp_productFamilySelect");
  cmpDom.competitorSelect = document.getElementById("cmp_competitorSelect");
  cmpDom.productVariantSelect = document.getElementById("cmp_productVariantSelect");
  cmpDom.selectionSummary = document.getElementById("cmp_selectionSummary");
  cmpDom.mainLayout = document.getElementById("cmp_mainLayout");
  cmpDom.bottomSection = document.getElementById("cmp_bottomSection");
  cmpDom.productImage = document.getElementById("cmp_productImage");
  cmpDom.productImagePlaceholder = document.getElementById("cmp_productImagePlaceholder");
  cmpDom.selectedCompetitor = document.getElementById("cmp_selectedCompetitor");
  cmpDom.selectedVariant = document.getElementById("cmp_selectedVariant");
  cmpDom.issueDateValue = document.getElementById("cmp_issueDateValue");
  cmpDom.validToValue = document.getElementById("cmp_validToValue");
  cmpDom.technicalGrid = document.getElementById("cmp_technicalGrid");
  cmpDom.scenarioList = document.getElementById("cmp_scenarioList");
  cmpDom.scenarioPicker = document.getElementById("cmp_scenarioPicker");
  cmpDom.resultsLifecycleGrid = document.getElementById("cmp_resultsLifecycleGrid");
  cmpDom.mainBarChart = document.getElementById("cmp_mainBarChart");
  try {
    const [impacts, products, epds, pdfMap] = await Promise.all([
      fetchCsv("../competitor/floor_comparison_impacts.csv"),
      fetchCsv("../competitor/competitor_product.csv"),
      fetchCsv("../competitor/competitor_epd.csv"),
      fetchCsv("../competitor/competitor_pdf_map.csv").catch(() => [])
    ]);
    cmpState.impacts = impacts; cmpState.products = products; cmpState.epds = epds; cmpState.pdfMap = pdfMap;
  } catch (e) {
    console.error("Competitor CSV load error:", e);
    cmpDom.selectionSummary.textContent = "Unable to load competitor data.";
    return;
  }
  const families = uniqueSorted(
    cmpState.impacts.filter(r => cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION)).map(r => field(r, "product_family"))
  );
  cmpSetOpts(cmpDom.productFamilySelect, families, "Select product family", true);
  cmpSetOpts(cmpDom.competitorSelect, [], "Select competitor", false);
  cmpSetOpts(cmpDom.productVariantSelect, [], "Select product variant", false);
  cmpDom.productFamilySelect.addEventListener("change", onCmpFamilyChange);
  cmpDom.competitorSelect.addEventListener("change", onCmpCompetitorChange);
  cmpDom.productVariantSelect.addEventListener("change", onCmpVariantChange);
}

function cmpSetOpts(sel, items, placeholder, enabled) {
  sel.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = placeholder; sel.appendChild(blank);
  items.forEach(item => { const o = document.createElement("option"); o.value = o.textContent = item; sel.appendChild(o); });
  sel.disabled = !enabled;
}

function onCmpFamilyChange() {
  const fam = cmpDom.productFamilySelect.value;
  cmpSetOpts(cmpDom.competitorSelect, [], "Select competitor", false);
  cmpSetOpts(cmpDom.productVariantSelect, [], "Select product variant", false);
  cmpDom.mainLayout.style.display = "none"; cmpDom.bottomSection.style.display = "none";
  if (!fam) { cmpDom.selectionSummary.textContent = "Select a product family to begin."; return; }
  const competitors = uniqueSorted(
    cmpState.impacts.filter(r => cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) && cleanKeyText(field(r, "product_family")) === cleanKeyText(fam)).map(r => field(r, "producttype_comparable"))
  );
  cmpSetOpts(cmpDom.competitorSelect, competitors, "Select competitor", true);
  cmpDom.selectionSummary.textContent = `${fam} — choose a competitor.`;
}

function onCmpCompetitorChange() {
  const fam = cmpDom.productFamilySelect.value, comp = cmpDom.competitorSelect.value;
  cmpSetOpts(cmpDom.productVariantSelect, [], "Select product variant", false);
  cmpDom.mainLayout.style.display = "none"; cmpDom.bottomSection.style.display = "none";
  if (!comp) return;
  const variants = uniqueSorted(
    cmpState.impacts.filter(r => cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) && cleanKeyText(field(r, "product_family")) === cleanKeyText(fam) && cleanKeyText(field(r, "producttype_comparable")) === cleanKeyText(comp)).map(r => field(r, "productvariant_comparable"))
  );
  cmpSetOpts(cmpDom.productVariantSelect, variants, "Select product variant", true);
  cmpDom.selectionSummary.textContent = `${comp} — choose a product variant.`;
}

function cmpGetScenarios(impactRow) {
  return [1, 2, 3].map(id => { const name = field(impactRow, `Scenario ${id}`); if (!name) return null; return { id, name, emoji: "" }; }).filter(Boolean);
}
function cmpResetExpansion() {
  cmpState.expandedProductStage = false; cmpState.expandedConstruction = false;
  cmpState.expandedEndOfLife = false; cmpState.expandedBenefits = false;
}

function onCmpVariantChange() {
  const fam = cmpDom.productFamilySelect.value;
  const comp = cmpDom.competitorSelect.value;
  const variant = cmpDom.productVariantSelect.value;
  if (!variant) return;
  cmpResetExpansion();
  cmpState.activeModules = null;
  const impact = cmpState.impacts.find(r =>
    cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) &&
    cleanKeyText(field(r, "product_family")) === cleanKeyText(fam) &&
    cleanKeyText(field(r, "producttype_comparable")) === cleanKeyText(comp) &&
    cleanKeyText(field(r, "productvariant_comparable")) === cleanKeyText(variant)
  );
  const product = cmpState.products.find(r =>
    cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) &&
    cleanKeyText(field(r, "product_family")) === cleanKeyText(fam) &&
    cleanKeyText(field(r, "competitor")) === cleanKeyText(comp) &&
    cleanKeyText(field(r, "productvariant_comparable")) === cleanKeyText(variant)
  );
  const epd = cmpState.epds.find(r =>
    cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) &&
    cleanKeyText(field(r, "product_family")) === cleanKeyText(fam) &&
    cleanKeyText(field(r, "competitor")) === cleanKeyText(comp)
  );
  if (!impact) { cmpDom.selectionSummary.textContent = "No impact data found for this variant."; return; }
  cmpState.impact = impact;
  const scenarios = cmpGetScenarios(impact);
  cmpState.scenarios = scenarios;
  cmpState.selectedScenarios = scenarios.map(s => s.id);
  cmpState.chartView = "modules";
  cmpState.chartDisplayMode = "values";
  document.querySelectorAll("[data-cmp-view]").forEach(b => b.classList.toggle("active", b.dataset.cmpView === "modules"));
  cmpDom.selectionSummary.textContent = `Loaded: ${comp} — ${variant}`;
  cmpDom.selectedCompetitor.textContent = comp;
  cmpDom.selectedVariant.textContent = variant;
  cmpDom.issueDateValue.textContent = field(epd, "issuedate") || field(epd, "Issue date") || "—";
  cmpDom.validToValue.textContent = field(epd, "validto") || field(epd, "Valid to") || "—";
  const img = field(epd, "image");
  cmpDom.productImage.style.display = "none";
  cmpDom.productImagePlaceholder.style.display = "grid";
  if (img) {
    cmpDom.productImage.onload = () => { cmpDom.productImage.style.display = "block"; cmpDom.productImagePlaceholder.style.display = "none"; };
    cmpDom.productImage.onerror = () => { cmpDom.productImage.style.display = "none"; cmpDom.productImagePlaceholder.style.display = "grid"; };
    cmpDom.productImage.src = buildPath("..", "competitor", img);
  } else { cmpDom.productImage.removeAttribute("src"); }
  cmpDom.technicalGrid.classList.remove("empty-grid");
  cmpDom.technicalGrid.className = "metrics-grid";
  cmpDom.technicalGrid.innerHTML = [
    { label: "Layer thickness (mm)", value: product ? (field(product, "Layer thickness") || field(product, "layerthickness")) : "—" },
    { label: "Density (kg/m³)", value: product ? (field(product, "Density") || field(product, "density")) : "—" },
    { label: "Declared unit (kg/m²)", value: product ? (field(product, "declared unit") || field(product, "declaredunit")) : "—" }
  ].map(i => `<div class="metric-box"><div><span class="metric-label">${i.label}</span><div class="metric-value">${i.value || "—"}</div></div></div>`).join("");
  cmpRenderScenarios(scenarios);
  cmpDom.mainLayout.style.display = "grid";
  cmpDom.bottomSection.style.display = "block";
  if (dom.exportPdfBtn) { dom.exportPdfBtn.classList.remove("disabled"); dom.exportPdfBtn.setAttribute("aria-disabled", "false"); }
  cmpRenderResults(impact, scenarios);
}

function cmpRenderScenarios(scenarios) {
  cmpDom.scenarioList.classList.remove("empty-grid");
  cmpDom.scenarioList.innerHTML = scenarios.map(s => {
    const active = cmpState.selectedScenarios.includes(s.id);
    return `<div class="scenario-info-card ${active ? "selected" : ""}"><div class="scenario-title-row"><div class="scenario-name">${escapeHtml(s.name)}</div></div></div>`;
  }).join("");
  cmpDom.scenarioPicker.innerHTML = scenarios.map(s => {
    const active = cmpState.selectedScenarios.includes(s.id);
    return `<button type="button" class="scenario-filter-btn ${active ? "active" : ""}" data-cmp-scenario-id="${s.id}">${escapeHtml(s.name)}</button>`;
  }).join("");
  cmpDom.scenarioPicker.querySelectorAll("[data-cmp-scenario-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.cmpScenarioId);
      const set = new Set(cmpState.selectedScenarios);
      if (set.has(id)) { if (set.size === 1) return; set.delete(id); } else set.add(id);
      cmpState.selectedScenarios = scenarios.map(s => s.id).filter(i => set.has(i));
      cmpDom.scenarioPicker.querySelectorAll("[data-cmp-scenario-id]").forEach(b => b.classList.toggle("active", set.has(Number(b.dataset.cmpScenarioId))));
      cmpRenderResults(cmpState.impact, scenarios);
    });
  });
}

function cmpRenderResults(impact, scenarios) {
  if (!impact) {
    cmpDom.resultsLifecycleGrid.className = "results-lifecycle-grid empty-grid";
    cmpDom.resultsLifecycleGrid.innerHTML = `<div class="dash-empty">No impact data found.</div>`;
    return;
  }
  const selected = scenarios.filter(s => cmpState.selectedScenarios.includes(s.id));
  const parts = [];
  parts.push(cmpExpandableTile({ area: "area-a13", tone: "tone-production", codeClass: "code-production", code: "A1-A3", title: "Product stage", value: toNumber(field(impact, "A1-A3")), desc: "Raw materials, transport and manufacturing.", expanded: cmpState.expandedProductStage, toggleTarget: "productStage" }));
  if (cmpState.expandedConstruction) {
    parts.push(cmpSingleTile(CMP_MODULES[1], impact));
    parts.push(cmpSingleTile(CMP_MODULES[2], impact));
  } else {
    parts.push(cmpExpandableTile({ area: "area-construction", tone: "tone-construction", codeClass: "code-construction", code: "A4-A5", title: "Construction stage", value: sumValues([field(impact, "A4"), field(impact, "A5")]), desc: "Transport to site and installation.", expanded: false, toggleTarget: "construction" }));
  }
  if (cmpState.expandedEndOfLife) {
    CMP_EOL_MODULES.forEach(m => parts.push(cmpScenarioTile(m, impact, selected)));
  } else {
    parts.push(cmpEolTile(impact, selected));
  }
  parts.push(cmpBenefitsTile(impact, selected));
  parts.push(cmpTotalTile(impact, selected));
  cmpDom.resultsLifecycleGrid.className = `results-lifecycle-grid ${cmpGridMode()}`;
  cmpDom.resultsLifecycleGrid.innerHTML = parts.join("");
  cmpBindToggles(impact, scenarios);
  if (typeof cmpRenderChart === "function") cmpRenderChart(impact, selected);
}

function cmpGridMode() {
  if (cmpState.expandedConstruction && cmpState.expandedEndOfLife) return "mode-both-expanded";
  if (cmpState.expandedConstruction && !cmpState.expandedEndOfLife) return "mode-construction-expanded";
  if (!cmpState.expandedConstruction && cmpState.expandedEndOfLife) return "mode-eol-expanded";
  return "mode-collapsed";
}
function cmpBindToggles(impact, scenarios) {
  cmpDom.resultsLifecycleGrid.querySelectorAll("[data-toggle-target]").forEach(el => {
    el.addEventListener("click", () => {
      const t = el.dataset.toggleTarget;
      if (t === "productStage") cmpState.expandedProductStage = !cmpState.expandedProductStage;
      else if (t === "construction") cmpState.expandedConstruction = !cmpState.expandedConstruction;
      else if (t === "endOfLife") cmpState.expandedEndOfLife = !cmpState.expandedEndOfLife;
      else if (t === "benefits") cmpState.expandedBenefits = !cmpState.expandedBenefits;
      cmpRenderResults(impact, scenarios);
    });
  });
}
function cmpExpandableTile({ area, tone, codeClass, code, title, value, desc, expanded, toggleTarget }) {
  return `<div class="result-tile ${area} ${tone} toggle-tile ${expanded ? "is-open" : ""}" data-toggle-target="${toggleTarget}"><div class="result-head"><div><h4 class="result-title">${title}</h4></div><span class="result-code ${codeClass}">${code}</span></div><div class="single-value">${formatMetric(value)}</div><div class="tile-detail ${expanded ? "show" : ""}"><p class="result-desc detail-desc">${desc}</p></div></div>`;
}
function cmpSingleTile(module, impact) {
  return `<div class="result-tile ${module.area} ${module.tone} tile-appearing"><div class="result-head"><div><h4 class="result-title">${module.title}</h4><p class="result-desc">${module.desc}</p></div><span class="result-code ${module.codeClass}">${module.code}</span></div><div class="single-value">${formatMetric(toNumber(field(impact, module.key)))}</div></div>`;
}
function cmpValueLines(rows) {
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.value ?? 0)), 1);
  return rows.length ? rows.map(row => {
    const w = (Math.abs(row.value ?? 0) / maxAbs) * 100;
    const type = (row.value ?? 0) >= 0 ? "positive" : "negative";
    return `<div class="compare-line"><div class="compare-meta"><span>${escapeHtml(row.name)}</span><strong>${formatMetric(row.value)}</strong></div><div class="bar-track"><div class="bar-fill ${type}" style="--w:${w}"></div></div></div>`;
  }).join("") : `<div class="dash-empty">No data</div>`;
}
function cmpEolTile(impact, selected) {
  const rows = selected.map(s => ({ name: s.name, value: sumValues(["C1", "C2", "C3", "C4"].map(c => field(impact, cmpImpactCol(c, s.id)))) })).filter(r => r.value !== null);
  return `<div class="result-tile area-eol tone-endlife toggle-tile" data-toggle-target="endOfLife"><div class="result-head"><div><h4 class="result-title">End of life stage</h4></div><span class="result-code code-endlife">C1-C4</span></div><div class="compare-stack">${cmpValueLines(rows)}</div></div>`;
}
function cmpBenefitsTile(impact, selected) {
  const rows = selected.map(s => ({ name: s.name, value: toNumber(field(impact, cmpImpactCol("D", s.id))) })).filter(r => r.value !== null);
  return `<div class="result-tile area-d tone-benefits toggle-tile ${cmpState.expandedBenefits ? "is-open" : ""}" data-toggle-target="benefits"><div class="result-head"><div><h4 class="result-title">Benefits beyond life cycle stage</h4></div><span class="result-code code-benefits">D</span></div><div class="compare-stack">${cmpValueLines(rows)}</div><div class="tile-detail ${cmpState.expandedBenefits ? "show" : ""}"><p class="result-desc detail-desc">Potential benefits or loads beyond the system boundary.</p></div></div>`;
}
function cmpScenarioTile(module, impact, selected) {
  const rows = selected.map(s => ({ name: s.name, value: toNumber(field(impact, cmpImpactCol(module.base, s.id))) })).filter(r => r.value !== null);
  return `<div class="result-tile ${module.area} ${module.tone} tile-appearing"><div class="result-head"><div><h4 class="result-title">${module.title}</h4><p class="result-desc">${module.desc}</p></div><span class="result-code ${module.codeClass}">${module.code}</span></div><div class="compare-stack">${cmpValueLines(rows)}</div></div>`;
}
function cmpTotalTile(impact, selected) {
  const cards = selected.map(s => { const v = toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id))); return `<div class="total-card"><span>${escapeHtml(s.name)}</span><strong>${formatMetric(v)}</strong></div>`; }).join("");
  return `<div class="result-tile area-total tone-total"><div class="result-head"><div><h4 class="result-title">A1-C4 Total (kg CO₂eq/m²)</h4><p class="result-desc">Combined result up to end of life for selected scenarios.</p></div><span class="result-code code-total">A1-C4</span></div><div class="total-grid">${cards || `<div class="dash-empty">No total values available.</div>`}</div></div>`;
}

function cmpRenderChart(impact, selected) {
  const chart = cmpDom.mainBarChart;
  if (!chart) return;
  if (!impact) {
    chart.className = "module-bar-chart empty-grid";
    chart.innerHTML = `<div class="dash-empty">No graph data available.</div>`;
    return;
  }
  if (!cmpState.chartView) cmpState.chartView = "modules";
  if (!cmpState.chartDisplayMode) cmpState.chartDisplayMode = "values";
  const getVal = (key, s) => {
    if (key === "(A1-C4)") return toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id)));
    if (key === "A1-A3" || key === "A4" || key === "A5") return toNumber(field(impact, key));
    return toNumber(field(impact, cmpImpactCol(key, s.id)));
  };
  const dispToggle = `
    <div class="chart-disp-toggle">
      <button class="chart-disp-btn ${cmpState.chartDisplayMode === "values" ? "active" : ""}" data-cmp-disp="values">Values</button>
      <button class="chart-disp-btn ${cmpState.chartDisplayMode === "percent" ? "active" : ""}" data-cmp-disp="percent">%</button>
    </div>`;
  if (cmpState.chartView === "modules") {
    const eolMap = { C1: "Deconstruction", C2: "Transport", C3: "Waste processing", C4: "Disposal" };
    const allGroups = [];
    allGroups.push({ key: "A1-A3", label: "A1-A3", sub: "Product stage", tone: "production",
      bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, "A1-A3")), seriesIndex: i })).filter(b => b.value !== null) });
    allGroups.push({ key: "A4", label: "A4", sub: "Transport to site", tone: "construction",
      bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, "A4")), seriesIndex: i })).filter(b => b.value !== null) });
    allGroups.push({ key: "A5", label: "A5", sub: "Installation", tone: "construction",
      bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, "A5")), seriesIndex: i })).filter(b => b.value !== null) });
    ["C1", "C2", "C3", "C4"].forEach(base => allGroups.push({ key: base, label: base, sub: eolMap[base], tone: "endlife",
      bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, cmpImpactCol(base, s.id))), seriesIndex: i })).filter(b => b.value !== null) }));
    allGroups.push({ key: "D", label: "D", sub: "Benefits beyond", tone: "benefits",
      bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, cmpImpactCol("D", s.id))), seriesIndex: i })).filter(b => b.value !== null) });
    const groups0 = allGroups.filter(g => g.bars.length > 0);
    const modPills = groups0.map(g => `
      <button class="chart-mod-btn cmp-mod-btn ${!cmpState.activeModules || cmpState.activeModules.has(g.key) ? "active" : ""}"
        data-mod-key="${g.key}" title="${g.sub}">${g.label}</button>`).join("");
    if (cmpState.chartDisplayMode === "percent") {
      chart.className = "module-bar-chart";
      chart.innerHTML = `<div class="chart-controls-row"><div></div>${dispToggle}</div>${_renderModulePieChartsBase(selected, "cxpie", getVal)}`;
      _bindExplodingPie(chart);
      return;
    }
    const groups = cmpState.activeModules ? groups0.filter(g => cmpState.activeModules.has(g.key)) : groups0;
    if (!groups.length) {
      chart.className = "module-bar-chart empty-grid";
      chart.innerHTML = `<div class="dash-empty">No graph data available.</div>`;
      return;
    }
    const scale = getChartScale(groups);
    chart.className = "module-bar-chart";
    chart.innerHTML = `
      <div class="chart-controls-row"><div class="chart-mod-selector">${modPills}</div>${dispToggle}</div>
      ${renderModuleChartLegend(selected)}
      <div class="module-chart-canvas">
        <div class="module-chart-plot">
          ${groups.map((g, i) => createModuleChartGroup(g, scale, i)).join("")}
        </div>
        <div class="module-chart-note">Click module buttons above to filter.</div>
      </div>`;
  } else if (cmpState.chartView === "a1c4") {
    if (cmpState.chartDisplayMode === "percent") {
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row"><div></div>${dispToggle}</div>
        ${renderModuleChartLegend(selected)}
        ${_renderDonutRingsSavedBase(selected,
          s => toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id))),
          s => toNumber(field(impact, cmpImpactCol("D", s.id))))}`;
    } else {
      const a1c4Group = { key: "A1-C4", label: "A1-C4", sub: "Total", tone: "total",
        bars: selected.map((s, i) => ({ label: s.name, seriesIndex: i, value: toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id))) })).filter(b => b.value !== null) };
      const dGroup = { key: "D", label: "D", sub: "Benefit (Module D)", tone: "benefits",
        bars: selected.map((s, i) => ({ label: s.name, seriesIndex: i, value: toNumber(field(impact, cmpImpactCol("D", s.id))) })).filter(b => b.value !== null) };
      const netGroup = { key: "Net", label: "Net Carbon", sub: "A1-C4 + D", tone: "total",
        bars: selected.map((s, i) => {
          const a = toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id)));
          const d = toNumber(field(impact, cmpImpactCol("D", s.id)));
          const net = sumValues([a !== null ? String(a) : null, d !== null ? String(d) : null]);
          return { label: s.name, seriesIndex: i, value: net };
        }).filter(b => b.value !== null) };
      const groups = [a1c4Group, dGroup, netGroup].filter(g => g.bars.length > 0);
      const scale = getChartScale(groups);
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row"><div></div>${dispToggle}</div>
        ${renderModuleChartLegend(selected)}
        <div class="module-chart-canvas">
          <div class="module-chart-plot chart-plot-wide">
            ${groups.map((g, i) => createModuleChartGroup(g, scale, i)).join("")}
          </div>
          <div class="module-chart-note">A1-C4 total · Module D benefit · Net Carbon per scenario.</div>
        </div>`;
    }
  }
}

/* ─── Competitor chart control handlers ─── */
document.addEventListener("click", e => {
  const cViewBtn = e.target.closest("[data-cmp-view]");
  if (cViewBtn) {
    const v = cViewBtn.dataset.cmpView;
    if (typeof cmpState !== "undefined" && v !== cmpState.chartView) {
      cmpState.chartView = v; cmpState.activeModules = null;
      document.querySelectorAll("[data-cmp-view]").forEach(b => b.classList.toggle("active", b.dataset.cmpView === v));
      if (cmpState.impact) cmpRenderChart(cmpState.impact, cmpState.scenarios.filter(s => cmpState.selectedScenarios.includes(s.id)));
    }
    return;
  }
  const cDispBtn = e.target.closest("[data-cmp-disp]");
  if (cDispBtn) {
    const m = cDispBtn.dataset.cmpDisp;
    if (typeof cmpState !== "undefined" && m !== cmpState.chartDisplayMode) {
      cmpState.chartDisplayMode = m;
      if (cmpState.impact) cmpRenderChart(cmpState.impact, cmpState.scenarios.filter(s => cmpState.selectedScenarios.includes(s.id)));
    }
    return;
  }
  const cModBtn = e.target.closest(".cmp-mod-btn");
  if (cModBtn) {
    if (typeof cmpState === "undefined") return;
    const key = cModBtn.dataset.modKey;
    if (!cmpState.activeModules) cmpState.activeModules = new Set([...document.querySelectorAll(".cmp-mod-btn")].map(b => b.dataset.modKey));
    if (cmpState.activeModules.has(key)) { if (cmpState.activeModules.size > 1) cmpState.activeModules.delete(key); }
    else cmpState.activeModules.add(key);
    if (cmpState.impact) cmpRenderChart(cmpState.impact, cmpState.scenarios.filter(s => cmpState.selectedScenarios.includes(s.id)));
    return;
  }
});
/* ─── Lindner products PDF (stutzen) ─── */
async function exportPdf() {
  if (!window.LindnerPDF) {
    alert("PDF engine not loaded. Check that pdf-engine scripts are included in index.html.");
    return;
  }
  const record = findSelectedRecord();
  if (!record) return;
  const values = calculateModules(record);
  if (!values) return;
  const scenario = getScenario();
  const selected = [scenario];
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const classification = field(record, "classification");
  const pedestalType = field(record, "Pedestal type");
  const variant = field(record, "Variant");
  const weight = field(record, "Wt of installation kit (kg)");

  await window.LindnerPDF.export({
    today,
    issueD: "17.02.2026",
    validD: "16.02.2031",
    titleLine1: variant,
    titleLine2: classification,
    floorType: classification,
    techItems: [
      ["Classification", classification || "--"],
      ["Pedestal type", pedestalType || "--"],
      ["Variant", variant || "--"],
      ["Installation kit weight", (weight || "--") + " kg"]
    ],
    selected,
    impact: values,  // stutzen passes the computed values object
    getA1c4:   s => values["A1-C4"] ?? null,
    getD:      s => values["D"] ?? null,
    getModule: (col, s) => values[col] ?? null,
    getFixed:  col => values[col] ?? null,
    buildModGroups: () => buildModuleChartGroups(values, scenario),
    getScenarioDesc: s => getScenarioInfo(s.name) || "",
    filename: `CarbonReport_${(variant || "pedestal").replace(/\s+/g, "_")}_${today.replace(/\s/g, "")}.pdf`
  });
}
/* ─── Competitor PDF (stutzen) ─── */
async function exportCmpPdf() {
  if (!window.LindnerPDF) { alert("PDF engine not loaded."); return; }
  const impact = cmpState.impact;
  const selected = (cmpState.scenarios || []).filter(s => cmpState.selectedScenarios.includes(s.id));
  if (!impact || !selected.length) return;
  const competitor = cmpDom.competitorSelect.value;
  const variant = cmpDom.productVariantSelect.value;
  const fam = cmpDom.productFamilySelect.value;
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const epd = cmpState.epds.find(r =>
    cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) &&
    cleanKeyText(field(r, "product_family")) === cleanKeyText(fam) &&
    cleanKeyText(field(r, "competitor")) === cleanKeyText(competitor)
  );
  const product = cmpState.products.find(r =>
    cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) &&
    cleanKeyText(field(r, "product_family")) === cleanKeyText(fam) &&
    cleanKeyText(field(r, "competitor")) === cleanKeyText(competitor) &&
    cleanKeyText(field(r, "productvariant_comparable")) === cleanKeyText(variant)
  );
  await window.LindnerPDF.export({
    today,
    issueD: field(epd, "issuedate") || field(epd, "Issue date") || "--",
    validD: field(epd, "validto") || field(epd, "Valid to") || "--",
    titleLine1: competitor, titleLine2: variant, floorType: fam,
    techItems: [
      ["Division", CMP_DIVISION], ["Product family", fam || "--"], ["Competitor", competitor || "--"],
      ["Layer thickness", (product ? (field(product, "layerthickness") || field(product, "Layer thickness")) : "--") + " mm"],
      ["Density", (product ? (field(product, "density") || field(product, "Density")) : "--") + " kg/m\u00B3"],
      ["Declared unit", (product ? (field(product, "declaredunit") || field(product, "declared unit")) : "--") + " kg/m\u00B2"]
    ],
    selected, impact,
    getA1c4: s => toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id))),
    getD: s => toNumber(field(impact, cmpImpactCol("D", s.id))),
    getModule: (col, s) => toNumber(field(impact, cmpImpactCol(col, s.id))),
    getFixed: col => toNumber(field(impact, col)),
    buildModGroups: () => {
      const grps = [];
      const em = { C1: "Deconstruction", C2: "Transport", C3: "Waste proc.", C4: "Disposal" };
      grps.push({ key: "A1-A3", label: "A1-A3", sub: "Product stage", tone: "production",
        bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, "A1-A3")), seriesIndex: i })).filter(b => b.value !== null) });
      grps.push({ key: "A4", label: "A4", sub: "Transport", tone: "construction",
        bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, "A4")), seriesIndex: i })).filter(b => b.value !== null) });
      grps.push({ key: "A5", label: "A5", sub: "Installation", tone: "construction",
        bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, "A5")), seriesIndex: i })).filter(b => b.value !== null) });
      ["C1", "C2", "C3", "C4"].forEach(base => grps.push({ key: base, label: base, sub: em[base], tone: "endlife",
        bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, cmpImpactCol(base, s.id))), seriesIndex: i })).filter(b => b.value !== null) }));
      grps.push({ key: "D", label: "D", sub: "Benefits", tone: "benefits",
        bars: selected.map((s, i) => ({ label: s.name, value: toNumber(field(impact, cmpImpactCol("D", s.id))), seriesIndex: i })).filter(b => b.value !== null) });
      return grps.filter(g => g.bars.length > 0);
    },
    getScenarioDesc: () => "",
    filename: `CarbonReport_Competitor_${(competitor || "comp").replace(/\s+/g, "_")}_${today.replace(/\s/g, "")}.pdf`
  });
}
/* ════════════════════════════════════════════════════════════════════
   S.7 — ARIA CONTEXT BUILDER — Floor Pedestals (stutzen)
   ════════════════════════════════════════════════════════════════════ */
function buildStutzenAriaContext() {
  const ctx = { page: 'Floor Pedestals (stutzen)', mode: 'Lindner Products' };

  // ── Competitor mode? ──
  const isCmp = document.getElementById('competitorTabBtn')?.getAttribute('aria-pressed') === 'true';
  if (isCmp && typeof cmpState !== 'undefined' && cmpState?.impact) {
    ctx.mode = 'Competitor Analysis';
    ctx.competitor = cmpDom?.competitorSelect?.value;
    ctx.productFamily = cmpDom?.productFamilySelect?.value;
    ctx.variant = cmpDom?.productVariantSelect?.value;
    ctx.fixedModules = {
      'A1-A3': field(cmpState.impact, 'A1-A3'),
      'A4': field(cmpState.impact, 'A4'),
      'A5': field(cmpState.impact, 'A5')
    };
    if (cmpState.scenarios) {
      const selected = cmpState.scenarios.filter(s => cmpState.selectedScenarios.includes(s.id));
      ctx.scenarios = selected.map(s => {
        const a = toNumber(field(cmpState.impact, cmpImpactCol('(A1-C4)', s.id)));
        const d = toNumber(field(cmpState.impact, cmpImpactCol('D', s.id)));
        return {
          name: s.name,
          a1c4: a?.toFixed(2),
          moduleD: d?.toFixed(2),
          net: (a !== null && d !== null) ? (a + d).toFixed(2) : null
        };
      });
    }
    ctx.note = 'Competitor data is third-party EPD data for Floor Pedestals (Standard and Height-adjustable). Values are compared against Lindner steel pedestals on the Lindner Products tab.';
    return ctx;
  }

  // ── Lindner products mode ──
  const record = findSelectedRecord();
  if (!record) {
    ctx.userState = 'No product selected yet. User needs to pick a classification, pedestal type, and variant.';
    return ctx;
  }

  const values = calculateModules(record);
  const scenario = getScenario();

  ctx.product = {
    classification: field(record, 'classification'),
    pedestalType: field(record, 'Pedestal type'),
    variant: field(record, 'Variant'),
    installationKitWeight: field(record, 'Wt of installation kit (kg)')
  };

  ctx.epd = {
    issueDate: '17.02.2026',
    validTo: '16.02.2031',
    epdName: 'Steel pedestals for system floors'
  };

  ctx.scenario = {
    name: scenario.name,
    description: getScenarioInfo(scenario.name) || ''
  };

  if (values) {
    const a1c4 = values['A1-C4'];
    const d = values['D'];
    ctx.modules = {
      'A1-A3': values['A1-A3']?.toFixed(3),
      'A4': values['A4']?.toFixed(3),
      'A5': values['A5']?.toFixed(3),
      'C1': values['C1']?.toFixed(3),
      'C2': values['C2']?.toFixed(3),
      'C3': values['C3']?.toFixed(3),
      'C4': values['C4']?.toFixed(3),
      'D': values['D']?.toFixed(3)
    };
    ctx.totals = {
      'A1-C4': a1c4?.toFixed(3),
      netCarbon: (a1c4 !== null && d !== null) ? (a1c4 + d).toFixed(3) : null
    };

    // Highlight the dominant module
    ctx.insight = 'A1-A3 (product stage) dominates the lifecycle footprint due to galvanised steel production. Module D shows a significant carbon benefit from 95% steel recyclability.';
  }

  // Module descriptions available
  if (state.moduleInfo?.length) {
    ctx.moduleDescriptions = {};
    ['A1-A3', 'A4', 'A5', 'C1', 'C2', 'C3', 'C4', 'D'].forEach(m => {
      const desc = getModuleInfo(m);
      if (desc) ctx.moduleDescriptions[m] = desc;
    });
  }

  ctx.note = 'Stutzen values are calculated from a weight-based formula (linear regression on installation kit weight). C3 is a constant 0.169 kg CO2eq. C1 is always 0. Single end-of-life scenario: 95% recycling, 5% landfilling.';

  return ctx;
}
/* ─── Competitor toggle button (top-left action bar) ─── */
(function () {
  const toggleBtn = document.getElementById("cmpToggleBtn");
  const toggleLabel = document.getElementById("cmpToggleLabel");
  const switcher = document.getElementById("toolSwitcher");
  const cmpTab = document.getElementById("competitorTabBtn");
  if (!toggleBtn) return;

  let competitorEnabled = false;

  function setCompetitorEnabled(on) {
    competitorEnabled = on;
    toggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
    toggleBtn.classList.toggle("dash-btn-ghost-active", on);
    if (toggleLabel) toggleLabel.textContent = on ? "Hide Competitor" : "Competitor Analysis";
    if (switcher) switcher.style.display = on ? "" : "none";
    if (cmpTab) cmpTab.style.display = on ? "" : "none";
    // If turning OFF while competitor panel is open, switch back to Lindner
    if (!on && document.getElementById("competitorTabBtn")?.getAttribute("aria-pressed") === "true") {
      toggleCompetitorPanel(false);
    }
  }

  toggleBtn.addEventListener("click", () => setCompetitorEnabled(!competitorEnabled));
})();