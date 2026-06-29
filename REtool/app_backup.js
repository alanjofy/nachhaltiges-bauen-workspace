import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getProduct } from "./productBuilder.js";

/* ---------------- DOM ---------------- */
const appRoot = document.getElementById("appRoot");
const scenarioStage = document.getElementById("scenarioStage");
const viewerShell = document.getElementById("viewerShell");
const viewerEl = document.getElementById("viewer3d");
const roomNameInput = document.getElementById("roomNameInput");
const lengthInput = document.getElementById("lengthInput");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const buildBtn = document.getElementById("buildBtn");
const dimensionReadout = document.getElementById("dimensionReadout");
const componentRowsEl = document.getElementById("componentRows");
const selectionReadout = document.getElementById("selectionReadout");
const viewerRoomTitle = document.getElementById("viewerRoomTitle");
const roomNameReadout = document.getElementById("roomNameReadout");
const insideBtn = document.getElementById("insideBtn");
const outsideBtn = document.getElementById("outsideBtn");
const resetBtn = document.getElementById("resetBtn");
const goScenariosBtn = document.getElementById("goScenariosBtn");
const backToRoomBtn = document.getElementById("backToRoomBtn");
const scenarioListEl = document.getElementById("scenarioList");
const scenarioDescriptionEl = document.getElementById("scenarioDescription");
const scenarioDescCard = document.getElementById("scenarioDescCard");
const showTotalBtn = document.getElementById("showTotalBtn");
const totalCard = document.getElementById("totalCard");
const totalDonut = document.getElementById("totalDonut");
const totalPercentEl = document.getElementById("totalPercent");
const totalKgEl = document.getElementById("totalKg");
const totalKgWithoutEl = document.getElementById("totalKgWithout");
const totalKgSavedEl = document.getElementById("totalKgSaved");
const totalEbfEl = document.getElementById("totalEbf");
const resetScenariosBtn = document.getElementById("resetScenariosBtn");

const SCENARIOS = [
  "Reuse same location", "Reuse diff location",
  "Repair same location", "Repair diff location",
  "Refurbish", "Repurpose", "Recycle", "Redistribute",
];

const CATEGORY_DEFS = {
  wall: { label: "Wall", areaLabel: "Area (m²)", csvComponent: "Wall", defaultAreaType: "max" },
  floor: { label: "Floor Panels", areaLabel: "Area (m²)", csvComponent: "Floor Panels", defaultAreaType: "maxIntegerPanels" },
  ceiling: { label: "Ceiling", areaLabel: "Area (m²)", csvComponent: "Ceiling", defaultAreaType: "maxIntegerPanels" },
  door: { label: "Door", areaLabel: "Area (m²)", csvComponent: "Door", defaultAreaType: "door" },
  lights: { label: "Lights", areaLabel: "Coverage (m²)", csvComponent: "Lights", defaultAreaType: "floorArea" },
  pedestal: { label: "Pedestals", areaLabel: "Area (m²)", csvComponent: "Pedestals", defaultAreaType: "maxIntegerPanels" },
};

const state = {
  roomName: "Lindner Room",
  dims: { length: 5, width: 10, height: 3 },
  raisedFloorHeight: 0.45,
  selected: new Set(),
  ui: {},
  componentsCatalog: {},
  settings: {
    wall: { area: 0, material: "glass", product: "", productType: "" },
    floor: { area: 0, material: "calcium", product: "", productType: "" },
    ceiling: { area: 0, material: "metal", product: "", productType: "" },
    door: { area: 2.0, material: "glass", product: "", productType: "", count: 1 },
    lights: { area: 20, material: "warm", product: "", productType: "" },
    pedestal: { area: 0, material: "hollow", product: "", productType: "" },
  },
  metrics: {},
  scenario: { 
  mode: "room", 
  chartByComponent: {}, 
  descByScenario: {}, 
  chosenByComponent: {},        // For RE scenario per component  
  initialByComponent: {},        // NEW: For Initial scenario per component
  stepByComponent: {},           // NEW: "initial" | "re" | "done"
},
  objects: {
    root: null, ghost: [], pickables: [],
    categories: { wall: [], floor: [], ceiling: [], door: [], lights: [], pedestal: [] },
    wallInst: null, floorInst: null, ceilingInst: null, doorGroup: null,
    lightGroup: null, lightSpots: [], wallCells: [], floorCells: [], ceilingCells: [],
    pedBase: null, pedRod: null, pedHead: null, pedRing: null,
    pedestalAnchors: [], ceilingLightCandidates: [],
  },
};

let scene, camera, renderer, controls;
let ambientLight, hemiLight, dirLight;
let texCache = new Map();
let anisotropy = 4;
let tmpObj = new THREE.Object3D();

let isAnimatingCamera = false;
let cameraAnim = {
  startPos: new THREE.Vector3(), endPos: new THREE.Vector3(),
  startTarget: new THREE.Vector3(), endTarget: new THREE.Vector3(),
  startTime: 0, duration: 1000
};

function animateCameraTo(newPos, newTarget, duration = 1000) {
  cameraAnim.startPos.copy(camera.position);
  cameraAnim.endPos.copy(newPos);
  cameraAnim.startTarget.copy(controls.target);
  cameraAnim.endTarget.copy(newTarget);
  cameraAnim.startTime = performance.now();
  cameraAnim.duration = duration;
  isAnimatingCamera = true;
  controls.enabled = false;
}

async function loadTextFile(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

async function loadCSVData() {
  const [chartText, descText, componentsText] = await Promise.all([
    loadTextFile("./chart.csv"),
    loadTextFile("./description.csv"),
    loadTextFile("./components.csv"),
  ]);
  parseScenarioCSVs(chartText, descText);
  parseComponentsCSV(componentsText);
}

init().catch((err) => {
  console.error(err);
  alert("Failed to load CSV files. If you opened index.html directly, run the project with Live Server.");
});

async function init() {
  await loadCSVData();
  setupUI();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2332);
  scene.fog = new THREE.Fog(0x1a2332, 20, 60);
  camera = new THREE.PerspectiveCamera(52, viewerEl.clientWidth / viewerEl.clientHeight, 0.05, 240);
  renderer = new THREE.WebGLRenderer({
    antialias: window.devicePixelRatio < 2,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  viewerEl.appendChild(renderer.domElement);
  anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 4;
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.minDistance = 1.4;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI * 0.495;
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
  pmremGenerator.dispose();
  setupLighting();
  setupEnvironment();
  setupEvents();
  buildRoom();
  const m = state.metrics;
  camera.position.set(m.length * 0.95, m.floorTopY + m.height * 0.8, m.width * 1.05);
  controls.target.set(0, m.floorTopY + m.height * 0.45, 0);
  controls.update();
  renderer.setAnimationLoop(renderLoop);
}

function parseScenarioCSVs(chartCSVText, descCSVText) {
  const chartRows = parseCSV(chartCSVText);
  const descRows = parseCSV(descCSVText);
  const chartByComponent = {};
  for (const r of chartRows) {
    const comp = r["Components"]?.trim();
    if (!comp) continue;
    const chartvalue = toNum(r["chartvalue"]);
    const scenarioValues = {};
    for (const s of SCENARIOS) scenarioValues[s] = toNum(r[s]);
    chartByComponent[comp] = { chartvalue, scenarioValues };
  }
  const descByScenario = {};
  for (const r of descRows) {
    const s = r["Scenario"]?.trim();
    if (!s) continue;
    descByScenario[s] = {
      en: stripQuotes(r["Description"] || ""),
      de: stripQuotes(r["Description_DE"] || ""),
    };
  }
  state.scenario.chartByComponent = chartByComponent;
  state.scenario.descByScenario = descByScenario;
}

function parseComponentsCSV(componentsCSVText) {
  const rows = parseCSV(componentsCSVText);
  const catalog = {};
  for (const r of rows) {
    const comp = (r["Components"] || "").trim();
    const prod = (r["Product"] || "").trim();
    const type = (r["Product type"] || "").trim();
    if (!comp || !prod || !type) continue;
    if (!catalog[comp]) catalog[comp] = { products: {} };
    if (!catalog[comp].products[prod]) catalog[comp].products[prod] = [];
    if (!catalog[comp].products[prod].includes(type)) catalog[comp].products[prod].push(type);
  }
  state.componentsCatalog = catalog;
  for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
    const compName = def.csvComponent;
    const entry = catalog[compName];
    if (!entry) continue;
    const products = Object.keys(entry.products);
    if (!products.length) continue;
    const p0 = products[0];
    const t0 = entry.products[p0]?.[0] || "";
    state.settings[key].product = state.settings[key].product || p0;
    state.settings[key].productType = state.settings[key].productType || t0;
    state.settings[key].material = deriveMaterialForCategory(key, state.settings[key].product, state.settings[key].productType);
  }
}

function getProductsForComponent(compName) {
  return Object.keys(state.componentsCatalog?.[compName]?.products || {});
}

function getTypesForComponentProduct(compName, productName) {
  return (state.componentsCatalog?.[compName]?.products?.[productName] || []).slice();
}

function deriveMaterialForCategory(catKey, productName, productType) {
  const p = (productName || "").toLowerCase();
  const t = (productType || "").toLowerCase();
  if (catKey === "wall") {
    if (p.includes("wood")) return "wood";
    if (p.includes("glass")) return "glass";
    return "glass";
  }
  if (catKey === "floor") {
    if (p.includes("ligna") || p.includes("wood") || t.includes("wood")) return "wood";
    return "calcium";
  }
  if (catKey === "ceiling") {
    if (p.includes("glass")) return "glass";
    return "metal";
  }
  if (catKey === "door") {
    if (p.includes("aluminium")) return "aluminium";
    if (p.includes("glass")) return "glass";
    if (p.includes("wood")) return "wood";
    return "glass";
  }
  if (catKey === "lights") return state.settings.lights.material || "warm";
  if (catKey === "pedestal") return state.settings.pedestal.material || "hollow";
  return state.settings[catKey]?.material || "glass";
}

function isDoorDoubleLeaf(productName) {
  const p = (productName || "").toLowerCase();
  return p.includes("2 lfg");
}

function setupUI() {
  componentRowsEl.innerHTML = "";
  for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
    const row = document.createElement("div");
    row.className = "comp-row";
    row.dataset.cat = key;
    const top = document.createElement("div");
    top.className = "comp-top";
    const toggle = document.createElement("button");
    toggle.className = "comp-toggle";
    toggle.textContent = def.label;
    const summary = document.createElement("div");
    summary.className = "comp-summary";
    summary.textContent = "Not selected";
    top.append(toggle, summary);
    const controlsWrap = document.createElement("div");
    controlsWrap.className = "comp-controls hidden";
    const areaWrap = document.createElement("div");
    areaWrap.className = "comp-field";
    const areaLabel = document.createElement("label");
    areaLabel.textContent = def.areaLabel;
    const areaInput = document.createElement("input");
    areaInput.type = "number";
    areaInput.min = "0";
    areaInput.step = key === "door" ? "0.1" : "1";
    areaInput.value = String(state.settings[key].area ?? 0);
    areaWrap.append(areaLabel, areaInput);
    const compWrap = document.createElement("div");
    compWrap.className = "comp-field";
    const compLabel = document.createElement("label");
    compLabel.textContent = "Component";
    const compSelect = document.createElement("select");
    compSelect.disabled = true;
    const compOpt = document.createElement("option");
    compOpt.value = def.csvComponent;
    compOpt.textContent = def.csvComponent;
    compOpt.selected = true;
    compSelect.appendChild(compOpt);
    compWrap.append(compLabel, compSelect);
    const prodWrap = document.createElement("div");
    prodWrap.className = "comp-field";
    const prodLabel = document.createElement("label");
    prodLabel.textContent = "Product";
    const prodSelect = document.createElement("select");
    prodWrap.append(prodLabel, prodSelect);
    const typeWrap = document.createElement("div");
    typeWrap.className = "comp-field";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Product type";
    const typeSelect = document.createElement("select");
    typeWrap.append(typeLabel, typeSelect);
    const doorCountWrap = document.createElement("div");
    doorCountWrap.className = "comp-field hidden";
    const doorCountLabel = document.createElement("label");
    doorCountLabel.textContent = "Number of doors";
    const doorCountInput = document.createElement("input");
    doorCountInput.type = "number";
    doorCountInput.min = "1";
    doorCountInput.max = "24";
    doorCountInput.step = "1";
    doorCountInput.value = String(state.settings.door.count ?? 1);
    doorCountWrap.append(doorCountLabel, doorCountInput);
    if (key === "door") doorCountWrap.classList.remove("hidden");
    controlsWrap.append(areaWrap, compWrap, prodWrap, typeWrap);
    if (key === "door") controlsWrap.append(doorCountWrap);
    row.append(top, controlsWrap);
    componentRowsEl.appendChild(row);
    state.ui[key] = { row, toggle, summary, controlsWrap, areaInput, compSelect, prodSelect, typeSelect, doorCountInput };
    hydrateProductTypeSelectsForCategory(key);
    toggle.addEventListener("click", () => {
      if (state.selected.has(key)) state.selected.delete(key);
      else state.selected.add(key);
      if (state.selected.has(key) && Number(areaInput.value) <= 0) {
        const suggested = suggestDefaultArea(key);
        areaInput.value = String(suggested);
        state.settings[key].area = Number(areaInput.value);
      }
      syncUISelectionState();
      if (key === "door") buildRoom();
      else applyAllCategories();
      updateScenarioButtonState();
    });
    areaInput.addEventListener("input", () => {
      state.settings[key].area = Number(areaInput.value) || 0;
      if (key === "door") buildRoom();
      else applyAllCategories();
      updateScenarioButtonState();
    });
    prodSelect.addEventListener("change", () => {
      state.settings[key].product = prodSelect.value;
      hydrateProductTypeSelectsForCategory(key);
      state.settings[key].material = deriveMaterialForCategory(key, state.settings[key].product, state.settings[key].productType);
      buildRoom();
    });
    typeSelect.addEventListener("change", () => {
      state.settings[key].productType = typeSelect.value;
      state.settings[key].material = deriveMaterialForCategory(key, state.settings[key].product, state.settings[key].productType);
      if (key === "door") buildRoom();
      else applyAllCategories();
    });
    if (key === "door") {
      doorCountInput.addEventListener("input", () => {
        state.settings.door.count = clamp(Math.floor(Number(doorCountInput.value) || 1), 1, 24, 1);
        doorCountInput.value = String(state.settings.door.count);
        buildRoom();
      });
    }
  }
  syncUISelectionState();
  updateScenarioButtonState();
}

function hydrateProductTypeSelectsForCategory(catKey) {
  const def = CATEGORY_DEFS[catKey];
  const ui = state.ui[catKey];
  if (!def || !ui) return;
  const compName = def.csvComponent;
  const products = getProductsForComponent(compName);
  ui.prodSelect.innerHTML = "";
  for (const p of products) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    ui.prodSelect.appendChild(opt);
  }
  const desiredProduct = state.settings[catKey].product && products.includes(state.settings[catKey].product)
    ? state.settings[catKey].product : (products[0] || "");
  state.settings[catKey].product = desiredProduct;
  ui.prodSelect.value = desiredProduct;
  const types = getTypesForComponentProduct(compName, desiredProduct);
  ui.typeSelect.innerHTML = "";
  for (const t of types) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    ui.typeSelect.appendChild(opt);
  }
  const desiredType = state.settings[catKey].productType && types.includes(state.settings[catKey].productType)
    ? state.settings[catKey].productType : (types[0] || "");
  state.settings[catKey].productType = desiredType;
  ui.typeSelect.value = desiredType;
  state.settings[catKey].material = deriveMaterialForCategory(catKey, desiredProduct, desiredType);
}

function syncUISelectionState() {
  const selectedLabels = [];
  for (const [key, ui] of Object.entries(state.ui)) {
    const active = state.selected.has(key);
    ui.row.classList.toggle("active", active);
    ui.toggle.classList.toggle("active", active);
    ui.controlsWrap.classList.toggle("hidden", !active);
    if (active) {
      selectedLabels.push(CATEGORY_DEFS[key].label);
      ui.summary.textContent = `${CATEGORY_DEFS[key].areaLabel}`;
    } else {
      ui.summary.textContent = "Not selected";
    }
  }
  selectionReadout.textContent = selectedLabels.length ? selectedLabels.join(", ") : "None";
}

function updateScenarioButtonState() {
  const comps = getSelectedCSVComponents();
  goScenariosBtn.disabled = comps.length === 0;
}

function setupEvents() {
  window.addEventListener("resize", onResize);
  let resizeTicking = false;
  const resizeObserver = new ResizeObserver(() => {
    if (!resizeTicking) {
      requestAnimationFrame(() => { onResize(); resizeTicking = false; });
      resizeTicking = true;
    }
  });
  resizeObserver.observe(viewerShell);
  buildBtn.addEventListener("click", buildRoom);
  roomNameInput.addEventListener("input", () => {
    state.roomName = roomNameInput.value.trim() || "Untitled Room";
    roomNameReadout.textContent = state.roomName;
    viewerRoomTitle.textContent = state.roomName;
  });
  insideBtn.addEventListener("click", () => flyToInsideView());
  outsideBtn.addEventListener("click", () => flyToOutsideView());
  resetBtn.addEventListener("click", () => {
  state.selected.clear();
  state.scenario.chosenByComponent = {};
  state.scenario.initialByComponent = {};
  state.scenario.stepByComponent = {};
  totalCard.classList.add("hidden");
  scenarioDescriptionEl.textContent = "Select a scenario ring to see the description here.";
  syncUISelectionState();
  applyAllCategories();
  updateScenarioButtonState();
});
  goScenariosBtn.addEventListener("click", () => enterScenarioMode());
  backToRoomBtn.addEventListener("click", () => exitScenarioMode());
  resetScenariosBtn.addEventListener("click", () => {
  state.scenario.mode = "scenarios";
  state.scenario.chosenByComponent = {};
  state.scenario.initialByComponent = {};
  state.scenario.stepByComponent = {};
  totalCard.classList.add("hidden");
  totalCard.style.display = "";
  if (scenarioDescCard) scenarioDescCard.style.display = "";
  appRoot.classList.add("mode-scenario-select");
  appRoot.classList.remove("mode-total");
  clearTotalViewerLayout();
  buildScenarioListUI();
});
  showTotalBtn.addEventListener("click", () => {
    if (!allSelectedComponentsHaveChoice()) {
      alert("Please select a scenario for each component.");
      return;
    }
    showTotal();
  });
}

function layoutTotalViewer() {
  if (!viewerShell) return;
  if (window.innerWidth <= 992) {
    viewerShell.style.position = "";
    viewerShell.style.left = "";
    viewerShell.style.top = "";
    viewerShell.style.width = "";
    viewerShell.style.height = "";
    return;
  }
  const leftCard = document.querySelector(".scenario-left .scenario-card");
  const btnRect = showTotalBtn.getBoundingClientRect();
  if (!leftCard) return;
  const cardRect = leftCard.getBoundingClientRect();
  const gap = 14;
  const pad = 12;
  const left = cardRect.left + pad;
  const top = btnRect.bottom + gap;
  const width = cardRect.width - pad * 2;
  const height = Math.max(360, window.innerHeight - top - 24);
  viewerShell.style.position = "fixed";
  viewerShell.style.left = `${left}px`;
  viewerShell.style.top = `${top}px`;
  viewerShell.style.width = `${width}px`;
  viewerShell.style.height = `${height}px`;
}

function clearTotalViewerLayout() {
  if (!viewerShell) return;
  viewerShell.style.position = "";
  viewerShell.style.left = "";
  viewerShell.style.top = "";
  viewerShell.style.width = "";
  viewerShell.style.height = "";
}

function onResize() {
  if (appRoot.classList.contains("mode-total")) layoutTotalViewer();
  const w = viewerEl.clientWidth;
  const h = viewerEl.clientHeight;
  if (!w || !h) return;
  if (camera && renderer) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
}

function setupLighting() {
  ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);
  hemiLight = new THREE.HemisphereLight(0xeaf0ff, 0x55606e, 0.6);
  hemiLight.position.set(0, 12, 0);
  scene.add(hemiLight);
  dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(-8, 14, -6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 90;
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  dirLight.shadow.bias = -0.00015;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xc8ddff, 0.6);
  fillLight.position.set(10, 8, 12);
  scene.add(fillLight);
  const accentLight = new THREE.PointLight(0xfff0d8, 0.4, 30);
  accentLight.position.set(6, 3, 6);
  scene.add(accentLight);
}

function setupEnvironment() {
  const outer = new THREE.Mesh(
    new THREE.CircleGeometry(60, 80),
    new THREE.MeshStandardMaterial({ color: 0x2a364a, roughness: 1.0, metalness: 0 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);
  const grid = new THREE.GridHelper(60, 60, 0x4a5a75, 0x2a364a);
  grid.position.y = -0.01;
  scene.add(grid);
}

function buildRoom() {
  state.roomName = roomNameInput.value.trim() || "Untitled Room";
  roomNameReadout.textContent = state.roomName;
  viewerRoomTitle.textContent = state.roomName;
  const length = clamp(parseFloat(lengthInput.value), 2, 100, 5);
  const width = clamp(parseFloat(widthInput.value), 2, 100, 10);
  const height = clamp(parseFloat(heightInput.value), 2.2, 8, 3);
  lengthInput.value = String(length);
  widthInput.value = String(width);
  heightInput.value = String(height);
  state.dims = { length, width, height };
  if (state.objects.root) {
    disposeObject(state.objects.root);
    scene.remove(state.objects.root);
  }
  state.objects = {
    root: new THREE.Group(), ghost: [], pickables: [],
    categories: { wall: [], floor: [], ceiling: [], door: [], lights: [], pedestal: [] },
    wallInst: null, floorInst: null, ceilingInst: null, doorGroup: null,
    lightGroup: null, lightSpots: [], wallCells: [], floorCells: [], ceilingCells: [],
    pedBase: null, pedRod: null, pedHead: null, pedRing: null,
    pedestalAnchors: [], ceilingLightCandidates: [],
  };
  scene.add(state.objects.root);
  computeMetrics();
  buildGhostShell();
  buildWallSystem();
  buildFloorPanels();
  buildCeilingPanels();
  buildDoor();
  buildLights();
  buildPedestalSystem();
  updateDimensionReadout();
  updateCategoryInputBounds();
  applyAllCategories();
  controls.target.set(0, state.metrics.floorTopY + state.dims.height * 0.45, 0);
  controls.update();
  updateScenarioButtonState();
}

function computeDoorPlacements() {
  const m = state.metrics;
  const doorCount = clamp(Math.floor(Number(state.settings.door.count) || 1), 1, 24, 1);
  const bySide = { front: 0, back: 0, left: 0, right: 0 };
  const order = ["front", "back", "left", "right"];
  for (let i = 0; i < doorCount; i++) bySide[order[i % 4]]++;
  const placements = [];
  function addSide(side, k) {
    if (k <= 0) return;
    const span = side === "front" || side === "back" ? m.length : m.width;
    const minClear = 0.8 + m.doorWidth / 2;
    const usable = Math.max(0, span - minClear * 2);
    for (let i = 0; i < k; i++) {
      const t = k === 1 ? 0.5 : i / (k - 1);
      const along = -span / 2 + minClear + usable * t;
      placements.push({ side, along });
    }
  }
  addSide("front", bySide.front);
  addSide("back", bySide.back);
  addSide("left", bySide.left);
  addSide("right", bySide.right);
  return placements;
}

function computeMetrics() {
  const { length, width, height } = state.dims;
  const floorTopY = state.raisedFloorHeight;
  const ceilingY = floorTopY + height;
  const doorHeight = Math.min(2.2, Math.max(1.9, height * 0.74));
  const requestedDoorArea = Math.max(0.8, state.settings.door.area || 2.0);
  const isDoubleLeafDoor = isDoorDoubleLeaf(state.settings.door.product);
  const doorWidthMultiplier = isDoubleLeafDoor ? 2.0 : 1.0;
  const baseDoorWidth = clamp(
    requestedDoorArea / doorHeight, 0.75,
    Math.min(1.6, length * 0.4), 1.0
  );
  const doorWidth = baseDoorWidth * doorWidthMultiplier;
  const nx = Math.max(1, Math.floor(length));
  const nz = Math.max(1, Math.floor(width));
  const panelCount = nx * nz;
  const xMargin = (length - nx) / 2;
  const zMargin = (width - nz) / 2;
  state.metrics = {
    ...state.dims, floorTopY, ceilingY, doorHeight, doorWidth,
    doorPlacements: computeDoorPlacements(),
    nx, nz, panelCount, usableFloorArea: panelCount,
    xMargin, zMargin, wallMaxArea: 0,
    ceilingMaxArea: panelCount, floorMaxArea: panelCount, pedestalMaxArea: panelCount,
  };
}

function updateDimensionReadout() {
  const m = state.metrics;
  dimensionReadout.textContent = `Size: ${m.length.toFixed(2)}m × ${m.width.toFixed(2)}m × ${m.height.toFixed(2)}m`;
}

function updateCategoryInputBounds() {
  const m = state.metrics;
  const maxDoorArea = m.doorWidth * m.doorHeight;
  const maxMap = {
    wall: m.wallMaxArea, floor: m.floorMaxArea, ceiling: m.ceilingMaxArea,
    door: maxDoorArea, lights: m.length * m.width, pedestal: m.pedestalMaxArea,
  };
  for (const [cat, ui] of Object.entries(state.ui)) {
    const maxVal = maxMap[cat] || 0;
    ui.areaInput.max = String(Math.max(0, Math.floor(maxVal * 10) / 10));
    ui.areaInput.placeholder = `max ${maxVal.toFixed(1)}`;
    const current = Number(ui.areaInput.value) || 0;
    if (current > maxVal) {
      ui.areaInput.value = String(Math.max(0, Math.floor(maxVal)));
      state.settings[cat].area = Number(ui.areaInput.value);
    }
    if (cat === "wall" && state.selected.has("wall") && current <= 0) {
      ui.areaInput.value = String(Math.floor(maxVal));
      state.settings.wall.area = Number(ui.areaInput.value);
    }
  }
}

function buildGhostShell() {
  const { length, width, height } = state.metrics;
  const floorTopY = state.metrics.floorTopY;
  const shellGroup = new THREE.Group();
  state.objects.root.add(shellGroup);
  const shellGeo = new THREE.BoxGeometry(length, height, width);
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xaaccff, transparent: true, opacity: 0.12,
    roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.position.set(0, floorTopY + height / 2, 0);
  shellGroup.add(shell);
  const edgeGeo = new THREE.EdgesGeometry(shellGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x88bbff, transparent: true, opacity: 0.9 });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.position.copy(shell.position);
  shellGroup.add(edges);
  const ghostRaisedFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(length, width),
    new THREE.MeshBasicMaterial({
      color: 0x95b8ee, transparent: true, opacity: 0.07,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  ghostRaisedFloor.rotation.x = -Math.PI / 2;
  ghostRaisedFloor.position.set(0, floorTopY + 0.001, 0);
  shellGroup.add(ghostRaisedFloor);
  state.objects.ghost.push(shell, edges, ghostRaisedFloor);
}

function buildWallSystem() { return buildWallSystem_impl(); }
function buildFloorPanels() { return buildFloorPanels_impl(); }
function buildCeilingPanels() { return buildCeilingPanels_impl(); }
function buildDoor() { return buildDoor_impl(); }
function buildLights() { return buildLights_impl(); }
function buildPedestalSystem() { return buildPedestalSystem_impl(); }

function buildWallSystem_impl() {
  const m = state.metrics;
  const group = new THREE.Group();
  group.userData.category = "wall";
  state.objects.root.add(group);
  const productName = state.settings.wall.product;
  const product = getProduct(productName);
  if (!product) {
    console.warn(`No product builder for "${productName}", using generic`);
    return buildGenericWalls(group);
  }
  const panelH = m.height;
  const wallCells = [];

  function placeSide(side, span) {
    const doorPlacements = state.metrics.doorPlacements || [];
    const hasDoorOnSide = state.selected.has("door") && doorPlacements.some(p => p.side === side);
    if (!hasDoorOnSide) {
      addWallPiece(side, 0, span, m.height, 0);
      return;
    }
    const doorW = state.metrics.doorWidth;
    const doorH = state.metrics.doorHeight;
    const sideDoors = doorPlacements.filter(p => p.side === side).sort((a, b) => a.along - b.along);
    let cursorStart = -span / 2;
    for (const door of sideDoors) {
      const segEnd = door.along - doorW / 2;
      const segWidth = segEnd - cursorStart;
      if (segWidth > 0.05) {
        const segCenter = cursorStart + segWidth / 2;
        addWallPiece(side, segCenter, segWidth, m.height, 0);
      }
      cursorStart = door.along + doorW / 2;
    }
    const finalW = span / 2 - cursorStart;
    if (finalW > 0.05) {
      const segCenter = cursorStart + finalW / 2;
      addWallPiece(side, segCenter, finalW, m.height, 0);
    }
    const transomH = m.height - doorH;
    if (transomH > 0.05) {
      for (const door of sideDoors) {
        addWallPiece(side, door.along, doorW, transomH, doorH);
      }
    }
  }

  function addWallPiece(s, centerAlong, w, h, yOffset) {
    if (w <= 0.05 || h <= 0.05) return;
    const inst = product.build({ width: w, height: h });
    inst.userData.category = "wall";
    if (s === "back") {
      inst.position.set(centerAlong, m.floorTopY + yOffset, -m.width / 2);
      inst.rotation.y = 0;
    } else if (s === "front") {
      inst.position.set(centerAlong, m.floorTopY + yOffset, m.width / 2);
      inst.rotation.y = Math.PI;
    } else if (s === "left") {
      inst.position.set(-m.length / 2, m.floorTopY + yOffset, centerAlong);
      inst.rotation.y = Math.PI / 2;
    } else if (s === "right") {
      inst.position.set(m.length / 2, m.floorTopY + yOffset, centerAlong);
      inst.rotation.y = -Math.PI / 2;
    }
    inst.visible = false;
    group.add(inst);
    wallCells.push({ mesh: inst, area: w * h, side: s });
  }

  placeSide("back", m.length);
  placeSide("front", m.length);
  placeSide("left", m.width);
  placeSide("right", m.width);
  state.objects.wallCells = wallCells;
  state.objects.wallGroup = group;
  state.metrics.wallMaxArea = wallCells.reduce((s, c) => s + c.area, 0);
}

function isInDoorCutoutSide(side, along, panelW) {
  if (!state.selected.has("door")) return false;
  const placements = state.metrics.doorPlacements || [];
  const doorW = state.metrics.doorWidth;
  for (const p of placements) {
    if (p.side !== side) continue;
    const cellMin = along - panelW / 2;
    const cellMax = along + panelW / 2;
    if (rangesOverlap(cellMin, cellMax, p.along - doorW / 2, p.along + doorW / 2)) return true;
  }
  return false;
}

function buildGenericWalls(group) {
  state.objects.wallCells = [];
  state.metrics.wallMaxArea = 0;
}

function buildFloorPanels_impl() {
  const m = state.metrics;
  const group = new THREE.Group();
  state.objects.root.add(group);
  const cells = [];
  const panelTopY = m.floorTopY;
  const panelThickness = 0.04;
  const startX = -m.length / 2 + m.xMargin + 0.5;
  const startZ = -m.width / 2 + m.zMargin + 0.5;
  for (let iz = 0; iz < m.nz; iz++) {
    for (let ix = 0; ix < m.nx; ix++) {
      const x = startX + ix;
      const z = startZ + iz;
      cells.push({ x, z, y: panelTopY + panelThickness / 2, area: 1 });
    }
  }
  state.objects.floorCells = cells;
  const geo = new THREE.BoxGeometry(0.98, panelThickness, 0.98);
  const mat = createFloorMaterial(state.settings.floor.material);
  const inst = new THREE.InstancedMesh(geo, mat, cells.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.frustumCulled = false;
  inst.userData.category = "floor";
  cells.forEach((c, i) => {
    tmpObj.position.set(c.x, c.y, c.z);
    tmpObj.rotation.set(0, 0, 0);
    tmpObj.scale.set(1, 1, 1);
    tmpObj.updateMatrix();
    inst.setMatrixAt(i, tmpObj.matrix);
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.count = 0;
  group.add(inst);
  state.objects.floorInst = inst;
  state.objects.categories.floor.push(inst);
}

function buildCeilingPanels_impl() {
  const m = state.metrics;
  const group = new THREE.Group();
  state.objects.root.add(group);
  const productName = state.settings.ceiling.product;
  const product = getProduct(productName);
  const panelL = 1.2;
  const panelW = 0.6;
  const nx = Math.max(1, Math.floor(m.length / panelL));
  const nz = Math.max(1, Math.floor(m.width / panelW));
  const actualPanelL = m.length / nx;
  const actualPanelW = m.width / nz;
  const cells = [];
  const suspensionDrop = 0.25;
  const y = m.ceilingY - suspensionDrop;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = -m.length / 2 + actualPanelL * (ix + 0.5);
      const z = -m.width / 2 + actualPanelW * (iz + 0.5);
      cells.push({ x, z, y, area: actualPanelL * actualPanelW });
    }
  }
  state.objects.floorCells = state.objects.floorCells || [];
  state.objects.ceilingCells = cells;
  const panelMeshes = [];
  for (const c of cells) {
    let panel;
    if (product && product.category === "ceiling") {
      panel = product.build({ width: actualPanelL, depth: actualPanelW });
    } else {
      panel = new THREE.Mesh(
        new THREE.BoxGeometry(actualPanelL * 0.98, 0.02, actualPanelW * 0.98),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5 })
      );
    }
    panel.position.set(c.x, c.y, c.z);
    panel.userData.category = "ceiling";
    panel.visible = false;
    group.add(panel);
    panelMeshes.push({ mesh: panel, area: c.area });
  }
  const rodMat = new THREE.MeshStandardMaterial({
    color: 0xa0a4a8, metalness: 0.7, roughness: 0.4,
  });
  const rodSpacing = 1.2;
  const rodsX = Math.max(2, Math.floor(m.length / rodSpacing));
  const rodsZ = Math.max(2, Math.floor(m.width / rodSpacing));
  for (let ix = 0; ix < rodsX; ix++) {
    for (let iz = 0; iz < rodsZ; iz++) {
      const x = -m.length / 2 + (m.length / (rodsX - 1)) * ix;
      const z = -m.width / 2 + (m.width / (rodsZ - 1)) * iz;
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, suspensionDrop, 6),
        rodMat
      );
      rod.position.set(x, m.ceilingY - suspensionDrop / 2, z);
      rod.userData.category = "ceiling";
      rod.visible = false;
      group.add(rod);
      panelMeshes.push({ mesh: rod, area: 0 });
    }
  }
  state.objects.ceilingPanelMeshes = panelMeshes;
  state.objects.categories.ceiling.push(group);
  state.metrics.ceilingMaxArea = cells.reduce((s, c) => s + c.area, 0);
  state.metrics.panelCount = cells.length;
  state.objects.ceilingLightCandidates = cells
    .filter((_, i) => i % 2 === 0)
    .map((c) => ({ x: c.x, y: m.ceilingY - 0.04, z: c.z }));
}

function buildDoor_impl() {
  const m = state.metrics;
  const group = new THREE.Group();
  state.objects.root.add(group);
  group.visible = false;
  group.userData.category = "door";
  const doorH = m.doorHeight;
  const y0 = m.floorTopY;
  const doorCount = clamp(Math.floor(Number(state.settings.door.count) || 1), 1, 24, 1);
  state.settings.door.count = doorCount;
  const placements = m.doorPlacements || [];
  const productName = state.settings.door.product;
  const product = getProduct(productName);

  function addDoorAt(side, along) {
    let doorMesh;
    if (product && product.category === "door") {
      doorMesh = product.build({ width: m.doorWidth, height: doorH });
    } else {
      doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(m.doorWidth, doorH, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xc0c4cc })
      );
      doorMesh.position.y = doorH / 2;
    }
    doorMesh.userData.category = "door";
    let basePos = new THREE.Vector3();
    let rotY = 0;
    const inset = 0.0;
    if (side === "front") { basePos.set(along, y0, m.width / 2 - inset); rotY = Math.PI; }
    if (side === "back") { basePos.set(along, y0, -m.width / 2 + inset); rotY = 0; }
    if (side === "left") { basePos.set(-m.length / 2 + inset, y0, along); rotY = Math.PI / 2; }
    if (side === "right") { basePos.set(m.length / 2 - inset, y0, along); rotY = -Math.PI / 2; }
    doorMesh.position.copy(basePos);
    doorMesh.rotation.y = rotY;
    doorMesh.traverse((o) => { o.userData.category = "door"; });
    group.add(doorMesh);
  }
  for (let i = 0; i < Math.min(placements.length, doorCount); i++) {
    const p = placements[i];
    addDoorAt(p.side, p.along);
  }
  state.objects.doorGroup = group;
  state.objects.categories.door.push(group);
}

function buildLights_impl() {
  const m = state.metrics;
  const group = new THREE.Group();
  state.objects.root.add(group);
  state.objects.lightSpots = [];
  const productName = state.settings.lights.product;
  const product = getProduct(productName);
  const stripLength = 1.5;
  const stripGapAlongLength = 0.2;
  const rowSpacing = 2.0;
  const usableWidth = m.width - 1.0;
  const rowCount = Math.max(1, Math.floor(usableWidth / rowSpacing));
  const actualRowSpacing = usableWidth / rowCount;
  const usableLength = m.length - 1.0;
  const stripsPerRow = Math.max(1, Math.floor(usableLength / (stripLength + stripGapAlongLength)));
  const fixturesData = [];
  const suspendedCeilingY = m.ceilingY - 0.25;
  const y = suspendedCeilingY - 0.05;
  for (let r = 0; r < rowCount; r++) {
    const z = -m.width / 2 + 0.5 + actualRowSpacing * (r + 0.5);
    for (let s = 0; s < stripsPerRow; s++) {
      const totalRowLength = stripsPerRow * stripLength + (stripsPerRow - 1) * stripGapAlongLength;
      const startX = -totalRowLength / 2;
      const x = startX + s * (stripLength + stripGapAlongLength) + stripLength / 2;
      fixturesData.push({ x, y, z });
    }
  }
  for (const fd of fixturesData) {
    let fixture;
    if (product && product.category === "lights") {
      fixture = product.build({ length: stripLength });
    } else {
      fixture = new THREE.Mesh(
        new THREE.BoxGeometry(stripLength, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xe0e2e6, metalness: 0.9 })
      );
    }
    fixture.position.set(fd.x, fd.y, fd.z);
    fixture.userData.category = "lights";
    const spot = new THREE.SpotLight(0xffe9b8, 12, 10, Math.PI / 3, 0.5, 1.5);
    spot.position.set(fd.x, fd.y - 0.05, fd.z);
    spot.castShadow = false;
    const target = new THREE.Object3D();
    target.position.set(fd.x, m.floorTopY + 0.02, fd.z);
    group.add(target);
    spot.target = target;
    fixture.visible = false;
    spot.visible = false;
    group.add(fixture, spot);
    state.objects.lightSpots.push({ fixture, spot, target });
  }
  group.userData.category = "lights";
  state.objects.lightGroup = group;
  state.objects.categories.lights.push(group);
}

function buildPedestalSystem_impl() {
  const m = state.metrics;
  const root = new THREE.Group();
  state.objects.root.add(root);

  const anchors = [];
  const cornerOffset = 0.42;

  for (const p of state.objects.floorCells) {
    anchors.push([p.x - cornerOffset, p.z - cornerOffset]);
    anchors.push([p.x + cornerOffset, p.z - cornerOffset]);
    anchors.push([p.x - cornerOffset, p.z + cornerOffset]);
    anchors.push([p.x + cornerOffset, p.z + cornerOffset]);
  }

  state.objects.pedestalAnchors = anchors;

  const productName = state.settings.pedestal.product;
  const product = getProduct(productName);

  // ===== HEIGHT CALCULATION =====
  // Floor panels sit at y = m.floorTopY (top surface at floor level)
  // Panel thickness = 0.04m
  // Panel BOTTOM = m.floorTopY - 0.04
  // Pedestal TOP must touch panel bottom
  // Pedestal BOTTOM at y = 0 (on the ground)
  // So pedestal total height = m.floorTopY - 0.04
  
  const panelThickness = 0.04;
  // No more slab - pedestals sit directly on the ground
const pedestalHeight = Math.max(0.05, m.floorTopY - panelThickness);

  console.log("Pedestal height:", pedestalHeight, "Floor top:", m.floorTopY);  // Debug

  const pedestalMeshes = [];

  for (const [x, z] of anchors) {
    let pedestal;
    if (product && product.category === "pedestal") {
      pedestal = product.build({ height: pedestalHeight });
    } else {
      pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, pedestalHeight, 8),
        new THREE.MeshStandardMaterial({ color: 0xa0a4a8 })
      );
      pedestal.position.y = pedestalHeight / 2;
    }

    // Place pedestal ON TOP of the concrete slab (which is 6cm thick)
// Place pedestal directly on the ground (y=0)
pedestal.position.set(x, 0, z);
    pedestal.userData.category = "pedestal";
    pedestal.visible = false;
    root.add(pedestal);
    pedestalMeshes.push(pedestal);
  }

  state.objects.pedestalMeshes = pedestalMeshes;
  state.objects.categories.pedestal.push(root);
}

function applyAllCategories() {
  applyWallCategory();
  applyFloorCategory();
  applyCeilingCategory();
  applyDoorCategory();
  applyLightsCategory();
  applyPedestalCategory();
}

function applyWallCategory() {
  if (!state.objects.wallCells || !state.objects.wallCells.length) return;
  const active = state.selected.has("wall");
  const areaReq = clamp(Number(state.settings.wall.area) || 0, 0, state.metrics.wallMaxArea, 0);
  state.settings.wall.area = areaReq;
  if (!active || areaReq <= 0) {
    state.objects.wallCells.forEach(c => c.mesh.visible = false);
    return;
  }
  let total = 0;
  for (const cell of state.objects.wallCells) {
    if (total < areaReq) {
      cell.mesh.visible = true;
      total += cell.area;
    } else {
      cell.mesh.visible = false;
    }
  }
}

function applyFloorCategory() {
  const inst = state.objects.floorInst;
  if (!inst) return;
  const active = state.selected.has("floor");
  const max = state.metrics.floorMaxArea;
  const req = clamp(Math.floor(Number(state.settings.floor.area) || 0), 0, max, 0);
  state.settings.floor.area = req;
  replaceInstancedMaterial(inst, createFloorMaterial(state.settings.floor.material));
  inst.count = active && req > 0 ? req : 0;
}

function applyCeilingCategory() {
  if (!state.objects.ceilingPanelMeshes) return;
  const active = state.selected.has("ceiling");
  const max = state.metrics.ceilingMaxArea;
  const req = clamp(Number(state.settings.ceiling.area) || 0, 0, max, 0);
  state.settings.ceiling.area = req;
  if (!active || req <= 0) {
    state.objects.ceilingPanelMeshes.forEach(p => p.mesh.visible = false);
    return;
  }
  let total = 0;
  for (const cell of state.objects.ceilingPanelMeshes) {
    if (cell.area === 0) {
      cell.mesh.visible = true;
      continue;
    }
    if (total < req - 0.01) {
      cell.mesh.visible = true;
      total += cell.area;
    } else {
      cell.mesh.visible = false;
    }
  }
}

function applyDoorCategory() {
  const group = state.objects.doorGroup;
  if (!group) return;
  const active = state.selected.has("door");
  const maxDoorArea = state.metrics.doorWidth * state.metrics.doorHeight;
  const area = clamp(Number(state.settings.door.area) || 0, 0, maxDoorArea, 0);
  group.visible = active && area > 0;
}

function applyLightsCategory() {
  const active = state.selected.has("lights");
  const maxCoverage = state.metrics.length * state.metrics.width;
  const cov = clamp(Number(state.settings.lights.area) || 0, 0, maxCoverage, 0);
  const mode = state.settings.lights.material;
  const count = active
    ? Math.min(state.objects.lightSpots.length, Math.max(1, Math.ceil(cov / 6)))
    : 0;
  const mood = getLightMood(mode);
  ambientLight.intensity = mood.ambient;
  hemiLight.intensity = mood.hemi;
  dirLight.intensity = mood.sun;
  state.objects.lightSpots.forEach((o, i) => {
    const vis = i < count;
    if (o.fixture) o.fixture.visible = vis;
    if (o.spot) o.spot.visible = vis;
    if (vis && o.spot) {
      o.spot.color.set(mood.color);
      o.spot.intensity = mood.spot;
    }
  });
}

function applyPedestalCategory() {
  if (!state.objects.pedestalMeshes) return;
  
  const active = state.selected.has("pedestal");
  const max = state.metrics.pedestalMaxArea;
  const reqPanels = clamp(Math.floor(Number(state.settings.pedestal.area) || 0), 0, max, 0);

  if (!active || reqPanels <= 0) {
    state.objects.pedestalMeshes.forEach(p => p.visible = false);
    return;
  }

  // Each floor panel has 4 pedestals at corners
  const pedCount = reqPanels * 4;
  state.objects.pedestalMeshes.forEach((p, i) => {
    p.visible = i < pedCount;
  });
}

function createWallMaterial(type) {
  if (type === "glass") {
    return new THREE.MeshStandardMaterial({
      color: 0xbfe2ff, transparent: true, opacity: 0.28,
      roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
    });
  }
  const tex = getTexture("woodWallReal");
  tex.repeat.set(1.2, 1.0);
  return new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.55, metalness: 0.02,
    bumpMap: tex, bumpScale: 0.045, side: THREE.DoubleSide,
  });
}

function createFloorMaterial(type) {
  if (type === "wood") {
    const tex = getTexture("woodFloorReal");
    tex.repeat.set(2.0, 2.0);
    return new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.52, metalness: 0.03, bumpMap: tex, bumpScale: 0.05,
    });
  }
  const tex = getTexture("calciumPanel");
  tex.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.78, metalness: 0.02,
    bumpMap: tex, bumpScale: 0.012, color: 0xf5f5f2,
  });
}

function createCeilingMaterial(type) {
  if (type === "glass") {
    return new THREE.MeshStandardMaterial({
      color: 0xd9eeff, transparent: true, opacity: 0.35, roughness: 0.04, metalness: 0.02,
    });
  }
  const tex = getTexture("brushedMetal");
  tex.repeat.set(2.2, 2.2);
  return new THREE.MeshStandardMaterial({
    map: tex, color: 0xd7dae1, roughness: 0.34, metalness: 0.9,
    bumpMap: tex, bumpScale: 0.02,
  });
}

function createDoorMaterial(type) {
  if (type === "glass") {
    return new THREE.MeshStandardMaterial({
      color: 0xbbe0ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0,
    });
  }
  if (type === "aluminium") {
    const tex = getTexture("brushedMetal");
    tex.repeat.set(3.0, 1.6);
    return new THREE.MeshStandardMaterial({
      map: tex, color: 0xe0e3ea, roughness: 0.28, metalness: 0.95,
      bumpMap: tex, bumpScale: 0.02,
    });
  }
  const tex = getTexture("woodDoorReal");
  tex.repeat.set(1.4, 1.0);
  return new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.5, metalness: 0.03, bumpMap: tex, bumpScale: 0.04,
  });
}

function createDoorFrameMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x9097a5, roughness: 0.35, metalness: 0.75 });
}

function createPedestalMaterial(type) {
  const isRaised = type === "raised";
  const baseColor = isRaised ? 0x8c96a5 : 0x667892;
  const rodColor = isRaised ? 0xa6b0bf : 0x7a8da8;
  const headColor = isRaised ? 0xc0c9d6 : 0x8ea2be;
  return {
    base: new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.32, metalness: 0.82 }),
    rod: new THREE.MeshStandardMaterial({ color: rodColor, roughness: 0.22, metalness: 0.9 }),
    head: new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.26, metalness: 0.86 }),
    ring: new THREE.MeshStandardMaterial({ color: 0xb5bcc7, roughness: 0.2, metalness: 0.92 }),
  };
}

function getLightMood(mode) {
  if (mode === "daylight") return { color: 0xe8f3ff, diffuser: 0xf2f8ff, spot: 18, ambient: 0.45, hemi: 0.7, sun: 1.2 };
  if (mode === "neutral") return { color: 0xffedd6, diffuser: 0xfff1de, spot: 16, ambient: 0.40, hemi: 0.6, sun: 1.0 };
  return { color: 0xffd9ac, diffuser: 0xffe3bc, spot: 15, ambient: 0.35, hemi: 0.55, sun: 0.9 };
}

function getTexture(kind) {
  if (texCache.has(kind)) return texCache.get(kind);
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (kind === "woodWallReal") drawRealWood(ctx, size, { tone: "walnut", planks: true, rotate: false });
  else if (kind === "woodFloorReal") drawRealWood(ctx, size, { tone: "oak", planks: true, rotate: true });
  else if (kind === "woodDoorReal") drawRealWood(ctx, size, { tone: "teak", planks: false, rotate: false });
  else if (kind === "calciumPanel") drawCalciumPanel(ctx, size);
  else if (kind === "brushedMetal") drawBrushedMetal(ctx, size);
  else { ctx.fillStyle = "#cccccc"; ctx.fillRect(0, 0, size, size); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.repeat.set(1, 1);
  texCache.set(kind, tex);
  return tex;
}

function drawRealWood(ctx, size, opts) {
  const tone = opts.tone || "oak";
  const rotate = !!opts.rotate;
  const planks = opts.planks !== false;
  const palettes = {
    oak: ["#c7925f", "#b57e50", "#a06f46", "#d2a06d", "#8f603b"],
    walnut: ["#7f5a3f", "#6c4a35", "#5b3d2c", "#8b6446", "#4a3124"],
    teak: ["#a46e3f", "#8f5d35", "#b87a48", "#764b2d", "#c48a56"],
  };
  const pal = palettes[tone] || palettes.oak;
  ctx.fillStyle = pal[0];
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 22000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * 0.05;
    const v = 160 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${v},${v - 10},${v - 30},${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
  const lines = 240;
  for (let i = 0; i < lines; i++) {
    const base = pal[i % pal.length];
    ctx.strokeStyle = hexToRgba(base, 0.18 + Math.random() * 0.08);
    ctx.lineWidth = 1 + Math.random() * 1.2;
    ctx.beginPath();
    const freq = 0.004 + Math.random() * 0.01;
    const amp = 12 + Math.random() * 28;
    const drift = (Math.random() - 0.5) * 80;
    for (let tt = 0; tt <= size; tt += 14) {
      const v = (i / lines) * size;
      const wave = Math.sin((tt + drift) * freq) * amp;
      const jitter = (Math.random() - 0.5) * 4;
      let x = tt;
      let y = v + wave + jitter;
      if (rotate) [x, y] = [y, x];
      if (tt === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const knotCount = planks ? 10 : 6;
  for (let k = 0; k < knotCount; k++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 18 + Math.random() * 40;
    const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    rg.addColorStop(0, "rgba(40,20,10,0.35)");
    rg.addColorStop(0.35, "rgba(90,60,40,0.18)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const rr = (a / (Math.PI * 4)) * r;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.6;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (planks) {
    const plankW = 140 + Math.random() * 60;
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    for (let p = 0; p < size; p += plankW) {
      if (!rotate) ctx.fillRect(p + plankW - 2, 0, 2, size);
      else ctx.fillRect(0, p + plankW - 2, size, 2);
    }
  }
}

function drawCalciumPanel(ctx, size) {
  ctx.fillStyle = "#f1f1ee";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 210 + Math.floor(Math.random() * 30);
    const a = Math.random() * 0.06;
    ctx.fillStyle = `rgba(${g},${g},${g},${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = "rgba(120,120,120,0.15)";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.fillStyle = "rgba(80,80,80,0.22)";
  [[42, 42], [size - 42, 42], [42, size - 42], [size - 42, size - 42]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBrushedMetal(ctx, size) {
  ctx.fillStyle = "#d9dde4";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const shade = 210 + Math.floor(Math.random() * 25);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.35 + Math.random() * 0.25})`;
    ctx.fillRect(0, y, size, 1);
  }
  for (let i = 0; i < 7000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(x, y, Math.random() * 14 + 3, 1);
  }
}

function setOutsideView() {
  const m = state.metrics;
  if (!m.length) return;
  camera.position.set(m.length * 0.95, m.floorTopY + m.height * 0.8, m.width * 1.05);
  controls.target.set(0, m.floorTopY + m.height * 0.45, 0);
  controls.minDistance = 1.4;
  controls.maxDistance = 80;
  controls.update();
}

function flyToOutsideView() {
  const m = state.metrics;
  if (!m.length) return;
  const tPos = new THREE.Vector3(m.length * 0.95, m.floorTopY + m.height * 0.8, m.width * 1.05);
  const tLook = new THREE.Vector3(0, m.floorTopY + m.height * 0.45, 0);
  animateCameraTo(tPos, tLook, 900);
  controls.minDistance = 1.4;
  controls.maxDistance = 80;
}

function flyToInsideView() {
  const m = state.metrics;
  if (!m.length) return;
  const tPos = new THREE.Vector3(0, m.floorTopY + m.height * 0.55, m.width * 0.2);
  const tLook = new THREE.Vector3(0, m.floorTopY + m.height * 0.52, -m.width * 0.25);
  animateCameraTo(tPos, tLook, 900);
  controls.minDistance = 0.6;
  controls.maxDistance = 60;
}

function flyToSummaryView() {
  if (!state.objects?.root) return;
  const box = new THREE.Box3().setFromObject(state.objects.root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim / 2) / Math.tan(fov / 2);
  distance *= 1.4;
  const dir = new THREE.Vector3(1.4, 0.1, 1).normalize();
  const targetPos = center.clone().add(dir.multiplyScalar(distance));
  animateCameraTo(targetPos, center, 1200);
}

function renderLoop() {
  if (isAnimatingCamera) {
    const now = performance.now();
    let t = (now - cameraAnim.startTime) / cameraAnim.duration;
    if (t >= 1) {
      t = 1;
      isAnimatingCamera = false;
      controls.enabled = true;
    }
    const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    camera.position.lerpVectors(cameraAnim.startPos, cameraAnim.endPos, ease);
    controls.target.lerpVectors(cameraAnim.startTarget, cameraAnim.endTarget, ease);
    camera.updateProjectionMatrix();
  }
  controls.update();
  renderer.render(scene, camera);
}

function enterScenarioMode() {
  state.scenario.mode = "scenarios";
  appRoot.classList.add("mode-scenarios");
  appRoot.classList.add("mode-scenario-select");
  appRoot.classList.remove("mode-total");
  scenarioStage.setAttribute("aria-hidden", "false");
  pruneScenarioSelections();
  totalCard.classList.add("hidden");
  buildScenarioListUI();
}

function exitScenarioMode() {
  state.scenario.mode = "room";
  scenarioStage.setAttribute("aria-hidden", "true");
  appRoot.classList.remove("mode-scenarios", "mode-scenario-select", "mode-total");
  totalCard.classList.add("hidden");
  totalCard.style.display = "";
  scenarioDescCard.style.display = "";
  clearTotalViewerLayout();
  flyToOutsideView();
}

function pruneScenarioSelections() {
  const selectedComps = new Set(getSelectedCSVComponents());
  for (const comp of Object.keys(state.scenario.chosenByComponent)) {
    if (!selectedComps.has(comp)) delete state.scenario.chosenByComponent[comp];
  }
}

function getSelectedCSVComponents() {
  const comps = [];
  for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
    if (!state.selected.has(key)) continue;
    const area = Number(state.settings[key].area) || 0;
    if (area <= 0) continue;
    comps.push(def.csvComponent);
  }
  return comps;
}

function getSelectedCategorySummaryHTML() {
  const builtUpArea = (state.dims.length * state.dims.width).toFixed(2);
  const rows = [];
  for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
    if (!state.selected.has(key)) continue;
    const area = Number(state.settings[key]?.area) || 0;
    if (area <= 0) continue;
    rows.push(`<div class="result-comp-row"><span class="result-comp-name">${escapeHtml(def.label)}</span><span class="result-comp-value">${area.toFixed(2)} m²</span></div>`);
  }
  return `
    <div class="result-summary-card">
      <div class="result-summary-top">
        <div class="result-room-block">
          <div class="result-label">Room name</div>
          <div class="result-room-name">${escapeHtml(state.roomName)}</div>
        </div>
        <div class="result-area-block">
          <div class="result-label">Built up area</div>
          <div class="result-area-value">${builtUpArea} m²</div>
        </div>
      </div>
      <div class="result-components-block">
        <div class="result-label">Selected components</div>
        <div class="result-components-list">
          ${rows.length ? rows.join("") : `<div class="result-empty">No components selected</div>`}
        </div>
      </div>
    </div>
  `;
}

function buildScenarioListUI() {
  scenarioListEl.innerHTML = "";
  showTotalBtn.disabled = true;
  totalCard.classList.add("hidden");

  const selectedComponents = getSelectedCSVComponents();
  if (!selectedComponents.length) {
    scenarioListEl.innerHTML = `<div style="color: var(--muted);">No components selected. Go back and select components + area.</div>`;
    scenarioDescriptionEl.textContent = "Select a component to view scenario descriptions.";
    return;
  }

  // Initialize steps for components that don't have one
  for (const comp of selectedComponents) {
    if (!state.scenario.stepByComponent[comp]) {
      state.scenario.stepByComponent[comp] = "initial";
    }
  }

  for (const comp of selectedComponents) {
    const block = document.createElement("div");
    block.className = "comp-scenarios";

    // Header
    const header = document.createElement("div");
    header.className = "comp-scenarios-header";
    const name = document.createElement("div");
    name.className = "comp-scenarios-name";
    name.textContent = comp;
    const area = document.createElement("div");
    area.className = "comp-scenarios-area";
    area.textContent = `Area: ${getAreaForCSVComponent(comp).toFixed(2)} m²`;
    header.append(name, area);
    block.appendChild(header);

    // Get config for this component
    const cfg = state.scenario.chartByComponent[comp] || null;
    const chartvalue = cfg?.chartvalue ?? 0;

    if (!Number.isFinite(chartvalue) || chartvalue <= 0) {
      const msg = document.createElement("div");
      msg.style.color = "var(--muted)";
      msg.style.fontSize = "0.85rem";
      msg.textContent = "No scenario data available for this component.";
      block.appendChild(msg);
      scenarioListEl.appendChild(block);
      continue;
    }

    // Build available scenarios (with values)
    const available = [];
    for (const s of SCENARIOS) {
      const v = cfg?.scenarioValues?.[s];
      if (!Number.isFinite(v)) continue;
      available.push({ scenario: s, value: v });
    }

    const step = state.scenario.stepByComponent[comp] || "initial";
    const initialChoice = state.scenario.initialByComponent[comp];
    const reChoice = state.scenario.chosenByComponent[comp];

    if (step === "done") {
      // ===== DONE: Show Initial → RE side by side =====
      const doneWrap = document.createElement("div");
      doneWrap.style.display = "flex";
      doneWrap.style.alignItems = "center";
      doneWrap.style.justifyContent = "center";
      doneWrap.style.gap = "20px";
      doneWrap.style.padding = "20px";

      // Initial card
      const initCard = makeFinalCard(comp, initialChoice, "Initial", chartvalue, available);
      doneWrap.appendChild(initCard);

      // Arrow
      const arrow = document.createElement("div");
      arrow.style.fontSize = "2rem";
      arrow.style.color = "var(--accent)";
      arrow.style.fontWeight = "900";
      arrow.textContent = "→";
      doneWrap.appendChild(arrow);

      // RE card
      const reCard = makeFinalCard(comp, reChoice, "RE Strategy", chartvalue, available);
      doneWrap.appendChild(reCard);

      // Back button
      const backBtn = document.createElement("button");
      backBtn.className = "btn";
      backBtn.style.marginLeft = "auto";
      backBtn.innerHTML = "← Back";
      backBtn.addEventListener("click", () => {
        // Done → RE → Initial cycle
        if (state.scenario.stepByComponent[comp] === "done") {
          state.scenario.stepByComponent[comp] = "re";
        } else if (state.scenario.stepByComponent[comp] === "re") {
          state.scenario.stepByComponent[comp] = "initial";
        }
        buildScenarioListUI();
      });
      doneWrap.appendChild(backBtn);

      block.appendChild(doneWrap);
    } else {
      // ===== INITIAL or RE step: Show options grid =====
      const stepLabel = document.createElement("div");
      stepLabel.style.color = "var(--muted)";
      stepLabel.style.fontSize = "0.85rem";
      stepLabel.style.marginBottom = "8px";
      stepLabel.style.fontWeight = "700";
      stepLabel.textContent = step === "initial" 
        ? "Step 1: Choose INITIAL state" 
        : "Step 2: Choose RE Strategy";
      block.appendChild(stepLabel);

      // Show back button if on RE step
      if (step === "re") {
        const backBtn = document.createElement("button");
        backBtn.className = "btn";
        backBtn.style.fontSize = "0.75rem";
        backBtn.style.padding = "4px 10px";
        backBtn.style.marginBottom = "8px";
        backBtn.innerHTML = "← Change Initial";
        backBtn.addEventListener("click", () => {
          state.scenario.stepByComponent[comp] = "initial";
          buildScenarioListUI();
        });
        block.appendChild(backBtn);
      }

      const grid = document.createElement("div");
      grid.className = "ring-grid";

      // === Available scenario rings ===
      for (const item of available) {
        let pct = 0;
        if (Number.isFinite(chartvalue) && chartvalue > 0) {
          pct = 100 - (item.value / chartvalue) * 100;
        }
        if (item.value === 0) pct = 100;
        pct = clamp(pct, 0, 100, 0);

        const ring = document.createElement("div");
        ring.className = "ring-item";
        ring.dataset.comp = comp;
        ring.dataset.scenario = item.scenario;
        ring.dataset.step = step;

        ring.innerHTML = `
          <div class="donut">${donutSVG(pct, 84)}</div>
          <div class="ring-title">${escapeHtml(item.scenario)}</div>
          <div class="ring-sub">${pct.toFixed(1)}%</div>
        `;

        ring.addEventListener("click", () => {
          handleScenarioClick(comp, item.scenario, step);
        });

        grid.appendChild(ring);
      }

      // === NEW PRODUCT box (plain box, no donut) ===
      const newProdBox = document.createElement("div");
      newProdBox.className = "ring-item new-product-box";
      newProdBox.dataset.comp = comp;
      newProdBox.dataset.scenario = "__NEW__";
      newProdBox.dataset.step = step;
      newProdBox.style.display = "flex";
      newProdBox.style.alignItems = "center";
      newProdBox.style.justifyContent = "center";
      newProdBox.style.minHeight = "140px";
      newProdBox.innerHTML = `
        <div style="text-align:center;">
          <div style="font-weight: 900; font-size: 1.1rem; color: #f1f6ff;">NEW PRODUCT</div>
          <div style="margin-top: 6px; color: var(--muted); font-size: 0.75rem;">${chartvalue.toFixed(2)} kg CO₂/m²</div>
        </div>
      `;
      newProdBox.addEventListener("click", () => {
        handleScenarioClick(comp, "__NEW__", step);
      });
      grid.appendChild(newProdBox);

      block.appendChild(grid);
    }

    scenarioListEl.appendChild(block);
    requestAnimationFrame(() => animateDonuts(block));
  }

  // Show description for first component
  const firstComp = selectedComponents[0];
  showDescriptionsForComponent(firstComp, SCENARIOS.filter(s => 
    Number.isFinite(state.scenario.chartByComponent[firstComp]?.scenarioValues?.[s])
  ));

  // Enable Show Total only when ALL components have both initial + RE selected
  showTotalBtn.disabled = !allComponentsFullyChosen();
}

function makeFinalCard(comp, scenarioName, label, chartvalue, available) {
  const card = document.createElement("div");
  card.style.textAlign = "center";
  card.style.minWidth = "140px";

  const labelEl = document.createElement("div");
  labelEl.style.fontSize = "0.7rem";
  labelEl.style.color = "var(--muted)";
  labelEl.style.fontWeight = "800";
  labelEl.style.textTransform = "uppercase";
  labelEl.style.marginBottom = "8px";
  labelEl.textContent = label;
  card.appendChild(labelEl);

  if (scenarioName === "__NEW__") {
    // Plain box for "New Product"
    const box = document.createElement("div");
    box.style.padding = "20px";
    box.style.background = "rgba(94,167,255,0.10)";
    box.style.border = "1px solid rgba(94,167,255,0.55)";
    box.style.borderRadius = "12px";
    box.innerHTML = `
      <div style="font-weight: 900; font-size: 1rem; color: #f1f6ff;">NEW PRODUCT</div>
      <div style="margin-top: 6px; color: var(--muted); font-size: 0.72rem;">${chartvalue.toFixed(2)} kg CO₂/m²</div>
    `;
    card.appendChild(box);
  } else {
    // Donut for scenario
    const item = available.find(x => x.scenario === scenarioName);
    if (item) {
      let pct = 0;
      if (chartvalue > 0) pct = 100 - (item.value / chartvalue) * 100;
      if (item.value === 0) pct = 100;
      pct = clamp(pct, 0, 100, 0);

      const donut = document.createElement("div");
      donut.className = "donut";
      donut.innerHTML = donutSVG(pct, 84);
      card.appendChild(donut);

      const title = document.createElement("div");
      title.className = "ring-title";
      title.style.marginTop = "8px";
      title.textContent = scenarioName;
      card.appendChild(title);

      requestAnimationFrame(() => animateDonuts(card));
    }
  }

  return card;
}

function handleScenarioClick(comp, scenarioName, step) {
  if (step === "initial") {
    state.scenario.initialByComponent[comp] = scenarioName;
    state.scenario.stepByComponent[comp] = "re";
  } else if (step === "re") {
    state.scenario.chosenByComponent[comp] = scenarioName;
    state.scenario.stepByComponent[comp] = "done";
  }
  buildScenarioListUI();
}

function allComponentsFullyChosen() {
  const comps = getSelectedCSVComponents();
  if (!comps.length) return false;
  for (const comp of comps) {
    if (state.scenario.stepByComponent[comp] !== "done") return false;
    if (!state.scenario.initialByComponent[comp]) return false;
    if (!state.scenario.chosenByComponent[comp]) return false;
  }
  return true;
}

function showDescriptionsForComponent(comp, scenarios) {
  const parts = [];
  parts.push(`<div class="desc-title">Scenario description</div>`);
  parts.push(getSelectedCategorySummaryHTML());
  parts.push(`<div class="desc-item"><div class="desc-s">${escapeHtml(comp)}</div><div class="desc-b">Available scenarios:</div></div>`);
  for (const s of scenarios) {
    const d = state.scenario.descByScenario[s];
    if (!d?.en) continue;
    parts.push(`<div class="desc-item"><div class="desc-s">${escapeHtml(s)}</div><div class="desc-b">${escapeHtml(d.en)}</div></div>`);
  }
  scenarioDescriptionEl.innerHTML = parts.join("");
}

function selectScenarioForComponent(comp, scenarioName) {
  state.scenario.chosenByComponent[comp] = scenarioName;
  applyChosenStylingForComponent(comp, scenarioName);
  showTotalBtn.disabled = !allSelectedComponentsHaveChoice();
}

function applyChosenStylingForComponent(comp, chosenScenario) {
  const rings = [...scenarioListEl.querySelectorAll(`.ring-item[data-comp="${cssEscape(comp)}"]`)];
  if (!rings.length) return;
  for (const r of rings) {
    const isChosen = r.dataset.scenario === chosenScenario;
    r.classList.toggle("selected", isChosen);
    r.classList.toggle("faded", chosenScenario ? !isChosen : false);
  }
}

function allSelectedComponentsHaveChoice() {
  const comps = getSelectedCSVComponents();
  if (!comps.length) return false;
  for (const comp of comps) {
    if (!state.scenario.chosenByComponent[comp]) return false;
  }
  return true;
}

function getAreaForCSVComponent(comp) {
  const entry = Object.entries(CATEGORY_DEFS).find(([, def]) => def.csvComponent === comp);
  if (!entry) return 0;
  const [key] = entry;
  return Number(state.settings[key]?.area) || 0;
}

function showTotal() {
  state.scenario.mode = "total";
  appRoot.classList.remove("mode-scenario-select");
  appRoot.classList.add("mode-total");
  layoutTotalViewer();
  flyToSummaryView();

  const selectedComps = getSelectedCSVComponents();
  let kgInitial = 0;
  let kgAfter = 0;

  for (const comp of selectedComps) {
    const area = getAreaForCSVComponent(comp);
    if (area <= 0) continue;

    const cfg = state.scenario.chartByComponent[comp];
    if (!cfg || !Number.isFinite(cfg.chartvalue)) continue;

    const initialChoice = state.scenario.initialByComponent[comp];
    const reChoice = state.scenario.chosenByComponent[comp];
    if (!initialChoice || !reChoice) continue;

    // Get initial value
    let initialValue;
    if (initialChoice === "__NEW__") {
      initialValue = cfg.chartvalue;
    } else {
      initialValue = cfg.scenarioValues?.[initialChoice] ?? 0;
    }

    // Get RE value
    let reValue;
    if (reChoice === "__NEW__") {
      reValue = cfg.chartvalue;
    } else {
      reValue = cfg.scenarioValues?.[reChoice] ?? 0;
    }

    kgInitial += initialValue * area;
    kgAfter += reValue * area;
  }

  const kgSaved = kgInitial - kgAfter;
  const savingsPct = kgInitial > 0 ? (kgSaved / kgInitial) * 100 : 0;

  totalDonut.innerHTML = donutSVG(Math.max(0, savingsPct), 200);
  requestAnimationFrame(() => animateDonuts(totalDonut));

  if (totalPercentEl) totalPercentEl.textContent = `${savingsPct.toFixed(1)}%`;
  totalKgWithoutEl.textContent = `${kgInitial.toFixed(2)} kg`;
  totalKgEl.textContent = `${kgAfter.toFixed(2)} kg`;
  if (totalKgSavedEl) totalKgSavedEl.textContent = `${kgSaved.toFixed(2)} kg`;
  
  // Hide EBF row
  if (totalEbfEl) {
    const ebfRow = totalEbfEl.closest('.metric');
    if (ebfRow) ebfRow.style.display = 'none';
  }

  totalCard.classList.remove("hidden");
  scenarioListEl.innerHTML = `<div style="color: var(--muted);">Total calculated. Click "Change scenario selection" to edit.</div>`;
  scenarioDescriptionEl.innerHTML = `<div class="desc-title result-main-title">Project summary</div>${getSelectedCategorySummaryHTML()}`;
}

function animateDonuts(container) {
  const circles = container.querySelectorAll("circle.donut-progress");
  circles.forEach((c) => {
    const C = Number(c.getAttribute("data-c"));
    const P = Number(c.getAttribute("data-p"));
    if (!Number.isFinite(C) || !Number.isFinite(P)) return;
    c.style.strokeDasharray = `${C} ${C}`;
    c.style.strokeDashoffset = `${C}`;
    requestAnimationFrame(() => {
      const target = C * (1 - Math.max(0, Math.min(100, P)) / 100);
      c.style.strokeDashoffset = `${target}`;
    });
  });
}

function getSelectedComponentsDetailsHTML() {
  const rows = [];
  for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
    if (!state.selected.has(key)) continue;
    const area = Number(state.settings[key]?.area) || 0;
    if (area <= 0) continue;
    rows.push(`<li><b>${escapeHtml(def.label)}</b> — ${area.toFixed(2)} m²</li>`);
  }
  if (!rows.length) return `No components selected.`;
  return `<ul style="margin: 0; padding-left: 18px;">${rows.join("")}</ul>`;
}

function suggestDefaultArea(cat) {
  const m = state.metrics;
  if (!m) return 0;
  switch (CATEGORY_DEFS[cat].defaultAreaType) {
    case "max": return Math.max(1, Math.floor(m.wallMaxArea || 0));
    case "maxIntegerPanels": return Math.max(1, Math.min(1000, m.panelCount || 0));
    case "floorArea": return Math.max(4, Math.floor((m.length * m.width) / 2));
    case "door": return Number((m.doorWidth * m.doorHeight).toFixed(1));
    default: return 1;
  }
}

function replaceInstancedMaterial(inst, newMat) {
  if (!inst) return;
  if (inst.material && inst.material !== newMat) inst.material.dispose?.();
  inst.material = newMat;
}

function rangesOverlap(a1, a2, b1, b2) {
  return Math.max(a1, b1) < Math.min(a2, b2);
}

function clamp(v, min, max, fallback = min) {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose?.();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
      else obj.material.dispose?.();
    }
  });
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => (row[h] = (cells[idx] ?? "").trim()));
    out.push(row);
  }
  return out;
}

function splitCSVLine(line) {
  const res = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { res.push(cur); cur = ""; continue; }
    cur += ch;
  }
  res.push(cur);
  return res;
}

function stripQuotes(s) {
  const t = (s || "").trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function toNum(v) {
  const s = String(v ?? "").trim();
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function donutSVG(percent, sizePx) {
  const size = sizePx;
  const stroke = Math.max(10, Math.round(size * 0.12));
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const P = Math.max(0, Math.min(100, percent));
  const gid = `g_${size}_${Math.round(P * 10)}_${Math.random().toString(16).slice(2)}`;
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#79f5dc" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#5ea7ff" stop-opacity="0.95"/>
      </linearGradient>
    </defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="${stroke}" />
    <circle class="donut-progress" data-c="${C}" data-p="${P}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${gid})" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C} ${C}" stroke-dashoffset="${C}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f2f6ff" font-size="${Math.round(size * 0.18)}" font-weight="900">${P.toFixed(0)}%</text>
  </svg>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssEscape(s) {
  return String(s).replaceAll('"', '\\"');
}

function hexToRgba(hex, a) {
  const c = new THREE.Color(hex);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `rgba(${r},${g},${b},${a})`;
}