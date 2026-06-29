// ── State ─────────────────────────────────────────────────────
const state = {
  products: [], epds: [], impacts: [], pdfMap: [],
  selectedScenarios: [], theme: "dark",
  expandedProductStage: false, expandedConstruction: false,
  expandedEndOfLife: false, expandedBenefits: false,
  chartView: "modules"
};
const dom = {};

const COMMON_MODULES = [
  { key:"A1-A3", code:"A1-A3", title:"Product stage",    desc:"Raw materials, transport and manufacturing.", area:"area-a13", tone:"tone-production",   codeClass:"code-production"  },
  { key:"A4",    code:"A4",    title:"Transport to site", desc:"Transport to construction site.",            area:"area-a4",  tone:"tone-construction", codeClass:"code-construction"},
  { key:"A5",    code:"A5",    title:"Installation",      desc:"Assembly and installation.",                area:"area-a5",  tone:"tone-construction", codeClass:"code-construction"}
];
const SCENARIO_MODULES = [
  { base:"C1", code:"C1", title:"Deconstruction / demolition", desc:"Removal at end of life.",                       area:"area-c1", tone:"tone-endlife",  codeClass:"code-endlife" },
  { base:"C2", code:"C2", title:"Transport",                   desc:"Transport after removal.",                     area:"area-c2", tone:"tone-endlife",  codeClass:"code-endlife" },
  { base:"C3", code:"C3", title:"Waste processing",            desc:"Sorting or processing before final treatment.",area:"area-c3", tone:"tone-endlife",  codeClass:"code-endlife" },
  { base:"C4", code:"C4", title:"Disposal",                    desc:"Final disposal stage.",                        area:"area-c4", tone:"tone-endlife",  codeClass:"code-endlife" },
  { base:"D",  code:"D",  title:"Benefits beyond life cycle",  desc:"Potential benefits beyond system boundary.",   area:"area-d",  tone:"tone-benefits", codeClass:"code-benefits"}
];

document.addEventListener("DOMContentLoaded", async () => {
  cacheDom(); bindEvents(); initTheme(); updateDashboardVisibility();
  await loadData(); populateCompetitors();
  renderEmptyState("Select a competitor and product variant to load the dashboard.");
});

// ── DOM cache ──────────────────────────────────────────────────
function cacheDom() {
  dom.divisionSelect       = document.getElementById("divisionSelect");
  dom.productFamilySelect  = document.getElementById("productFamilySelect");
  dom.competitorSelect     = document.getElementById("competitorSelect");
  dom.productVariantSelect = document.getElementById("productVariantSelect");
  dom.selectionSummary     = document.getElementById("selectionSummary");
  dom.mainLayout           = document.querySelector(".main-layout");
  dom.exportPdfBtn         = document.getElementById("exportPdfBtn");
  dom.themeToggle          = document.getElementById("themeToggle");
  dom.themeLabel           = document.getElementById("themeLabel");
  dom.productImage             = document.getElementById("productImage");
  dom.productImagePlaceholder  = document.getElementById("productImagePlaceholder");
  dom.selectedCompetitor       = document.getElementById("selectedCompetitor");
  dom.selectedProductVariant   = document.getElementById("selectedProductVariant");
  dom.issueDateValue           = document.getElementById("issueDateValue");
  dom.validToValue             = document.getElementById("validToValue");
  dom.technicalGrid        = document.getElementById("technicalGrid");
  dom.scenarioList         = document.getElementById("scenarioList");
  dom.scenarioPicker       = document.getElementById("scenarioPicker");
  dom.resultsLifecycleGrid = document.getElementById("resultsLifecycleGrid");
  dom.bottomSection        = document.getElementById("bottomSection");
  dom.mainBarChart         = document.getElementById("mainBarChart");
  dom.moduleBarChart       = dom.mainBarChart;
  dom.summaryBarChart      = null;
}

function updateDashboardVisibility() {
  const ready = Boolean(
    dom.divisionSelect.value &&
    dom.productFamilySelect.value &&
    dom.competitorSelect.value &&
    dom.productVariantSelect.value
  );
  dom.selectionSummary.classList.toggle("hidden-until-ready", !ready);
  dom.mainLayout.classList.toggle("hidden-until-ready", !ready);
  if (dom.bottomSection) dom.bottomSection.classList.toggle("hidden-until-ready", !ready);
}

// ── Events ─────────────────────────────────────────────────────
function bindEvents() {
  dom.divisionSelect.addEventListener("change", onDivisionChange);
  dom.productFamilySelect.addEventListener("change", onProductFamilyChange);
  dom.competitorSelect.addEventListener("change", onCompetitorChange);
  dom.productVariantSelect.addEventListener("change", onProductVariantChange);
  dom.themeToggle.addEventListener("click", toggleTheme);
  dom.exportPdfBtn.addEventListener("click", () => {
    if (!dom.exportPdfBtn.classList.contains("disabled")) exportPdf();
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".chart-view-btn");
    if (!btn) return;
    const view = btn.dataset.view;
    if (view && view !== state.chartView) {
      state.chartView = view;
      document.querySelectorAll(".chart-view-btn").forEach(b =>
        b.classList.toggle("active", b.dataset.view === view)
      );
      const impact = findImpactRecord();
      if (impact) {
        const scenarios = getAvailableScenarios(impact);
        const selected  = scenarios.filter(s => state.selectedScenarios.includes(s.id));
        renderMainBarChart(impact, selected);
      }
    }
  });
}

// ── Data loading ───────────────────────────────────────────────
async function loadData() {
  try {
    const [products, epds, impacts, pdfMap] = await Promise.all([
      fetchCsv("competitor_product.csv"),
      fetchCsv("competitor_epd.csv"),
      fetchCsv("floor_comparison_impacts.csv"),
      fetchCsv("competitor_pdf_map.csv")
    ]);
    state.products = products; state.epds = epds;
    state.impacts  = impacts;  state.pdfMap = pdfMap;
  } catch (err) {
    console.error(err);
    dom.selectionSummary.textContent = "Unable to load CSV files. Ensure all CSVs are present and you are running via a local server.";
  }
}

async function fetchCsv(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Failed to load " + path);
  return parseCsv(await res.text());
}

function parseCsv(text) {
  const rows = csvToRows(text.replace(/^\uFEFF/, ""));
  if (!rows.length) return [];
  const headers = rows[0].map(canonicalHeader);
  return rows.slice(1).filter(r => r.some(c => normalizeText(c) !== ""))
    .map(r => { const o = {}; headers.forEach((h,i) => { o[h] = normalizeText(r[i]??""); }); return o; });
}

function csvToRows(text) {
  const rows=[]; let row=[],cell="",inQ=false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i],nx=text[i+1];
    if (ch==='"') { inQ&&nx==='"'?(cell+='"',i++):(inQ=!inQ); }
    else if (ch===","&&!inQ) { row.push(cell); cell=""; }
    else if ((ch==="\n"||ch==="\r")&&!inQ) {
      if (ch==="\r"&&nx==="\n") i++;
      row.push(cell); rows.push(row); row=[]; cell="";
    } else { cell+=ch; }
  }
  if (cell.length||row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function normalizeText(v) { return String(v??"").normalize("NFKC").replace(/\u00A0/g," ").replace(/\s+/g," ").trim(); }
function cleanKeyText(v)   { return normalizeText(v).toLowerCase().replace(/[®™]/g,"").replace(/\s+/g," ").trim(); }
function canonicalHeader(v){ return normalizeText(v).toLowerCase().replace(/\s+/g,""); }
function field(rec,key)    { return rec?.[canonicalHeader(key)]??""; }
function toNumber(v) {
  if (v===null||v===undefined||v==="") return null;
  const n=Number(String(v).replace(/,/g,""));
  return Number.isFinite(n)?n:null;
}
function formatMetric(v) {
  const n=typeof v==="number"?v:toNumber(v); if (n===null) return "—";
  const a=Math.abs(n); if (a===0) return "0.00";
  if (a>=10000||a<0.01) return n.toExponential(2);
  return n.toFixed(2);
}
function uniqueSorted(arr) { return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }
function escapeHtml(v) { return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"); }
function sumValues(vals) {
  const ns=vals.map(toNumber).filter(n=>n!==null);
  return ns.length?ns.reduce((s,n)=>s+n,0):null;
}

// ── Record finders ─────────────────────────────────────────────
function buildKey(a,b) { return [a,b].map(cleanKeyText).join("||"); }
function findImpactRecord() {
  const div=dom.divisionSelect.value, fam=dom.productFamilySelect.value;
  const comp=dom.competitorSelect.value, variant=dom.productVariantSelect.value;
  return state.impacts.find(r=>
    cleanKeyText(field(r,"division"))===cleanKeyText(div) &&
    cleanKeyText(field(r,"product_family"))===cleanKeyText(fam) &&
    cleanKeyText(field(r,"producttype_comparable"))===cleanKeyText(comp) &&
    cleanKeyText(field(r,"productvariant_comparable"))===cleanKeyText(variant)
  );
}
function findProductRecord() {
  const div=dom.divisionSelect.value, fam=dom.productFamilySelect.value;
  const comp=dom.competitorSelect.value, variant=dom.productVariantSelect.value;
  return state.products.find(r=>
    cleanKeyText(field(r,"division"))===cleanKeyText(div) &&
    cleanKeyText(field(r,"product_family"))===cleanKeyText(fam) &&
    cleanKeyText(field(r,"competitor"))===cleanKeyText(comp) &&
    cleanKeyText(field(r,"productvariant_comparable"))===cleanKeyText(variant)
  );
}
function findEpdRecord() {
  const div=dom.divisionSelect.value, fam=dom.productFamilySelect.value;
  const comp=dom.competitorSelect.value;
  return state.epds.find(r=>
    cleanKeyText(field(r,"division"))===cleanKeyText(div) &&
    cleanKeyText(field(r,"product_family"))===cleanKeyText(fam) &&
    cleanKeyText(field(r,"competitor"))===cleanKeyText(comp)
  );
}
function impactCol(base,id) { return id===1?base:`${base}/${id-1}`; }

// ── Dropdowns ──────────────────────────────────────────────────
function populateCompetitors() {
  const divisions = uniqueSorted(state.impacts.map(r => field(r,"division")));
  setOptions(dom.divisionSelect,      divisions, "Select division",       true);
  setOptions(dom.productFamilySelect, [],        "Select product family", false);
  setOptions(dom.competitorSelect,    [],        "Select competitor",     false);
  setOptions(dom.productVariantSelect,[],        "Select product variant",false);
}
function setOptions(sel,items,placeholder,enabled) {
  sel.innerHTML="";
  const first=document.createElement("option"); first.value=""; first.textContent=placeholder; sel.appendChild(first);
  items.forEach(item=>{ const o=document.createElement("option"); o.value=o.textContent=item; sel.appendChild(o); });
  sel.disabled=!enabled;
}

function onDivisionChange() {
  const div=dom.divisionSelect.value;
  state.selectedScenarios=[]; resetExpansionState();
  setOptions(dom.productFamilySelect,[],"Select product family",false);
  setOptions(dom.competitorSelect,   [],"Select competitor",   false);
  setOptions(dom.productVariantSelect,[],"Select product variant",false);
  updateSelectionSummary(); updateDashboardVisibility();
  if (!div) { renderEmptyState("Select a division to begin."); return; }
  const families=uniqueSorted(state.impacts
    .filter(r=>cleanKeyText(field(r,"division"))===cleanKeyText(div))
    .map(r=>field(r,"product_family")));
  setOptions(dom.productFamilySelect,families,"Select product family",true);
  renderEmptyState("Division selected. Choose a product family.");
}

function onProductFamilyChange() {
  const div=dom.divisionSelect.value, fam=dom.productFamilySelect.value;
  state.selectedScenarios=[]; resetExpansionState();
  setOptions(dom.competitorSelect,   [],"Select competitor",   false);
  setOptions(dom.productVariantSelect,[],"Select product variant",false);
  updateSelectionSummary(); updateDashboardVisibility();
  if (!fam) { renderEmptyState("Select a product family."); return; }
  const competitors=uniqueSorted(state.impacts
    .filter(r=>cleanKeyText(field(r,"division"))===cleanKeyText(div)&&
               cleanKeyText(field(r,"product_family"))===cleanKeyText(fam))
    .map(r=>field(r,"producttype_comparable")));
  setOptions(dom.competitorSelect,competitors,"Select competitor",true);
  renderEmptyState("Product family selected. Choose a competitor.");
}

function onCompetitorChange() {
  const div=dom.divisionSelect.value, fam=dom.productFamilySelect.value, comp=dom.competitorSelect.value;
  state.selectedScenarios=[]; resetExpansionState();
  setOptions(dom.productVariantSelect,[],"Select product variant",false);
  updateSelectionSummary(); updateDashboardVisibility();
  if (!comp) { renderEmptyState("Select a competitor."); return; }
  const variants=uniqueSorted(state.impacts
    .filter(r=>cleanKeyText(field(r,"division"))===cleanKeyText(div)&&
               cleanKeyText(field(r,"product_family"))===cleanKeyText(fam)&&
               cleanKeyText(field(r,"producttype_comparable"))===cleanKeyText(comp))
    .map(r=>field(r,"productvariant_comparable")));
  setOptions(dom.productVariantSelect,variants,"Select product variant",true);
  updateSelectionSummary(); updateDashboardVisibility();
  renderEmptyState("Competitor selected. Choose a product variant.");
}

function onProductVariantChange() {
  updateSelectionSummary(); updateDashboardVisibility();
  if (!dom.productVariantSelect.value) { renderEmptyState("Choose a product variant to continue."); return; }
  const impact=findImpactRecord();
  if (!impact) { renderEmptyState("No impact data found for this product variant."); return; }
  resetExpansionState();
  const scenarios=getAvailableScenarios(impact);
  state.selectedScenarios=scenarios.map(s=>s.id);
  state.chartView="modules";
  document.querySelectorAll(".chart-view-btn").forEach(b=>b.classList.toggle("active",b.dataset.view==="modules"));
  renderDashboard();
}

function resetExpansionState() {
  state.expandedProductStage=false; state.expandedConstruction=false;
  state.expandedEndOfLife=false; state.expandedBenefits=false;
}
function updateSelectionSummary() {
  const div=dom.divisionSelect.value, fam=dom.productFamilySelect.value;
  const comp=dom.competitorSelect.value, variant=dom.productVariantSelect.value;
  if (!div)     { dom.selectionSummary.textContent="Select a division to begin."; return; }
  if (!fam)     { dom.selectionSummary.textContent=`Division: ${div}. Choose a product family next.`; return; }
  if (!comp)    { dom.selectionSummary.textContent=`${div} · ${fam}. Choose a competitor next.`; return; }
  if (!variant) { dom.selectionSummary.textContent=`${div} · ${fam} · ${comp}. Choose a product variant next.`; return; }
  dom.selectionSummary.textContent=`Loaded: ${comp}  ·  ${variant}  (${div} — ${fam})`;
}

// ── Scenarios ──────────────────────────────────────────────────
function getAvailableScenarios(impactRow) {
  return [1,2,3].map(id=>{
    const name=field(impactRow,`Scenario ${id}`); if (!name) return null;
    return { id, name, emoji:getScenarioEmoji(name) };
  }).filter(Boolean);
}
function getScenarioEmoji(name) {
  const t=normalizeText(name).toLowerCase();
  if (t.includes("reuse")||t.includes("refurb")) return "♻️";
  if (t.includes("recycl"))    return "🔄";
  if (t.includes("inciner"))   return "🔥";
  if (t.includes("landfill"))  return "🗑️";
  if (t.includes("shredd"))    return "⚙️";
  if (t.includes("disposal"))  return "🏁";
  if (t.includes("transport")) return "🚛";
  return "📦";
}

// ── Dashboard ──────────────────────────────────────────────────
function renderDashboard() {
  const impact=findImpactRecord(), product=findProductRecord(), epdRecord=findEpdRecord();
  if (!impact) { renderEmptyState("No impact data found for this product variant."); return; }
  const scenarios=getAvailableScenarios(impact);
  if (!state.selectedScenarios.length) state.selectedScenarios=scenarios.map(s=>s.id);
  renderProductOverview(impact,product,epdRecord);
  renderTechnicalDetails(product);
  renderScenarios(scenarios);
  renderResults(impact,scenarios);
  dom.exportPdfBtn.classList.remove("disabled"); dom.exportPdfBtn.setAttribute("aria-disabled","false");
}

function renderProductOverview(impact,product,epdRecord) {
  dom.selectedCompetitor.textContent    = dom.competitorSelect.value||"—";
  dom.selectedProductVariant.textContent= dom.productVariantSelect.value||"—";
  dom.issueDateValue.textContent = field(epdRecord,"issuedate")||field(epdRecord,"Issue date")||"—";
  dom.validToValue.textContent   = field(epdRecord,"validto")  ||field(epdRecord,"Valid to")  ||"—";
  const img=field(epdRecord,"image");
  dom.productImage.style.display="none"; dom.productImagePlaceholder.style.display="grid";
  dom.productImagePlaceholder.textContent="Product image will appear here";
  if (img) {
    dom.productImage.onload=()=>{ dom.productImage.style.display="block"; dom.productImagePlaceholder.style.display="none"; };
    dom.productImage.onerror=()=>{ dom.productImage.style.display="none"; dom.productImagePlaceholder.style.display="grid"; };
    dom.productImage.src=img;
  } else { dom.productImage.removeAttribute("src"); }
}

function renderTechnicalDetails(product) {
  const items=[
    { label:"Layer thickness (mm)", value:product?(field(product,"layerthickness")||field(product,"Layer thickness")):"—" },
    { label:"Density (kg/m³)",      value:product?(field(product,"density")       ||field(product,"Density"))       :"—" },
    { label:"Declared unit (kg/m²)",value:product?(field(product,"declaredunit")  ||field(product,"declared unit")) :"—" }
  ];
  dom.technicalGrid.classList.remove("empty-grid");
  dom.technicalGrid.innerHTML=items.map(item=>`
    <div class="metric-box"><div>
      <span class="metric-label">${item.label}</span>
      <div class="metric-value">${item.value||"—"}</div>
    </div></div>`).join("");
}

function renderScenarios(scenarios) {
  if (!scenarios.length) {
    dom.scenarioList.classList.add("empty-grid");
    dom.scenarioList.innerHTML=`<div class="empty-panel">No scenarios available.</div>`;
    dom.scenarioPicker.innerHTML=""; return;
  }
  dom.scenarioList.classList.remove("empty-grid");
  dom.scenarioList.innerHTML=scenarios.map(s=>{
    const active=state.selectedScenarios.includes(s.id);
    return `<div class="scenario-info-card ${active?"selected":""}"><div class="scenario-title-row"><div class="scenario-name">${s.emoji} ${s.name}</div></div></div>`;
  }).join("");
  dom.scenarioPicker.innerHTML=scenarios.map(s=>{
    const active=state.selectedScenarios.includes(s.id);
    return `<button type="button" class="scenario-filter-btn ${active?"active":""}" data-scenario-id="${s.id}">${s.emoji} ${s.name}</button>`;
  }).join("");
  dom.scenarioPicker.querySelectorAll("[data-scenario-id]").forEach(btn=>{
    btn.addEventListener("click",()=>toggleScenario(Number(btn.dataset.scenarioId),scenarios));
  });
}
function toggleScenario(id,scenarios) {
  const set=new Set(state.selectedScenarios);
  if (set.has(id)) { if (set.size===1) return; set.delete(id); } else set.add(id);
  state.selectedScenarios=scenarios.map(s=>s.id).filter(i=>set.has(i));
  renderDashboard();
}

// ── Results grid ───────────────────────────────────────────────
function renderResults(impact,scenarios) {
  if (!impact) {
    dom.resultsLifecycleGrid.className="results-lifecycle-grid empty-grid";
    dom.resultsLifecycleGrid.innerHTML=`<div class="empty-panel">No impact data found.</div>`; return;
  }
  const selected=scenarios.filter(s=>state.selectedScenarios.includes(s.id));
  const parts=[];
  parts.push(createExpandableSummaryTile({
    area:"area-a13",tone:"tone-production",codeClass:"code-production",code:"A1-A3",
    title:"Product stage",value:toNumber(field(impact,"A1-A3")),
    desc:"Raw materials, transport and manufacturing.",expanded:state.expandedProductStage,toggleTarget:"productStage"
  }));
  if (state.expandedConstruction) {
    parts.push(createSingleTile(COMMON_MODULES[1],impact,"construction"));
    parts.push(createSingleTile(COMMON_MODULES[2],impact,"construction"));
  } else {
    parts.push(createExpandableSummaryTile({
      area:"area-construction",tone:"tone-construction",codeClass:"code-construction",code:"A4-A5",
      title:"Construction stage",value:sumValues([field(impact,"A4"),field(impact,"A5")]),
      desc:"Transport to site and installation.",expanded:false,toggleTarget:"construction"
    }));
  }
  if (state.expandedEndOfLife) {
    parts.push(...SCENARIO_MODULES.slice(0,4).map(m=>createScenarioTile(m,impact,selected,"endOfLife")));
  } else {
    parts.push(createEndOfLifeSummaryTile(impact,selected));
  }
  parts.push(createBenefitsTile(impact,selected));
  parts.push(createTotalTile(impact,selected));
  dom.resultsLifecycleGrid.className=`results-lifecycle-grid ${getResultsGridMode()}`;
  dom.resultsLifecycleGrid.innerHTML=parts.join("");
  bindResultToggleEvents(impact,scenarios);
  renderMainBarChart(impact,selected);
}

function getResultsGridMode() {
  if (state.expandedConstruction&&state.expandedEndOfLife)  return "mode-both-expanded";
  if (state.expandedConstruction&&!state.expandedEndOfLife) return "mode-construction-expanded";
  if (!state.expandedConstruction&&state.expandedEndOfLife) return "mode-eol-expanded";
  return "mode-collapsed";
}
function bindResultToggleEvents(impact,scenarios) {
  dom.resultsLifecycleGrid.querySelectorAll("[data-toggle-target]").forEach(el=>{
    el.addEventListener("click",()=>{
      const t=el.dataset.toggleTarget;
      if (t==="productStage")  state.expandedProductStage =!state.expandedProductStage;
      else if (t==="construction") state.expandedConstruction=!state.expandedConstruction;
      else if (t==="endOfLife")    state.expandedEndOfLife   =!state.expandedEndOfLife;
      else if (t==="benefits")     state.expandedBenefits    =!state.expandedBenefits;
      renderResults(impact,scenarios);
    });
  });
}

// ── Tile factories ─────────────────────────────────────────────
function createExpandableSummaryTile({area,tone,codeClass,code,title,value,desc,expanded,toggleTarget}) {
  return `<div class="result-tile ${area} ${tone} toggle-tile ${expanded?"is-open":""}" data-toggle-target="${toggleTarget}">
    <div class="result-head"><div><h4 class="result-title">${title}</h4></div><span class="result-code ${codeClass}">${code}</span></div>
    <div class="single-value">${formatMetric(value)}</div>
    <div class="tile-detail ${expanded?"show":""}"><p class="result-desc detail-desc">${desc}</p></div>
  </div>`;
}
function createSingleTile(module,impact,toggleTarget="") {
  const isT=Boolean(toggleTarget);
  return `<div class="result-tile ${module.area} ${module.tone} tile-appearing ${isT?"toggle-tile":""}" ${isT?`data-toggle-target="${toggleTarget}"`:""}">
    <div class="result-head"><div><h4 class="result-title">${module.title}</h4><p class="result-desc">${module.desc}</p></div><span class="result-code ${module.codeClass}">${module.code}</span></div>
    <div class="single-value">${formatMetric(field(impact,module.key))}</div>
    ${isT?`<div class="toggle-hint"> </div>`:""}
  </div>`;
}
function createScenarioValueLines(rows) {
  const maxAbs=Math.max(...rows.map(r=>Math.abs(r.value)),1);
  return rows.length?rows.map(row=>{
    const w=(Math.abs(row.value)/maxAbs)*100,type=row.value>=0?"positive":"negative";
    return `<div class="compare-line">
      <div class="compare-meta"><span>${row.emoji} ${row.name}</span><strong>${formatMetric(row.value)}</strong></div>
      <div class="bar-track"><div class="bar-fill ${type}" style="--w:${w}"></div></div>
    </div>`;
  }).join(""):`<div class="empty-panel">No data</div>`;
}
function createEndOfLifeSummaryTile(impact,selected) {
  const rows=selected.map(s=>({ name:s.name,emoji:s.emoji,
    value:sumValues(["C1","C2","C3","C4"].map(c=>field(impact,impactCol(c,s.id)))) })).filter(r=>r.value!==null);
  return `<div class="result-tile area-eol tone-endlife toggle-tile" data-toggle-target="endOfLife">
    <div class="result-head"><div><h4 class="result-title">End of life stage</h4></div><span class="result-code code-endlife">C1-C4</span></div>
    <div class="compare-stack">${createScenarioValueLines(rows)}</div>
  </div>`;
}
function createBenefitsTile(impact,selected) {
  const rows=selected.map(s=>({ name:s.name,emoji:s.emoji,
    value:toNumber(field(impact,impactCol("D",s.id))) })).filter(r=>r.value!==null);
  return `<div class="result-tile area-d tone-benefits toggle-tile ${state.expandedBenefits?"is-open":""}" data-toggle-target="benefits">
    <div class="result-head"><div><h4 class="result-title">Benefits beyond life cycle stage</h4></div><span class="result-code code-benefits">D</span></div>
    <div class="compare-stack">${createScenarioValueLines(rows)}</div>
    <div class="tile-detail ${state.expandedBenefits?"show":""}"><p class="result-desc detail-desc">Potential benefits or loads beyond the system boundary.</p></div>
  </div>`;
}
function createScenarioTile(module,impact,selected,toggleTarget="") {
  const rows=selected.map(s=>({ name:s.name,emoji:s.emoji,
    value:toNumber(field(impact,impactCol(module.base,s.id))) })).filter(r=>r.value!==null);
  const isT=Boolean(toggleTarget);
  return `<div class="result-tile ${module.area} ${module.tone} tile-appearing ${isT?"toggle-tile":""}" ${isT?`data-toggle-target="${toggleTarget}"`:""}">
    <div class="result-head"><div><h4 class="result-title">${module.title}</h4><p class="result-desc">${module.desc}</p></div><span class="result-code ${module.codeClass}">${module.code}</span></div>
    <div class="compare-stack">${createScenarioValueLines(rows)}</div>
    ${isT?`<div class="toggle-hint"> </div>`:""}
  </div>`;
}
function createTotalTile(impact,selected) {
  const cards=selected.map(s=>{
    const v=toNumber(field(impact,impactCol("(A1-C4)",s.id)));
    return `<div class="total-card"><span>${s.emoji} ${escapeHtml(s.name)}</span><strong>${formatMetric(v)}</strong></div>`;
  }).join("");
  return `<div class="result-tile area-total tone-total">
    <div class="result-head"><div><h4 class="result-title">A1-C4 Total (kg/m²)</h4><p class="result-desc">Combined result up to end of life for selected scenarios.</p></div><span class="result-code code-total">A1-C4</span></div>
    <div class="total-grid">${cards||`<div class="empty-panel">No total values available.</div>`}</div>
  </div>`;
}

// ── Empty state ────────────────────────────────────────────────
function renderEmptyState(message) {
  dom.selectedCompetitor.textContent="—"; dom.selectedProductVariant.textContent=message;
  dom.issueDateValue.textContent="—"; dom.validToValue.textContent="—";
  dom.productImage.removeAttribute("src"); dom.productImage.style.display="none";
  dom.productImagePlaceholder.style.display="grid"; dom.productImagePlaceholder.textContent="Product image will appear here";
  dom.technicalGrid.classList.add("empty-grid"); dom.technicalGrid.innerHTML=`<div class="empty-panel">Technical details will load here.</div>`;
  dom.scenarioList.classList.add("empty-grid"); dom.scenarioList.innerHTML=`<div class="empty-panel">Scenario details will appear here.</div>`;
  dom.scenarioPicker.innerHTML="";
  dom.resultsLifecycleGrid.className="results-lifecycle-grid empty-grid"; dom.resultsLifecycleGrid.innerHTML=`<div class="empty-panel">${message}</div>`;
  const chart=dom.mainBarChart;
  if (chart) { chart.className="module-bar-chart empty-grid"; chart.innerHTML=`<div class="empty-panel">${message}</div>`; }
  dom.exportPdfBtn.classList.add("disabled"); dom.exportPdfBtn.setAttribute("aria-disabled","true");
}

// ── Chart ──────────────────────────────────────────────────────
function renderMainBarChart(impact, selectedScenarios) {
  const chart = dom.mainBarChart;
  if (!chart || !impact) return;

  if (state.chartView === "modules") {
    const groups = buildModuleChartGroups(impact, selectedScenarios);
    if (!groups.length) { chart.className="module-bar-chart empty-grid"; chart.innerHTML=`<div class="empty-panel">No graph data available.</div>`; return; }
    const scale = getChartScale(groups);
    chart.className = "module-bar-chart";
    chart.innerHTML = `
      ${renderModuleChartLegend(selectedScenarios)}
      <div class="module-chart-canvas"><div class="module-chart-plot">
        ${groups.map((g,i)=>createModuleChartGroup(g,scale,i)).join("")}
      </div><div class="module-chart-note">The graph updates automatically when you expand or collapse the module tiles.</div></div>`;

  } else if (state.chartView === "a1c4") {
    const a1c4G = { key:"A1-C4",label:"A1–C4",sub:"Total",tone:"total",
      bars:selectedScenarios.map((s,i)=>({label:s.name,value:toNumber(field(impact,impactCol("(A1-C4)",s.id))),seriesIndex:i})).filter(b=>b.value!==null) };
    const dG = { key:"D",label:"D",sub:"Benefits beyond",tone:"benefits",
      bars:selectedScenarios.map((s,i)=>({label:s.name,value:toNumber(field(impact,impactCol("D",s.id))),seriesIndex:i})).filter(b=>b.value!==null) };
    const groups=[a1c4G,dG].filter(g=>g.bars.length>0);
    if (!groups.length) { chart.className="module-bar-chart empty-grid"; chart.innerHTML=`<div class="empty-panel">No data available.</div>`; return; }
    const scale=getChartScale(groups);
    chart.className="module-bar-chart";
    chart.innerHTML=`
      ${renderModuleChartLegend(selectedScenarios)}
      <div class="module-chart-canvas"><div class="module-chart-plot chart-plot-wide">
        ${groups.map((g,i)=>createModuleChartGroup(g,scale,i)).join("")}
      </div><div class="module-chart-note">A1–C4 total and Module D per scenario.</div></div>`;

  } else if (state.chartView === "netcarbon") {
    const netG = { key:"Net",label:"Net Carbon",sub:"A1-C4 + D",tone:"total",
      bars:selectedScenarios.map((s,i)=>{
        const a=toNumber(field(impact,impactCol("(A1-C4)",s.id))), d=toNumber(field(impact,impactCol("D",s.id)));
        return {label:s.name,value:sumValues([a!==null?String(a):null,d!==null?String(d):null]),seriesIndex:i};
      }).filter(b=>b.value!==null) };
    if (!netG.bars.length) { chart.className="module-bar-chart empty-grid"; chart.innerHTML=`<div class="empty-panel">No net carbon data.</div>`; return; }
    const scale=getChartScale([netG]);
    chart.className="module-bar-chart";
    chart.innerHTML=`
      ${renderModuleChartLegend(selectedScenarios)}
      <div class="module-chart-canvas"><div class="module-chart-plot chart-plot-wide">
        ${createModuleChartGroup(netG,scale,0)}
      </div><div class="module-chart-note">Net Carbon = A1–C4 + D for each scenario.</div></div>`;
  }
}

function buildModuleChartGroups(impact,selected) {
  const groups=[];
  groups.push({ key:"A1-A3",label:"A1-A3",sub:"Product stage",tone:"production",
    bars:selected.map((s,i)=>({label:s.name,value:toNumber(field(impact,"A1-A3")),seriesIndex:i})).filter(b=>b.value!==null) });
  if (state.expandedConstruction) {
    ["A4","A5"].forEach((k,idx)=>groups.push({ key:k,label:k,sub:["Transport to site","Installation"][idx],tone:"construction",
      bars:selected.map((s,i)=>({label:s.name,value:toNumber(field(impact,k)),seriesIndex:i})).filter(b=>b.value!==null) }));
  } else {
    groups.push({ key:"A4-A5",label:"A4-A5",sub:"Construction stage",tone:"construction",
      bars:selected.map((s,i)=>({label:s.name,value:sumValues([field(impact,"A4"),field(impact,"A5")]),seriesIndex:i})).filter(b=>b.value!==null) });
  }
  if (state.expandedEndOfLife) {
    const em={C1:"Deconstruction",C2:"Transport",C3:"Waste processing",C4:"Disposal"};
    ["C1","C2","C3","C4"].forEach(base=>groups.push({ key:base,label:base,sub:em[base],tone:"endlife",
      bars:selected.map((s,i)=>({label:s.name,value:toNumber(field(impact,impactCol(base,s.id))),seriesIndex:i})).filter(b=>b.value!==null) }));
  } else {
    groups.push({ key:"C1-C4",label:"C1-C4",sub:"End of life stage",tone:"endlife",
      bars:selected.map((s,i)=>({label:s.name,seriesIndex:i,
        value:sumValues(["C1","C2","C3","C4"].map(c=>field(impact,impactCol(c,s.id)))) })).filter(b=>b.value!==null) });
  }
  groups.push({ key:"D",label:"D",sub:"Benefits beyond",tone:"benefits",
    bars:selected.map((s,i)=>({label:s.name,value:toNumber(field(impact,impactCol("D",s.id))),seriesIndex:i})).filter(b=>b.value!==null) });
  return groups.filter(g=>g.bars.length>0);
}

function getChartScale(groups) {
  const vals=groups.flatMap(g=>g.bars.map(b=>b.value)).filter(v=>v!==null);
  const pos=vals.filter(v=>v>0),neg=vals.filter(v=>v<0).map(Math.abs);
  const rP=pos.length?Math.max(...pos):0,rN=neg.length?Math.max(...neg):0;
  const P=1.08,mP=rP*P,mN=rN*P;
  if (!rP&&!rN) return {maxPositive:1,maxNegative:0,positiveZone:100,negativeZone:0,zeroBottom:0};
  if (!rN) return {maxPositive:mP||1,maxNegative:0,positiveZone:100,negativeZone:0,zeroBottom:0};
  if (!rP) return {maxPositive:0,maxNegative:mN||1,positiveZone:0,negativeZone:100,zeroBottom:100};
  const tot=mP+mN;
  return {maxPositive:mP,maxNegative:mN,positiveZone:(mP/tot)*100,negativeZone:(mN/tot)*100,zeroBottom:(mN/tot)*100};
}
function getLegendDotStyle(i) {
  return ["background:linear-gradient(180deg,rgba(93,140,255,.96),rgba(122,168,255,1))",
          "background:linear-gradient(180deg,rgba(207,90,64,.96),rgba(235,125,99,1))",
          "background:linear-gradient(180deg,rgba(96,200,191,.96),rgba(131,225,214,1))"][i]||
         "background:linear-gradient(180deg,rgba(93,140,255,.96),rgba(122,168,255,1))";
}
function renderModuleChartLegend(selected) {
  if (!selected.length) return "";
  return `<div class="module-chart-legend">${selected.map((s,i)=>
    `<div class="module-legend-chip"><span class="module-legend-dot" style="${getLegendDotStyle(i)}"></span><span>${escapeHtml(s.name)}</span></div>`
  ).join("")}</div>`;
}
function createModuleChartGroup(group,scale,gi) {
  return `<div class="module-chart-group tone-${group.tone}" style="--group-index:${gi};">
    <div class="module-chart-bars" style="--zero-line-bottom:${scale.zeroBottom}%;">
      <div class="module-chart-zero-line"></div>
      ${group.bars.map((bar,bi)=>createModuleChartBar(group,bar,scale,bi)).join("")}
    </div>
    <div class="module-chart-group-label">${group.label}<span class="module-chart-group-sub">${group.sub}</span></div>
  </div>`;
}
function createModuleChartBar(group,bar,scale,bi) {
  const v=bar.value??0,minP=3;
  const pR=v>0&&scale.maxPositive>0?(Math.abs(v)/scale.maxPositive)*scale.positiveZone:0;
  const nR=v<0&&scale.maxNegative>0?(Math.abs(v)/scale.maxNegative)*scale.negativeZone:0;
  const pH=v>0?Math.min(Math.max(pR,minP),scale.positiveZone):0;
  const nH=v<0?Math.min(Math.max(nR,minP),scale.negativeZone):0;
  const barClass=`series-${bar.seriesIndex??0}`;
  const pos=v>=0?`height:${pH}%;bottom:calc(${scale.zeroBottom}% + 1px);`
                :`height:${nH}%;bottom:calc(${scale.zeroBottom}% - ${nH}% - 1px);`;
  return `<div class="module-chart-slot">
    <div class="module-chart-tooltip ${v>=0?"positive":"negative"}">${formatMetric(v)}</div>
    <div class="module-chart-bar ${v>=0?"positive":"negative"} ${barClass}" style="${pos}--bar-index:${bi};"></div>
  </div>`;
}

// ── Theme ──────────────────────────────────────────────────────
function initTheme() {
  const saved=localStorage.getItem("slca-comp-theme");
  const pref=window.matchMedia("(prefers-color-scheme:light)").matches;
  applyTheme(saved||(pref?"light":"dark"));
}
function toggleTheme() {
  const next=state.theme==="dark"?"light":"dark";
  applyTheme(next); localStorage.setItem("slca-comp-theme",next);
}
function applyTheme(theme) {
  state.theme=theme; document.body.dataset.theme=theme;
  dom.themeLabel.textContent=theme==="dark"?"Light mode":"Dark mode";
}

// ── Utility ────────────────────────────────────────────────────
function impactCol(base,id) { return id===1?base:`${base}/${id-1}`; }


// ── PDF Export ─────────────────────────────────────────────────
function exportPdf() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { alert("PDF library not loaded."); return; }

  const impact    = findImpactRecord();
  const product   = findProductRecord();
  const epdRecord = findEpdRecord();
  if (!impact) return;

  const competitor = dom.competitorSelect.value;
  const variant    = dom.productVariantSelect.value;
  const division   = dom.divisionSelect.value;
  const prodFamily = dom.productFamilySelect.value;
  const scenarios  = getAvailableScenarios(impact);
  const selected   = scenarios.filter(s => state.selectedScenarios.includes(s.id));
  const today      = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  const issueD     = field(epdRecord,"issuedate")||field(epdRecord,"Issue date")||"--";
  const validD     = field(epdRecord,"validto")  ||field(epdRecord,"Valid to")  ||"--";

  const stripEmoji = str => String(str||"").replace(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{27FF}]/gu,"").trim();

  buildPdfReport({
    doc: new jsPDF({orientation:"portrait",unit:"mm",format:"a4"}),
    today, issueD, validD,
    titleLine1: competitor,
    titleLine2: variant,
    breadcrumb: `${division}  |  ${prodFamily}  |  ${competitor}  |  ${variant}`,
    reportLabel: "EPD Competitor Analysis Report",
    footerNote: "Competitor EPD Analysis  |  GWP values in kg CO2eq/m2  |  EN 15804+A2  |  For internal sales reference only",
    techItems: [
      ["Division",        division],
      ["Product Family",  prodFamily],
      ["Layer Thickness", (product?(field(product,"layerthickness")||field(product,"Layer thickness")):"--")+" mm"],
      ["Density",         (product?(field(product,"density")||field(product,"Density")):"--")+" kg/m3"],
      ["Declared Unit",   (product?(field(product,"declaredunit")||field(product,"declared unit")):"--")+" kg/m2"],
    ],
    selected, impact,
    stripEmoji,
    getA1c4: s => toNumber(field(impact, impactCol("(A1-C4)", s.id))),
    getD:    s => toNumber(field(impact, impactCol("D", s.id))),
    getModule: (col,s) => toNumber(field(impact, impactCol(col, s.id))),
    getFixed:  col => toNumber(field(impact, col)),
    buildModGroups: () => buildModuleChartGroups(impact, selected),
    getScale: getChartScale,
    sumVals: sumValues,
    fmt: formatMetric,
    filename: `Competitor_${competitor.replace(/\s+/g,"_")}_${variant.replace(/\s+/g,"_").substring(0,28)}_${today.replace(/\s/g,"")}.pdf`
  });
}
// ── Shared PDF engine — used by both main and competitor tools ─
function buildPdfReport(opts) {
  const { doc, today, issueD, validD, titleLine1, titleLine2, breadcrumb,
    reportLabel, footerNote, techItems, selected, impact,
    stripEmoji, getA1c4, getD, getModule, getFixed,
    buildModGroups, getScale, sumVals, fmt, filename } = opts;

  const PW=210, PH=297, ML=15, MR=15, CW=PW-ML-MR;
  let y=0, tblStart=0;

  const C={
    red:[200,16,46], dark:[22,28,50], accent:[50,80,160],
    light:[245,246,250], border:[215,218,228],
    muted:[108,116,138], soft:[158,163,178], white:[255,255,255],
    prod:[207,90,64], cons:[215,135,28], eol:[125,170,25],
    ben:[55,170,160], tot:[65,118,232],
    s0:[65,118,232], s1:[207,90,64], s2:[55,170,160]
  };
  const sc = i => [C.s0,C.s1,C.s2][i]||C.s0;
  const tone = {production:C.prod,construction:C.cons,endlife:C.eol,benefits:C.ben,total:C.tot};

  const sf=(sty,sz,col)=>{
    doc.setFont("helvetica",sty||"normal");
    doc.setFontSize(sz||9);
    doc.setTextColor(...(col||C.dark));
  };

  // ── Logo (red pill, white "Lindner" + "GROUP") ────────────────
  function logo(x,lY,h){
    const w=36;
    doc.setFillColor(...C.red); doc.roundedRect(x,lY,w,h,1.5,1.5,"F");
    sf("bold",10,C.white); doc.text("Lindner",x+w/2,lY+h*0.60,{align:"center"});
    doc.setDrawColor(...C.white); doc.setLineWidth(0.35);
    const m=x+w/2; doc.line(m-3,lY+h*0.76,m+3,lY+h*0.76);
    sf("normal",4.5,C.white); doc.text("GROUP",m,lY+h*0.91,{align:"center"});
  }

  // ── Page header ───────────────────────────────────────────────
  function hdr(){
    const H=18;
    doc.setFillColor(...C.dark); doc.rect(0,0,PW,H,"F");
    doc.setFillColor(...C.red);  doc.rect(0,0,4,H,"F");
    logo(7,2,14);
    doc.setDrawColor(68,76,104); doc.setLineWidth(0.35); doc.line(47,4,47,H-4);
    sf("bold",9,C.white); doc.text(reportLabel,51,8);
    sf("normal",6.5,[165,174,198]); doc.text(breadcrumb,51,14,{maxWidth:PW-51-MR-20});
    sf("normal",6.2,[148,156,178]); doc.text(today,PW-MR,14,{align:"right"});
    y=H+5;
  }

  // ── Page footer ───────────────────────────────────────────────
  function ftr(p,tot){
    doc.setFillColor(...C.light); doc.rect(0,PH-9,PW,9,"F");
    doc.setDrawColor(...C.border); doc.setLineWidth(0.25); doc.line(0,PH-9,PW,PH-9);
    doc.setFillColor(...C.red); doc.rect(0,PH-9,3,9,"F");
    sf("normal",5.8,C.muted);
    doc.text(`Lindner Group  |  ${footerNote}`,9,PH-3.5,{maxWidth:PW-28});
    sf("bold",6.5,C.muted); doc.text(`${p} / ${tot}`,PW-MR,PH-3.5,{align:"right"});
  }

  function ln(gap=3){
    doc.setDrawColor(...C.border); doc.setLineWidth(0.22);
    doc.line(ML,y,ML+CW,y); y+=gap;
  }

  function secHead(txt,col){
    col=col||C.accent;
    doc.setFillColor(...col); doc.rect(ML,y,2.5,4.5,"F");
    sf("bold",6.8,col); doc.text(txt.toUpperCase(),ML+5,y+3.5); y+=8;
  }

  // ══════════════ PAGE 1 ══════════════════════════════════════
  hdr();

  // Product banner
  doc.setFillColor(...C.dark); doc.roundedRect(ML,y,CW,21,2,2,"F");
  doc.setFillColor(...C.red);  doc.roundedRect(ML,y,4,21,2,2,"F");
  sf("bold",13,C.white); doc.text(titleLine1,ML+8,y+8.5);
  sf("normal",8.2,[168,178,208]); doc.text(titleLine2,ML+8,y+15.5);

  // EPD validity box
  doc.setFillColor(38,46,78); doc.roundedRect(ML+CW-56,y+4,53,13,1.5,1.5,"F");
  sf("normal",5.8,[128,138,168]);
  doc.text("EPD Validity Period",ML+CW-56+26.5,y+8,{align:"center"});
  sf("bold",7.2,C.white);
  doc.text(`${issueD} - ${validD}`,ML+CW-56+26.5,y+14,{align:"center"});
  y+=25;

  // Two-column: tech specs (left) + scenarios (right)
  const half=ML+CW*0.5, colY=y;

  // Left — tech specs
  secHead("Technical Specifications");
  techItems.forEach(([lbl,val])=>{
    doc.setFillColor(...C.light); doc.roundedRect(ML,y,half-ML-5,6.2,0.8,0.8,"F");
    sf("normal",6.8,C.muted); doc.text(lbl,ML+3,y+4.3);
    sf("bold",7.2,C.dark); doc.text(String(val||"--"),half-ML-7,y+4.3,{align:"right"});
    y+=7;
  });

  // Right — scenarios
  let ry=colY;
  const rX=half+2, rW=ML+CW-rX;
  doc.setDrawColor(...C.border); doc.setLineWidth(0.25);
  doc.line(half-2,colY,half-2,colY+44);
  doc.setFillColor(...C.accent); doc.rect(rX,ry,2.5,4.5,"F");
  sf("bold",6.8,C.accent); doc.text("END-OF-LIFE SCENARIOS",rX+5,ry+3.5); ry+=8;
  selected.forEach((s,i)=>{
    doc.setFillColor(...sc(i)); doc.roundedRect(rX,ry,rW,6.8,1.5,1.5,"F");
    sf("bold",7.2,C.white);
    doc.text(`${stripEmoji(s.name)}`,rX+5,ry+4.6);
    sf("normal",5.8,C.white); doc.text(`S${s.id}`,rX+rW-3,ry+4.6,{align:"right"});
    ry+=8.5;
  });

  y=Math.max(y,ry)+4; ln(5);

  // Table
  secHead("Lifecycle Module Results  (GWP - kg CO2eq / m2)",C.prod);

  const cW2=13, lbW=56, scW=(CW-cW2-lbW)/Math.max(selected.length,1), RH=6.8;
  tblStart=y;

  // Table header row
  doc.setFillColor(...C.dark); doc.roundedRect(ML,y,CW,RH+1,1,1,"F");
  sf("bold",5.8,C.white);
  doc.text("Code",ML+cW2/2,y+4.8,{align:"center"});
  doc.text("Lifecycle Stage",ML+cW2+3,y+4.8);
  selected.forEach((s,i)=>{
    const cx=ML+cW2+lbW+(i+0.5)*scW;
    doc.setFillColor(...sc(i));
    doc.roundedRect(ML+cW2+lbW+i*scW+1,y+1.5,scW-2,RH-2,1,1,"F");
    sf("bold",5.8,C.white);
    doc.text(stripEmoji(s.name),cx,y+4.8,{align:"center",maxWidth:scW-3});
  });
  y+=RH+2;

  function tRow(code,stage,tn,getVal,even){
    doc.setFillColor(...(even?C.light:C.white));
    doc.rect(ML,y,CW,RH,"F");
    const tc=tone[tn]||C.accent;
    doc.setFillColor(...tc); doc.roundedRect(ML+0.8,y+0.8,cW2-1.6,RH-1.6,1,1,"F");
    sf("bold",5.2,C.white); doc.text(code,ML+cW2/2,y+4.4,{align:"center"});
    sf("normal",6.5,C.dark); doc.text(stage,ML+cW2+3,y+4.6);
    selected.forEach((s,i)=>{
      const v=getVal(s);
      const neg=typeof v==="number"&&v<0;
      sf("bold",7,neg?C.ben:C.dark);
      doc.text(fmt(v),ML+cW2+lbW+(i+0.5)*scW,y+4.6,{align:"center"});
    });
    y+=RH;
    doc.setDrawColor(...C.border); doc.setLineWidth(0.12); doc.line(ML,y,ML+CW,y);
  }

  let ev=false;
  tRow("A1-A3","Product stage",           "production",()=>getFixed("A1-A3"),ev); ev=!ev;
  tRow("A4",   "Transport to site",       "construction",()=>getFixed("A4"),ev); ev=!ev;
  tRow("A5",   "Installation",            "construction",()=>getFixed("A5"),ev); ev=!ev;
  tRow("C1",   "Deconstruction",          "endlife",s=>getModule("C1",s),ev); ev=!ev;
  tRow("C2",   "Transport (end of life)", "endlife",s=>getModule("C2",s),ev); ev=!ev;
  tRow("C3",   "Waste processing",        "endlife",s=>getModule("C3",s),ev); ev=!ev;
  tRow("C4",   "Disposal",                "endlife",s=>getModule("C4",s),ev); ev=!ev;
  tRow("D",    "Benefits beyond system boundary","benefits",s=>getD(s),ev);

  // Summary separator
  y+=2;
  doc.setFillColor(...C.accent); doc.rect(ML,y,CW,0.5,"F"); y+=4;

  function sRow(code,lbl,tn,getVal,idx){
    const bg=idx%2===0?[226,231,249]:[216,223,246];
    doc.setFillColor(...bg); doc.rect(ML,y,CW,RH+2,"F");
    const tc=tone[tn]||C.tot;
    doc.setFillColor(...tc); doc.roundedRect(ML+0.8,y+0.8,cW2-1.6,RH,1,1,"F");
    sf("bold",5.2,C.white); doc.text(code,ML+cW2/2,y+5,{align:"center"});
    sf("bold",7.2,C.dark); doc.text(lbl,ML+cW2+3,y+5);
    selected.forEach((s,i)=>{
      const v=getVal(s); const neg=typeof v==="number"&&v<0;
      sf("bold",8.5,neg?C.ben:C.dark);
      doc.text(fmt(v),ML+cW2+lbW+(i+0.5)*scW,y+5.2,{align:"center"});
    });
    y+=RH+2;
    doc.setDrawColor(...C.border); doc.setLineWidth(0.18); doc.line(ML,y,ML+CW,y);
  }

  sRow("A1-C4","Lifecycle Total (A1-C4)","total",s=>getA1c4(s),0);
  sRow("D",    "Module D (benefits beyond boundary)","benefits",s=>getD(s),1);
  sRow("Net",  "Net Carbon (A1-C4 + D)","total",s=>{
    const a=getA1c4(s), d=getD(s);
    return sumVals([a!==null?String(a):null,d!==null?String(d):null]);
  },2);

  // Table border (precise — tracks actual tblStart to y)
  doc.setDrawColor(...C.border); doc.setLineWidth(0.32);
  doc.roundedRect(ML,tblStart,CW,y-tblStart,1.5,1.5,"S");

  ftr(1,2);

  // ══════════════ PAGE 2 ══════════════════════════════════════
  doc.addPage(); hdr();

  // Scenario legend — plain text, no emoji
  selected.forEach((s,i)=>{
    const lx=ML+i*62;
    doc.setFillColor(...sc(i)); doc.roundedRect(lx,y,4.5,4.5,1,1,"F");
    sf("bold",7.8,C.dark); doc.text(stripEmoji(s.name),lx+6.5,y+3.8);
  });
  y+=11;

  // Chart draw function
  function drawChart(groups,cx,cy,cw,ch,scale){
    const YA=10, LB=10, pX=cx+YA, pW=cw-YA, pH=ch-LB;
    const zY=cy+(scale.positiveZone/100)*pH;
    const gW=pW/Math.max(groups.length,1);

    doc.setFillColor(249,250,253); doc.rect(pX,cy,pW,pH,"F");
    doc.setDrawColor(218,221,232); doc.setLineWidth(0.12);
    for(let t=0;t<=4;t++){
      const gy=cy+(t/4)*pH; doc.line(pX,gy,pX+pW,gy);
      const span=(scale.maxPositive+scale.maxNegative)/1.08;
      const v=(scale.maxPositive/1.08)-(t/4)*span;
      if(Math.abs(v)>0.001){ sf("normal",4.2,C.soft); doc.text(fmt(v),pX-1,gy+1,{align:"right"}); }
    }
    doc.setDrawColor(...C.muted); doc.setLineWidth(0.45);
    doc.line(pX,zY,pX+pW,zY);
    sf("bold",4.5,C.muted); doc.text("0",pX-1,zY+1,{align:"right"});

    groups.forEach((grp,gi)=>{
      const gx=pX+gi*gW, nB=grp.bars.length;
      const bW=Math.max((gW-6)/Math.max(nB,1)-1.5,3);
      const totW=nB*bW+(nB-1)*1.5, sX=gx+(gW-totW)/2;
      grp.bars.forEach((bar,bi)=>{
        if(bar.value===null) return;
        const col=sc(bar.seriesIndex??bi);
        const pP=bar.value>0&&scale.maxPositive>0?(bar.value/scale.maxPositive)*(scale.positiveZone/100):0;
        const nP=bar.value<0&&scale.maxNegative>0?(Math.abs(bar.value)/scale.maxNegative)*(scale.negativeZone/100):0;
        const bH=Math.max((pP+nP)*pH,1.5);
        const bx=sX+bi*(bW+1.5), by2=bar.value>=0?zY-pP*pH:zY;
        doc.setFillColor(...col); doc.roundedRect(bx,by2,bW,bH,0.7,0.7,"F");
        doc.setFont("helvetica","bold"); doc.setFontSize(5.2); doc.setTextColor(...col);
        const lv=fmt(bar.value);
        if(bar.value>=0) doc.text(lv,bx+bW/2,by2-1.5,{align:"center"});
        else             doc.text(lv,bx+bW/2,by2+bH+3.8,{align:"center"});
      });
      sf("bold",5.5,C.dark); doc.text(grp.label,gx+gW/2,cy+pH+5,{align:"center"});
      sf("normal",4.5,C.muted); doc.text(grp.sub,gx+gW/2,cy+pH+8.5,{align:"center"});
    });
  }

  // Build chart groups
  const modGs=buildModGroups();
  const a1c4G={key:"A1-C4",label:"A1-C4",sub:"Total",tone:"total",
    bars:selected.map((s,i)=>({label:s.name,value:getA1c4(s),seriesIndex:i})).filter(b=>b.value!==null)};
  const dG={key:"D",label:"D",sub:"Benefits",tone:"benefits",
    bars:selected.map((s,i)=>({label:s.name,value:getD(s),seriesIndex:i})).filter(b=>b.value!==null)};
  const netG={key:"Net",label:"Net Carbon",sub:"A1-C4+D",tone:"total",
    bars:selected.map((s,i)=>{
      const a=getA1c4(s),d=getD(s);
      return {label:s.name,value:sumVals([a!==null?String(a):null,d!==null?String(d):null]),seriesIndex:i};
    }).filter(b=>b.value!==null)};

  const CH=68, GAP=5;
  const mW=CW*0.46, aW=CW*0.28, nW=CW-mW-aW-GAP*2;
  const mX=ML, aX=ML+mW+GAP, nX=aX+aW+GAP;

  function panel(title,px,pw,ac){
    doc.setFillColor(...C.white); doc.roundedRect(px,y,pw,CH+18,2,2,"F");
    doc.setDrawColor(...C.border); doc.setLineWidth(0.28); doc.roundedRect(px,y,pw,CH+18,2,2,"S");
    doc.setFillColor(...ac); doc.roundedRect(px,y,pw,2.5,1,1,"F");
    sf("bold",5.8,ac); doc.text(title,px+pw/2,y+7.5,{align:"center",maxWidth:pw-4});
  }

  panel("MODULE VIEW",     mX,mW,C.accent);
  panel("A1-C4 + MODULE D",aX,aW,C.prod);
  panel("NET CARBON",      nX,nW,C.ben);

  const cY=y+11;
  drawChart(modGs,                              mX+1,cY,mW-2,CH,getScale(modGs));
  drawChart([a1c4G,dG].filter(g=>g.bars.length),aX+1,cY,aW-2,CH,getScale([a1c4G,dG]));
  drawChart([netG],                             nX+1,cY,nW-2,CH,getScale([netG]));
  y+=CH+20; ln(5);

  // Comparison cards
  secHead("Scenario Comparison - Key Figures",C.dark);
  const cardW=(CW-(selected.length-1)*5)/Math.max(selected.length,1);
  const CARDH=42;

  selected.forEach((s,i)=>{
    const cx=ML+i*(cardW+5), col=sc(i);
    const av=getA1c4(s), dv=getD(s);
    const nv=sumVals([av!==null?String(av):null,dv!==null?String(dv):null]);
    const saved=av!==null&&nv!==null?av-nv:null;

    doc.setFillColor(...C.white); doc.roundedRect(cx,y,cardW,CARDH,2,2,"F");
    doc.setDrawColor(...C.border); doc.setLineWidth(0.28); doc.roundedRect(cx,y,cardW,CARDH,2,2,"S");
    doc.setFillColor(...col); doc.roundedRect(cx,y,cardW,3.2,1.5,1.5,"F");

    sf("bold",8.2,C.dark);
    doc.text(stripEmoji(s.name),cx+5,y+10,{maxWidth:cardW-10});

    [["A1-C4 Total",av,false],["Module D",dv,dv!==null&&dv<0],["Net Carbon",nv,nv!==null&&nv<0]]
      .forEach(([lbl,val,green],ri)=>{
        const ky=y+16+ri*7.5;
        sf("normal",6.2,C.muted); doc.text(lbl,cx+5,ky);
        sf("bold",7.8,green?C.ben:C.dark); doc.text(fmt(val),cx+cardW-5,ky,{align:"right"});
        if(ri<2){ doc.setDrawColor(...C.border); doc.setLineWidth(0.12); doc.line(cx+5,ky+2.2,cx+cardW-5,ky+2.2); }
      });

    if(saved!==null&&saved>0.01){
      doc.setFillColor(228,246,244); doc.roundedRect(cx+5,y+CARDH-8,cardW-10,5.5,1,1,"F");
      sf("bold",5.8,C.ben);
      doc.text(`${fmt(saved)} kg CO2eq/m2 saved vs A1-C4`,cx+cardW/2,y+CARDH-4,{align:"center"});
    }
  });
  y+=CARDH+5; ln(3);

  sf("normal",5.8,C.soft);
  doc.text(
    "GWP values in kg CO2eq/m2  |  Negative values = carbon sequestration or avoided emissions  |  "+
    "System boundary per EN 15804+A2  |  This document is for sales reference - consult the full EPD for verified data.",
    ML,y+3,{maxWidth:CW}
  );

  // Footers
  const tot=doc.getNumberOfPages();
  for(let p=1;p<=tot;p++){ doc.setPage(p); ftr(p,tot); }
  doc.save(filename);
}
