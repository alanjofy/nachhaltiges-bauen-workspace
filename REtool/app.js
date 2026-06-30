import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getProduct } from "./productBuilder.js";

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

const buildingNameInput = document.getElementById("buildingNameInput");
const buildingLocationInput = document.getElementById("buildingLocationInput");
const buildingTypeSelect = document.getElementById("buildingTypeSelect");
const buildingTreeEl = document.getElementById("buildingTree");
const addFloorBtn = document.getElementById("addFloorBtn");
const viewModeRoomBtn = document.getElementById("viewModeRoomBtn");
const viewModeBuildingBtn = document.getElementById("viewModeBuildingBtn");
const exportProjectBtn = document.getElementById("exportProjectBtn");
const importProjectBtn = document.getElementById("importProjectBtn");
const importFileInput = document.getElementById("importFileInput");

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

function createRoom(id, name = "New Room") {
  return {
    id, name,
    dims: { length: 5, width: 10, height: 3 },
    raisedFloorHeight: 0.45,
    selected: new Set(),
    settings: {
      wall:     { area: 0, material: "glass",   product: "", productType: "" },
      floor:    { area: 0, material: "calcium", product: "", productType: "" },
      ceiling:  { area: 0, material: "metal",   product: "", productType: "" },
      door:     { area: 2.0, material: "glass", product: "", productType: "", count: 1 },
      lights:   { area: 20, material: "warm",   product: "", productType: "" },
      pedestal: { area: 0, material: "hollow",  product: "", productType: "" },
    },
    scenario: {
      chartByComponent: {}, descByScenario: {},
      chosenByComponent: {}, initialByComponent: {}, stepByComponent: {},
    },
  };
}

function createFloor(id, name = "Ground Floor") {
  return { id, name, maxRoomHeight: 4.0, rooms: [] };
}

function createBuilding() {
  const defaultRoom = createRoom("room-1", "Lindner Room");
  const defaultFloor = createFloor("floor-1", "Ground Floor");
  defaultFloor.rooms.push(defaultRoom);
  return {
    name: "My Building", location: "", projectType: "office",
    floors: [defaultFloor],
  };
}

const state = {
  building: createBuilding(),
  currentFloorId: "floor-1",
  currentRoomId: "room-1",
  viewMode: "room",
  ui: {},
  componentsCatalog: {},
  scenario: { 
    mode: "room", 
    chartByComponent: {}, 
    descByScenario: {},
    cameFromBuildingScenarios: false,
  },
  get roomName()           { return getCurrentRoom()?.name ?? "Untitled"; },
  set roomName(v)          { const r = getCurrentRoom(); if (r) r.name = v; },
  get dims()               { return getCurrentRoom()?.dims; },
  set dims(v)              { const r = getCurrentRoom(); if (r) r.dims = v; },
  get raisedFloorHeight()  { return getCurrentRoom()?.raisedFloorHeight ?? 0.45; },
  set raisedFloorHeight(v) { const r = getCurrentRoom(); if (r) r.raisedFloorHeight = v; },
  get selected()           { return getCurrentRoom()?.selected ?? new Set(); },
  set selected(v)          { const r = getCurrentRoom(); if (r) r.selected = v; },
  get settings()           { return getCurrentRoom()?.settings; },
  set settings(v)          { const r = getCurrentRoom(); if (r) r.settings = v; },
  metrics: {},
  objects: {
    root: null, ghost: [], pickables: [],
    categories: { wall: [], floor: [], ceiling: [], door: [], lights: [], pedestal: [] },
    wallInst: null, floorInst: null, ceilingInst: null, doorGroup: null,
    lightGroup: null, lightSpots: [], wallCells: [], floorCells: [], ceilingCells: [],
    pedBase: null, pedRod: null, pedHead: null, pedRing: null,
    pedestalAnchors: [], ceilingLightCandidates: [],
  },
};

function getCurrentRoom() {
  const floor = getCurrentFloor();
  if (!floor) return null;
  return floor.rooms.find(r => r.id === state.currentRoomId) || floor.rooms[0] || null;
}

function getCurrentFloor() {
  if (!state.building?.floors) return null;
  return state.building.floors.find(f => f.id === state.currentFloorId)
       || state.building.floors[0] || null;
}

function getAllRooms() {
  const rooms = [];
  for (const floor of state.building?.floors || []) {
    for (const room of floor.rooms) rooms.push({ floor, room });
  }
  return rooms;
}

function setCurrentRoom(floorId, roomId) {
  state.currentFloorId = floorId;
  state.currentRoomId = roomId;
}

Object.defineProperty(state.scenario, "chosenByComponent", {
  get() { return getCurrentRoom()?.scenario.chosenByComponent ?? {}; },
  set(v) { const r = getCurrentRoom(); if (r) r.scenario.chosenByComponent = v; },
  configurable: true,
});
Object.defineProperty(state.scenario, "initialByComponent", {
  get() { return getCurrentRoom()?.scenario.initialByComponent ?? {}; },
  set(v) { const r = getCurrentRoom(); if (r) r.scenario.initialByComponent = v; },
  configurable: true,
});
Object.defineProperty(state.scenario, "stepByComponent", {
  get() { return getCurrentRoom()?.scenario.stepByComponent ?? {}; },
  set(v) { const r = getCurrentRoom(); if (r) r.scenario.stepByComponent = v; },
  configurable: true,
});

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

// ===== SPLASH ANIMATION =====
// ===== SPLASH ANIMATION =====
// ===== SPLASH ANIMATION (first visit only) =====
function runSplash() {
  const splash = document.getElementById("splashScreen");
  const stage = document.getElementById("splashStage");
  const headerLogo = document.getElementById("headerLogo");
  if (!splash || !stage) return;

  // Check if splash already played this session
  const alreadyPlayed = sessionStorage.getItem("splashPlayed") === "true";

  if (alreadyPlayed) {
    // REFRESH: skip animation, show everything immediately
    splash.remove();
    if (headerLogo) headerLogo.classList.add("visible");
    return;
  }

  // FIRST VISIT: mark as played, run full animation
  sessionStorage.setItem("splashPlayed", "true");

  stage.classList.add("reveal-ring");
  runSplashParticles();

  const DISSOLVE_AT = 6000;
  const PARTICLE_DURATION = 1200;

  setTimeout(() => {
    flyParticlesToHeader(splash, stage, headerLogo);
    stage.style.transition = "opacity 0.4s ease";
    stage.style.opacity = "0";
    splash.classList.add("dissolving");

    setTimeout(() => {
      headerLogo.classList.add("visible");
    }, PARTICLE_DURATION * 0.85);

    setTimeout(() => {
      splash.remove();
    }, PARTICLE_DURATION + 300);
  }, DISSOLVE_AT);
}

// ===== Phase 1: intro particles (build the logo) =====
function runSplashParticles() {
  const canvas = document.getElementById("splashParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = 900, H = 940;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);

  const SCALE = 600 / 500, BX = 150, BY = 175, OFFX = 150, OFFY = 150;
  const toCanvas = (bx, by) => ({ x: (BX + bx) * SCALE + OFFX, y: (BY + by) * SCALE + OFFY });

  const glow = makeGlowSprite();

  const targets = [];
  function fillRect(x0, y0, x1, y1, count) {
    for (let i = 0; i < count; i++)
      targets.push(toCanvas(x0 + Math.random()*(x1-x0), y0 + Math.random()*(y1-y0)));
  }
  fillRect(10,-2,97,150,70); fillRect(97,31,157,150,45); fillRect(135,94,222,150,38);
  fillRect(10,-2,97,12,12);  fillRect(97,31,157,45,7);   fillRect(135,94,222,108,7);

  const cx = 250*SCALE+OFFX, cy = 280*SCALE+OFFY;
  const particles = targets.map(t => {
    const a = Math.random()*Math.PI*2, d = Math.sqrt(Math.random())*465;
    return { x: cx+Math.cos(a)*d, y: cy+Math.sin(a)*d, tx:t.x, ty:t.y,
             size: 6+Math.random()*8, delay: Math.random()*0.5 };
  });

  const easeOut = t => 1 - Math.pow(1-t, 3);
  const DURATION = 3000;
  let startTime = null, canvasFade = 1;
  const stage = document.getElementById("splashStage");

  function frame(now) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    ctx.clearRect(0,0,W,H);
    const phase = Math.min(elapsed/DURATION, 1);
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      let local = (phase - p.delay)/(1 - p.delay);
      local = local<0?0:local>1?1:local;
      const e = easeOut(local);
      const x = p.x+(p.tx-p.x)*e, y = p.y+(p.ty-p.y)*e;
      const alpha = (0.55 + 0.8*(1-Math.abs(local-0.5)*2))*canvasFade;
      const s = p.size*(1.4+(1-local)*0.7);
      ctx.globalAlpha = alpha<1?alpha:1;
      ctx.drawImage(glow, x-s/2, y-s/2, s, s);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    if (phase > 0.7) stage?.classList.add("reveal-on");
    if (phase > 0.85) { canvasFade -= 0.04; if (canvasFade <= 0) { canvas.style.display="none"; return; } }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ===== Phase 2: particles dissolve from logo and fly to the header =====
function flyParticlesToHeader(splash, stage, headerLogo) {
  // create a fresh full-screen canvas overlay for the fly-away
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "100001";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function sizeCanvas() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  sizeCanvas();
  ctx.scale(dpr, dpr);

  const glow = makeGlowSprite();

  // SOURCE: scatter particles across the splash logo's current screen box
  const stageRect = stage.getBoundingClientRect();
  const headerRect = headerLogo.getBoundingClientRect();

  const srcCX = stageRect.left + stageRect.width / 2;
  const srcCY = stageRect.top + stageRect.height / 2;
  const tgtCX = headerRect.left + headerRect.width / 2;
  const tgtCY = headerRect.top + headerRect.height / 2;

  const COUNT = 180;
  const particles = [];
  for (let i = 0; i < COUNT; i++) {
    // start scattered around the logo center (within its radius)
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (stageRect.width * 0.32);
    const sx = srcCX + Math.cos(a) * r;
    const sy = srcCY + Math.sin(a) * r * 1.05;

    // target scattered around header logo (small spread)
    const ta = Math.random() * Math.PI * 2;
    const tr = Math.sqrt(Math.random()) * (headerRect.width * 0.4);
    const tx = tgtCX + Math.cos(ta) * tr;
    const ty = tgtCY + Math.sin(ta) * tr;

    particles.push({
      sx, sy, tx, ty,
      // control point for a slight arc
      cx: (sx + tx) / 2 + (Math.random() - 0.5) * 120,
      cy: (sy + ty) / 2 - 80 - Math.random() * 120,
      size: 4 + Math.random() * 7,
      delay: Math.random() * 0.25,
    });
  }

  const easeInOut = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  const DURATION = 1200;
  let startTime = null;

  function frame(now) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const phase = Math.min(elapsed / DURATION, 1);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      let local = (phase - p.delay) / (1 - p.delay);
      local = local < 0 ? 0 : local > 1 ? 1 : local;
      const e = easeInOut(local);

      // quadratic bezier: src -> control -> target (arc path)
      const mt = 1 - e;
      const x = mt*mt*p.sx + 2*mt*e*p.cx + e*e*p.tx;
      const y = mt*mt*p.sy + 2*mt*e*p.cy + e*e*p.ty;

      // fade: bright in middle, fade as it lands
      const alpha = local < 0.85 ? 0.9 : 0.9 * (1 - (local - 0.85) / 0.15);
      const s = p.size * (1 + (1 - local) * 0.6);

      ctx.globalAlpha = alpha;
      ctx.drawImage(glow, x - s/2, y - s/2, s, s);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (phase < 1) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}

// ===== shared glow sprite =====
function makeGlowSprite() {
  const SPRITE = 48;
  const glow = document.createElement("canvas");
  glow.width = glow.height = SPRITE;
  const gctx = glow.getContext("2d");
  const grad = gctx.createRadialGradient(SPRITE/2, SPRITE/2, 0, SPRITE/2, SPRITE/2, SPRITE/2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.1, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(220,242,255,0.85)");
  grad.addColorStop(0.6, "rgba(150,195,225,0.35)");
  grad.addColorStop(1, "rgba(150,195,225,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, SPRITE, SPRITE);
  return glow;
}

async function init() {
  await loadCSVData();
  loadFromLocalStorage();
  for (const { room } of getAllRooms()) {
    room.scenario.chartByComponent = state.scenario.chartByComponent;
    room.scenario.descByScenario = state.scenario.descByScenario;
  }
  setupUI();
  setupBuildingNav();
  scene = new THREE.Scene();
const bgLoader = new THREE.TextureLoader();
bgLoader.load("./bg.jpg", (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  scene.background = texture;
  updateBackgroundAspect();
}); // light slate grey
scene.fog = new THREE.Fog(0x6b7882, 80, 200);
  camera = new THREE.PerspectiveCamera(52, viewerEl.clientWidth / viewerEl.clientHeight, 0.05, 1000);
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
  if (state.viewMode === "building") {
    buildBuildingView();
    showBuildingViewInstructions();
  } else {
    buildRoom();
    const m = state.metrics;
    if (m.length) {
      camera.position.set(m.length * 0.95, m.floorTopY + m.height * 0.8, m.width * 1.05);
      controls.target.set(0, m.floorTopY + m.height * 0.45, 0);
      controls.update();
    }
  }
  renderer.setAnimationLoop(renderLoop);
    runSplash();
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
  for (const { room } of getAllRooms()) {
    room.scenario.chartByComponent = chartByComponent;
    room.scenario.descByScenario = descByScenario;
  }
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

function setupBuildingNav() {
  buildingNameInput.value = state.building.name;
  buildingLocationInput.value = state.building.location || "";
  buildingTypeSelect.value = state.building.projectType || "office";
  buildingNameInput.addEventListener("input", () => {
    state.building.name = buildingNameInput.value.trim() || "Untitled Building";
    saveToLocalStorage();
  });
  buildingLocationInput.addEventListener("input", () => {
    state.building.location = buildingLocationInput.value.trim();
    saveToLocalStorage();
  });
  buildingTypeSelect.addEventListener("change", () => {
    state.building.projectType = buildingTypeSelect.value;
    saveToLocalStorage();
  });
  addFloorBtn.addEventListener("click", addNewFloor);
  viewModeRoomBtn.addEventListener("click", () => setViewMode("room"));
  viewModeBuildingBtn.addEventListener("click", () => setViewMode("building"));
  viewModeRoomBtn.classList.toggle("active", state.viewMode === "room");
  viewModeBuildingBtn.classList.toggle("active", state.viewMode === "building");
  if (exportProjectBtn) exportProjectBtn.addEventListener("click", exportProject);
  if (importProjectBtn && importFileInput) {
    importProjectBtn.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) importProject(file);
      e.target.value = "";
    });
  }
  renderBuildingTree();
}

function renderBuildingTree() {
  buildingTreeEl.innerHTML = "";
  for (const floor of state.building.floors) {
    const floorNode = document.createElement("div");
    floorNode.className = "floor-node";
    const floorHeader = document.createElement("div");
    floorHeader.className = "floor-header";
    const floorIcon = document.createElement("span");
    floorIcon.textContent = "🏢";
    const floorNameInput = document.createElement("input");
    floorNameInput.type = "text";
    floorNameInput.value = floor.name;
    floorNameInput.addEventListener("input", () => {
      floor.name = floorNameInput.value.trim() || "Unnamed Floor";
      saveToLocalStorage();
    });
    const delFloorBtn = document.createElement("button");
    delFloorBtn.className = "floor-mini-btn danger";
    delFloorBtn.innerHTML = "✕";
    delFloorBtn.title = "Delete floor";
    delFloorBtn.addEventListener("click", () => deleteFloor(floor.id));
    floorHeader.append(floorIcon, floorNameInput, delFloorBtn);
    floorNode.appendChild(floorHeader);
    const roomsList = document.createElement("div");
    roomsList.className = "rooms-list";
    for (const room of floor.rooms) {
      const roomItem = document.createElement("div");
      roomItem.className = "room-item";
      if (room.id === state.currentRoomId) roomItem.classList.add("active");
      const roomIcon = document.createElement("span");
      roomIcon.textContent = "📦";
      const roomNameField = document.createElement("input");
      roomNameField.type = "text";
      roomNameField.value = room.name;
      roomNameField.addEventListener("click", (e) => e.stopPropagation());
      roomNameField.addEventListener("input", () => {
        room.name = roomNameField.value.trim() || "Untitled Room";
        if (room.id === state.currentRoomId) {
          if (roomNameReadout) roomNameReadout.textContent = room.name;
          if (viewerRoomTitle) viewerRoomTitle.textContent = room.name;
        }
        saveToLocalStorage();
      });
      const roomInfo = document.createElement("span");
      roomInfo.className = "room-info";
      roomInfo.textContent = `${room.dims.length}×${room.dims.width}m`;
      const dupBtn = document.createElement("button");
      dupBtn.className = "floor-mini-btn";
      dupBtn.innerHTML = "⎘";
      dupBtn.title = "Duplicate room";
      dupBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        duplicateRoom(floor.id, room.id);
      });
      const delBtn = document.createElement("button");
      delBtn.className = "floor-mini-btn danger";
      delBtn.innerHTML = "✕";
      delBtn.title = "Delete room";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteRoom(floor.id, room.id);
      });
      roomItem.append(roomIcon, roomNameField, roomInfo, dupBtn, delBtn);
      roomItem.addEventListener("click", () => switchToRoom(floor.id, room.id));
      roomsList.appendChild(roomItem);
    }
    const addRoomBtn = document.createElement("button");
    addRoomBtn.className = "add-room-btn";
    addRoomBtn.textContent = "+ Add Room";
    addRoomBtn.addEventListener("click", () => addNewRoom(floor.id));
    roomsList.appendChild(addRoomBtn);
    floorNode.appendChild(roomsList);
    buildingTreeEl.appendChild(floorNode);
  }
}

function addNewFloor() {
  const id = `floor-${Date.now()}`;
  const floorIndex = state.building.floors.length;
  let floorName = floorIndex === 0 ? "Ground Floor" : `Floor ${floorIndex}`;
  const newFloor = createFloor(id, floorName);
  const roomId = `room-${Date.now()}`;
  const newRoom = createRoom(roomId, "New Room");
  newRoom.scenario.chartByComponent = state.scenario.chartByComponent;
  newRoom.scenario.descByScenario = state.scenario.descByScenario;
  newFloor.rooms.push(newRoom);
  state.building.floors.push(newFloor);
  renderBuildingTree();
  saveToLocalStorage();
  if (state.viewMode === "building") buildBuildingView();
}

function addNewRoom(floorId) {
  const floor = state.building.floors.find(f => f.id === floorId);
  if (!floor) return;
  const roomId = `room-${Date.now()}`;
  const newRoom = createRoom(roomId, `Room ${floor.rooms.length + 1}`);
  newRoom.scenario.chartByComponent = state.scenario.chartByComponent;
  newRoom.scenario.descByScenario = state.scenario.descByScenario;
  floor.rooms.push(newRoom);
  renderBuildingTree();
  saveToLocalStorage();
  if (state.viewMode === "building") buildBuildingView();
}

function duplicateRoom(floorId, roomId) {
  const floor = state.building.floors.find(f => f.id === floorId);
  if (!floor) return;
  const sourceRoom = floor.rooms.find(r => r.id === roomId);
  if (!sourceRoom) return;
  const cloned = JSON.parse(JSON.stringify({
    id: `room-${Date.now()}`,
    name: sourceRoom.name + " (copy)",
    dims: sourceRoom.dims,
    raisedFloorHeight: sourceRoom.raisedFloorHeight,
    settings: sourceRoom.settings,
    scenario: {
      chosenByComponent: sourceRoom.scenario.chosenByComponent,
      initialByComponent: sourceRoom.scenario.initialByComponent,
      stepByComponent: sourceRoom.scenario.stepByComponent,
    },
  }));
  cloned.selected = new Set(sourceRoom.selected);
  cloned.scenario.chartByComponent = state.scenario.chartByComponent;
  cloned.scenario.descByScenario = state.scenario.descByScenario;
  floor.rooms.push(cloned);
  renderBuildingTree();
  saveToLocalStorage();
  if (state.viewMode === "building") buildBuildingView();
}

function deleteFloor(floorId) {
  if (state.building.floors.length <= 1) {
    alert("Cannot delete the last floor. Add another floor first.");
    return;
  }
  if (!confirm("Delete this floor and all its rooms?")) return;
  state.building.floors = state.building.floors.filter(f => f.id !== floorId);
  if (state.currentFloorId === floorId) {
    const firstFloor = state.building.floors[0];
    state.currentFloorId = firstFloor.id;
    state.currentRoomId = firstFloor.rooms[0]?.id || null;
    refreshCurrentRoom();
  }
  renderBuildingTree();
  saveToLocalStorage();
  if (state.viewMode === "building") buildBuildingView();
}

function deleteRoom(floorId, roomId) {
  const floor = state.building.floors.find(f => f.id === floorId);
  if (!floor) return;
  if (floor.rooms.length <= 1) {
    alert("Cannot delete the last room on this floor.");
    return;
  }
  if (!confirm("Delete this room?")) return;
  floor.rooms = floor.rooms.filter(r => r.id !== roomId);
  if (state.currentRoomId === roomId) {
    state.currentRoomId = floor.rooms[0]?.id || null;
    refreshCurrentRoom();
  }
  renderBuildingTree();
  saveToLocalStorage();
  if (state.viewMode === "building") buildBuildingView();
}

function switchToRoom(floorId, roomId) {
  if (state.currentFloorId === floorId && state.currentRoomId === roomId) return;
  state.currentFloorId = floorId;
  state.currentRoomId = roomId;
  if (state.viewMode === "building") {
    refreshCurrentRoomUIOnly();
  } else {
    refreshCurrentRoom();
  }
  renderBuildingTree();
  saveToLocalStorage();
}

function refreshCurrentRoom() {
  const room = getCurrentRoom();
  if (!room) return;
  if (roomNameInput) roomNameInput.value = room.name;
  if (lengthInput) lengthInput.value = String(room.dims.length);
  if (widthInput) widthInput.value = String(room.dims.width);
  if (heightInput) heightInput.value = String(room.dims.height);
  if (roomNameReadout) roomNameReadout.textContent = room.name;
  if (viewerRoomTitle) viewerRoomTitle.textContent = room.name;
  for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
    const ui = state.ui[key];
    if (!ui) continue;
    ui.areaInput.value = String(room.settings[key].area ?? 0);
    hydrateProductTypeSelectsForCategory(key);
    if (key === "door" && ui.doorCountInput) {
      ui.doorCountInput.value = String(room.settings.door.count ?? 1);
    }
  }
  syncUISelectionState();
  updateScenarioButtonState();
  buildRoom();
}

function refreshCurrentRoomUIOnly() {
  const room = getCurrentRoom();
  if (!room) return;
  if (roomNameInput) roomNameInput.value = room.name;
  if (lengthInput) lengthInput.value = String(room.dims.length);
  if (widthInput) widthInput.value = String(room.dims.width);
  if (heightInput) heightInput.value = String(room.dims.height);
  if (roomNameReadout) roomNameReadout.textContent = room.name;
  if (viewerRoomTitle) viewerRoomTitle.textContent = room.name;
  for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
    const ui = state.ui[key];
    if (!ui) continue;
    ui.areaInput.value = String(room.settings[key].area ?? 0);
    hydrateProductTypeSelectsForCategory(key);
    if (key === "door" && ui.doorCountInput) {
      ui.doorCountInput.value = String(room.settings.door.count ?? 1);
    }
  }
  syncUISelectionState();
  updateScenarioButtonState();
}

function setViewMode(mode) {
  state.viewMode = mode;
  viewModeRoomBtn.classList.toggle("active", mode === "room");
  viewModeBuildingBtn.classList.toggle("active", mode === "building");
  saveToLocalStorage();

  if (mode === "building") {
    scene.fog = null;                              // no fog for building
    buildBuildingView();
    showBuildingViewInstructions();
  } else {
    scene.fog = new THREE.Fog(0x6b7882, 30, 80);   // gentle fog for room
    hideBuildingPerformanceNotice();
    const hint = document.getElementById("buildingViewHint");
    if (hint) hint.style.display = "none";
    buildRoom();
    flyToOutsideView();
  }
  updateScenarioButtonState();
}

const buildingRoomMeshes = [];

function buildBuildingView() {
  if (state.objects.root) {
    disposeObject(state.objects.root);
    scene.remove(state.objects.root);
  }
  state.objects = {
    root: new THREE.Group(),
    ghost: [], pickables: [],
    categories: { wall: [], floor: [], ceiling: [], door: [], lights: [], pedestal: [] },
    wallInst: null, floorInst: null, ceilingInst: null, doorGroup: null,
    lightGroup: null, lightSpots: [], wallCells: [], floorCells: [], ceilingCells: [],
    pedBase: null, pedRod: null, pedHead: null, pedRing: null,
    pedestalAnchors: [], ceilingLightCandidates: [],
  };
  scene.add(state.objects.root);
  buildingRoomMeshes.length = 0;

  let totalRooms = 0;
  for (const floor of state.building.floors) totalRooms += floor.rooms.length;
  const useSimplified = totalRooms > 8;
  if (useSimplified) showBuildingPerformanceNotice(totalRooms);
  else hideBuildingPerformanceNotice();

  const slabThickness = 0.3;
  const interRoomGap = 0.2;
  const corridorWidth = 2.5;
  
  let maxFloorWidthX = 0;
  let maxRoomDepth = 0;
  
  for (const floor of state.building.floors) {
    const rooms = floor.rooms;
    if (!rooms.length) continue;
    const halfCount = Math.ceil(rooms.length / 2);
    let row1Width = 0, row2Width = 0;
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (i < halfCount) row1Width += r.dims.length + interRoomGap;
      else row2Width += r.dims.length + interRoomGap;
      maxRoomDepth = Math.max(maxRoomDepth, r.dims.width);
    }
    row1Width -= interRoomGap;
    row2Width -= interRoomGap;
    const floorWidth = Math.max(row1Width, row2Width);
    maxFloorWidthX = Math.max(maxFloorWidthX, floorWidth);
  }
  
  const buildingDepthZ = maxRoomDepth * 2 + corridorWidth;

  let cumulativeY = 0;
  const floorYs = [];

  for (let fi = 0; fi < state.building.floors.length; fi++) {
    const floor = state.building.floors[fi];
    const rooms = floor.rooms;
    if (!rooms.length) continue;

    let maxRoomHeight = 0;
    for (const room of rooms) maxRoomHeight = Math.max(maxRoomHeight, room.dims.height);
    const floorTotalHeight = maxRoomHeight + 0.45;
    
    const halfCount = Math.ceil(rooms.length / 2);
    const row1 = rooms.slice(0, halfCount);
    const row2 = rooms.slice(halfCount);
    
    let row1TotalW = 0;
    for (const r of row1) row1TotalW += r.dims.length + interRoomGap;
    row1TotalW -= interRoomGap;
    let cursorX = -row1TotalW / 2;
    
    for (const room of row1) {
      const roomCenterX = cursorX + room.dims.length / 2;
      const roomCenterZ = (corridorWidth / 2) + (room.dims.width / 2);
      const y = cumulativeY;
      const roomGroup = useSimplified
        ? buildSimplifiedRoom(room, roomCenterX, y, roomCenterZ)
        : buildDetailedRoomAtPosition(room, roomCenterX, y, roomCenterZ);
      roomGroup.userData.floorId = floor.id;
      roomGroup.userData.roomId = room.id;
      roomGroup.userData.isBuildingRoom = true;
      state.objects.root.add(roomGroup);
      const bbox = new THREE.Box3().setFromObject(roomGroup);
      buildingRoomMeshes.push({ floorId: floor.id, roomId: room.id, group: roomGroup, bbox });
      addBuildingRoomLabel(room.name, roomCenterX, y + room.dims.height + 0.45 + 0.2, roomCenterZ);
      if (room.id === state.currentRoomId) highlightBuildingRoom(roomGroup, true);
      cursorX += room.dims.length + interRoomGap;
    }
    
    if (row2.length > 0) {
      let row2TotalW = 0;
      for (const r of row2) row2TotalW += r.dims.length + interRoomGap;
      row2TotalW -= interRoomGap;
      cursorX = -row2TotalW / 2;
      for (const room of row2) {
        const roomCenterX = cursorX + room.dims.length / 2;
        const roomCenterZ = -((corridorWidth / 2) + (room.dims.width / 2));
        const y = cumulativeY;
        const roomGroup = useSimplified
          ? buildSimplifiedRoom(room, roomCenterX, y, roomCenterZ)
          : buildDetailedRoomAtPosition(room, roomCenterX, y, roomCenterZ);
        roomGroup.rotation.y = Math.PI;
        roomGroup.userData.floorId = floor.id;
        roomGroup.userData.roomId = room.id;
        roomGroup.userData.isBuildingRoom = true;
        state.objects.root.add(roomGroup);
        const bbox = new THREE.Box3().setFromObject(roomGroup);
        buildingRoomMeshes.push({ floorId: floor.id, roomId: room.id, group: roomGroup, bbox });
        addBuildingRoomLabel(room.name, roomCenterX, y + room.dims.height + 0.45 + 0.2, roomCenterZ);
        if (room.id === state.currentRoomId) highlightBuildingRoom(roomGroup, true);
        cursorX += room.dims.length + interRoomGap;
      }
    }
    
    const corridorMat = new THREE.MeshStandardMaterial({
      color: 0xd5d8dc, roughness: 0.65, metalness: 0.05,
    });
    const corridorFloor = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(row1TotalW, 4), 0.04, corridorWidth),
      corridorMat
    );
    corridorFloor.position.set(0, cumulativeY + 0.45 + 0.02, 0);
    state.objects.root.add(corridorFloor);
    
    const corridorCeil = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(row1TotalW, 4), 0.04, corridorWidth),
      new THREE.MeshStandardMaterial({ color: 0xeef0f4, roughness: 0.7 })
    );
    corridorCeil.position.set(0, cumulativeY + maxRoomHeight + 0.45 - 0.05, 0);
    state.objects.root.add(corridorCeil);
    
    if (fi > 0) {
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x6a737d, roughness: 0.85, metalness: 0.1,
      });
      const slabPadding = 0.8;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(maxFloorWidthX + slabPadding, slabThickness, buildingDepthZ + slabPadding),
        slabMat
      );
      slab.position.set(0, cumulativeY - slabThickness / 2, 0);
      state.objects.root.add(slab);
    }
    
    addBuildingFloorLabel(floor.name, cumulativeY + maxRoomHeight / 2 + 0.5, maxFloorWidthX, buildingDepthZ);
    floorYs.push({ floor, baseY: cumulativeY, height: floorTotalHeight });
    cumulativeY += floorTotalHeight + slabThickness;
  }
  
  const foundationMat = new THREE.MeshStandardMaterial({
    color: 0x4a5159, roughness: 0.92, metalness: 0.05,
  });
  const groundPadding = 1.5;
  const foundationW = maxFloorWidthX + groundPadding;
  const foundationD = buildingDepthZ + groundPadding;
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(foundationW, slabThickness * 1.5, foundationD),
    foundationMat
  );
  foundation.position.set(0, -slabThickness * 0.75, 0);
  state.objects.root.add(foundation);
  
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0x3a4048, roughness: 0.75, metalness: 0.25,
  });
  const colSize = 0.4;
  const colHeight = cumulativeY + 0.5;
  const colOffsetX = foundationW / 2 - colSize / 2;
  const colOffsetZ = foundationD / 2 - colSize / 2;
  const cornerPositions = [
    [-colOffsetX, -colOffsetZ], [colOffsetX, -colOffsetZ],
    [-colOffsetX, colOffsetZ], [colOffsetX, colOffsetZ],
  ];
  for (const [cx, cz] of cornerPositions) {
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(colSize, colHeight, colSize), columnMat
    );
    col.position.set(cx, colHeight / 2, cz);
    state.objects.root.add(col);
  }
  const interColSpacing = 6;
  const numInterCols = Math.max(0, Math.floor(foundationW / interColSpacing) - 1);
  for (let i = 1; i <= numInterCols; i++) {
    const x = -colOffsetX + (foundationW / (numInterCols + 1)) * i;
    const colF = new THREE.Mesh(
      new THREE.BoxGeometry(colSize * 0.7, colHeight, colSize * 0.7), columnMat
    );
    colF.position.set(x, colHeight / 2, colOffsetZ);
    state.objects.root.add(colF);
    const colB = colF.clone();
    colB.position.set(x, colHeight / 2, -colOffsetZ);
    state.objects.root.add(colB);
  }
  
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x2c3138, roughness: 0.7, metalness: 0.3,
  });
  const beamH = 0.35;
  const beamD = 0.3;
  for (let fi = 0; fi < floorYs.length; fi++) {
    const { baseY, height } = floorYs[fi];
    const beamY = baseY + height;
    const beamFront = new THREE.Mesh(
      new THREE.BoxGeometry(foundationW, beamH, beamD), beamMat
    );
    beamFront.position.set(0, beamY - beamH / 2 - slabThickness, colOffsetZ);
    state.objects.root.add(beamFront);
    const beamBack = beamFront.clone();
    beamBack.position.set(0, beamY - beamH / 2 - slabThickness, -colOffsetZ);
    state.objects.root.add(beamBack);
    const beamLeft = new THREE.Mesh(
      new THREE.BoxGeometry(beamD, beamH, foundationD), beamMat
    );
    beamLeft.position.set(-colOffsetX, beamY - beamH / 2 - slabThickness, 0);
    state.objects.root.add(beamLeft);
    const beamRight = beamLeft.clone();
    beamRight.position.set(colOffsetX, beamY - beamH / 2 - slabThickness, 0);
    state.objects.root.add(beamRight);
  }
  
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x35393f, roughness: 0.88, metalness: 0.15,
  });
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(foundationW + 0.4, 0.25, foundationD + 0.4), roofMat
  );
  roof.position.set(0, cumulativeY + 0.125, 0);
  state.objects.root.add(roof);
  
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x44494f, roughness: 0.8 });
  const parapetH = 0.4;
  const parapetT = 0.15;
  const parapetF = new THREE.Mesh(
    new THREE.BoxGeometry(foundationW + 0.4, parapetH, parapetT), parapetMat
  );
  parapetF.position.set(0, cumulativeY + 0.25 + parapetH / 2, colOffsetZ + 0.1);
  state.objects.root.add(parapetF);
  const parapetB = parapetF.clone();
  parapetB.position.z = -(colOffsetZ + 0.1);
  state.objects.root.add(parapetB);
  const parapetL = new THREE.Mesh(
    new THREE.BoxGeometry(parapetT, parapetH, foundationD + 0.4), parapetMat
  );
  parapetL.position.set(-(colOffsetX + 0.1), cumulativeY + 0.25 + parapetH / 2, 0);
  state.objects.root.add(parapetL);
  const parapetR = parapetL.clone();
  parapetR.position.x = colOffsetX + 0.1;
  state.objects.root.add(parapetR);

  flyToBuildingOverview();
  setupBuildingClickHandler();
}

function buildDetailedRoomAtPosition(room, offsetX, offsetY, offsetZ) {
  const group = new THREE.Group();
  group.position.set(offsetX, offsetY, offsetZ);
  const dims = room.dims;
  const raisedFloorHeight = room.raisedFloorHeight || 0.45;
  const floorTopY = raisedFloorHeight;
  const ceilingY = floorTopY + dims.height;

  const shellGeo = new THREE.BoxGeometry(dims.length, dims.height, dims.width);
  const shellMat = new THREE.MeshStandardMaterial({
  color: 0xc8d0d8,
  transparent: true,
  opacity: 0.02,          // ← was 0.06, much lighter
  roughness: 0.2,
  metalness: 0.1,
  side: THREE.FrontSide,  // ← was DoubleSide (halves the layering)
  depthWrite: false,
});
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.position.set(0, floorTopY + dims.height / 2, 0);
  group.add(shell);
  const edgeGeo = new THREE.EdgesGeometry(shellGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xaab4be, transparent: true, opacity: 0.9 });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.position.copy(shell.position);
  group.add(edges);

  if (room.selected.has("wall") && room.settings.wall.area > 0) {
    const productName = room.settings.wall.product;
    const product = getProduct(productName);
    if (product) {
      placeWallsForRoomWithDoors(group, room, product, dims.height, floorTopY, dims);
    }
  }

  if (room.selected.has("floor") && room.settings.floor.area > 0) {
    const floorMat = createFloorMaterial(room.settings.floor.material);
    const floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(dims.length * 0.95, 0.04, dims.width * 0.95),
      floorMat
    );
    floorMesh.position.set(0, floorTopY + 0.02, 0);
    group.add(floorMesh);
  }

  if (room.selected.has("ceiling") && room.settings.ceiling.area > 0) {
    const ceilingMat = createCeilingMaterial(room.settings.ceiling.material);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(dims.length * 0.95, 0.02, dims.width * 0.95),
      ceilingMat
    );
    ceiling.position.set(0, ceilingY - 0.25, 0);
    group.add(ceiling);
  }

  if (room.selected.has("pedestal") && room.settings.pedestal.area > 0) {
    const productName = room.settings.pedestal.product;
    const product = getProduct(productName);
    const panelThickness = 0.04;
    const pedestalHeight = Math.max(0.05, floorTopY - panelThickness);
    const reqPanels = Math.min(
      Math.floor(room.settings.pedestal.area),
      Math.floor(dims.length * dims.width)
    );
    const totalPedestals = Math.min(reqPanels * 4, 80);
    const nx = Math.max(1, Math.floor(dims.length));
    const nz = Math.max(1, Math.floor(dims.width));
    const startX = -dims.length / 2 + (dims.length - nx) / 2 + 0.5;
    const startZ = -dims.width / 2 + (dims.width - nz) / 2 + 0.5;
    const cornerOffset = 0.42;
    const anchors = [];
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const cx = startX + ix;
        const cz = startZ + iz;
        anchors.push([cx - cornerOffset, cz - cornerOffset]);
        anchors.push([cx + cornerOffset, cz - cornerOffset]);
        anchors.push([cx - cornerOffset, cz + cornerOffset]);
        anchors.push([cx + cornerOffset, cz + cornerOffset]);
      }
    }
    const limit = Math.min(anchors.length, totalPedestals);
    for (let i = 0; i < limit; i++) {
      const [px, pz] = anchors[i];
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
      pedestal.position.set(px, 0, pz);
      group.add(pedestal);
    }
  }
  
    if (room.selected.has("door") && room.settings.door.area > 0) {
    const doorH = Math.min(2.2, Math.max(1.9, dims.height * 0.74));
    const isDoubleLeaf = isDoorDoubleLeaf(room.settings.door.product);
    const requestedDoorArea = Math.max(0.8, room.settings.door.area || 2.0);
    const doorWidthMultiplier = isDoubleLeaf ? 2.0 : 1.0;
    const baseDoorWidth = clamp(requestedDoorArea / doorH, 0.75, Math.min(1.6, dims.length * 0.4), 1.0);
    const doorWidth = baseDoorWidth * doorWidthMultiplier;
    const productName = room.settings.door.product;
    const product = getProduct(productName);
    const doorY = floorTopY;

    const placements = computeDoorPlacementsForRoom(room, dims, doorWidth);

    for (const p of placements) {
      let doorMesh;
      if (product && product.category === "door") {
        doorMesh = product.build({ width: doorWidth, height: doorH });
      } else {
        doorMesh = new THREE.Mesh(
          new THREE.BoxGeometry(doorWidth, doorH, 0.04),
          new THREE.MeshStandardMaterial({ color: 0xc0c4cc })
        );
        doorMesh.position.y = doorH / 2;
      }

      // position by side
      if (p.side === "front") {
        doorMesh.position.set(p.along, doorY, dims.width / 2);
        doorMesh.rotation.y = Math.PI;
      } else if (p.side === "back") {
        doorMesh.position.set(p.along, doorY, -dims.width / 2);
        doorMesh.rotation.y = 0;
      } else if (p.side === "left") {
        doorMesh.position.set(-dims.length / 2, doorY, p.along);
        doorMesh.rotation.y = Math.PI / 2;
      } else if (p.side === "right") {
        doorMesh.position.set(dims.length / 2, doorY, p.along);
        doorMesh.rotation.y = -Math.PI / 2;
      }
      group.add(doorMesh);
    }
  }

  return group;
}

function placeWallsForRoomWithDoors(group, room, product, panelH, floorTopY, dims) {
  const hasDoor = room.selected.has("door") && room.settings.door.area > 0;
  const doorH = Math.min(2.2, Math.max(1.9, dims.height * 0.74));
  const isDoubleLeaf = isDoorDoubleLeaf(room.settings.door.product);
  const requestedDoorArea = Math.max(0.8, room.settings.door.area || 2.0);
  const doorWidthMultiplier = isDoubleLeaf ? 2.0 : 1.0;
  const baseDoorWidth = clamp(requestedDoorArea / doorH, 0.75, Math.min(1.6, dims.length * 0.4), 1.0);
  const doorWidth = baseDoorWidth * doorWidthMultiplier;

  const doorPlacements = hasDoor
    ? computeDoorPlacementsForRoom(room, dims, doorWidth)
    : [];

  function place(side, span) {
    const sideDoors = doorPlacements
      .filter(p => p.side === side)
      .sort((a, b) => a.along - b.along);

    if (sideDoors.length === 0) {
      const inst = product.build({ width: span, height: panelH });
      positionWall(inst, side, 0, floorTopY, dims);
      group.add(inst);
      return;
    }

    let cursorStart = -span / 2;
    for (const door of sideDoors) {
      const segEnd = door.along - doorWidth / 2;
      const segWidth = segEnd - cursorStart;
      if (segWidth > 0.05) {
        const segCenter = cursorStart + segWidth / 2;
        const inst = product.build({ width: segWidth, height: panelH });
        positionWall(inst, side, segCenter, floorTopY, dims);
        group.add(inst);
      }
      cursorStart = door.along + doorWidth / 2;
    }
    const finalW = span / 2 - cursorStart;
    if (finalW > 0.05) {
      const segCenter = cursorStart + finalW / 2;
      const inst = product.build({ width: finalW, height: panelH });
      positionWall(inst, side, segCenter, floorTopY, dims);
      group.add(inst);
    }

    // transom above each door
    const transomH = panelH - doorH;
    if (transomH > 0.05) {
      for (const door of sideDoors) {
        const transom = product.build({ width: doorWidth, height: transomH });
        positionWall(transom, side, door.along, floorTopY + doorH, dims);
        group.add(transom);
      }
    }
  }

  function positionWall(inst, side, centerAlong, yOffset, dims) {
    if (side === "back") {
      inst.position.set(centerAlong, yOffset, -dims.width / 2);
      inst.rotation.y = 0;
    } else if (side === "front") {
      inst.position.set(centerAlong, yOffset, dims.width / 2);
      inst.rotation.y = Math.PI;
    } else if (side === "left") {
      inst.position.set(-dims.length / 2, yOffset, centerAlong);
      inst.rotation.y = Math.PI / 2;
    } else if (side === "right") {
      inst.position.set(dims.length / 2, yOffset, centerAlong);
      inst.rotation.y = -Math.PI / 2;
    }
  }

  place("front", dims.length);
  place("back", dims.length);
  place("left", dims.width);
  place("right", dims.width);
}

function buildSimplifiedRoom(room, offsetX, offsetY, offsetZ) {
  const group = new THREE.Group();
  group.position.set(offsetX, offsetY, offsetZ);
  const dims = room.dims;
  const floorTopY = room.raisedFloorHeight || 0.45;
  const boxGeo = new THREE.BoxGeometry(dims.length, dims.height, dims.width);
  const compCount = room.selected.size;
let color = 0x5a6670;
if (compCount > 0) color = 0xaab4be;
if (room.id === state.currentRoomId) color = 0xe2e7ec;
  const boxMat = new THREE.MeshStandardMaterial({
    color, transparent: true, opacity: 0.35,
    roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide,
  });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(0, floorTopY + dims.height / 2, 0);
  group.add(box);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xeef0f3, transparent: true, opacity: 0.6 });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.position.copy(box.position);
  group.add(edges);
  return group;
}

function addBuildingFloorLabel(text, y, totalWidth, totalDepth) {
  const sprite = makeProLabel(text, {
    fontSize: 52,
    textColor: "#eef4f5",        // near-white from ice family
    accent: "#d5e4e6",           // ice accent bar
    subtitle: "LEVEL",
    subtitleColor: "rgba(213,228,230,0.65)",
    style: "floor",
  });

  const height = 1.0;
  const width = height * sprite.userData.aspect;   // ← MUST multiply by aspect
  sprite.scale.set(width, height, 1);   


  const labelX = -totalWidth / 2 - width / 2 - 1.5;
  sprite.position.set(labelX, y, 0);
  state.objects.root.add(sprite);

  // connector line in ice tone
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xd5e4e6, transparent: true, opacity: 0.4,
  });
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(labelX + width / 2, y, 0),
    new THREE.Vector3(-totalWidth / 2, y, 0),
  ]);
  state.objects.root.add(new THREE.Line(lineGeo, lineMat));

  // accent dot
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xd5e4e6 })
  );
  dot.position.set(-totalWidth / 2, y, 0);
  state.objects.root.add(dot);
}

function addBuildingRoomLabel(text, x, y, z) {
  const sprite = makeProLabel(text, {
    fontSize: 40,
    textColor: "#eef4f5",
    accent: "#9fc0c6",          // slightly darker ice for variation
    style: "room",
  });
  const height = 0.42;
  const width = height * sprite.userData.aspect;
  sprite.scale.set(width, height, 1);
  sprite.position.set(x, y, z);
  state.objects.root.add(sprite);
}

function makeProLabel(text, opts = {}) {
  const {
    fontSize = 52,
    textColor = "#f1f6ff",
    accent = "#79f5dc",
    subtitle = null,
    subtitleColor = "rgba(200,210,225,0.7)",
    style = "floor",   // "floor" | "room"
  } = opts;

  const dpr = 3;
  const fontFamily = "Inter, system-ui, sans-serif";
  const padX = 34, padY = 22;
  const accentBarW = 8;
  const subSize = Math.round(fontSize * 0.52);

    // measure
  const mc = document.createElement("canvas").getContext("2d");
  mc.font = `800 ${fontSize}px ${fontFamily}`;
  const titleW = mc.measureText(text).width;

  // measure subtitle WITH letter spacing
  let subW = 0;
  const subSpacing = 2;
  if (subtitle) {
    mc.font = `700 ${subSize}px ${fontFamily}`;
    const subText = subtitle.toUpperCase();
    for (const ch of subText) {
      subW += mc.measureText(ch).width + subSpacing;
    }
  }

  const contentW = Math.max(titleW, subW);
  const lineH = fontSize * 1.05;
  const contentH = subtitle ? lineH + subSize * 1.6 : lineH;   // more vertical room

  const w = contentW + padX * 2 + accentBarW + 16;   // +16 safety margin
  const h = contentH + padY * 2;

  const canvas = document.createElement("canvas");
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // rounded rect bg with gradient
  const r = h * 0.28;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
      if (style === "floor") {
    grad.addColorStop(0, "rgba(40, 52, 58, 0.95)");   // dark slate
    grad.addColorStop(1, "rgba(26, 35, 40, 0.95)");
  } else {
    grad.addColorStop(0, "rgba(34, 45, 50, 0.9)");
    grad.addColorStop(1, "rgba(20, 28, 32, 0.9)");
  }
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // subtle border
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();

  // accent bar (left)
  roundRect(ctx, padX * 0.45, padY * 0.7, accentBarW, h - padY * 1.4, accentBarW / 2);
  ctx.fillStyle = accent;
  ctx.fill();
  // glow on accent
    ctx.shadowColor = accent;
  ctx.shadowBlur = 4;          // subtle, was 12
  ctx.fill();
  ctx.shadowBlur = 0;

    const textX = padX + accentBarW + 14;

  if (subtitle) {
    // title sits in upper area
    const titleY = padY + lineH * 0.5;
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 3;
    ctx.fillText(text, textX, titleY);
    ctx.shadowBlur = 0;

    // subtitle below title
    const subY = titleY + lineH * 0.55 + subSize * 0.5;
    ctx.font = `700 ${subSize}px ${fontFamily}`;
    ctx.fillStyle = subtitleColor;
    drawSpacedText(ctx, subtitle.toUpperCase(), textX, subY, subSpacing);
  } else {
    // single centered title
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 3;
    ctx.fillText(text, textX, h / 2);
    ctx.shadowBlur = 0;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 999;
  sprite.userData.aspect = w / h;
  return sprite;
}

// helper: rounded rectangle path
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// helper: letter-spaced text
function drawSpacedText(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function highlightBuildingRoom(group, isHighlighted) {
  group.traverse(child => {
    if (child.isMesh && child.material && child.material.emissive !== undefined) {
      if (isHighlighted) {
        child.material.emissive = new THREE.Color(0xc8d0d8);
        child.material.emissiveIntensity = 0.15;
      } else {
        child.material.emissiveIntensity = 0;
      }
    }
  });
}

function flyToBuildingOverview() {
  if (!buildingRoomMeshes.length) return;
  const overallBox = new THREE.Box3();
  for (const { bbox } of buildingRoomMeshes) overallBox.union(bbox);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  overallBox.getSize(size);
  overallBox.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let distance = (maxDim / 2) / Math.tan(fov / 2);
  distance *= 1.8;
  const dir = new THREE.Vector3(1, 0.7, 1).normalize();
  const targetPos = center.clone().add(dir.multiplyScalar(distance));
  animateCameraTo(targetPos, center, 1100);
  controls.minDistance = 2;
  controls.maxDistance = 200;
}

let buildingClickHandlerSetup = false;
function setupBuildingClickHandler() {
  if (buildingClickHandlerSetup) return;
  buildingClickHandlerSetup = true;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let mouseDownPos = null;
  let mouseDownTime = 0;
  renderer.domElement.addEventListener("mousedown", (event) => {
    if (state.viewMode !== "building") return;
    mouseDownPos = { x: event.clientX, y: event.clientY };
    mouseDownTime = performance.now();
  });
  renderer.domElement.addEventListener("mouseup", (event) => {
    if (state.viewMode !== "building") return;
    if (!mouseDownPos) return;
    const dx = Math.abs(event.clientX - mouseDownPos.x);
    const dy = Math.abs(event.clientY - mouseDownPos.y);
    const elapsed = performance.now() - mouseDownTime;
    mouseDownPos = null;
    if (dx > 5 || dy > 5 || elapsed > 400) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const groups = buildingRoomMeshes.map(b => b.group);
    const intersects = raycaster.intersectObjects(groups, true);
    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target && !target.userData.isBuildingRoom) target = target.parent;
      if (target && target.userData.floorId && target.userData.roomId) {
        switchToRoom(target.userData.floorId, target.userData.roomId);
        for (const { group, roomId } of buildingRoomMeshes) {
          highlightBuildingRoom(group, roomId === target.userData.roomId);
        }
      }
    }
  });
}

function showBuildingPerformanceNotice(roomCount) {
  let notice = document.getElementById("buildingPerfNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "buildingPerfNotice";
    notice.className = "building-perf-notice";
    viewerEl.parentElement.appendChild(notice);
  }
  notice.innerHTML = `⚡ Performance mode: ${roomCount} rooms shown as simple boxes.`;
  notice.style.display = "block";
}

function hideBuildingPerformanceNotice() {
  const notice = document.getElementById("buildingPerfNotice");
  if (notice) notice.style.display = "none";
}

function showBuildingViewInstructions() {
  let hint = document.getElementById("buildingViewHint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "buildingViewHint";
    hint.className = "building-view-hint";
    viewerEl.parentElement.appendChild(hint);
  }
  hint.innerHTML = `💡 <b>Click</b> any room to edit its components`;
  hint.style.display = state.viewMode === "building" ? "block" : "none";
}

function exportProject() {
  try {
    const cloned = JSON.parse(JSON.stringify(state.building, (key, value) => {
      if (value instanceof Set) return Array.from(value);
      return value;
    }));
    cloned.floors.forEach((floor, fi) => {
      floor.rooms.forEach((room, ri) => {
        const liveRoom = state.building.floors[fi]?.rooms[ri];
        if (liveRoom?.selected) room.selected = Array.from(liveRoom.selected);
      });
    });
    const payload = {
      version: "1.0", exportedAt: new Date().toISOString(),
      building: cloned,
      currentFloorId: state.currentFloorId,
      currentRoomId: state.currentRoomId,
      viewMode: state.viewMode,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = state.building.name.replace(/[^a-z0-9-_]/gi, "_") || "lindner-project";
    a.download = `${safeName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Export failed:", e);
    alert("Failed to export project: " + e.message);
  }
}

function importProject(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const payload = JSON.parse(e.target.result);
      if (!payload?.building?.floors?.length) throw new Error("Invalid project file");
      if (!confirm("This will replace your current project. Continue?")) return;
      payload.building.floors.forEach(floor => {
        floor.rooms.forEach(room => {
          room.selected = new Set(room.selected || []);
          room.scenario = room.scenario || {};
          room.scenario.chosenByComponent = room.scenario.chosenByComponent || {};
          room.scenario.initialByComponent = room.scenario.initialByComponent || {};
          room.scenario.stepByComponent = room.scenario.stepByComponent || {};
          room.scenario.chartByComponent = state.scenario.chartByComponent;
          room.scenario.descByScenario = state.scenario.descByScenario;
        });
      });
      state.building = payload.building;
      state.currentFloorId = payload.currentFloorId || state.building.floors[0].id;
      state.currentRoomId = payload.currentRoomId || state.building.floors[0].rooms[0]?.id;
      state.viewMode = payload.viewMode || "room";
      buildingNameInput.value = state.building.name;
      buildingLocationInput.value = state.building.location || "";
      buildingTypeSelect.value = state.building.projectType || "office";
      refreshCurrentRoom();
      renderBuildingTree();
      saveToLocalStorage();
      alert(`Project "${state.building.name}" imported successfully!`);
    } catch (err) {
      console.error("Import failed:", err);
      alert("Failed to import project: " + err.message);
    }
  };
  reader.readAsText(file);
}

function saveToLocalStorage() {
  try {
    const cloned = JSON.parse(JSON.stringify(state.building, (key, value) => {
      if (value instanceof Set) return Array.from(value);
      return value;
    }));
    cloned.floors.forEach((floor, fi) => {
      floor.rooms.forEach((room, ri) => {
        const liveRoom = state.building.floors[fi]?.rooms[ri];
        if (liveRoom?.selected) room.selected = Array.from(liveRoom.selected);
      });
    });
    const payload = {
      building: cloned,
      currentFloorId: state.currentFloorId,
      currentRoomId: state.currentRoomId,
      viewMode: state.viewMode,
    };
    localStorage.setItem("lindner-project", JSON.stringify(payload));
  } catch (e) { console.warn("Failed to save to localStorage:", e); }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem("lindner-project");
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload?.building?.floors?.length) return false;
    payload.building.floors.forEach(floor => {
      floor.rooms.forEach(room => {
        room.selected = new Set(room.selected || []);
        room.scenario = room.scenario || {};
        room.scenario.chosenByComponent = room.scenario.chosenByComponent || {};
        room.scenario.initialByComponent = room.scenario.initialByComponent || {};
        room.scenario.stepByComponent = room.scenario.stepByComponent || {};
      });
    });
    state.building = payload.building;
    state.currentFloorId = payload.currentFloorId || state.building.floors[0].id;
    state.currentRoomId = payload.currentRoomId || state.building.floors[0].rooms[0]?.id;
    state.viewMode = payload.viewMode || "room";
    return true;
  } catch (e) {
    console.warn("Failed to load from localStorage:", e);
    return false;
  }
}

function setupUI() {
  const currentRoom = getCurrentRoom();
  if (currentRoom) {
    roomNameInput.value = currentRoom.name;
    lengthInput.value = String(currentRoom.dims.length);
    widthInput.value = String(currentRoom.dims.width);
    heightInput.value = String(currentRoom.dims.height);
  }
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
      if (state.viewMode === "building") buildBuildingView();
      else if (key === "door") buildRoom();
      else applyAllCategories();
      updateScenarioButtonState();
      saveToLocalStorage();
    });
    areaInput.addEventListener("input", () => {
      state.settings[key].area = Number(areaInput.value) || 0;
      if (state.viewMode === "building") buildBuildingView();
      else if (key === "door") buildRoom();
      else applyAllCategories();
      updateScenarioButtonState();
      saveToLocalStorage();
    });
    prodSelect.addEventListener("change", () => {
      state.settings[key].product = prodSelect.value;
      hydrateProductTypeSelectsForCategory(key);
      state.settings[key].material = deriveMaterialForCategory(key, state.settings[key].product, state.settings[key].productType);
      if (state.viewMode === "building") buildBuildingView();
      else buildRoom();
      saveToLocalStorage();
    });
    typeSelect.addEventListener("change", () => {
      state.settings[key].productType = typeSelect.value;
      state.settings[key].material = deriveMaterialForCategory(key, state.settings[key].product, state.settings[key].productType);
      if (state.viewMode === "building") buildBuildingView();
      else if (key === "door") buildRoom();
      else applyAllCategories();
      saveToLocalStorage();
    });
    if (key === "door") {
      doorCountInput.addEventListener("input", () => {
        state.settings.door.count = clamp(Math.floor(Number(doorCountInput.value) || 1), 1, 24, 1);
        doorCountInput.value = String(state.settings.door.count);
        if (state.viewMode === "building") buildBuildingView();
        else buildRoom();
        saveToLocalStorage();
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
  if (state.viewMode === "building") {
    let anyHasComponents = false;
    for (const { room } of getAllRooms()) {
      for (const [key] of Object.entries(CATEGORY_DEFS)) {
        if (room.selected.has(key) && (room.settings[key].area || 0) > 0) {
          anyHasComponents = true;
          break;
        }
      }
      if (anyHasComponents) break;
    }
    goScenariosBtn.disabled = !anyHasComponents;
    goScenariosBtn.textContent = "Select RE-Strategies for entire BUILDING";
  } else {
    const comps = getSelectedCSVComponents();
    goScenariosBtn.disabled = comps.length === 0;
    goScenariosBtn.textContent = "Select RE-Strategies for selected Lindner products";
  }
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
  buildBtn.addEventListener("click", () => {
    if (state.viewMode === "building") buildBuildingView();
    else buildRoom();
    renderBuildingTree();
    saveToLocalStorage();
  });
  roomNameInput.addEventListener("input", () => {
    state.roomName = roomNameInput.value.trim() || "Untitled Room";
    roomNameReadout.textContent = state.roomName;
    viewerRoomTitle.textContent = state.roomName;
    renderBuildingTree();
    saveToLocalStorage();
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
    saveToLocalStorage();
  });
  goScenariosBtn.addEventListener("click", () => {
    if (state.viewMode === "building") enterBuildingScenarioMode();
    else enterScenarioMode();
  });
  backToRoomBtn.addEventListener("click", () => exitScenarioMode());
  resetScenariosBtn.addEventListener("click", () => {
    totalCard.classList.add("hidden");
    totalCard.style.display = "";
    if (scenarioDescCard) scenarioDescCard.style.display = "";
    appRoot.classList.add("mode-scenario-select");
    appRoot.classList.remove("mode-total");
    clearTotalViewerLayout();
    if (state.scenario.mode === "building-total") {
      state.scenario.mode = "building-scenarios";
      buildBuildingScenarioListUI();
    } else {
      state.scenario.mode = "scenarios";
      state.scenario.chosenByComponent = {};
      state.scenario.initialByComponent = {};
      state.scenario.stepByComponent = {};
      buildScenarioListUI();
    }
  });
  showTotalBtn.addEventListener("click", () => {
    if (state.scenario.mode === "building-scenarios") {
      if (!allBuildingRoomsConfigured()) {
        alert("Please configure scenarios for all rooms with components first.");
        return;
      }
      showBuildingTotal();
    } else {
      if (!allComponentsFullyChosen()) {
        alert("Please select both Initial and RE scenario for each component.");
        return;
      }
      showTotal();
    }
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
  updateBackgroundAspect();   // ← add this line
}

function updateBackgroundAspect() {
  if (!scene.background || !scene.background.image) return;
  const tex = scene.background;
  const canvasAspect = viewerEl.clientWidth / viewerEl.clientHeight;
  const imageAspect = tex.image.width / tex.image.height;
  const factor = imageAspect / canvasAspect;

  tex.offset.x = factor > 1 ? (1 - 1 / factor) / 2 : 0;
  tex.repeat.x = factor > 1 ? 1 / factor : 1;
  tex.offset.y = factor > 1 ? 0 : (1 - factor) / 2;
  tex.repeat.y = factor > 1 ? 1 : factor;
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
  const radius = 60;

  const outer = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 80),
    new THREE.MeshStandardMaterial({ color: 0x5a6670, roughness: 1.0, metalness: 0 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);

  // grid size must match the circle DIAMETER (radius * 2)
  const grid = new THREE.GridHelper(radius * 2, 120, 0x8a95a0, 0x4a5660);
  grid.position.y = -0.01;
  scene.add(grid);
}

function buildRoom() {
  state.metrics = {};
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
  if (controls) {
    controls.target.set(0, state.metrics.floorTopY + state.dims.height * 0.45, 0);
    controls.update();
  }
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

function computeDoorPlacementsForRoom(room, dims, doorWidth) {
  const doorCount = clamp(Math.floor(Number(room.settings.door.count) || 1), 1, 24, 1);
  const bySide = { front: 0, back: 0, left: 0, right: 0 };
  const order = ["front", "back", "left", "right"];
  for (let i = 0; i < doorCount; i++) bySide[order[i % 4]]++;

  const placements = [];
  function addSide(side, k) {
    if (k <= 0) return;
    const span = (side === "front" || side === "back") ? dims.length : dims.width;
    const minClear = 0.8 + doorWidth / 2;
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
  const baseDoorWidth = clamp(requestedDoorArea / doorHeight, 0.75, Math.min(1.6, length * 0.4), 1.0);
  const doorWidth = baseDoorWidth * doorWidthMultiplier;
  const nx = Math.max(1, Math.floor(length));
  const nz = Math.max(1, Math.floor(width));
  const panelCount = nx * nz;
  const xMargin = (length - nx) / 2;
  const zMargin = (width - nz) / 2;

  // STEP 1: set metrics FIRST (so doorWidth is available)
  state.metrics = {
    ...state.dims, floorTopY, ceilingY, doorHeight, doorWidth,
    doorPlacements: [],                       // placeholder
    nx, nz, panelCount, usableFloorArea: panelCount,
    xMargin, zMargin, wallMaxArea: 0,
    ceilingMaxArea: panelCount, floorMaxArea: panelCount, pedestalMaxArea: panelCount,
  };

  // STEP 2: now compute placements using the finalized doorWidth
  state.metrics.doorPlacements = computeDoorPlacements();
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
  color: 0xc8d0d8,
  transparent: true,
  opacity: 0.02,          // ← was 0.06, much lighter
  roughness: 0.2,
  metalness: 0.1,
  side: THREE.FrontSide,  // ← was DoubleSide (halves the layering)
  depthWrite: false,
});
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.position.set(0, floorTopY + height / 2, 0);
  shellGroup.add(shell);
  const edgeGeo = new THREE.EdgesGeometry(shellGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xaab4be, transparent: true, opacity: 0.5 });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.position.copy(shell.position);
  shellGroup.add(edges);
  const ghostRaisedFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(length, width),
  new THREE.MeshBasicMaterial({
    color: 0xb0bac4, transparent: true, opacity: 0.07,
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
        new THREE.CylinderGeometry(0.004, 0.004, suspensionDrop, 6), rodMat
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
  console.log("DOOR DEBUG:", {
  selected: state.selected.has("door"),
  area: state.settings.door.area,
  product: state.settings.door.product,
  productFound: !!getProduct(state.settings.door.product),
  placements: state.metrics.doorPlacements,
  childrenCount: group.children.length,
});
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
  const panelThickness = 0.04;
  const pedestalHeight = Math.max(0.05, m.floorTopY - panelThickness);
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
    if (cell.area === 0) { cell.mesh.visible = true; continue; }
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
  const area = Number(state.settings.door.area) || 0;
  group.visible = active && area > 0;
  group.traverse((child) => { child.visible = group.visible; });

  // DIAGNOSTIC
  if (group.visible && group.children.length) {
    const box = new THREE.Box3().setFromObject(group);
    console.log("DOOR APPLY:", {
      groupVisible: group.visible,
      childCount: group.children.length,
      firstChildPos: group.children[0].position.toArray(),
      boxMin: box.min.toArray(),
      boxMax: box.max.toArray(),
      floorTopY: state.metrics.floorTopY,
      roomWidth: state.metrics.width,
      roomLength: state.metrics.length,
    });
  }
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
  const pedCount = reqPanels * 4;
  state.objects.pedestalMeshes.forEach((p, i) => { p.visible = i < pedCount; });
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
}

function drawBrushedMetal(ctx, size) {
  ctx.fillStyle = "#d9dde4";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const shade = 210 + Math.floor(Math.random() * 25);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.35 + Math.random() * 0.25})`;
    ctx.fillRect(0, y, size, 1);
  }
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

function enterBuildingScenarioMode() {
  state.scenario.mode = "building-scenarios";
  appRoot.classList.add("mode-scenarios");
  appRoot.classList.add("mode-scenario-select");
  appRoot.classList.remove("mode-total");
  scenarioStage.setAttribute("aria-hidden", "false");
  totalCard.classList.add("hidden");
  buildBuildingScenarioListUI();
  if (backToRoomBtn) backToRoomBtn.innerHTML = "Back to Room";
}

function buildBuildingScenarioListUI() {
  scenarioListEl.innerHTML = "";
  showTotalBtn.disabled = true;
  totalCard.classList.add("hidden");
  const buildingHeader = document.createElement("div");
  buildingHeader.style.padding = "12px 14px";
  buildingHeader.style.marginBottom = "14px";
  buildingHeader.style.background = "rgba(121,245,220,0.08)";
  buildingHeader.style.border = "1px solid rgba(121,245,220,0.3)";
  buildingHeader.style.borderRadius = "12px";
  buildingHeader.innerHTML = `
    <div style="font-weight: 900; font-size: 1.05rem; color: #f1f6ff;">🏢 ${escapeHtml(state.building.name)}</div>
    <div style="color: var(--muted); font-size: 0.85rem; margin-top: 4px;">
      Building-level LCA — configure scenarios for each room
    </div>
  `;
  scenarioListEl.appendChild(buildingHeader);
  for (const floor of state.building.floors) {
    const floorSection = document.createElement("div");
    floorSection.style.marginBottom = "20px";
    const floorHeader = document.createElement("div");
    floorHeader.style.fontWeight = "800";
    floorHeader.style.fontSize = "0.95rem";
    floorHeader.style.color = "#79f5dc";
    floorHeader.style.marginBottom = "10px";
    floorHeader.style.paddingBottom = "6px";
    floorHeader.style.borderBottom = "1px solid rgba(121,245,220,0.2)";
    floorHeader.textContent = `🏬 ${floor.name}`;
    floorSection.appendChild(floorHeader);
    for (const room of floor.rooms) {
      const roomCompsHTML = [];
      let hasComps = false;
      for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
        if (room.selected.has(key) && (room.settings[key].area || 0) > 0) {
          hasComps = true;
          roomCompsHTML.push(def.csvComponent);
        }
      }
      const roomBlock = document.createElement("div");
      roomBlock.className = "comp-scenarios";
      roomBlock.style.marginBottom = "10px";
      const roomHeader = document.createElement("div");
      roomHeader.className = "comp-scenarios-header";
      const roomName = document.createElement("div");
      roomName.className = "comp-scenarios-name";
      roomName.textContent = `📦 ${room.name}`;
      const roomInfo = document.createElement("div");
      roomInfo.className = "comp-scenarios-area";
      roomInfo.textContent = `${room.dims.length}×${room.dims.width}×${room.dims.height}m`;
      roomHeader.append(roomName, roomInfo);
      roomBlock.appendChild(roomHeader);
      if (!hasComps) {
        const msg = document.createElement("div");
        msg.style.color = "var(--muted)";
        msg.style.fontSize = "0.8rem";
        msg.style.padding = "6px 8px";
        msg.textContent = "⚠️ No components selected for this room.";
        roomBlock.appendChild(msg);
      } else {
        const statusDiv = document.createElement("div");
        statusDiv.style.padding = "8px 4px";
        let configured = 0;
        let unconfigured = 0;
        for (const comp of roomCompsHTML) {
          const step = room.scenario.stepByComponent[comp];
          if (step === "done") configured++;
          else unconfigured++;
        }
        const statusLine = document.createElement("div");
        statusLine.style.fontSize = "0.85rem";
        statusLine.style.color = "var(--muted)";
        statusLine.style.marginBottom = "8px";
        statusLine.innerHTML = `
          <span style="color: ${configured === roomCompsHTML.length ? '#79f5dc' : '#aab3c6'};">
            ${configured}/${roomCompsHTML.length} components configured
          </span>
          • Components: ${roomCompsHTML.join(", ")}
        `;
        statusDiv.appendChild(statusLine);
        const configBtn = document.createElement("button");
        configBtn.className = "btn";
        configBtn.style.fontSize = "0.82rem";
        configBtn.style.padding = "6px 12px";
        configBtn.innerHTML = configured === roomCompsHTML.length
          ? "✓ View / Edit Scenarios"
          : `⚙️ Configure Scenarios (${unconfigured} remaining)`;
        configBtn.addEventListener("click", () => {
          state.scenario.cameFromBuildingScenarios = true;
          switchToRoom(floor.id, room.id);
          setViewMode("room");
          setTimeout(() => enterScenarioMode(), 100);
        });
        statusDiv.appendChild(configBtn);
        roomBlock.appendChild(statusDiv);
      }
      floorSection.appendChild(roomBlock);
    }
    scenarioListEl.appendChild(floorSection);
  }
  scenarioDescriptionEl.innerHTML = `
    <div class="desc-title">Building LCA</div>
    <div class="desc-item">
      <div class="desc-s">Project Name</div>
      <div class="desc-b">${escapeHtml(state.building.name)}</div>
    </div>
    <div class="desc-item">
      <div class="desc-s">Location</div>
      <div class="desc-b">${escapeHtml(state.building.location || "—")}</div>
    </div>
    <div class="desc-item">
      <div class="desc-s">Project Type</div>
      <div class="desc-b">${escapeHtml(state.building.projectType || "—")}</div>
    </div>
    <div class="desc-item">
      <div class="desc-s">Total Floors</div>
      <div class="desc-b">${state.building.floors.length}</div>
    </div>
    <div class="desc-item">
      <div class="desc-s">Total Rooms</div>
      <div class="desc-b">${getAllRooms().length}</div>
    </div>
    <div class="desc-item">
      <div class="desc-s">Built-up Area</div>
      <div class="desc-b">${getBuildingTotalArea().toFixed(2)} m²</div>
    </div>
  `;
  showTotalBtn.disabled = !allBuildingRoomsConfigured();
  showTotalBtn.textContent = "Show building CO₂ savings";
}

function getBuildingTotalArea() {
  let total = 0;
  for (const { room } of getAllRooms()) total += room.dims.length * room.dims.width;
  return total;
}

function allBuildingRoomsConfigured() {
  let anyConfigurable = false;
  for (const { room } of getAllRooms()) {
    for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
      if (room.selected.has(key) && (room.settings[key].area || 0) > 0) {
        anyConfigurable = true;
        const comp = def.csvComponent;
        if (room.scenario.stepByComponent[comp] !== "done") return false;
        if (!room.scenario.initialByComponent[comp]) return false;
        if (!room.scenario.chosenByComponent[comp]) return false;
      }
    }
  }
  return anyConfigurable;
}

function calculateBuildingTotals() {
  let kgInitial = 0;
  let kgAfter = 0;
  const byFloor = [];
  for (const floor of state.building.floors) {
    const floorData = {
      floorName: floor.name, floorId: floor.id,
      byRoom: [], kgInitial: 0, kgAfter: 0,
    };
    for (const room of floor.rooms) {
      const roomData = {
        roomName: room.name, roomId: room.id,
        kgInitial: 0, kgAfter: 0, components: [],
      };
      for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
        if (!room.selected.has(key)) continue;
        const area = Number(room.settings[key].area) || 0;
        if (area <= 0) continue;
        const comp = def.csvComponent;
        const cfg = room.scenario.chartByComponent[comp];
        if (!cfg || !Number.isFinite(cfg.chartvalue)) continue;
        const initialChoice = room.scenario.initialByComponent[comp];
        const reChoice = room.scenario.chosenByComponent[comp];
        if (!initialChoice || !reChoice) continue;
        let initialValue;
        if (initialChoice === "__NEW__") initialValue = cfg.chartvalue;
        else initialValue = cfg.scenarioValues?.[initialChoice] ?? 0;
        let reValue;
        if (reChoice === "__NEW__") reValue = cfg.chartvalue;
        else reValue = cfg.scenarioValues?.[reChoice] ?? 0;
        const initKg = initialValue * area;
        const reKg = reValue * area;
        roomData.kgInitial += initKg;
        roomData.kgAfter += reKg;
        roomData.components.push({
          name: def.label, area,
          initialChoice: initialChoice === "__NEW__" ? "New Product" : initialChoice,
          reChoice: reChoice === "__NEW__" ? "New Product" : reChoice,
          initKg, reKg, saved: initKg - reKg
        });
      }
      floorData.kgInitial += roomData.kgInitial;
      floorData.kgAfter += roomData.kgAfter;
      if (roomData.components.length > 0) floorData.byRoom.push(roomData);
    }
    kgInitial += floorData.kgInitial;
    kgAfter += floorData.kgAfter;
    if (floorData.byRoom.length > 0) byFloor.push(floorData);
  }
  const kgSaved = kgInitial - kgAfter;
  const savingsPct = kgInitial > 0 ? (kgSaved / kgInitial) * 100 : 0;
  return { kgInitial, kgAfter, kgSaved, savingsPct, byFloor };
}

function showBuildingTotal() {
  state.scenario.mode = "building-total";
  appRoot.classList.remove("mode-scenario-select");
  appRoot.classList.add("mode-total");
  layoutTotalViewer();
  if (state.viewMode !== "building") setViewMode("building");
  else flyToBuildingOverview();
  const totals = calculateBuildingTotals();
  totalDonut.innerHTML = donutSVG(Math.max(0, totals.savingsPct), 200);
  requestAnimationFrame(() => animateDonuts(totalDonut));
  if (totalPercentEl) totalPercentEl.textContent = `${totals.savingsPct.toFixed(1)}%`;
  totalKgWithoutEl.textContent = `${totals.kgInitial.toFixed(2)} kg`;
  totalKgEl.textContent = `${totals.kgAfter.toFixed(2)} kg`;
  if (totalKgSavedEl) totalKgSavedEl.textContent = `${totals.kgSaved.toFixed(2)} kg`;
  if (totalEbfEl) {
    const ebfRow = totalEbfEl.closest('.metric');
    if (ebfRow) ebfRow.style.display = 'none';
  }
  totalCard.classList.remove("hidden");
  scenarioListEl.innerHTML = `<div style="color: var(--muted);">Building total calculated. Click "Change scenario selection" to edit.</div>`;
  scenarioDescriptionEl.innerHTML = buildBuildingDrilldownHTML(totals);
}

function buildBuildingDrilldownHTML(totals) {
  let html = `
    <div class="desc-title result-main-title">🏢 ${escapeHtml(state.building.name)} — Drilldown</div>
    <div class="desc-item">
      <div class="desc-s">Building Totals</div>
      <div class="desc-b">
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span>Initial CO₂:</span><strong>${totals.kgInitial.toFixed(2)} kg</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span>After RE:</span><strong>${totals.kgAfter.toFixed(2)} kg</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0; color: #79f5dc;">
          <span><b>Saved:</b></span>
          <strong>${totals.kgSaved.toFixed(2)} kg (${totals.savingsPct.toFixed(1)}%)</strong>
        </div>
      </div>
    </div>
  `;
  for (const floorData of totals.byFloor) {
    const floorPct = floorData.kgInitial > 0 
      ? ((floorData.kgInitial - floorData.kgAfter) / floorData.kgInitial) * 100 : 0;
    html += `
      <div class="desc-item" style="border-color: rgba(121,245,220,0.3);">
        <div class="desc-s" style="color: #79f5dc;">🏬 ${escapeHtml(floorData.floorName)}</div>
        <div class="desc-b">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin: 3px 0;">
            <span>Initial:</span><span>${floorData.kgInitial.toFixed(2)} kg</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin: 3px 0;">
            <span>After RE:</span><span>${floorData.kgAfter.toFixed(2)} kg</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin: 3px 0; color: #79f5dc;">
            <span><b>Saved:</b></span><span><b>${(floorData.kgInitial - floorData.kgAfter).toFixed(2)} kg (${floorPct.toFixed(1)}%)</b></span>
          </div>
    `;
    for (const roomData of floorData.byRoom) {
      const roomSaved = roomData.kgInitial - roomData.kgAfter;
      const roomPct = roomData.kgInitial > 0 ? (roomSaved / roomData.kgInitial) * 100 : 0;
      html += `
        <div style="margin: 10px 0 6px 0; padding: 8px 10px; background: rgba(255,255,255,0.025); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="font-weight: 800; font-size: 0.85rem; color: #f1f6ff; margin-bottom: 4px;">
            📦 ${escapeHtml(roomData.roomName)}
          </div>
          <div style="font-size: 0.75rem; color: var(--muted);">
            Initial: ${roomData.kgInitial.toFixed(2)} kg → After RE: ${roomData.kgAfter.toFixed(2)} kg
            <br>
            <strong style="color: #79f5dc;">Saved: ${roomSaved.toFixed(2)} kg (${roomPct.toFixed(1)}%)</strong>
          </div>
      `;
      for (const compData of roomData.components) {
        const compSaved = compData.initKg - compData.reKg;
        html += `
          <div style="margin-top: 6px; padding: 4px 6px; font-size: 0.72rem; background: rgba(0,0,0,0.2); border-radius: 4px;">
            <div style="display: flex; justify-content: space-between;">
              <span><b>${escapeHtml(compData.name)}</b> (${compData.area.toFixed(1)} m²)</span>
              <span style="color: #79f5dc;">−${compSaved.toFixed(2)} kg</span>
            </div>
            <div style="color: var(--muted); margin-top: 2px;">
              ${escapeHtml(compData.initialChoice)} → ${escapeHtml(compData.reChoice)}
            </div>
          </div>
        `;
      }
      html += `</div>`;
    }
    html += `</div></div>`;
  }
  return html;
}

function enterScenarioMode() {
  state.scenario.mode = "scenarios";
  appRoot.classList.add("mode-scenarios");
  appRoot.classList.add("mode-scenario-select");
  appRoot.classList.remove("mode-total");
  scenarioStage.setAttribute("aria-hidden", "false");
  pruneScenarioSelections();
  totalCard.classList.add("hidden");
  if (backToRoomBtn) {
    if (state.scenario.cameFromBuildingScenarios) {
      backToRoomBtn.innerHTML = "← Back to Building Scenarios";
    } else {
      backToRoomBtn.innerHTML = "Back to Room";
    }
  }
  buildScenarioListUI();
}

function exitScenarioMode() {
  if (state.scenario.cameFromBuildingScenarios) {
    state.scenario.cameFromBuildingScenarios = false;
    setViewMode("building");
    enterBuildingScenarioMode();
    return;
  }
  state.scenario.mode = "room";
  scenarioStage.setAttribute("aria-hidden", "true");
  appRoot.classList.remove("mode-scenarios", "mode-scenario-select", "mode-total");
  totalCard.classList.add("hidden");
  totalCard.style.display = "";
  scenarioDescCard.style.display = "";
  clearTotalViewerLayout();
  if (state.viewMode === "building") {
    buildBuildingView();
    flyToBuildingOverview();
    showBuildingViewInstructions();
  } else {
    flyToOutsideView();
  }
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
    scenarioListEl.innerHTML = `<div style="color: var(--muted);">No components selected.</div>`;
    scenarioDescriptionEl.textContent = "Select a component to view scenario descriptions.";
    return;
  }
  for (const comp of selectedComponents) {
    if (!state.scenario.stepByComponent[comp]) state.scenario.stepByComponent[comp] = "initial";
  }
  for (const comp of selectedComponents) {
    const block = document.createElement("div");
    block.className = "comp-scenarios";
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
    const cfg = state.scenario.chartByComponent[comp] || null;
    const chartvalue = cfg?.chartvalue ?? 0;
    if (!Number.isFinite(chartvalue) || chartvalue <= 0) {
      const msg = document.createElement("div");
      msg.style.color = "var(--muted)";
      msg.style.fontSize = "0.85rem";
      msg.textContent = "No scenario data available.";
      block.appendChild(msg);
      scenarioListEl.appendChild(block);
      continue;
    }
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
      const doneWrap = document.createElement("div");
      doneWrap.style.display = "flex";
      doneWrap.style.alignItems = "center";
      doneWrap.style.justifyContent = "center";
      doneWrap.style.gap = "20px";
      doneWrap.style.padding = "20px";
      const initCard = makeFinalCard(comp, initialChoice, "Initial", chartvalue, available);
      doneWrap.appendChild(initCard);
      const arrow = document.createElement("div");
      arrow.style.fontSize = "2rem";
      arrow.style.color = "var(--accent)";
      arrow.style.fontWeight = "900";
      arrow.textContent = "→";
      doneWrap.appendChild(arrow);
      const reCard = makeFinalCard(comp, reChoice, "RE Strategy", chartvalue, available);
      doneWrap.appendChild(reCard);
      const backBtn = document.createElement("button");
      backBtn.className = "btn";
      backBtn.style.marginLeft = "auto";
      backBtn.innerHTML = "← Back";
      backBtn.addEventListener("click", () => {
        if (state.scenario.stepByComponent[comp] === "done") state.scenario.stepByComponent[comp] = "re";
        else if (state.scenario.stepByComponent[comp] === "re") state.scenario.stepByComponent[comp] = "initial";
        buildScenarioListUI();
      });
      doneWrap.appendChild(backBtn);
      block.appendChild(doneWrap);
    } else {
      const stepLabel = document.createElement("div");
      stepLabel.style.color = "var(--muted)";
      stepLabel.style.fontSize = "0.85rem";
      stepLabel.style.marginBottom = "8px";
      stepLabel.style.fontWeight = "700";
      stepLabel.textContent = step === "initial"
        ? "Step 1: Choose INITIAL state"
        : "Step 2: Choose RE Strategy";
      block.appendChild(stepLabel);
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
      for (const item of available) {
        let pct = 0;
        if (Number.isFinite(chartvalue) && chartvalue > 0) pct = 100 - (item.value / chartvalue) * 100;
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
        ring.addEventListener("click", () => handleScenarioClick(comp, item.scenario, step));
        grid.appendChild(ring);
      }
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
      newProdBox.addEventListener("click", () => handleScenarioClick(comp, "__NEW__", step));
      grid.appendChild(newProdBox);
      block.appendChild(grid);
    }
    scenarioListEl.appendChild(block);
    requestAnimationFrame(() => animateDonuts(block));
  }
  const firstComp = selectedComponents[0];
  showDescriptionsForComponent(firstComp, SCENARIOS.filter(s =>
    Number.isFinite(state.scenario.chartByComponent[firstComp]?.scenarioValues?.[s])
  ));
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
  saveToLocalStorage();
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
    let initialValue;
    if (initialChoice === "__NEW__") initialValue = cfg.chartvalue;
    else initialValue = cfg.scenarioValues?.[initialChoice] ?? 0;
    let reValue;
    if (reChoice === "__NEW__") reValue = cfg.chartvalue;
    else reValue = cfg.scenarioValues?.[reChoice] ?? 0;
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

function hexToRgba(hex, a) {
  const c = new THREE.Color(hex);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `rgba(${r},${g},${b},${a})`;
}