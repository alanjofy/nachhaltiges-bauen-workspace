/* ════════════════════════════════════════════════════════════════════
   BODEN — Floor Panels LCA Dashboard
   ────────────────────────────────────────────────────────────────────
   Lindner Nachhaltiges Bauen · CO₂ Compass

   Version: 3.0 · 2026 (PDF engine extracted to /pdf-engine/)

   Architecture:
   - State:    centralized in `state` object
   - Data:     CSV-driven (6 files in folder)
   - UI:       rendered from state, event-driven updates
   - ARIA:     loaded externally from ../aria/aria.js
   - PDF:      loaded externally from ../pdf-engine/pdf-engine.js
   ════════════════════════════════════════════════════════════════════ */


/* ────────────────────────────────────────────────────────────────────
   STATE
   ──────────────────────────────────────────────────────────────────── */

const state = {
  products: [],
  epds: [],
  impacts: [],
  pdfMap: [],
  scenarioInfo: [],
  moduleInfo: [],
  selectedScenarios: [],
  theme: "dark",
  expandedProductStage: false,
  expandedConstruction: false,
  expandedEndOfLife: false,
  expandedBenefits: false,
  chartView: "modules",
  chartDisplayMode: "values",
  activeModules: null
};

const dom = {};

const COMMON_MODULES = [
  { key: "A1-A3", code: "A1-A3", title: "Product stage",
    desc: "Raw materials, transport and manufacturing.",
    area: "area-a13", tone: "tone-production", codeClass: "code-production" },
  { key: "A4", code: "A4", title: "Transport to site",
    desc: "Transport to construction site.",
    area: "area-a4", tone: "tone-construction", codeClass: "code-construction" },
  { key: "A5", code: "A5", title: "Installation",
    desc: "Assembly and installation.",
    area: "area-a5", tone: "tone-construction", codeClass: "code-construction" }
];

const SCENARIO_MODULES = [
  { base: "C1", code: "C1", title: "Deconstruction / demolition",
    desc: "Removal at end of life.",
    area: "area-c1", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C2", code: "C2", title: "Transport",
    desc: "Transport after removal.",
    area: "area-c2", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C3", code: "C3", title: "Waste processing",
    desc: "Sorting or processing before final treatment.",
    area: "area-c3", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C4", code: "C4", title: "Disposal",
    desc: "Final disposal stage.",
    area: "area-c4", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "D", code: "D", title: "Benefits beyond life cycle stage",
    desc: "Potential benefits or loads beyond the system boundary.",
    area: "area-d", tone: "tone-benefits", codeClass: "code-benefits" }
];


/* ────────────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  cacheDom();
  bindEvents();
  initTheme();
  updateDashboardVisibility();
  await loadData();
  populateFloorTypes();
  renderEmptyState("Choose a floor type, product type and product variant to load the dashboard.");
});

function cacheDom() {
  dom.floorTypeSelect = document.getElementById("floorTypeSelect");
  dom.productTypeSelect = document.getElementById("productTypeSelect");
  dom.productVariantSelect = document.getElementById("productVariantSelect");
  dom.selectionSummary = document.getElementById("selectionSummary");
  dom.mainLayout = document.getElementById("lindnerMainLayout");
  dom.welcomePanel = document.getElementById("welcomePanel");
  dom.epdDownloadBtn = document.getElementById("epdDownloadBtn");
  dom.reportDownloadBtn = document.getElementById("reportDownloadBtn");
  dom.exportPdfBtn = document.getElementById("exportPdfBtn");
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
  dom.scenarioSummaryCards = document.getElementById("scenarioSummaryCards");
  dom.bottomSection = document.getElementById("bottomSection");
  dom.mainBarChart = document.getElementById("mainBarChart");
  dom.moduleBarChart = dom.mainBarChart;
  dom.summaryBarChart = null;
}

function updateDashboardVisibility() {
  const ready = Boolean(
    dom.floorTypeSelect.value &&
    dom.productTypeSelect.value &&
    dom.productVariantSelect.value
  );
  dom.selectionSummary.classList.toggle("hidden-until-ready", !ready);
  dom.mainLayout.classList.toggle("hidden-until-ready", !ready);
  if (dom.bottomSection) dom.bottomSection.classList.toggle("hidden-until-ready", !ready);
  // Welcome panel = inverse of dashboard (show only when NOT ready)
  if (dom.welcomePanel) dom.welcomePanel.classList.toggle("hidden-until-ready", ready);
}


/* ────────────────────────────────────────────────────────────────────
   EVENT BINDING
   ──────────────────────────────────────────────────────────────────── */

function bindEvents() {
  dom.floorTypeSelect.addEventListener("change", onFloorTypeChange);
  dom.productTypeSelect.addEventListener("change", onProductTypeChange);
  dom.productVariantSelect.addEventListener("change", onProductVariantChange);
  dom.themeToggle.addEventListener("click", toggleTheme);

  const cmpBtn = document.getElementById("competitorTabBtn");
  if (cmpBtn) {
    cmpBtn.addEventListener("click", () => {
      const isOpen = cmpBtn.getAttribute("aria-pressed") === "true";
      toggleCompetitorPanel(!isOpen);
    });
  }

  const lindnerTab = document.querySelector(".tool-tab:not(#competitorTabBtn)");
  if (lindnerTab) {
    lindnerTab.addEventListener("click", () => toggleCompetitorPanel(false));
  }

  // ── Competitor panel chart controls ──
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-cmp-view]");
    if (btn) {
      const view = btn.dataset.cmpView;
      if (view !== "modules" && view !== "a1c4") return;
      document.querySelectorAll("[data-cmp-view]").forEach(b => b.classList.toggle("active", b === btn));
      cmpState.chartView = view;
      if (cmpState.impact && cmpState.scenarios && cmpState.scenarios.length) {
        const sel = cmpState.scenarios.filter(s => cmpState.selectedScenarios.includes(s.id));
        cmpRenderChart(cmpState.impact, sel);
      }
      return;
    }
    const dispBtn = e.target.closest("[data-cmp-disp]");
    if (dispBtn) {
      const mode = dispBtn.dataset.cmpDisp;
      if (mode && mode !== cmpState.chartDisplayMode) {
        cmpState.chartDisplayMode = mode;
        document.querySelectorAll("[data-cmp-disp]").forEach(b =>
          b.classList.toggle("active", b.dataset.cmpDisp === mode)
        );
        if (cmpState.impact && cmpState.scenarios && cmpState.scenarios.length) {
          const sel = cmpState.scenarios.filter(s => cmpState.selectedScenarios.includes(s.id));
          cmpRenderChart(cmpState.impact, sel);
        }
      }
      return;
    }
    const cmpModBtn = e.target.closest(".cmp-mod-btn");
    if (cmpModBtn) {
      const key = cmpModBtn.dataset.modKey;
      if (!key) return;
      if (!cmpState.activeModules) {
        const allKeys = [...document.querySelectorAll(".cmp-mod-btn")].map(b => b.dataset.modKey);
        cmpState.activeModules = new Set(allKeys);
      }
      if (cmpState.activeModules.has(key)) {
        if (cmpState.activeModules.size > 1) cmpState.activeModules.delete(key);
      } else {
        cmpState.activeModules.add(key);
      }
      document.querySelectorAll(".cmp-mod-btn").forEach(b =>
        b.classList.toggle("active", !cmpState.activeModules || cmpState.activeModules.has(b.dataset.modKey))
      );
      if (cmpState.impact && cmpState.scenarios && cmpState.scenarios.length) {
        const sel = cmpState.scenarios.filter(s => cmpState.selectedScenarios.includes(s.id));
        cmpRenderChart(cmpState.impact, sel);
      }
      return;
    }
  });

  // ── Export PDF button ──
  dom.exportPdfBtn.addEventListener("click", () => {
    if (dom.exportPdfBtn.classList.contains("disabled")) return;
    const isCmpMode = document.getElementById("competitorTabBtn")?.getAttribute("aria-pressed") === "true";
    if (isCmpMode) exportCmpPdf();
    else exportPdf();
  });

  // ── Main chart controls ──
  document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".chart-view-btn");
    if (viewBtn && !viewBtn.dataset.cmpView) {
      const view = viewBtn.dataset.view;
      if (view && view !== state.chartView) {
        if (view !== "modules" && view !== "a1c4") return;
        state.chartView = view;
        state.activeModules = null;
        document.querySelectorAll(".chart-view-btn:not([data-cmp-view])").forEach(b =>
          b.classList.toggle("active", b.dataset.view === view)
        );
        const product = findSelectedRecord(state.products);
        if (product) {
          const impact = findSelectedRecord(state.impacts);
          const scenarios = getAvailableScenarios(product);
          const selected = scenarios.filter(s => state.selectedScenarios.includes(s.id));
          renderMainBarChart(impact, selected);
        }
      }
    }
    const dispBtn = e.target.closest(".chart-disp-btn");
    if (dispBtn && !dispBtn.dataset.cmpDisp) {
      const mode = dispBtn.dataset.disp;
      if (mode && mode !== state.chartDisplayMode) {
        state.chartDisplayMode = mode;
        document.querySelectorAll(".chart-disp-btn:not([data-cmp-disp])").forEach(b =>
          b.classList.toggle("active", b.dataset.disp === mode)
        );
        const product = findSelectedRecord(state.products);
        if (product) {
          const impact = findSelectedRecord(state.impacts);
          const scenarios = getAvailableScenarios(product);
          const selected = scenarios.filter(s => state.selectedScenarios.includes(s.id));
          renderMainBarChart(impact, selected);
        }
      }
    }
    const modBtn = e.target.closest(".chart-mod-btn:not(.cmp-mod-btn)");
    if (modBtn) {
      const key = modBtn.dataset.modKey;
      if (!key) return;
      if (!state.activeModules) {
        const allKeys = [...document.querySelectorAll(".chart-mod-btn:not(.cmp-mod-btn)")].map(b => b.dataset.modKey);
        state.activeModules = new Set(allKeys);
      }
      if (state.activeModules.has(key)) {
        if (state.activeModules.size > 1) state.activeModules.delete(key);
      } else {
        state.activeModules.add(key);
      }
      document.querySelectorAll(".chart-mod-btn:not(.cmp-mod-btn)").forEach(b =>
        b.classList.toggle("active", !state.activeModules || state.activeModules.has(b.dataset.modKey))
      );
      const product = findSelectedRecord(state.products);
      if (product) {
        const impact = findSelectedRecord(state.impacts);
        const scenarios = getAvailableScenarios(product);
        const selected = scenarios.filter(s => state.selectedScenarios.includes(s.id));
        renderMainBarChart(impact, selected);
      }
    }
  });

  // ── Disabled download buttons guard ──
  [dom.epdDownloadBtn, dom.reportDownloadBtn].forEach((button) => {
    button.addEventListener("click", (event) => {
      if (button.classList.contains("disabled")) event.preventDefault();
    });
  });

  // ── Info popup close handlers ──
  document.addEventListener("click", e => {
    if (e.target.classList.contains("info-popup-overlay")) closeInfoPopup();
    if (e.target.closest(".info-popup-close")) closeInfoPopup();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeInfoPopup();
  });
}


/* ────────────────────────────────────────────────────────────────────
   INFO POPUP
   ──────────────────────────────────────────────────────────────────── */

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
  if (!overlay) return;
  overlay.classList.remove("open");
}

function getScenarioInfo(productType, scenarioName) {
  const row = state.scenarioInfo.find(r =>
    cleanKeyText(field(r, "producttype")) === cleanKeyText(productType) &&
    cleanKeyText(field(r, "scenario_name")) === cleanKeyText(scenarioName)
  );
  return row ? field(row, "description") : null;
}

function getModuleInfo(productType, module, scenarioIndex) {
  const row = state.moduleInfo.find(r =>
    cleanKeyText(field(r, "producttype")) === cleanKeyText(productType) &&
    cleanKeyText(field(r, "module")) === cleanKeyText(module)
  );
  if (!row) return null;
  const scenarioKey = `description_s${scenarioIndex}`;
  const scenarioDesc = field(row, scenarioKey);
  if (scenarioDesc && scenarioDesc.trim()) return scenarioDesc;
  return field(row, "description_general") || null;
}

function getModuleSubInfo(productType, module) {
  if (cleanKeyText(module) !== "a1-a3") return null;
  const row = state.moduleInfo.find(r =>
    cleanKeyText(field(r, "producttype")) === cleanKeyText(productType) &&
    cleanKeyText(field(r, "module")) === "a1-a3"
  );
  if (!row) return null;
  const a1 = row["description_a1"] || row["descriptiona1"] || field(row, "description_a1") || "";
  const a2 = row["description_a2"] || row["descriptiona2"] || field(row, "description_a2") || "";
  const a3 = row["description_a3"] || row["descriptiona3"] || field(row, "description_a3") || "";
  if (!a1 && !a2 && !a3) return null;
  return { a1, a2, a3 };
}


/* ────────────────────────────────────────────────────────────────────
   DATA LOADING
   ──────────────────────────────────────────────────────────────────── */

async function loadData() {
  try {
    const [products, epds, impacts, pdfMap, scenarioInfo, moduleInfo] = await Promise.all([
      fetchCsv("product.csv"),
      fetchCsv("epd.csv"),
      fetchCsv("impacts.csv"),
      fetchCsv("pdf_map.csv"),
      fetchCsv("scenario_info.csv").catch(() => []),
      fetchCsv("module_info.csv").catch(() => [])
    ]);
    state.products = products;
    state.epds = epds;
    state.impacts = impacts;
    state.pdfMap = pdfMap;
    state.scenarioInfo = scenarioInfo;
    state.moduleInfo = moduleInfo;
  } catch (error) {
    console.error(error);
    dom.selectionSummary.textContent =
      "Unable to load CSV files. Use VS Code Live Server and verify the CSV names and paths.";
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
      if (inQuotes && next === '"') { cell += '"'; i += 1; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
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
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\u00AE\u2122]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function formatMetric(value) {
  const number = typeof value === "number" ? value : toNumber(value);
  if (number === null) return "-";
  const abs = Math.abs(number);
  if (abs === 0) return "0.00";
  if (abs >= 10000) return number.toFixed(0);
  if (abs < 0.0001) return number.toFixed(5);
  if (abs < 0.001) return number.toFixed(4);
  if (abs < 0.01) return number.toFixed(3);
  return number.toFixed(2);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildKey(floorType, productType, productVariant) {
  return [floorType, productType, productVariant].map(cleanKeyText).join("||");
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

function populateFloorTypes() {
  const floorTypes = uniqueSorted(state.products.map((row) => field(row, "floortype")));
  setOptions(dom.floorTypeSelect, floorTypes, "Select floor type", true);
  setOptions(dom.productTypeSelect, [], "Select product type", false);
  setOptions(dom.productVariantSelect, [], "Select product variant", false);
}

function resetExpansionState() {
  state.expandedProductStage = false;
  state.expandedConstruction = false;
  state.expandedEndOfLife = false;
  state.expandedBenefits = false;
}


/* ────────────────────────────────────────────────────────────────────
   SELECTION HANDLERS
   ──────────────────────────────────────────────────────────────────── */

function onFloorTypeChange() {
  const floorType = dom.floorTypeSelect.value;
  state.selectedScenarios = [];
  resetExpansionState();
  setOptions(dom.productVariantSelect, [], "Select product variant", false);
  if (!floorType) {
    setOptions(dom.productTypeSelect, [], "Select product type", false);
    updateSelectionSummary();
    updateDashboardVisibility();
    renderEmptyState("Choose a floor type, product type and product variant to load the dashboard.");
    return;
  }
  const productTypes = uniqueSorted(
    state.products
      .filter((row) => cleanKeyText(field(row, "floortype")) === cleanKeyText(floorType))
      .map((row) => field(row, "producttype"))
  );
  setOptions(dom.productTypeSelect, productTypes, "Select product type", true);
  updateSelectionSummary();
  updateDashboardVisibility();
  renderEmptyState("Floor type selected. Choose a product type and product variant.");
}

function onProductTypeChange() {
  const floorType = dom.floorTypeSelect.value;
  const productType = dom.productTypeSelect.value;
  state.selectedScenarios = [];
  resetExpansionState();
  if (!floorType || !productType) {
    setOptions(dom.productVariantSelect, [], "Select product variant", false);
    updateSelectionSummary();
    updateDashboardVisibility();
    renderEmptyState("Choose a product variant to continue.");
    return;
  }
  const variants = uniqueSorted(
    state.products
      .filter((row) =>
        cleanKeyText(field(row, "floortype")) === cleanKeyText(floorType) &&
        cleanKeyText(field(row, "producttype")) === cleanKeyText(productType)
      )
      .map((row) => field(row, "productvariant"))
  );
  setOptions(dom.productVariantSelect, variants, "Select product variant", true);
  updateSelectionSummary();
  updateDashboardVisibility();
  renderEmptyState("Product type selected. Choose a product variant.");
}

function onProductVariantChange() {
  updateSelectionSummary();
  updateDashboardVisibility();
  if (!dom.productVariantSelect.value) {
    renderEmptyState("Choose a product variant to continue.");
    return;
  }
  const product = findSelectedRecord(state.products);
  if (!product) {
    renderEmptyState("No matching product was found for the selected combination.");
    return;
  }
  resetExpansionState();
  state.selectedScenarios = getAvailableScenarios(product).map((scenario) => scenario.id);
  renderDashboard();
}

function findSelectedRecord(collection) {
  const targetKey = buildKey(
    dom.floorTypeSelect.value,
    dom.productTypeSelect.value,
    dom.productVariantSelect.value
  );
  return collection.find((row) => {
    const rowKey = buildKey(
      field(row, "floortype"),
      field(row, "producttype"),
      field(row, "productvariant")
    );
    return rowKey === targetKey;
  });
}

function findEpdRecord(productType) {
  return state.epds.find(
    (row) => cleanKeyText(field(row, "producttype")) === cleanKeyText(productType)
  );
}


/* ────────────────────────────────────────────────────────────────────
   DASHBOARD RENDERING
   ──────────────────────────────────────────────────────────────────── */

function renderDashboard() {
  const product = findSelectedRecord(state.products);
  const impact = findSelectedRecord(state.impacts);
  const pdfRecord = findSelectedRecord(state.pdfMap);
  const epdRecord = findEpdRecord(field(product, "producttype"));
  const scenarios = getAvailableScenarios(product);
  if (!product) {
    renderEmptyState("No matching product was found for the selected combination.");
    return;
  }
  if (!state.selectedScenarios.length) {
    state.selectedScenarios = scenarios.map((scenario) => scenario.id);
  }
  renderDownloads(product, epdRecord, pdfRecord);
  renderProductOverview(product, epdRecord);
  renderTechnicalDetails(product);
  renderScenarios(scenarios);
  renderResults(impact, scenarios);
}

function renderDownloads(product, epdRecord, pdfRecord) {
  const productType = field(product, "producttype");
  const epdFile = field(epdRecord, "epd");
  const reportFile = field(pdfRecord, "pdf");
  const epdHref = epdFile ? buildPath("epd", productType, epdFile) : "";
  const reportHref = reportFile ? buildPath("reports", productType, reportFile) : "";
  setLinkState(dom.epdDownloadBtn, epdHref);
  setLinkState(dom.reportDownloadBtn, reportHref);
  dom.exportPdfBtn.classList.remove("disabled");
  dom.exportPdfBtn.setAttribute("aria-disabled", "false");
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

function renderProductOverview(product, epdRecord) {
  const productType = field(product, "producttype");
  const productVariant = field(product, "productvariant");
  dom.selectedProductType.textContent = productType || "-";
  dom.selectedProductVariant.textContent = productVariant || "-";
  dom.issueDateValue.textContent = field(epdRecord, "Issue date") || field(epdRecord, "issuedate") || "-";
  dom.validToValue.textContent = field(epdRecord, "Valid to") || field(epdRecord, "validto") || "-";
  const imageName = field(epdRecord, "image");
  const imagePath = imageName ? buildPath(imageName) : "";
  dom.productImage.style.display = "none";
  dom.productImagePlaceholder.style.display = "grid";
  dom.productImagePlaceholder.textContent = "Product image will appear here";
  if (!imagePath) {
    dom.productImage.removeAttribute("src");
    return;
  }
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

function renderTechnicalDetails(product) {
  const items = [
    { label: "Layer thickness (mm)",
      value: field(product, "Layer thickness") || field(product, "layerthickness") },
    { label: "Density (kg/m\u00B3)",
      value: field(product, "Density") || field(product, "density") },
    { label: "Declared unit (kg/m\u00B2)",
      value: field(product, "declared unit") || field(product, "declaredunit") }
  ];
  dom.technicalGrid.classList.remove("empty-grid");
  dom.technicalGrid.innerHTML = items
    .map((item) => `
      <div class="metric-box">
        <div>
          <span class="metric-label">${item.label}</span>
          <div class="metric-value">${item.value || "-"}</div>
        </div>
        ${item.foot ? `<div class="metric-foot">${item.foot}</div>` : ""}
      </div>`)
    .join("");
}

function getScenarioEmoji(name) {
  const text = normalizeText(name).toLowerCase();
  if (text.includes("reuse") || text.includes("refurb")) return "R";
  if (text.includes("recycl")) return "RC";
  if (text.includes("inciner")) return "IN";
  if (text.includes("landfill") || text.includes("landfil")) return "LF";
  if (text.includes("shredd")) return "SH";
  if (text.includes("disposal")) return "DS";
  if (text.includes("transport")) return "TR";
  return "SC";
}

function getAvailableScenarios(product) {
  return [1, 2, 3]
    .map((id) => {
      const name = field(product, `Scenario ${id}`);
      if (!name) return null;
      return { id, name, emoji: getScenarioEmoji(name) };
    })
    .filter(Boolean);
}

function renderScenarios(scenarios) {
  if (!scenarios.length) {
    dom.scenarioList.classList.add("empty-grid");
    dom.scenarioList.innerHTML = `<div class="dash-empty">No scenario details are available for this variant.</div>`;
    dom.scenarioPicker.innerHTML = "";
    return;
  }
  const product = findSelectedRecord(state.products);
  const productType = product ? field(product, "producttype") : "";
  dom.scenarioList.classList.remove("empty-grid");
  dom.scenarioList.innerHTML = scenarios.map((scenario) => {
    const active = state.selectedScenarios.includes(scenario.id);
    const hasInfo = !!getScenarioInfo(productType, scenario.name);
    return `
      <div class="scenario-info-card ${active ? "selected" : ""}">
        <div class="scenario-title-row">
          <div class="scenario-name">${scenario.name}</div>
          ${hasInfo ? `<button class="info-icon-btn" data-scenario-name="${escapeHtml(scenario.name)}" data-product-type="${escapeHtml(productType)}" aria-label="Learn more about this scenario">
            <svg viewBox="0 0 20 20" fill="none" width="16" height="16"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.6"/><text x="10" y="14.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" font-family="Helvetica,Arial,sans-serif">i</text></svg>
          </button>` : ""}
        </div>
      </div>`;
  }).join("");

  dom.scenarioList.querySelectorAll(".info-icon-btn[data-scenario-name]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const name = btn.dataset.scenarioName;
      const pType = btn.dataset.productType;
      const desc = getScenarioInfo(pType, name);
      const scenario = scenarios.find(s => s.name === name);
      if (desc) {
        openInfoPopup(name, scenario?.emoji || "i", "info-badge-scenario", `<p>${desc}</p>`);
      }
    });
  });

  dom.scenarioPicker.innerHTML = scenarios.map((scenario) => {
    const active = state.selectedScenarios.includes(scenario.id);
    return `
      <button type="button" class="scenario-filter-btn ${active ? "active" : ""}" data-scenario-id="${scenario.id}">
        ${scenario.name}
      </button>`;
  }).join("");
  dom.scenarioPicker.querySelectorAll("[data-scenario-id]").forEach((button) => {
    button.addEventListener("click", () => toggleScenarioSelection(Number(button.dataset.scenarioId), scenarios));
  });
}

function toggleScenarioSelection(scenarioId, scenarios) {
  const selected = new Set(state.selectedScenarios);
  if (selected.has(scenarioId)) {
    if (selected.size === 1) return;
    selected.delete(scenarioId);
  } else {
    selected.add(scenarioId);
  }
  state.selectedScenarios = scenarios.map((scenario) => scenario.id).filter((id) => selected.has(id));
  renderDashboard();
}

function renderResults(impact, scenarios) {
  if (!impact) {
    dom.resultsLifecycleGrid.className = "results-lifecycle-grid empty-grid";
    dom.resultsLifecycleGrid.innerHTML = `<div class="dash-empty">No matching result was found in impacts.csv for this selected variant.</div>`;
    return;
  }
  const selectedScenarios = scenarios.filter((scenario) => state.selectedScenarios.includes(scenario.id));
  const parts = [];

  parts.push(createExpandableSummaryTile({
    area: "area-a13", tone: "tone-production", codeClass: "code-production", code: "A1-A3",
    title: "Product stage", value: toNumber(field(impact, "A1-A3")),
    desc: "Raw materials, transport and manufacturing.",
    expanded: state.expandedProductStage, toggleTarget: "productStage"
  }));

  if (state.expandedConstruction) {
    parts.push(createSingleTile(COMMON_MODULES[1], impact, "construction"));
    parts.push(createSingleTile(COMMON_MODULES[2], impact, "construction"));
  } else {
    parts.push(createExpandableSummaryTile({
      area: "area-construction", tone: "tone-construction", codeClass: "code-construction", code: "A4-A5",
      title: "Construction stage",
      value: sumValues([field(impact, "A4"), field(impact, "A5")]),
      desc: "Transport to site and installation.",
      expanded: false, toggleTarget: "construction"
    }));
  }

  if (state.expandedEndOfLife) {
    parts.push(...SCENARIO_MODULES.slice(0, 4)
      .map((module) => createScenarioTile(module, impact, selectedScenarios, "endOfLife")));
  } else {
    parts.push(createEndOfLifeSummaryTile(impact, selectedScenarios));
  }

  parts.push(createBenefitsTile(impact, selectedScenarios));
  parts.push(createTotalTile(impact, selectedScenarios));

  dom.resultsLifecycleGrid.className = `results-lifecycle-grid ${getResultsGridMode()}`;
  dom.resultsLifecycleGrid.innerHTML = parts.join("");
  bindResultToggleEvents();
  renderModuleBarChart(impact, selectedScenarios);
}

function getResultsGridMode() {
  if (state.expandedConstruction && state.expandedEndOfLife) return "mode-both-expanded";
  if (state.expandedConstruction && !state.expandedEndOfLife) return "mode-construction-expanded";
  if (!state.expandedConstruction && state.expandedEndOfLife) return "mode-eol-expanded";
  return "mode-collapsed";
}

function bindResultToggleEvents() {
  const product = findSelectedRecord(state.products);
  const productType = product ? field(product, "producttype") : "";
  const scenarios = product ? getAvailableScenarios(product) : [];

  dom.resultsLifecycleGrid.querySelectorAll("[data-toggle-target]").forEach((element) => {
    element.addEventListener("click", (e) => {
      if (e.target.closest(".tile-info-btn")) return;
      const target = element.dataset.toggleTarget;
      if (target === "productStage") state.expandedProductStage = !state.expandedProductStage;
      else if (target === "construction") state.expandedConstruction = !state.expandedConstruction;
      else if (target === "endOfLife") state.expandedEndOfLife = !state.expandedEndOfLife;
      else if (target === "benefits") state.expandedBenefits = !state.expandedBenefits;
      const impact = findSelectedRecord(state.impacts);
      renderResults(impact, scenarios);
    });
  });

  dom.resultsLifecycleGrid.querySelectorAll(".tile-info-btn[data-module]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const module = btn.dataset.module;
      const scenarioIdx = parseInt(btn.dataset.scenarioIdx) || 0;
      const desc = getModuleInfo(productType, module, scenarioIdx);
      const subInfo = getModuleSubInfo(productType, module);
      if (!desc && !subInfo) return;
      let body = "";
      if (cleanKeyText(module) === "a1-a3" && subInfo) {
        const subModules = [
          { code: "A1", label: "Raw material supply", desc: subInfo.a1 },
          { code: "A2", label: "Transport to manufacturer", desc: subInfo.a2 },
          { code: "A3", label: "Manufacturing", desc: subInfo.a3 }
        ];
        body = subModules.filter(sm => sm.desc).map(sm => `
          <div class="popup-sub-row">
            <div class="popup-sub-head">
              <span class="result-code code-production popup-sub-badge">${sm.code}</span>
              <span class="popup-sub-label">${sm.label}</span>
            </div>
            <p class="popup-scenario-desc">${sm.desc}</p>
          </div>`).join("");
      } else {
        const isScenarioSpecific = ["C1", "C2", "C3", "C4", "D"].includes(module);
        const activeScenarios = scenarios.filter(s => state.selectedScenarios.includes(s.id));
        if (isScenarioSpecific && activeScenarios.length > 0) {
          body = activeScenarios.map((s) => {
            const origIdx = scenarios.findIndex(sc => sc.id === s.id) + 1;
            const d = getModuleInfo(productType, module, origIdx) || getModuleInfo(productType, module, 0) || "";
            return d ? `<div class="popup-scenario-row">
              <span class="popup-scenario-label">${s.name}</span>
              <p class="popup-scenario-desc">${d}</p>
            </div>` : "";
          }).filter(Boolean).join("");
          if (!body) body = `<p>${desc}</p>`;
        } else {
          body = `<p>${desc}</p>`;
        }
      }
      const badgeMap = {
        "A1-A3": "code-production", "A4": "code-construction", "A5": "code-construction",
        "C1": "code-endlife", "C2": "code-endlife", "C3": "code-endlife", "C4": "code-endlife",
        "D": "code-benefits"
      };
      openInfoPopup(btn.dataset.title || module, module, `result-code ${badgeMap[module] || "code-total"}`, body);
    });
  });
}

function infoBtn(module, title, scenarioIdx = 0) {
  return `<button class="tile-info-btn" data-module="${module}" data-title="${escapeHtml(title)}" data-scenario-idx="${scenarioIdx}" aria-label="More info">
    <svg viewBox="0 0 20 20" fill="none" width="15" height="15"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.6"/><text x="10" y="14.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" font-family="Helvetica,Arial,sans-serif">i</text></svg>
  </button>`;
}


/* ────────────────────────────────────────────────────────────────────
   RESULT TILE BUILDERS
   ──────────────────────────────────────────────────────────────────── */

function createExpandableSummaryTile({ area, tone, codeClass, code, title, value, desc, expanded, toggleTarget }) {
  return `
    <div class="result-tile ${area} ${tone} toggle-tile ${expanded ? "is-open" : ""}" data-toggle-target="${toggleTarget}">
      <div class="result-head">
        <div class="result-head-left"><h4 class="result-title">${title}</h4></div>
        <div class="result-head-right">
          ${infoBtn(code, title)}
          <span class="result-code ${codeClass}">${code}</span>
        </div>
      </div>
      <div class="single-value">${formatMetric(value)}</div>
      <div class="tile-detail ${expanded ? "show" : ""}">
        <p class="result-desc detail-desc">${desc}</p>
      </div>
    </div>`;
}

function createSingleTile(module, impact, toggleTarget = "") {
  const isToggle = Boolean(toggleTarget);
  return `
    <div class="result-tile ${module.area} ${module.tone} tile-appearing ${isToggle ? "toggle-tile" : ""}" ${isToggle ? `data-toggle-target="${toggleTarget}"` : ""}>
      <div class="result-head">
        <div class="result-head-left">
          <h4 class="result-title">${module.title}</h4>
          <p class="result-desc">${module.desc}</p>
        </div>
        <div class="result-head-right">
          ${infoBtn(module.code, module.title)}
          <span class="result-code ${module.codeClass}">${module.code}</span>
        </div>
      </div>
      <div class="single-value">${formatMetric(field(impact, module.key))}</div>
      ${isToggle ? `<div class="toggle-hint">Click to collapse</div>` : ""}
    </div>`;
}

function createEndOfLifeSummaryTile(impact, selectedScenarios) {
  const rows = selectedScenarios.map((scenario) => {
    const total = sumValues([
      field(impact, impactColumnForScenario("C1", scenario.id)),
      field(impact, impactColumnForScenario("C2", scenario.id)),
      field(impact, impactColumnForScenario("C3", scenario.id)),
      field(impact, impactColumnForScenario("C4", scenario.id))
    ]);
    return { name: scenario.name, value: total };
  }).filter((row) => row.value !== null);
  return `
    <div class="result-tile area-eol tone-endlife toggle-tile" data-toggle-target="endOfLife">
      <div class="result-head">
        <div class="result-head-left"><h4 class="result-title">End of life stage</h4></div>
        <div class="result-head-right">
          ${infoBtn("C1", "End of life stage")}
          <span class="result-code code-endlife">C1-C4</span>
        </div>
      </div>
      <div class="compare-stack">${createScenarioValueLines(rows)}</div>
    </div>`;
}

function createBenefitsTile(impact, selectedScenarios) {
  const rows = selectedScenarios.map((scenario) => {
    const value = toNumber(field(impact, impactColumnForScenario("D", scenario.id)));
    return { name: scenario.name, value };
  }).filter((row) => row.value !== null);
  return `
    <div class="result-tile area-d tone-benefits toggle-tile ${state.expandedBenefits ? "is-open" : ""}" data-toggle-target="benefits">
      <div class="result-head">
        <div class="result-head-left"><h4 class="result-title">Benefits beyond life cycle stage</h4></div>
        <div class="result-head-right">
          ${infoBtn("D", "Benefits beyond life cycle stage")}
          <span class="result-code code-benefits">D</span>
        </div>
      </div>
      <div class="compare-stack">${createScenarioValueLines(rows)}</div>
      <div class="tile-detail ${state.expandedBenefits ? "show" : ""}">
        <p class="result-desc detail-desc">Potential benefits or loads beyond the system boundary.</p>
      </div>
    </div>`;
}

function createScenarioValueLines(rows) {
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  return rows.length
    ? rows.map((row) => {
        const width = (Math.abs(row.value) / maxAbs) * 100;
        const type = row.value >= 0 ? "positive" : "negative";
        return `
          <div class="compare-line">
            <div class="compare-meta">
              <span>${row.name}</span>
              <strong>${formatMetric(row.value)}</strong>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${type}" style="--w:${width}"></div>
            </div>
          </div>`;
      }).join("")
    : `<div class="dash-empty">No data</div>`;
}

function createScenarioTile(module, impact, selectedScenarios, toggleTarget = "") {
  const rows = selectedScenarios
    .map((scenario) => {
      const column = impactColumnForScenario(module.base, scenario.id);
      const value = toNumber(field(impact, column));
      return { name: scenario.name, value };
    })
    .filter((row) => row.value !== null);
  const isToggle = Boolean(toggleTarget);
  return `
    <div class="result-tile ${module.area} ${module.tone} tile-appearing ${isToggle ? "toggle-tile" : ""}" ${isToggle ? `data-toggle-target="${toggleTarget}"` : ""}>
      <div class="result-head">
        <div class="result-head-left">
          <h4 class="result-title">${module.title}</h4>
          <p class="result-desc">${module.desc}</p>
        </div>
        <div class="result-head-right">
          ${infoBtn(module.code, module.title)}
          <span class="result-code ${module.codeClass}">${module.code}</span>
        </div>
      </div>
      <div class="compare-stack">${createScenarioValueLines(rows)}</div>
      ${isToggle ? `<div class="toggle-hint">Click to collapse</div>` : ""}
    </div>`;
}

function createTotalTile(impact, selectedScenarios) {
  const cards = selectedScenarios
    .map((scenario) => {
      const value = toNumber(field(impact, impactColumnForScenario("(A1-C4)", scenario.id)));
      return `
        <div class="total-card">
          <span>${scenario.name}</span>
          <strong>${formatMetric(value)}</strong>
        </div>`;
    })
    .join("");
  return `
    <div class="result-tile area-total tone-total">
      <div class="result-head">
        <div>
          <h4 class="result-title">A1-C4 Total (kg CO\u2082eq/m\u00B2)</h4>
          <p class="result-desc">Combined result up to end of life for the selected scenarios.</p>
        </div>
        <span class="result-code code-total">A1-C4</span>
      </div>
      <div class="total-grid">
        ${cards || `<div class="dash-empty">No total values available.</div>`}
      </div>
    </div>`;
}

function sumValues(values) {
  const numbers = values.map(toNumber).filter((value) => value !== null);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0);
}

function impactColumnForScenario(base, scenarioId) {
  if (scenarioId === 1) return base;
  return `${base}/${scenarioId - 1}`;
}

function renderEmptyState(message) {
  dom.selectedProductType.textContent = "-";
  dom.selectedProductVariant.textContent = message;
  dom.issueDateValue.textContent = "-";
  dom.validToValue.textContent = "-";
  dom.productImage.removeAttribute("src");
  dom.productImage.style.display = "none";
  dom.productImagePlaceholder.style.display = "grid";
  dom.productImagePlaceholder.textContent = "Product image will appear here";
  dom.technicalGrid.classList.add("empty-grid");
  dom.technicalGrid.innerHTML = `<div class="dash-empty">Technical details will load here.</div>`;
  dom.scenarioList.classList.add("empty-grid");
  dom.scenarioList.innerHTML = `<div class="dash-empty">Scenario details will appear here.</div>`;
  dom.scenarioPicker.innerHTML = "";
  dom.resultsLifecycleGrid.className = "results-lifecycle-grid empty-grid";
  dom.resultsLifecycleGrid.innerHTML = `<div class="dash-empty">${message}</div>`;
  if (dom.scenarioSummaryCards) dom.scenarioSummaryCards.innerHTML = "";
  const chart = dom.mainBarChart || dom.moduleBarChart;
  if (chart) {
    chart.className = "module-bar-chart empty-grid";
    chart.innerHTML = `<div class="dash-empty">${message}</div>`;
  }
  setLinkState(dom.epdDownloadBtn, "");
  setLinkState(dom.reportDownloadBtn, "");
  dom.exportPdfBtn.classList.add("disabled");
  dom.exportPdfBtn.setAttribute("aria-disabled", "true");
}

function updateSelectionSummary() {
  const floorType = dom.floorTypeSelect.value;
  const productType = dom.productTypeSelect.value;
  const productVariant = dom.productVariantSelect.value;
  if (!floorType) {
    dom.selectionSummary.textContent = "Choose a floor type to begin.";
    return;
  }
  if (!productType) {
    dom.selectionSummary.textContent = `Floor type selected: ${floorType}. Choose a product type next.`;
    return;
  }
  if (!productVariant) {
    dom.selectionSummary.textContent = `Floor type: ${floorType} \u00B7 Product type: ${productType}. Choose a product variant next.`;
    return;
  }
  dom.selectionSummary.textContent = `Loaded configuration: ${floorType} \u00B7 ${productType} \u00B7 ${productVariant}`;
}


/* ════════════════════════════════════════════════════════════════════
   END OF PART 1
   ────────────────────────────────────────────────────────────────────
   Part 2 contains:
   - Donut ring chart helpers
   - Module pie / exploding pie charts
   - Main bar chart rendering
   - Theme toggle
   - PDF export delegators (call ../pdf-engine/)
   - Competitor panel (cmpState + all cmp* functions)
   - buildBodenAriaContext()
   ════════════════════════════════════════════════════════════════════ */
   /* ════════════════════════════════════════════════════════════════════
   PART 2 — Charts + Theme + PDF Delegators + Competitor + ARIA
   ════════════════════════════════════════════════════════════════════ */


/* ────────────────────────────────────────────────────────────────────
   DONUT RING CHART
   ──────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────
   DONUT RING CHART
   ──────────────────────────────────────────────────────────────────── */

/* Scenario colors — ONE source of truth. Index = scenario order. */
const SCENARIO_COLORS = [
  { solid: "#044459", grad: "linear-gradient(180deg, #044459, #1A8FA8)" },  /* Scenario 1 — Steel Blue */
  { solid: "#E40428", grad: "linear-gradient(180deg, #AE0C1E, #E40428)" },  /* Scenario 2 — Lindner Red */
  { solid: "#23B9D6", grad: "linear-gradient(180deg, #1A8FA8, #23B9D6)" }   /* Scenario 3 — Cyan */
];

const DONUT_ACCENT = [
  { fill: "#044459", track: "rgba(4,68,89,0.14)"  },
  { fill: "#E40428", track: "rgba(228,4,40,0.14)" },
  { fill: "#23B9D6", track: "rgba(35,185,214,0.14)" }
];

function buildDonutRingSvg(pct, fillColor, trackColor, size, stroke) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const clamp = Math.min(Math.max(pct, 0), 100);
  const dash = `${(clamp / 100) * circ} ${circ}`;
  return `
    <svg class="donut-ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${trackColor}" stroke-width="${stroke}" class="donut-ring-track"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${fillColor}" stroke-width="${stroke}"
        stroke-linecap="round"
        stroke-dasharray="${dash}"
        stroke-dashoffset="0"
        transform="rotate(-90 ${cx} ${cy})"
        class="donut-ring-slice">
        <title>${clamp.toFixed(1)}%</title>
      </circle>
    </svg>`;
}

function _renderDonutRingsSavedBase(selectedScenarios, getA1c4Val, getDVal) {
  if (!selectedScenarios.length) return `<div class="dash-empty">No data.</div>`;
  const SIZE = 160, STROKE = 22;
  const cards = selectedScenarios.map((s, i) => {
    const a1c4 = getA1c4Val(s);
    const d = getDVal(s);
    const net = sumValues([a1c4 !== null ? String(a1c4) : null, d !== null ? String(d) : null]);
    const ac = DONUT_ACCENT[i] || DONUT_ACCENT[0];
    let savedPct = 0;
    if (a1c4 !== null && net !== null && a1c4 !== 0) {
      const remaining = Math.abs(net / a1c4) * 100;
      savedPct = Math.max(0, 100 - remaining);
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
          <div class="donut-ring-legend-item">
            <span class="donut-ring-legend-dot" style="background:${ac.fill}"></span>
            <span class="donut-ring-legend-name">Net Carbon</span>
            <span class="donut-ring-legend-val">${formatMetric(net)}</span>
          </div>
          <div class="donut-ring-legend-item">
            <span class="donut-ring-legend-dot" style="background:${ac.fill};opacity:0.3;border:1px solid ${ac.fill}"></span>
            <span class="donut-ring-legend-name">A1-C4 base</span>
            <span class="donut-ring-legend-val">${formatMetric(a1c4)}</span>
          </div>
          <div class="donut-ring-legend-item">
            <span class="donut-ring-legend-dot" style="background:#23B9D6"></span>
            <span class="donut-ring-legend-name">Module D</span>
            <span class="donut-ring-legend-val">${formatMetric(d)}</span>
          </div>
        </div>
      </div>`;
  }).join("");
  return `
    <div class="donut-ring-row">${cards}</div>
    <div class="donut-ring-note">
      Ring shows % of A1-C4 burden avoided by Module D (higher = better scenario).
      Net Carbon = A1-C4 + D \u00B7 Values in kg CO\u2082eq / m\u00B2.
    </div>`;
}

function renderDonutRingsSaved(impact, selectedScenarios) {
  return _renderDonutRingsSavedBase(
    selectedScenarios,
    s => toNumber(field(impact, impactColumnForScenario("(A1-C4)", s.id))),
    s => toNumber(field(impact, impactColumnForScenario("D", s.id)))
  );
}

function renderDonutRingsSavedCmp(impact, selected) {
  return _renderDonutRingsSavedBase(
    selected,
    s => toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id))),
    s => toNumber(field(impact, cmpImpactCol("D", s.id)))
  );
}


/* ────────────────────────────────────────────────────────────────────
   MODULE PIE / EXPLODING PIE CHARTS
   ──────────────────────────────────────────────────────────────────── */

const MOD_PIE_COLOURS = {
  // Production family — Lindner Red
  "A1-A3": "#E40428",
  // Construction family — Deep Red shades
  "A4":    "#AE0C1E",
  "A5":    "#7A0815",
  // End-of-life family — Lindner Steel Blue spectrum
  "C1":    "#044459",
  "C2":    "#0A6680",
  "C3":    "#1A8FA8",
  "C4":    "#23B9D6"
};

const MOD_PIE_LABELS = {
  "A1-A3": "Product stage",
  "A4":    "Transport",
  "A5":    "Installation",
  "C1":    "Deconstruction",
  "C2":    "Transport (EoL)",
  "C3":    "Waste processing",
  "C4":    "Disposal"
};

const MOD_PIE_KEYS = ["A1-A3", "A4", "A5", "C1", "C2", "C3", "C4"];

/**
 * Color legend shown in % view (pie chart mode) replacing module filter pills.
 */
function buildPieLegend() {
  const items = [
    { key: "A1-A3", label: "Product stage" },
    { key: "A4",    label: "Transport to site" },
    { key: "A5",    label: "Installation" },
    { key: "C1",    label: "Deconstruction" },
    { key: "C2",    label: "Transport (EoL)" },
    { key: "C3",    label: "Waste processing" },
    { key: "C4",    label: "Disposal" }
  ];
  return `
    <div class="pie-legend">
      <div class="pie-legend-title">Lifecycle Stages</div>
      <div class="pie-legend-grid">
        ${items.map(item => `
          <div class="pie-legend-item">
            <span class="pie-legend-swatch" style="background:${MOD_PIE_COLOURS[item.key]}"></span>
            <div class="pie-legend-text">
              <span class="pie-legend-code">${item.key}</span>
              <span class="pie-legend-label">${item.label}</span>
            </div>
          </div>`).join("")}
      </div>
    </div>`;
}

function buildExplodingPie(rawVals, total, a1c4Val, cardId) {
  const SIZE = 220;
  const STROKE = 38;
  const GAP = 2.5;
  const EXPLODE = 10;
  const r = (SIZE - STROKE) / 2;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const ir = r - STROKE;
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
    const x1o = cx + r * Math.cos(startA);
    const y1o = cy + r * Math.sin(startA);
    const x2o = cx + r * Math.cos(endA);
    const y2o = cy + r * Math.sin(endA);
    const x1i = cx + ir * Math.cos(endA);
    const y1i = cy + ir * Math.sin(endA);
    const x2i = cx + ir * Math.cos(startA);
    const y2i = cy + ir * Math.sin(startA);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1o} ${y1o} A ${r} ${r} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${ir} ${ir} 0 ${large} 0 ${x2i} ${y2i} Z`;
    const dx = Math.cos(midAngle) * EXPLODE;
    const dy = Math.sin(midAngle) * EXPLODE;
    const tipR = r + EXPLODE + 18;
    const tipX = cx + tipR * Math.cos(midAngle);
    const tipY = cy + tipR * Math.sin(midAngle);
    return { key, pct, path, midAngle, dx, dy, tipX, tipY, colour: MOD_PIE_COLOURS[key] };
  }).filter(Boolean);

  // Build TWO layers per slice (invisible hover zone + visible slice)
  // so the cursor never "loses" the slice when it explodes outward
  const sliceSvg = slices.map(sl => {
    return `
      <g class="xpie-slice-g"
         data-card="${cardId}"
         data-key="${sl.key}"
         data-pct="${sl.pct}"
         data-label="${escapeHtml(MOD_PIE_LABELS[sl.key])}"
         data-dx="${sl.dx.toFixed(2)}"
         data-dy="${sl.dy.toFixed(2)}"
         data-tipx="${sl.tipX.toFixed(1)}"
         data-tipy="${sl.tipY.toFixed(1)}"
         style="cursor:pointer;">
        <path d="${sl.path}"
              fill="transparent"
              stroke="transparent"
              stroke-width="${EXPLODE * 2 + 12}"
              stroke-linejoin="round"
              class="xpie-hover-zone"
              pointer-events="all"/>
        <path d="${sl.path}" fill="${sl.colour}" class="xpie-path" opacity="0.93" pointer-events="none"/>
      </g>`;
  }).join("");

  const tooltipSvg = `
    <g id="${cardId}-tip" style="display:none;" pointer-events="none">
      <rect id="${cardId}-tip-bg" x="0" y="0" width="60" height="22"
        rx="11" fill="rgba(22,28,50,0.92)" class="xpie-tip-bg"/>
      <text id="${cardId}-tip-txt" x="30" y="15"
        text-anchor="middle" font-size="11" font-weight="800"
        fill="#ffffff" class="xpie-tip-txt"></text>
    </g>`;

  return `
    <svg class="xpie-svg" width="${SIZE}" height="${SIZE}"
         viewBox="0 0 ${SIZE} ${SIZE}" overflow="visible">
      <defs>
        <filter id="${cardId}-sh">
          <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.2)"/>
        </filter>
      </defs>
      <g filter="url(#${cardId}-sh)">${sliceSvg}</g>
      ${tooltipSvg}
      <text id="${cardId}-cval" x="${cx}" y="${cy - 7}"
        text-anchor="middle" font-size="13" font-weight="800"
        fill="#ffffff">${formatMetric(a1c4Val)}</text>
      <text id="${cardId}-csub" x="${cx}" y="${cy + 9}"
        text-anchor="middle" font-size="7.5" font-weight="600"
        fill="rgba(255,255,255,0.55)">kg CO\u2082eq/m\u00B2</text>
      <text id="${cardId}-hmod" x="${cx}" y="${cy - 9}"
        text-anchor="middle" font-size="8" font-weight="700"
        fill="rgba(255,255,255,0.55)" style="display:none;"></text>
      <text id="${cardId}-hpct" x="${cx}" y="${cy + 10}"
        text-anchor="middle" font-size="18" font-weight="800"
        fill="#ffffff" style="display:none;"></text>
    </svg>`;
}

function renderModulePieCharts(impact, selectedScenarios) {
  if (!selectedScenarios.length) return `<div class="dash-empty">No data.</div>`;
  const cards = selectedScenarios.map((s, sIdx) => {
    const rawVals = {};
    MOD_PIE_KEYS.forEach(key => {
      let raw = null;
      if (key === "A1-A3") raw = toNumber(field(impact, "A1-A3"));
      else if (key === "A4") raw = toNumber(field(impact, "A4"));
      else if (key === "A5") raw = toNumber(field(impact, "A5"));
      else raw = toNumber(field(impact, impactColumnForScenario(key, s.id)));
      rawVals[key] = raw !== null ? Math.abs(raw) : 0;
    });
    const total = Object.values(rawVals).reduce((a, b) => a + b, 0);
    const a1c4Val = toNumber(field(impact, impactColumnForScenario("(A1-C4)", s.id)));
    const cardId = `xpie-${sIdx}-${Math.random().toString(36).slice(2, 7)}`;
    if (total === 0) return `
      <div class="xpie-card">
        <div class="xpie-scenario">${escapeHtml(s.name)}</div>
        <div class="dash-empty" style="min-height:80px">No data</div>
      </div>`;
    return `
      <div class="xpie-card">
        <div class="xpie-scenario">${escapeHtml(s.name)}</div>
        <div class="xpie-svg-wrap">
          ${buildExplodingPie(rawVals, total, a1c4Val, cardId)}
        </div>
      </div>`;
  }).join("");
  return `
    ${buildPieLegend()}
    <div class="xpie-row">${cards}</div>
    <div class="mod-pie-note">Each pie = A1-C4 lifecycle total (100%). Module D excluded. Hover a slice for details.</div>`;
}

function renderModulePieChartsCmp(impact, selected) {
  if (!selected.length) return `<div class="dash-empty">No data.</div>`;
  const cards = selected.map((s, sIdx) => {
    const rawVals = {};
    MOD_PIE_KEYS.forEach(key => {
      let raw = null;
      if (key === "A1-A3") raw = toNumber(field(impact, "A1-A3"));
      else if (key === "A4") raw = toNumber(field(impact, "A4"));
      else if (key === "A5") raw = toNumber(field(impact, "A5"));
      else raw = toNumber(field(impact, cmpImpactCol(key, s.id)));
      rawVals[key] = raw !== null ? Math.abs(raw) : 0;
    });
    const total = Object.values(rawVals).reduce((a, b) => a + b, 0);
    const a1c4Val = toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id)));
    const cardId = `cxpie-${sIdx}-${Math.random().toString(36).slice(2, 7)}`;
    if (total === 0) return `
      <div class="xpie-card">
        <div class="xpie-scenario">${escapeHtml(s.name)}</div>
        <div class="dash-empty" style="min-height:80px">No data</div>
      </div>`;
    return `
      <div class="xpie-card">
        <div class="xpie-scenario">${escapeHtml(s.name)}</div>
        <div class="xpie-svg-wrap">
          ${buildExplodingPie(rawVals, total, a1c4Val, cardId)}
        </div>
      </div>`;
  }).join("");
  return `
    ${buildPieLegend()}
    <div class="xpie-row">${cards}</div>
    <div class="mod-pie-note">Each pie = A1-C4 lifecycle total (100%). Module D excluded. Hover a slice for details.</div>`;
}

function _bindExplodingPie(container) {
  container.querySelectorAll(".xpie-slice-g").forEach(g => {
    const cardId = g.dataset.card;
    const key = g.dataset.key;
    const pct = g.dataset.pct;
    const label = g.dataset.label;
    const dx = parseFloat(g.dataset.dx);
    const dy = parseFloat(g.dataset.dy);
    const tipX = parseFloat(g.dataset.tipx);
    const tipY = parseFloat(g.dataset.tipy);
    const colour = MOD_PIE_COLOURS[key] || "#c0001a";
    const cval = document.getElementById(`${cardId}-cval`);
    const csub = document.getElementById(`${cardId}-csub`);
    const hmod = document.getElementById(`${cardId}-hmod`);
    const hpct = document.getElementById(`${cardId}-hpct`);
    const tipG = document.getElementById(`${cardId}-tip`);
    const tipBg = document.getElementById(`${cardId}-tip-bg`);
    const tipTxt = document.getElementById(`${cardId}-tip-txt`);

    const enter = () => {
      // ONLY transform the visible slice, NOT the hover zone
      const visiblePath = g.querySelector(".xpie-path");
      if (visiblePath) {
        visiblePath.style.transform = `translate(${dx}px,${dy}px)`;
        visiblePath.style.filter = `brightness(1.15) drop-shadow(0 4px 12px rgba(0,0,0,0.32))`;
        visiblePath.style.opacity = "1";
      }
      container.querySelectorAll(`.xpie-slice-g[data-card="${cardId}"]`).forEach(other => {
        if (other !== g) {
          const otherPath = other.querySelector(".xpie-path");
          if (otherPath) otherPath.style.opacity = "0.22";
        }
      });
      if (cval) cval.style.display = "none";
      if (csub) csub.style.display = "none";
      if (hmod) { hmod.textContent = label; hmod.style.display = "block"; }
      if (hpct) {
        hpct.textContent = pct + "%";
        hpct.setAttribute("fill", colour);
        hpct.style.display = "block";
      }
      if (tipG && tipBg && tipTxt) {
        const text = pct + "%";
        const tW = Math.max(text.length * 8 + 16, 44);
        const tH = 22;
        const tx = Math.min(Math.max(tipX - tW / 2, 2), 218 - tW);
        const ty = Math.min(Math.max(tipY - tH / 2, 2), 218 - tH);
        tipBg.setAttribute("x", tx);
        tipBg.setAttribute("y", ty);
        tipBg.setAttribute("width", tW);
        tipBg.setAttribute("height", tH);
        tipBg.setAttribute("fill", colour);
        tipTxt.setAttribute("x", tx + tW / 2);
        tipTxt.setAttribute("y", ty + tH - 6);
        tipTxt.textContent = text;
        tipG.style.display = "block";
      }
    };

    const leave = () => {
      const visiblePath = g.querySelector(".xpie-path");
      if (visiblePath) {
        visiblePath.style.transform = "";
        visiblePath.style.filter = "";
        visiblePath.style.opacity = "0.93";
      }
      container.querySelectorAll(`.xpie-slice-g[data-card="${cardId}"]`).forEach(other => {
        if (other !== g) {
          const otherPath = other.querySelector(".xpie-path");
          if (otherPath) otherPath.style.opacity = "0.93";
        }
      });
      if (cval) cval.style.display = "block";
      if (csub) csub.style.display = "block";
      if (hmod) hmod.style.display = "none";
      if (hpct) hpct.style.display = "none";
      if (tipG) tipG.style.display = "none";
    };

    g.addEventListener("mouseenter", enter);
    g.addEventListener("mouseleave", leave);
    g.addEventListener("touchstart", e => { e.preventDefault(); enter(); }, { passive: false });
    g.addEventListener("touchend", () => setTimeout(leave, 1400));
  });
}


/* ────────────────────────────────────────────────────────────────────
   MAIN BAR CHART
   ──────────────────────────────────────────────────────────────────── */

function renderMainBarChart(impact, selectedScenarios) {
  const chart = dom.mainBarChart || dom.moduleBarChart;
  if (!chart) return;
  if (!impact) {
    chart.className = "module-bar-chart empty-grid";
    chart.innerHTML = `<div class="dash-empty">No graph data available.</div>`;
    return;
  }
  const a1c4Totals = {};
  selectedScenarios.forEach(s => {
    a1c4Totals[s.id] = toNumber(field(impact, impactColumnForScenario("(A1-C4)", s.id)));
  });

  function toDisplayValue(rawValue, scenarioId) {
    if (state.chartDisplayMode !== "percent") return rawValue;
    const base = a1c4Totals[scenarioId];
    if (rawValue === null || !base || base === 0) return null;
    return (rawValue / Math.abs(base)) * 100;
  }
  function formatDisplay(v) {
    if (v === null) return "-";
    if (state.chartDisplayMode === "percent") return v.toFixed(1) + "%";
    return formatMetric(v);
  }

  const dispToggle = `
    <div class="chart-disp-toggle">
      <button class="chart-disp-btn ${state.chartDisplayMode === "values" ? "active" : ""}" data-disp="values">Values</button>
      <button class="chart-disp-btn ${state.chartDisplayMode === "percent" ? "active" : ""}" data-disp="percent">%</button>
    </div>`;

  if (state.chartView === "modules") {
    const allGroups = buildModuleChartGroups(impact, selectedScenarios);
    const modPills = allGroups.map(g => `
      <button class="chart-mod-btn ${!state.activeModules || state.activeModules.has(g.key) ? "active" : ""}"
        data-mod-key="${g.key}" title="${g.sub}">
        ${g.label}
      </button>`).join("");

    if (state.chartDisplayMode === "percent") {
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row">
          <div></div>
          ${dispToggle}
        </div>
        ${renderModulePieCharts(impact, selectedScenarios)}`;
      _bindExplodingPie(chart);
      return;
    }

    let groups = allGroups;
    if (state.activeModules) groups = groups.filter(g => state.activeModules.has(g.key));
    if (!groups.length) {
      chart.className = "module-bar-chart empty-grid";
      chart.innerHTML = `<div class="dash-empty">No graph data available.</div>`;
      return;
    }
    const scale = getChartScale(groups);
    chart.className = "module-bar-chart";
    chart.innerHTML = `
      <div class="chart-controls-row">
        <div class="chart-mod-selector">${modPills}</div>
        ${dispToggle}
      </div>
      ${renderModuleChartLegend(selectedScenarios)}
      <div class="module-chart-canvas">
        <div class="module-chart-plot">
          ${groups.map((g, i) => createModuleChartGroup(g, scale, i, formatDisplay)).join("")}
        </div>
        <div class="module-chart-note">Click module buttons above to filter. Graph reflects expanded/collapsed tiles.</div>
      </div>`;
  } else if (state.chartView === "a1c4") {
    if (state.chartDisplayMode === "percent") {
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row">
          <div></div>
          ${dispToggle}
        </div>
        ${renderModuleChartLegend(selectedScenarios)}
        ${renderDonutRingsSaved(impact, selectedScenarios)}`;
    } else {
      const a1c4Group = {
        key: "A1-C4", label: "A1-C4", sub: "Total", tone: "total",
        bars: selectedScenarios.map((s, i) => ({
          label: s.name, seriesIndex: i,
          value: toNumber(field(impact, impactColumnForScenario("(A1-C4)", s.id)))
        })).filter(b => b.value !== null)
      };
      const dGroup = {
        key: "D", label: "D", sub: "Benefit (Module D)", tone: "benefits",
        bars: selectedScenarios.map((s, i) => ({
          label: s.name, seriesIndex: i,
          value: toNumber(field(impact, impactColumnForScenario("D", s.id)))
        })).filter(b => b.value !== null)
      };
      const netGroup = {
        key: "Net", label: "Net Carbon", sub: "A1-C4 + D", tone: "total",
        bars: selectedScenarios.map((s, i) => {
          const a = toNumber(field(impact, impactColumnForScenario("(A1-C4)", s.id)));
          const d = toNumber(field(impact, impactColumnForScenario("D", s.id)));
          const net = sumValues([a !== null ? String(a) : null, d !== null ? String(d) : null]);
          return { label: s.name, seriesIndex: i, value: net };
        }).filter(b => b.value !== null)
      };
      const groups = [a1c4Group, dGroup, netGroup].filter(g => g.bars.length > 0);
      const scale = getChartScale(groups);
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row">
          <div></div>
          ${dispToggle}
        </div>
        ${renderModuleChartLegend(selectedScenarios)}
        <div class="module-chart-canvas">
          <div class="module-chart-plot chart-plot-wide">
            ${groups.map((g, i) => createModuleChartGroup(g, scale, i, formatDisplay)).join("")}
          </div>
          <div class="module-chart-note">A1-C4 total \u00B7 Module D benefit \u00B7 Net Carbon (A1-C4 + D) per scenario.</div>
        </div>`;
    }
  }
}

function renderModuleBarChart(impact, selectedScenarios) {
  renderMainBarChart(impact, selectedScenarios);
}

function buildModuleChartGroups(impact, selectedScenarios) {
  const groups = [];
  groups.push({
    key: "A1-A3", label: "A1-A3", sub: "Product stage", tone: "production",
    bars: selectedScenarios.map((scenario, i) => ({
      label: scenario.name, value: toNumber(field(impact, "A1-A3")), seriesIndex: i
    })).filter(b => b.value !== null)
  });
  groups.push({
    key: "A4", label: "A4", sub: "Transport to site", tone: "construction",
    bars: selectedScenarios.map((scenario, i) => ({
      label: scenario.name, value: toNumber(field(impact, "A4")), seriesIndex: i
    })).filter(b => b.value !== null)
  });
  groups.push({
    key: "A5", label: "A5", sub: "Installation", tone: "construction",
    bars: selectedScenarios.map((scenario, i) => ({
      label: scenario.name, value: toNumber(field(impact, "A5")), seriesIndex: i
    })).filter(b => b.value !== null)
  });
  const eolMap = { C1: "Deconstruction", C2: "Transport", C3: "Waste processing", C4: "Disposal" };
  ["C1", "C2", "C3", "C4"].forEach(base => {
    groups.push({
      key: base, label: base, sub: eolMap[base], tone: "endlife",
      bars: selectedScenarios.map((scenario, i) => ({
        label: scenario.name,
        value: toNumber(field(impact, impactColumnForScenario(base, scenario.id))),
        seriesIndex: i
      })).filter(b => b.value !== null)
    });
  });
  groups.push({
    key: "D", label: "D", sub: "Benefits beyond", tone: "benefits",
    bars: selectedScenarios.map((scenario, i) => ({
      label: scenario.name,
      value: toNumber(field(impact, impactColumnForScenario("D", scenario.id))),
      seriesIndex: i
    })).filter(b => b.value !== null)
  });
  return groups.filter(g => g.bars.length > 0);
}

function getChartScale(groups) {
  const values = groups.flatMap((group) => group.bars.map((bar) => bar.value)).filter((value) => value !== null);
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
  return { maxPositive, maxNegative, positiveZone, negativeZone, zeroBottom: negativeZone };
}

function createModuleChartGroup(group, scale, groupIndex, formatDisplay) {
  const fmt = formatDisplay || formatMetric;
  return `
    <div class="module-chart-group tone-${group.tone}" style="--group-index:${groupIndex};">
      <div class="module-chart-bars" style="--zero-line-bottom:${scale.zeroBottom}%;">
        <div class="module-chart-zero-line"></div>
        ${group.bars.map((bar, barIndex) => createModuleChartBar(group, bar, scale, barIndex, fmt)).join("")}
      </div>
      <div class="module-chart-group-label">
        ${group.label}
        <span class="module-chart-group-sub">${group.sub}</span>
      </div>
    </div>`;
}

function createModuleChartBar(group, bar, scale, barIndex, formatDisplay) {
  const fmt = formatDisplay || formatMetric;
  const value = bar.value ?? 0;
  const minVisiblePct = 3;
  const positiveRaw = value > 0 && scale.maxPositive > 0
    ? (Math.abs(value) / scale.maxPositive) * scale.positiveZone : 0;
  const negativeRaw = value < 0 && scale.maxNegative > 0
    ? (Math.abs(value) / scale.maxNegative) * scale.negativeZone : 0;
  const positiveHeight = value > 0 ? Math.min(Math.max(positiveRaw, minVisiblePct), scale.positiveZone) : 0;
  const negativeHeight = value < 0 ? Math.min(Math.max(negativeRaw, minVisiblePct), scale.negativeZone) : 0;
  const barClass = bar.common ? `common ${group.tone}` : `series-${bar.seriesIndex ?? 0}`;
  const positionStyle = value >= 0
    ? `height:${positiveHeight}%; bottom:calc(${scale.zeroBottom}% + 1px);`
    : `height:${negativeHeight}%; bottom:calc(${scale.zeroBottom}% - ${negativeHeight}% - 1px);`;
  const displayLabel = fmt(bar.value);
  return `
    <div class="module-chart-slot">
      <div class="module-chart-value-label ${value >= 0 ? "above" : "below"}">${displayLabel}</div>
      <div class="module-chart-tooltip ${value >= 0 ? "positive" : "negative"}">${displayLabel}</div>
      <div class="module-chart-bar ${value >= 0 ? "positive" : "negative"} ${barClass}"
        style="${positionStyle} --bar-index:${barIndex};"></div>
    </div>`;
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

function getLegendDotStyle(index) {
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


/* ────────────────────────────────────────────────────────────────────
   THEME TOGGLE
   ────────────────────────────────────────────────────────────────────
   Uses 'lindner-theme' localStorage key — syncs across all Lindner pages.
   ──────────────────────────────────────────────────────────────────── */

function initTheme() {
  /* Light mode deferred (Option C) — boden is dark-only for now.
     Ignores any stale "light" value in shared localStorage until
     light mode is built system-wide in shared CSS. */
  applyTheme("dark");
}

function toggleTheme() {
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("lindner-theme", nextTheme);
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  if (dom.themeLabel) {
    dom.themeLabel.textContent = theme === "dark" ? "Light" : "Dark";
  }
}


/* ════════════════════════════════════════════════════════════════════
   PDF EXPORT — Delegates to global /pdf-engine/
   ────────────────────────────────────────────────────────────────────
   Boden no longer owns PDF rendering logic. The global LindnerPDF
   engine (loaded via index.html) handles all output. Boden just
   provides data + labels via the public API.
   ════════════════════════════════════════════════════════════════════ */

const CONTACT_EMAIL = "denisa.krauss@lindner-group.com";

function openAriaEmail(type, context) {
  let subject, body;
  if (type === "support") {
    subject = "CO2 Compass \u2014 Support Request";
    body = `Hello,\n\nI have a question regarding the CO2 Compass tool:\n\n${context}\n\nBest regards`;
  } else if (type === "competitor") {
    subject = "CO2 Compass \u2014 Competitor Data Request";
    body = `Hello,\n\nI would like to request the following competitor to be added to CO2 Compass:\n\n${context}\n\nPlease advise on next steps.\n\nBest regards`;
  } else if (type === "general") {
    subject = "CO2 Compass \u2014 Inquiry";
    body = `Hello,\n\n${context}\n\nBest regards`;
  }
  window.open(
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  );
}


/* ─── Lindner products PDF ─── */

async function exportPdf() {
  if (!window.LindnerPDF) {
    alert("PDF engine not loaded. Check that pdf-engine scripts are included in index.html.");
    return;
  }
  const product = findSelectedRecord(state.products);
  const impact = findSelectedRecord(state.impacts);
  const epdRecord = findEpdRecord(field(product, "producttype"));
  if (!product || !impact) return;
  const scenarios = getAvailableScenarios(product);
  const selected = scenarios.filter(s => state.selectedScenarios.includes(s.id));
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
  const prodType = field(product, "producttype");
  const prodVar = field(product, "productvariant");
  const floorType = field(product, "floortype");
  const issueD = field(epdRecord, "issuedate") || field(epdRecord, "Issue date") || "--";
  const validD = field(epdRecord, "validto") || field(epdRecord, "Valid to") || "--";

  await window.LindnerPDF.export({
    today, issueD, validD,
    titleLine1: prodType,
    titleLine2: prodVar,
    floorType,
    techItems: [
      ["Floor type", floorType || "--"],
      ["Product type", prodType || "--"],
      ["Layer thickness", (field(product, "layerthickness") || field(product, "Layer thickness") || "--") + " mm"],
      ["Density", (field(product, "density") || field(product, "Density") || "--") + " kg/m\u00B3"],
      ["Declared unit", (field(product, "declaredunit") || field(product, "declared unit") || "--") + " kg/m\u00B2"]
    ],
    selected,
    impact,
    getA1c4:   s => toNumber(field(impact, impactColumnForScenario("(A1-C4)", s.id))),
    getD:      s => toNumber(field(impact, impactColumnForScenario("D", s.id))),
    getModule: (col, s) => toNumber(field(impact, impactColumnForScenario(col, s.id))),
    getFixed:  col => toNumber(field(impact, col)),
    buildModGroups: () => buildModuleChartGroups(impact, selected),
    getScenarioDesc: s => getScenarioInfo(field(product, "producttype"), s.name) || "",
    filename: `CarbonReport_${(prodType || "product").replace(/\s+/g, "_")}_${today.replace(/\s/g, "")}.pdf`
  });
}


/* ─── Competitor PDF ─── */

async function exportCmpPdf() {
  if (!window.LindnerPDF) {
    alert("PDF engine not loaded. Check that pdf-engine scripts are included in index.html.");
    return;
  }
  const impact = cmpState.impact;
  const selected = (cmpState.scenarios || []).filter(s => cmpState.selectedScenarios.includes(s.id));
  if (!impact || !selected.length) return;

  const competitor = cmpDom.competitorSelect.value;
  const variant = cmpDom.productVariantSelect.value;
  const fam = cmpDom.productFamilySelect.value;
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });

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

  const issueD = field(epd, "issuedate") || field(epd, "Issue date") || "--";
  const validD = field(epd, "validto") || field(epd, "Valid to") || "--";

  await window.LindnerPDF.export({
    today, issueD, validD,
    titleLine1: competitor,
    titleLine2: variant,
    floorType: fam,
    techItems: [
      ["Division", CMP_DIVISION],
      ["Product family", fam || "--"],
      ["Competitor", competitor || "--"],
      ["Layer thickness", (product ? (field(product, "layerthickness") || field(product, "Layer thickness")) : "--") + " mm"],
      ["Density", (product ? (field(product, "density") || field(product, "Density")) : "--") + " kg/m\u00B3"],
      ["Declared unit", (product ? (field(product, "declaredunit") || field(product, "declared unit")) : "--") + " kg/m\u00B2"]
    ],
    selected,
    impact,
    getA1c4:   s => toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id))),
    getD:      s => toNumber(field(impact, cmpImpactCol("D", s.id))),
    getModule: (col, s) => toNumber(field(impact, cmpImpactCol(col, s.id))),
    getFixed:  col => toNumber(field(impact, col)),
    buildModGroups: () => {
      const grps = [];
      const em = { C1: "Deconstruction", C2: "Transport", C3: "Waste proc.", C4: "Disposal" };
      grps.push({
        key: "A1-A3", label: "A1-A3", sub: "Product stage", tone: "production",
        bars: selected.map((s, i) => ({
          label: s.name,
          value: toNumber(field(impact, "A1-A3")),
          seriesIndex: i
        })).filter(b => b.value !== null)
      });
      grps.push({
        key: "A4", label: "A4", sub: "Transport", tone: "construction",
        bars: selected.map((s, i) => ({
          label: s.name,
          value: toNumber(field(impact, "A4")),
          seriesIndex: i
        })).filter(b => b.value !== null)
      });
      grps.push({
        key: "A5", label: "A5", sub: "Installation", tone: "construction",
        bars: selected.map((s, i) => ({
          label: s.name,
          value: toNumber(field(impact, "A5")),
          seriesIndex: i
        })).filter(b => b.value !== null)
      });
      ["C1", "C2", "C3", "C4"].forEach(base => grps.push({
        key: base, label: base, sub: em[base], tone: "endlife",
        bars: selected.map((s, i) => ({
          label: s.name,
          value: toNumber(field(impact, cmpImpactCol(base, s.id))),
          seriesIndex: i
        })).filter(b => b.value !== null)
      }));
      grps.push({
        key: "D", label: "D", sub: "Benefits", tone: "benefits",
        bars: selected.map((s, i) => ({
          label: s.name,
          value: toNumber(field(impact, cmpImpactCol("D", s.id))),
          seriesIndex: i
        })).filter(b => b.value !== null)
      });
      return grps.filter(g => g.bars.length > 0);
    },
    getScenarioDesc: () => "",
    filename: `CarbonReport_Competitor_${(competitor || "comp").replace(/\s+/g, "_")}_${today.replace(/\s/g, "")}.pdf`
  });
}


/* ════════════════════════════════════════════════════════════════════
   COMPETITOR PANEL
   ════════════════════════════════════════════════════════════════════ */

const CMP_DIVISION = "Floor Panels";

const cmpState = {
  impacts: [], products: [], epds: [],
  selectedScenarios: [], chartView: "modules", chartDisplayMode: "values", _loaded: false,
  impact: null,
  activeModules: null,
  expandedProductStage: false, expandedConstruction: false,
  expandedEndOfLife: false, expandedBenefits: false
};

const cmpDom = {};

const CMP_MODULES = [
  { key: "A1-A3", code: "A1-A3", title: "Product stage", desc: "Raw materials, transport and manufacturing.",
    area: "area-a13", tone: "tone-production", codeClass: "code-production" },
  { key: "A4", code: "A4", title: "Transport to site", desc: "Transport to construction site.",
    area: "area-a4", tone: "tone-construction", codeClass: "code-construction" },
  { key: "A5", code: "A5", title: "Installation", desc: "Assembly and installation.",
    area: "area-a5", tone: "tone-construction", codeClass: "code-construction" }
];

const CMP_EOL_MODULES = [
  { base: "C1", code: "C1", title: "Deconstruction / demolition", desc: "Removal at end of life.",
    area: "area-c1", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C2", code: "C2", title: "Transport", desc: "Transport after removal.",
    area: "area-c2", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C3", code: "C3", title: "Waste processing", desc: "Sorting or processing before final treatment.",
    area: "area-c3", tone: "tone-endlife", codeClass: "code-endlife" },
  { base: "C4", code: "C4", title: "Disposal", desc: "Final disposal stage.",
    area: "area-c4", tone: "tone-endlife", codeClass: "code-endlife" }
];

function cmpImpactCol(base, id) {
  return id === 1 ? base : `${base}/${id - 1}`;
}

function toggleCompetitorPanel(open) {
  const cmpBtn = document.getElementById("competitorTabBtn");
  const lindnerBtn = document.querySelector(".tool-tab:not(#competitorTabBtn)");
  const panel = document.getElementById("competitorPanel");
  const lindnerView = document.getElementById("lindnerView");
  const mainCfg = document.getElementById("mainConfigPanel");
  if (!cmpBtn || !panel) return;
  cmpBtn.setAttribute("aria-pressed", open ? "true" : "false");
  cmpBtn.classList.toggle("tool-tab-active", open);
  cmpBtn.classList.toggle("tool-tab-competitor", open);
  cmpBtn.classList.toggle("tool-tab-link", !open);
  if (lindnerBtn) lindnerBtn.classList.toggle("tool-tab-active", !open);
  panel.style.display = open ? "block" : "none";
  if (lindnerView) lindnerView.style.display = open ? "none" : "";
  if (mainCfg) mainCfg.style.display = open ? "none" : "";
  dom.epdDownloadBtn.style.display = open ? "none" : "";
  dom.reportDownloadBtn.style.display = open ? "none" : "";
  dom.exportPdfBtn.classList.add("disabled");
  dom.exportPdfBtn.setAttribute("aria-disabled", "true");
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
    const [impacts, products, epds] = await Promise.all([
      fetchCsv("../competitor/floor_comparison_impacts.csv"),
      fetchCsv("../competitor/competitor_product.csv"),
      fetchCsv("../competitor/competitor_epd.csv")
    ]);
    cmpState.impacts = impacts;
    cmpState.products = products;
    cmpState.epds = epds;
  } catch (e) {
    console.error("Competitor CSV load error:", e);
    cmpDom.selectionSummary.textContent = "Unable to load competitor data. Ensure CSVs are in the competitor/ folder.";
    return;
  }

  const families = uniqueSorted(
    cmpState.impacts
      .filter(r => cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION))
      .map(r => field(r, "product_family"))
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
  blank.value = "";
  blank.textContent = placeholder;
  sel.appendChild(blank);
  items.forEach(item => {
    const o = document.createElement("option");
    o.value = o.textContent = item;
    sel.appendChild(o);
  });
  sel.disabled = !enabled;
}

function onCmpFamilyChange() {
  const fam = cmpDom.productFamilySelect.value;
  cmpSetOpts(cmpDom.competitorSelect, [], "Select competitor", false);
  cmpSetOpts(cmpDom.productVariantSelect, [], "Select product variant", false);
  cmpDom.mainLayout.style.display = "none";
  cmpDom.bottomSection.style.display = "none";
  cmpResetExpansion();
  if (!fam) {
    cmpDom.selectionSummary.textContent = "Select a product family to begin.";
    return;
  }
  const competitors = uniqueSorted(
    cmpState.impacts
      .filter(r =>
        cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) &&
        cleanKeyText(field(r, "product_family")) === cleanKeyText(fam))
      .map(r => field(r, "producttype_comparable"))
  );
  cmpSetOpts(cmpDom.competitorSelect, competitors, "Select competitor", true);
  cmpDom.selectionSummary.textContent = `${fam} \u2014 choose a competitor.`;
}

function onCmpCompetitorChange() {
  const fam = cmpDom.productFamilySelect.value;
  const comp = cmpDom.competitorSelect.value;
  cmpSetOpts(cmpDom.productVariantSelect, [], "Select product variant", false);
  cmpDom.mainLayout.style.display = "none";
  cmpDom.bottomSection.style.display = "none";
  cmpResetExpansion();
  if (!comp) return;
  const variants = uniqueSorted(
    cmpState.impacts
      .filter(r =>
        cleanKeyText(field(r, "division")) === cleanKeyText(CMP_DIVISION) &&
        cleanKeyText(field(r, "product_family")) === cleanKeyText(fam) &&
        cleanKeyText(field(r, "producttype_comparable")) === cleanKeyText(comp))
      .map(r => field(r, "productvariant_comparable"))
  );
  cmpSetOpts(cmpDom.productVariantSelect, variants, "Select product variant", true);
  cmpDom.selectionSummary.textContent = `${comp} \u2014 choose a product variant.`;
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
  if (!impact) {
    cmpDom.selectionSummary.textContent = "No impact data found for this variant.";
    return;
  }
  cmpState.impact = impact;
  const scenarios = cmpGetScenarios(impact);
  cmpState.scenarios = scenarios;
  cmpState.selectedScenarios = scenarios.map(s => s.id);
  cmpState.chartView = "modules";
  cmpState.chartDisplayMode = "values";
  document.querySelectorAll("[data-cmp-view]").forEach(b => b.classList.toggle("active", b.dataset.cmpView === "modules"));
  cmpDom.selectionSummary.textContent = `Loaded: ${comp} \u2014 ${variant}`;
  cmpDom.selectedCompetitor.textContent = comp;
  cmpDom.selectedVariant.textContent = variant;
  cmpDom.issueDateValue.textContent = field(epd, "issuedate") || field(epd, "Issue date") || "-";
  cmpDom.validToValue.textContent = field(epd, "validto") || field(epd, "Valid to") || "-";

  const img = field(epd, "image");
  cmpDom.productImage.style.display = "none";
  cmpDom.productImagePlaceholder.style.display = "grid";
  if (img) {
    cmpDom.productImage.onload = () => {
      cmpDom.productImage.style.display = "block";
      cmpDom.productImagePlaceholder.style.display = "none";
    };
    cmpDom.productImage.onerror = () => {};
    cmpDom.productImage.src = img;
  } else {
    cmpDom.productImage.removeAttribute("src");
  }

  cmpDom.technicalGrid.classList.remove("empty-grid");
  cmpDom.technicalGrid.innerHTML = [
    { label: "Layer thickness (mm)", value: product ? (field(product, "layerthickness") || field(product, "Layer thickness")) : "-" },
    { label: "Density (kg/m\u00B3)", value: product ? (field(product, "density") || field(product, "Density")) : "-" },
    { label: "Declared unit (kg/m\u00B2)", value: product ? (field(product, "declaredunit") || field(product, "declared unit")) : "-" }
  ].map(i => `<div class="metric-box"><div><span class="metric-label">${i.label}</span><div class="metric-value">${i.value || "-"}</div></div></div>`).join("");

  cmpRenderScenarios(scenarios, impact);
  cmpDom.mainLayout.style.display = "grid";
  cmpDom.bottomSection.style.display = "block";
  dom.exportPdfBtn.classList.remove("disabled");
  dom.exportPdfBtn.setAttribute("aria-disabled", "false");
  cmpRenderResults(impact, scenarios);
}

function cmpGetScenarios(impactRow) {
  return [1, 2, 3].map(id => {
    const name = field(impactRow, `Scenario ${id}`);
    if (!name) return null;
    return { id, name, emoji: getScenarioEmoji(name) };
  }).filter(Boolean);
}

function cmpResetExpansion() {
  cmpState.expandedProductStage = false;
  cmpState.expandedConstruction = false;
  cmpState.expandedEndOfLife = false;
  cmpState.expandedBenefits = false;
}

function cmpRenderScenarios(scenarios, impact) {
  cmpDom.scenarioList.classList.remove("empty-grid");
  cmpDom.scenarioList.innerHTML = scenarios.map(s => {
    const active = cmpState.selectedScenarios.includes(s.id);
    return `<div class="scenario-info-card ${active ? "selected" : ""}">
      <div class="scenario-title-row"><div class="scenario-name">${s.name}</div></div>
    </div>`;
  }).join("");
  cmpDom.scenarioPicker.innerHTML = scenarios.map(s => {
    const active = cmpState.selectedScenarios.includes(s.id);
    return `<button type="button" class="scenario-filter-btn ${active ? "active" : ""}" data-cmp-scenario-id="${s.id}">
      ${s.name}
    </button>`;
  }).join("");
  cmpDom.scenarioPicker.querySelectorAll("[data-cmp-scenario-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.cmpScenarioId);
      const set = new Set(cmpState.selectedScenarios);
      if (set.has(id)) { if (set.size === 1) return; set.delete(id); }
      else set.add(id);
      cmpState.selectedScenarios = scenarios.map(s => s.id).filter(i => set.has(i));
      cmpDom.scenarioPicker.querySelectorAll("[data-cmp-scenario-id]").forEach(b =>
        b.classList.toggle("active", set.has(Number(b.dataset.cmpScenarioId)))
      );
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

  parts.push(cmpExpandableTile({
    area: "area-a13", tone: "tone-production", codeClass: "code-production", code: "A1-A3",
    title: "Product stage", value: toNumber(field(impact, "A1-A3")),
    desc: "Raw materials, transport and manufacturing.",
    expanded: cmpState.expandedProductStage, toggleTarget: "productStage"
  }));

  if (cmpState.expandedConstruction) {
    parts.push(cmpSingleTile(CMP_MODULES[1], impact));
    parts.push(cmpSingleTile(CMP_MODULES[2], impact));
  } else {
    parts.push(cmpExpandableTile({
      area: "area-construction", tone: "tone-construction", codeClass: "code-construction", code: "A4-A5",
      title: "Construction stage", value: sumValues([field(impact, "A4"), field(impact, "A5")]),
      desc: "Transport to site and installation.",
      expanded: false, toggleTarget: "construction"
    }));
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
  cmpRenderChart(impact, selected);
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
  return `<div class="result-tile ${area} ${tone} toggle-tile ${expanded ? "is-open" : ""}" data-toggle-target="${toggleTarget}">
    <div class="result-head"><div><h4 class="result-title">${title}</h4></div><span class="result-code ${codeClass}">${code}</span></div>
    <div class="single-value">${formatMetric(value)}</div>
    <div class="tile-detail ${expanded ? "show" : ""}"><p class="result-desc detail-desc">${desc}</p></div>
  </div>`;
}

function cmpSingleTile(module, impact) {
  return `<div class="result-tile ${module.area} ${module.tone} tile-appearing">
    <div class="result-head"><div><h4 class="result-title">${module.title}</h4><p class="result-desc">${module.desc}</p></div><span class="result-code ${module.codeClass}">${module.code}</span></div>
    <div class="single-value">${formatMetric(toNumber(field(impact, module.key)))}</div>
  </div>`;
}

function cmpValueLines(rows) {
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.value ?? 0)), 1);
  return rows.map(row => {
    const w = (Math.abs(row.value ?? 0) / maxAbs) * 100;
    const type = (row.value ?? 0) >= 0 ? "positive" : "negative";
    return `<div class="compare-line">
      <div class="compare-meta"><span>${row.name}</span><strong>${formatMetric(row.value)}</strong></div>
      <div class="bar-track"><div class="bar-fill ${type}" style="--w:${w}"></div></div>
    </div>`;
  }).join("");
}

function cmpEolTile(impact, selected) {
  const rows = selected.map(s => ({
    name: s.name,
    value: sumValues(["C1", "C2", "C3", "C4"].map(c => field(impact, cmpImpactCol(c, s.id))))
  })).filter(r => r.value !== null);
  return `<div class="result-tile area-eol tone-endlife toggle-tile" data-toggle-target="endOfLife">
    <div class="result-head"><div><h4 class="result-title">End of life stage</h4></div><span class="result-code code-endlife">C1-C4</span></div>
    <div class="compare-stack">${cmpValueLines(rows)}</div>
  </div>`;
}

function cmpBenefitsTile(impact, selected) {
  const rows = selected.map(s => ({
    name: s.name,
    value: toNumber(field(impact, cmpImpactCol("D", s.id)))
  })).filter(r => r.value !== null);
  return `<div class="result-tile area-d tone-benefits toggle-tile ${cmpState.expandedBenefits ? "is-open" : ""}" data-toggle-target="benefits">
    <div class="result-head"><div><h4 class="result-title">Benefits beyond life cycle stage</h4></div><span class="result-code code-benefits">D</span></div>
    <div class="compare-stack">${cmpValueLines(rows)}</div>
    <div class="tile-detail ${cmpState.expandedBenefits ? "show" : ""}"><p class="result-desc detail-desc">Potential benefits or loads beyond the system boundary.</p></div>
  </div>`;
}

function cmpScenarioTile(module, impact, selected) {
  const rows = selected.map(s => ({
    name: s.name,
    value: toNumber(field(impact, cmpImpactCol(module.base, s.id)))
  })).filter(r => r.value !== null);
  return `<div class="result-tile ${module.area} ${module.tone} tile-appearing">
    <div class="result-head"><div><h4 class="result-title">${module.title}</h4><p class="result-desc">${module.desc}</p></div><span class="result-code ${module.codeClass}">${module.code}</span></div>
    <div class="compare-stack">${cmpValueLines(rows)}</div>
  </div>`;
}

function cmpTotalTile(impact, selected) {
  const cards = selected.map(s => {
    const v = toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id)));
    return `<div class="total-card"><span>${escapeHtml(s.name)}</span><strong>${formatMetric(v)}</strong></div>`;
  }).join("");
  return `<div class="result-tile area-total tone-total">
    <div class="result-head"><div><h4 class="result-title">A1-C4 Total (kg CO\u2082eq/m\u00B2)</h4><p class="result-desc">Combined result up to end of life for selected scenarios.</p></div><span class="result-code code-total">A1-C4</span></div>
    <div class="total-grid">${cards || `<div class="dash-empty">No total values available.</div>`}</div>
  </div>`;
}

function cmpRenderChart(impact, selected) {
  const chart = cmpDom.mainBarChart;
  if (!chart) return;
  if (!impact) {
    chart.className = "module-bar-chart empty-grid";
    chart.innerHTML = `<div class="dash-empty">No graph data available.</div>`;
    return;
  }
  const a1c4Totals = {};
  selected.forEach(s => {
    a1c4Totals[s.id] = toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id)));
  });
  function toDisplayValue(rawValue, scenarioId) {
    if (cmpState.chartDisplayMode !== "percent") return rawValue;
    const base = a1c4Totals[scenarioId];
    if (rawValue === null || !base || base === 0) return null;
    return (rawValue / Math.abs(base)) * 100;
  }
  function formatDisplay(v) {
    if (v === null) return "-";
    if (cmpState.chartDisplayMode === "percent") return v.toFixed(1) + "%";
    return formatMetric(v);
  }
  const dispToggle = `
    <div class="chart-disp-toggle">
      <button class="chart-disp-btn ${cmpState.chartDisplayMode === "values" ? "active" : ""}" data-cmp-disp="values">Values</button>
      <button class="chart-disp-btn ${cmpState.chartDisplayMode === "percent" ? "active" : ""}" data-cmp-disp="percent">%</button>
    </div>`;

  if (cmpState.chartView === "modules") {
    const allGs = [];
    allGs.push({
      key: "A1-A3", label: "A1-A3", sub: "Product stage", tone: "production",
      bars: selected.map((s, i) => ({
        label: s.name,
        value: toDisplayValue(toNumber(field(impact, "A1-A3")), s.id),
        seriesIndex: i
      })).filter(b => b.value !== null)
    });
    allGs.push({
      key: "A4", label: "A4", sub: "Transport to site", tone: "construction",
      bars: selected.map((s, i) => ({
        label: s.name,
        value: toDisplayValue(toNumber(field(impact, "A4")), s.id),
        seriesIndex: i
      })).filter(b => b.value !== null)
    });
    allGs.push({
      key: "A5", label: "A5", sub: "Installation", tone: "construction",
      bars: selected.map((s, i) => ({
        label: s.name,
        value: toDisplayValue(toNumber(field(impact, "A5")), s.id),
        seriesIndex: i
      })).filter(b => b.value !== null)
    });
    const eolMap = { C1: "Deconstruction", C2: "Transport", C3: "Waste processing", C4: "Disposal" };
    ["C1", "C2", "C3", "C4"].forEach(base => allGs.push({
      key: base, label: base, sub: eolMap[base], tone: "endlife",
      bars: selected.map((s, i) => ({
        label: s.name,
        value: toDisplayValue(toNumber(field(impact, cmpImpactCol(base, s.id))), s.id),
        seriesIndex: i
      })).filter(b => b.value !== null)
    }));
    allGs.push({
      key: "D", label: "D", sub: "Benefits beyond", tone: "benefits",
      bars: selected.map((s, i) => ({
        label: s.name,
        value: toDisplayValue(toNumber(field(impact, cmpImpactCol("D", s.id))), s.id),
        seriesIndex: i
      })).filter(b => b.value !== null)
    });
    const allGroups = allGs.filter(g => g.bars.length > 0);
    const modPills = allGroups.map(g => `
      <button class="chart-mod-btn cmp-mod-btn ${!cmpState.activeModules || cmpState.activeModules.has(g.key) ? "active" : ""}"
        data-mod-key="${g.key}" title="${g.sub}">
        ${g.label}
      </button>`).join("");

    if (cmpState.chartDisplayMode === "percent") {
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row">
          <div></div>
          ${dispToggle}
        </div>
        ${renderModulePieChartsCmp(impact, selected)}`;
      _bindExplodingPie(chart);
      return;
    }
    const groups = cmpState.activeModules
      ? allGroups.filter(g => cmpState.activeModules.has(g.key))
      : allGroups;
    if (!groups.length) {
      chart.className = "module-bar-chart empty-grid";
      chart.innerHTML = `<div class="dash-empty">No graph data available.</div>`;
      return;
    }
    const scale = getChartScale(groups);
    chart.className = "module-bar-chart";
    chart.innerHTML = `
      <div class="chart-controls-row">
        <div class="chart-mod-selector">${modPills}</div>
        ${dispToggle}
      </div>
      ${renderModuleChartLegend(selected)}
      <div class="module-chart-canvas">
        <div class="module-chart-plot">
          ${groups.map((g, i) => createModuleChartGroup(g, scale, i, formatDisplay)).join("")}
        </div>
        <div class="module-chart-note">Click module buttons above to filter.</div>
      </div>`;
  } else if (cmpState.chartView === "a1c4") {
    if (cmpState.chartDisplayMode === "percent") {
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row">
          <div></div>
          ${dispToggle}
        </div>
        ${renderModuleChartLegend(selected)}
        ${renderDonutRingsSavedCmp(impact, selected)}`;
    } else {
      const a1c4Group = {
        key: "A1-C4", label: "A1-C4", sub: "Total", tone: "total",
        bars: selected.map((s, i) => ({
          label: s.name, seriesIndex: i,
          value: toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id)))
        })).filter(b => b.value !== null)
      };
      const dGroup = {
        key: "D", label: "D", sub: "Benefit (Module D)", tone: "benefits",
        bars: selected.map((s, i) => ({
          label: s.name, seriesIndex: i,
          value: toNumber(field(impact, cmpImpactCol("D", s.id)))
        })).filter(b => b.value !== null)
      };
      const netGroup = {
        key: "Net", label: "Net Carbon", sub: "A1-C4 + D", tone: "total",
        bars: selected.map((s, i) => {
          const a = toNumber(field(impact, cmpImpactCol("(A1-C4)", s.id)));
          const d = toNumber(field(impact, cmpImpactCol("D", s.id)));
          const net = sumValues([a !== null ? String(a) : null, d !== null ? String(d) : null]);
          return { label: s.name, seriesIndex: i, value: net };
        }).filter(b => b.value !== null)
      };
      const groups = [a1c4Group, dGroup, netGroup].filter(g => g.bars.length > 0);
      const scale = getChartScale(groups);
      chart.className = "module-bar-chart";
      chart.innerHTML = `
        <div class="chart-controls-row">
          <div></div>
          ${dispToggle}
        </div>
        ${renderModuleChartLegend(selected)}
        <div class="module-chart-canvas">
          <div class="module-chart-plot chart-plot-wide">
            ${groups.map((g, i) => createModuleChartGroup(g, scale, i, formatDisplay)).join("")}
          </div>
          <div class="module-chart-note">A1-C4 total \u00B7 Module D benefit \u00B7 Net Carbon per scenario.</div>
        </div>`;
    }
  }
}


/* ════════════════════════════════════════════════════════════════════
   ARIA CONTEXT BUILDER
   ────────────────────────────────────────────────────────────────────
   Called by ../aria/aria.js on every message to get fresh session data.
   ════════════════════════════════════════════════════════════════════ */

function buildBodenAriaContext() {
  const ctx = {
    page: 'Floor Panels (boden)',
    mode: 'Lindner Products'
  };

  // Competitor mode?
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
      ctx.scenarios = cmpState.scenarios.map(s => {
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
    return ctx;
  }

  // Lindner products mode
  const product = findSelectedRecord(state.products);
  if (!product) {
    ctx.userState = 'No product selected yet. User needs to pick a floor type, product type, and variant.';
    return ctx;
  }
  const impact = findSelectedRecord(state.impacts);
  const epdRecord = findEpdRecord(field(product, 'producttype'));
  const scenarios = getAvailableScenarios(product);
  const selected = scenarios.filter(s => state.selectedScenarios.includes(s.id));

  ctx.product = {
    type: field(product, 'producttype'),
    variant: field(product, 'productvariant'),
    floorType: field(product, 'floortype'),
    layerThickness: field(product, 'layerthickness') || field(product, 'Layer thickness'),
    density: field(product, 'density') || field(product, 'Density'),
    declaredUnit: field(product, 'declaredunit') || field(product, 'declared unit')
  };
  ctx.epd = {
    issueDate: field(epdRecord, 'issuedate') || field(epdRecord, 'Issue date'),
    validTo: field(epdRecord, 'validto') || field(epdRecord, 'Valid to')
  };

  if (impact) {
    ctx.fixedModules = {
      'A1-A3': field(impact, 'A1-A3'),
      'A4': field(impact, 'A4'),
      'A5': field(impact, 'A5')
    };
    ctx.selectedScenarios = selected.map(s => {
      const moduleData = {};
      ['C1', 'C2', 'C3', 'C4', 'D', '(A1-C4)'].forEach(m => {
        const v = field(impact, impactColumnForScenario(m, s.id));
        if (v) moduleData[m] = v;
      });
      const a = toNumber(field(impact, impactColumnForScenario('(A1-C4)', s.id)));
      const d = toNumber(field(impact, impactColumnForScenario('D', s.id)));
      moduleData.netCarbon = (a !== null && d !== null) ? (a + d).toFixed(2) : null;
      return { name: s.name, ...moduleData };
    });

    // Highlight high GWP modules
    const threshold = 1.5;
    const highMods = [];
    ['A1-A3', 'A4', 'A5'].forEach(m => {
      const v = toNumber(field(impact, m));
      if (v !== null && v > threshold) highMods.push(`${m}=${v}`);
    });
    selected.forEach(s => {
      ['C1', 'C2', 'C3', 'C4'].forEach(m => {
        const v = toNumber(field(impact, impactColumnForScenario(m, s.id)));
        if (v !== null && v > threshold) highMods.push(`${m}=${v} (${s.name})`);
      });
    });
    if (highMods.length) {
      ctx.highGwpModules = highMods.join(', ');
      ctx.thresholdNote = `Modules above ${threshold} kg CO2eq/m\u00B2 are significant contributors.`;
    }
  }

  if (state.scenarioInfo?.length) {
    ctx.scenarioDescriptions = {};
    scenarios.forEach(s => {
      const desc = getScenarioInfo(field(product, 'producttype'), s.name);
      if (desc) ctx.scenarioDescriptions[s.name] = desc;
    });
  }
  return ctx;
}


/* ════════════════════════════════════════════════════════════════════
   END OF script.js
   ────────────────────────────────────────────────────────────────────
   BODEN v3.0 \u2014 PDF engine extracted to /pdf-engine/
   File size: ~1100 lines (down from ~1600)
   
   \u2705 All PDF rendering removed (delegated to global engine)
   \u2705 Theme syncs via 'lindner-theme' localStorage
   \u2705 Competitor panel fully functional
   \u2705 buildBodenAriaContext() exposes data to ARIA
   ════════════════════════════════════════════════════════════════════ */
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
    if (!on && document.getElementById("competitorTabBtn")?.getAttribute("aria-pressed") === "true") {
      toggleCompetitorPanel(false);
    }
  }

  toggleBtn.addEventListener("click", () => setCompetitorEnabled(!competitorEnabled));
})();