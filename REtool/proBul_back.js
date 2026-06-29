// productBuilder.js - Realistic Lindner Product 3D Builders (OPTIMIZED)
import * as THREE from "three";

// ============================================================
// SHARED MATERIALS - Created once, reused everywhere
// ============================================================
let _sharedMats = null;

function getSharedMaterials() {
  if (_sharedMats) return _sharedMats;

  _sharedMats = {
    // Glass partition wall materials
    blackBase: new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0c, metalness: 0.4, roughness: 0.55,
      clearcoat: 0.3, clearcoatRoughness: 0.5,
    }),
    chrome: new THREE.MeshPhysicalMaterial({
      color: 0xd8dce2, metalness: 0.98, roughness: 0.12,
      clearcoat: 0.8, clearcoatRoughness: 0.1,
    }),
    brushedAlum: new THREE.MeshPhysicalMaterial({
      color: 0xb8bcc3, metalness: 0.9, roughness: 0.28, clearcoat: 0.4,
    }),
    darkAlum: new THREE.MeshPhysicalMaterial({
      color: 0x2a2a2c, metalness: 0.85, roughness: 0.35,
      clearcoat: 0.3, clearcoatRoughness: 0.4,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xeaf4fb, metalness: 0.0, roughness: 0.05,
      transparent: true, opacity: 0.25, side: THREE.FrontSide,
      clearcoat: 0.5, clearcoatRoughness: 0.08,
      reflectivity: 0.7, envMapIntensity: 1.5,
    }),
    frostedGlass: new THREE.MeshPhysicalMaterial({
      color: 0xeef2f6, metalness: 0.0, roughness: 0.45,
      transparent: true, opacity: 0.55, side: THREE.FrontSide,
      envMapIntensity: 0.6,
    }),
    seal: new THREE.MeshStandardMaterial({
      color: 0x111114, roughness: 0.9, metalness: 0.0,
    }),
    groove: new THREE.MeshStandardMaterial({
      color: 0x2a2a2e, roughness: 0.6, metalness: 0.5,
    }),

    // Wood materials
    oakWood: new THREE.MeshPhysicalMaterial({
      color: 0xc89968, roughness: 0.6, metalness: 0.0, clearcoat: 0.15,
    }),
    walnutWood: new THREE.MeshPhysicalMaterial({
      color: 0x6b4a30, roughness: 0.65, metalness: 0.0, clearcoat: 0.2,
    }),
    teakWood: new THREE.MeshPhysicalMaterial({
      color: 0xa67043, roughness: 0.55, metalness: 0.0, clearcoat: 0.2,
    }),

    // Floor materials
    calciumPanel: new THREE.MeshStandardMaterial({
      color: 0xe5e3dc, roughness: 0.75, metalness: 0.05,
    }),
    loopMetal: new THREE.MeshPhysicalMaterial({
      color: 0x9aa0a8, roughness: 0.4, metalness: 0.3, clearcoat: 0.4,
    }),
    noritBeige: new THREE.MeshStandardMaterial({
      color: 0xddd8c8, roughness: 0.7, metalness: 0.05,
    }),
    nortecSteel: new THREE.MeshPhysicalMaterial({
      color: 0xb8bcc4, roughness: 0.3, metalness: 0.9, clearcoat: 0.3,
    }),
    floorJoint: new THREE.MeshStandardMaterial({
      color: 0x8a8780, roughness: 0.85, metalness: 0.0,
    }),

    // Ceiling materials
    whitePanel: new THREE.MeshStandardMaterial({
      color: 0xf2f3f5, roughness: 0.55, metalness: 0.05,
    }),
    cleanWhite: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.25, metalness: 0.05, clearcoat: 0.4,
    }),
    perfMetal: new THREE.MeshStandardMaterial({
      color: 0x5a5e66, roughness: 0.6, metalness: 0.7,
    }),
    ceilingDark: new THREE.MeshStandardMaterial({
      color: 0x3a3d44, roughness: 0.7, metalness: 0.3,
    }),

    // Door materials
    doorAlum: new THREE.MeshPhysicalMaterial({
      color: 0xc4c8d0, metalness: 0.85, roughness: 0.35, clearcoat: 0.4,
    }),
    doorHandle: new THREE.MeshPhysicalMaterial({
      color: 0xd0d4dc, metalness: 0.98, roughness: 0.15,
    }),

    // LED
    ledHousing: new THREE.MeshPhysicalMaterial({
      color: 0xe0e2e6, metalness: 0.9, roughness: 0.25,
    }),
    ledGlow: new THREE.MeshStandardMaterial({
      color: 0xfff8e7, emissive: 0xfff0c8, emissiveIntensity: 1.8,
      roughness: 0.3,
    }),

    // Pedestal
    pedBase: new THREE.MeshStandardMaterial({
      color: 0x6c6f75, roughness: 0.5, metalness: 0.6,
    }),
    pedRod: new THREE.MeshStandardMaterial({
      color: 0xa0a4ab, roughness: 0.3, metalness: 0.9,
    }),
    pedHead: new THREE.MeshStandardMaterial({
      color: 0xc5c9d0, roughness: 0.25, metalness: 0.85,
    }),
    pedThread: new THREE.MeshStandardMaterial({
      color: 0x8a8d92, roughness: 0.4, metalness: 0.8,
    }),
  };
  return _sharedMats;
}

// ============================================================
// HELPERS
// ============================================================
function makeBox(w, h, d, mat, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  return mesh;
}

function makeCylinder(rTop, rBot, h, mat, segments = 12, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, segments), mat
  );
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  return mesh;
}

function positionMesh(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

// ============================================================
// 1. GLASS PARTITION WALL (already optimized)
// ============================================================
function buildGlassPartitionWall({ width, height }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const baseHeight = 0.10;
  const baseDepth = 0.09;
  const topChannelH = 0.04;
  const topChannelDepth = 0.08;
  const mullionWidth = 0.05;
  const mullionDepth = 0.08;
  const glassThickness = 0.010;
  const glassGap = 0.060;
  const sealThickness = 0.004;
  const panelW = 1.25;  // Real Lindner panel width

  // BLACK BASE
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, baseHeight, baseDepth), M.blackBase);
  base.position.set(0, baseHeight / 2, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const baseTopEdge = new THREE.Mesh(new THREE.BoxGeometry(width, 0.005, baseDepth - 0.005), M.brushedAlum);
  baseTopEdge.position.set(0, baseHeight + 0.0025, 0);
  g.add(baseTopEdge);

  // TOP CHANNEL
  const topChannel = new THREE.Mesh(new THREE.BoxGeometry(width, topChannelH, topChannelDepth), M.brushedAlum);
  topChannel.position.set(0, height - topChannelH / 2, 0);
  topChannel.castShadow = true;
  g.add(topChannel);

  const mullionH = height - baseHeight - topChannelH;
  const mullionY = baseHeight + mullionH / 2;

  // ===== VERTICAL MULLIONS (every 1.25m) =====
  // End mullions (always present)
  const leftMullion = new THREE.Mesh(new THREE.BoxGeometry(mullionWidth, mullionH, mullionDepth), M.chrome);
  leftMullion.position.set(-width / 2 + mullionWidth / 2, mullionY, 0);
  leftMullion.castShadow = true;
  g.add(leftMullion);

  const rightMullion = new THREE.Mesh(new THREE.BoxGeometry(mullionWidth, mullionH, mullionDepth), M.chrome);
  rightMullion.position.set(width / 2 - mullionWidth / 2, mullionY, 0);
  rightMullion.castShadow = true;
  g.add(rightMullion);

  // INTERNAL MULLIONS - every 1.25m
  const mullionCount = Math.max(0, Math.floor(width / panelW) - 1);
  const mullionSpacing = width / (mullionCount + 1);

  for (let i = 1; i <= mullionCount; i++) {
    const mx = -width / 2 + i * mullionSpacing;
    const internalMullion = new THREE.Mesh(
      new THREE.BoxGeometry(mullionWidth, mullionH, mullionDepth),
      M.chrome
    );
    internalMullion.position.set(mx, mullionY, 0);
    internalMullion.castShadow = true;
    g.add(internalMullion);
  }

  // ===== GLASS PANES (between mullions) =====
  // Calculate panel widths between mullions
  const mullionPositions = [-width / 2 + mullionWidth];
  for (let i = 1; i <= mullionCount; i++) {
    mullionPositions.push(-width / 2 + i * mullionSpacing);
  }
  mullionPositions.push(width / 2 - mullionWidth);

  // Build glass panes between each pair of mullions
  for (let i = 0; i < mullionPositions.length - 1; i++) {
    let panelStart = mullionPositions[i];
    let panelEnd = mullionPositions[i + 1];
    
    // Adjust to be between the mullions, not over them
    if (i === 0) panelStart += mullionWidth;
    if (i < mullionPositions.length - 2) panelEnd -= mullionWidth / 2;
    else panelEnd -= mullionWidth;

    const paneW = panelEnd - panelStart;
    if (paneW <= 0.05) continue;
    const paneX = (panelStart + panelEnd) / 2;

    const glassGeo = new THREE.BoxGeometry(paneW, mullionH, glassThickness);

    // Front pane
    const frontGlass = new THREE.Mesh(glassGeo, M.glass);
    frontGlass.position.set(paneX, mullionY, glassGap / 2 + glassThickness / 2);
    g.add(frontGlass);

    // Back pane
    const backGlass = new THREE.Mesh(glassGeo, M.glass);
    backGlass.position.set(paneX, mullionY, -glassGap / 2 - glassThickness / 2);
    g.add(backGlass);
  }

  return g;
}

// ============================================================
// 2. WOODEN PARTITION WALL (Lindner Logic Timber style)
// ============================================================
// ============================================================
// 2. WOODEN PARTITION WALL (Lindner Logic Timber)
// ============================================================
// ============================================================
// 2. WOODEN PARTITION WALL (Lindner Logic Timber)
// ============================================================
// ============================================================
// 2. WOODEN PARTITION WALL (Lindner Logic Timber)
// ============================================================
// ============================================================
// 2. WOODEN PARTITION WALL (Lindner Logic Timber)
// ============================================================
// ============================================================
// 2. WOODEN PARTITION WALL (Lindner Logic Timber) - Two-sided
// ============================================================
// ============================================================
// 2. WOODEN PARTITION WALL - Solid wooden panels (visible both sides)
// ============================================================
function buildWoodenPartitionWall({ width, height }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const depth = 0.082;
  const baseHeight = 0.08;
  const baseDepth = depth + 0.005;
  const plankW = 1.250;
  const grooveWidth = 0.012;

  // BLACK SKIRTING
  const base = makeBox(width, baseHeight, baseDepth, M.blackBase);
  base.position.set(0, baseHeight / 2, 0);
  g.add(base);

  const baseEdge = makeBox(width, 0.003, baseDepth - 0.005, M.brushedAlum, { castShadow: false });
  baseEdge.position.set(0, baseHeight + 0.0015, 0);
  g.add(baseEdge);

  const woodH = height - baseHeight;
  const woodY = baseHeight + woodH / 2;

  const woodTex = getWoodTexture();

  const plankCount = Math.max(1, Math.round(width / plankW));
  const actualPlankW = width / plankCount;
  const visiblePlankW = actualPlankW - grooveWidth;

  for (let i = 0; i < plankCount; i++) {
    const plankX = -width / 2 + actualPlankW * (i + 0.5);

    // Clone texture per plank
    const plankTex = woodTex.clone();
    plankTex.needsUpdate = true;
    plankTex.wrapS = THREE.ClampToEdgeWrapping;  // ⬅️ CHANGED - no tiling!
    plankTex.wrapT = THREE.ClampToEdgeWrapping;  // ⬅️ CHANGED - no tiling!
    plankTex.colorSpace = THREE.SRGBColorSpace;
    plankTex.offset.set(0, 0);
    plankTex.repeat.set(1, 1);

    const plankMat = new THREE.MeshPhysicalMaterial({
      map: plankTex,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.5,
    });

    const plank = makeBox(visiblePlankW, woodH, depth, plankMat);
    plank.position.set(plankX, woodY, 0);
    g.add(plank);
  }

  // Dark groove strips between planks
  const grooveMat = new THREE.MeshStandardMaterial({
    color: 0x1a1410,
    roughness: 0.95,
    metalness: 0.0
  });

  for (let i = 0; i < plankCount - 1; i++) {
    const gapX = -width / 2 + actualPlankW * (i + 1);
    const groove = makeBox(grooveWidth, woodH, depth - 0.01, grooveMat, { castShadow: false });
    groove.position.set(gapX, woodY, 0);
    g.add(groove);
  }

  return g;
}
// ============================================================
// PROCEDURAL WOOD TEXTURE GENERATOR
// ============================================================
// ============================================================
// PROCEDURAL WOOD TEXTURE (Light Oak - matches Lindner ref)
// ============================================================
let _woodTextureCache = null;

function getWoodTexture() {
  if (_woodTextureCache) return _woodTextureCache;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // ===== Light natural oak base (matches ref photo) =====
  ctx.fillStyle = "#d4ad7a";  // Lighter, more neutral oak
  ctx.fillRect(0, 0, size, size);

  // Subtle vertical color variation (creates the "planked" feel)
  for (let band = 0; band < 6; band++) {
    const bandX = (size / 6) * band + Math.random() * 20;
    const bandW = 40 + Math.random() * 60;
    const lightness = 0.85 + Math.random() * 0.25;
    ctx.fillStyle = `rgba(${Math.round(212 * lightness)}, ${Math.round(173 * lightness)}, ${Math.round(122 * lightness)}, 0.4)`;
    ctx.fillRect(bandX, 0, bandW, size);
  }

  // ===== Long vertical grain lines (THE KEY FEATURE) =====
  // Light grain lines
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * size;
    const opacity = 0.08 + Math.random() * 0.18;
    const lineWidth = 0.4 + Math.random() * 1.8;

    // Slight color variation
    const r = 130 + Math.random() * 40;
    const g = 90 + Math.random() * 30;
    const b = 55 + Math.random() * 25;

    ctx.strokeStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    const freq = 0.003 + Math.random() * 0.008;
    const wave = 1 + Math.random() * 4;
    for (let y = 0; y <= size; y += 4) {
      const wx = x + Math.sin(y * freq) * wave;
      if (y === 0) ctx.moveTo(wx, y);
      else ctx.lineTo(wx, y);
    }
    ctx.stroke();
  }

  // Darker accent grain (creates depth)
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    ctx.strokeStyle = `rgba(90, 55, 30, ${0.10 + Math.random() * 0.15})`;
    ctx.lineWidth = 0.3 + Math.random() * 0.7;
    ctx.beginPath();

    const freq = 0.005 + Math.random() * 0.012;
    const wave = 1 + Math.random() * 3;
    for (let y = 0; y <= size; y += 3) {
      const wx = x + Math.sin(y * freq) * wave;
      if (y === 0) ctx.moveTo(wx, y);
      else ctx.lineTo(wx, y);
    }
    ctx.stroke();
  }

  // ===== Subtle wood knots (sparse - like the modern ref photo) =====
  for (let i = 0; i < 2; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 5 + Math.random() * 10;

    const rg = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    rg.addColorStop(0, "rgba(85, 55, 30, 0.45)");
    rg.addColorStop(0.5, "rgba(120, 80, 50, 0.20)");
    rg.addColorStop(1, "rgba(180, 140, 95, 0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== Subtle film noise for realism =====
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.9));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.8));
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  _woodTextureCache = tex;
  return tex;
}

// ============================================================
// 3. LIGNA - Wood-based raised floor panel
// ============================================================
// 3. LIGNA - Wood-based particleboard raised floor panel
// ============================================================
function buildLignaFloor({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();

  const thickness = 0.028;        // 28mm thick (Ligna B 28)
  const edgeBandW = 0.008;        // 8mm visible black edge

  // Chipboard texture
  const lignaTex = getLignaTexture();
  const topMat = new THREE.MeshStandardMaterial({
    map: lignaTex,
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
  });

  // Black edge banding material (Lindner signature)
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c,
    roughness: 0.6,
    metalness: 0.1,
  });

  // Main panel (chipboard top)
  const innerW = width - edgeBandW * 2;
  const innerD = depth - edgeBandW * 2;
  
  const panel = makeBox(innerW, thickness, innerD, topMat);
  panel.position.y = thickness / 2;
  g.add(panel);

  // BLACK EDGE BANDING (the Lindner signature)
  const edgeFront = makeBox(width, thickness, edgeBandW, edgeMat);
  edgeFront.position.set(0, thickness / 2, depth / 2 - edgeBandW / 2);
  g.add(edgeFront);

  const edgeBack = makeBox(width, thickness, edgeBandW, edgeMat);
  edgeBack.position.set(0, thickness / 2, -depth / 2 + edgeBandW / 2);
  g.add(edgeBack);

  const edgeLeft = makeBox(edgeBandW, thickness, depth - edgeBandW * 2, edgeMat);
  edgeLeft.position.set(-width / 2 + edgeBandW / 2, thickness / 2, 0);
  g.add(edgeLeft);

  const edgeRight = makeBox(edgeBandW, thickness, depth - edgeBandW * 2, edgeMat);
  edgeRight.position.set(width / 2 - edgeBandW / 2, thickness / 2, 0);
  g.add(edgeRight);

  return g;
}

// ============================================================
// 4. FLOOR AND MORE - Calcium sulphate panel
// ============================================================
// ============================================================
// 4. FLOOR and more® - Calcium sulphate raised floor panel
// ============================================================
function buildFloorAndMoreFloor({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();

  const thickness = 0.030;       // 30mm (FLOOR and more® G30)
  const jointDepth = 0.003;      // Visible joint groove depth
  const jointWidth = 0.004;      // 4mm visible joint

  // ===== Panel texture with branding =====
  const floorTex = getFloorAndMoreTexture();
  const topMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: 0xffffff,
    roughness: 0.65,             // Slightly matte
    metalness: 0.0,
  });

  // ===== Edge/side material (slightly darker) =====
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0xe0ddd6,
    roughness: 0.75,
    metalness: 0.0,
  });

  // ===== Dark joint backing (visible in the gaps) =====
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x6a6862,
    roughness: 0.85,
    metalness: 0.0,
  });

  // ===== Main panel (slightly smaller than full size to leave room for joints) =====
  const innerW = width - jointWidth;
  const innerD = depth - jointWidth;

  // Build the panel as a box with branded top
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(innerW, thickness, innerD),
    [
      sideMat,   // right
      sideMat,   // left
      topMat,    // top  ⬅️ this gets the branded texture
      sideMat,   // bottom
      sideMat,   // front
      sideMat,   // back
    ]
  );
  panel.position.y = thickness / 2;
  panel.castShadow = true;
  panel.receiveShadow = true;
  g.add(panel);

  // ===== Dark joint strips around panel edges (visible gap effect) =====
  // Front joint
  const jointFront = makeBox(width, jointDepth, jointWidth, jointMat, { castShadow: false });
  jointFront.position.set(0, thickness - jointDepth / 2, depth / 2 - jointWidth / 2);
  g.add(jointFront);

  // Back joint
  const jointBack = makeBox(width, jointDepth, jointWidth, jointMat, { castShadow: false });
  jointBack.position.set(0, thickness - jointDepth / 2, -depth / 2 + jointWidth / 2);
  g.add(jointBack);

  // Right joint
  const jointRight = makeBox(jointWidth, jointDepth, depth, jointMat, { castShadow: false });
  jointRight.position.set(width / 2 - jointWidth / 2, thickness - jointDepth / 2, 0);
  g.add(jointRight);

  // Left joint
  const jointLeft = makeBox(jointWidth, jointDepth, depth, jointMat, { castShadow: false });
  jointLeft.position.set(-width / 2 + jointWidth / 2, thickness - jointDepth / 2, 0);
  g.add(jointLeft);

  return g;
}

// ============================================================
// 5. LOOP - Premium metallic raised floor
// ============================================================
function buildLoopFloor({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const thickness = 0.032;

  const panel = makeBox(width, thickness, depth, M.loopMetal);
  panel.position.y = thickness / 2;
  g.add(panel);

  // Center texture inset (subtle premium detail)
  const inset = makeBox(width * 0.92, 0.001, depth * 0.92,
    new THREE.MeshPhysicalMaterial({
      color: 0x8e949c, roughness: 0.35, metalness: 0.4, clearcoat: 0.5
    }), { castShadow: false });
  inset.position.set(0, thickness + 0.0005, 0);
  g.add(inset);

  return g;
}

// ============================================================
// 6. NORIT - Light beige raised floor
// ============================================================
function buildNoritFloor({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const thickness = 0.025;

  const panel = makeBox(width, thickness, depth, M.noritBeige);
  panel.position.y = thickness / 2;
  g.add(panel);

  // Aluminum edge band on all sides
  const edgeT = 0.005;
  const edgeH = thickness;
  const edges = [
    { w: width, d: edgeT, x: 0, z: depth / 2 - edgeT / 2 },
    { w: width, d: edgeT, x: 0, z: -depth / 2 + edgeT / 2 },
    { w: edgeT, d: depth, x: width / 2 - edgeT / 2, z: 0 },
    { w: edgeT, d: depth, x: -width / 2 + edgeT / 2, z: 0 },
  ];

  for (const e of edges) {
    const edge = makeBox(e.w, edgeH + 0.001, e.d, M.darkAlum, { castShadow: false });
    edge.position.set(e.x, thickness / 2, e.z);
    g.add(edge);
  }

  return g;
}

// ============================================================
// 7. NORTEC - Steel-encapsulated panel
// ============================================================
function buildNortecFloor({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const thickness = 0.038;

  // Steel outer shell
  const panel = makeBox(width, thickness, depth, M.nortecSteel);
  panel.position.y = thickness / 2;
  g.add(panel);

  // Top surface texture (slightly different shade for depth)
  const surface = makeBox(width - 0.005, 0.002, depth - 0.005,
    new THREE.MeshPhysicalMaterial({
      color: 0xa8acb4, roughness: 0.4, metalness: 0.7, clearcoat: 0.3
    }), { castShadow: false });
  surface.position.set(0, thickness + 0.001, 0);
  g.add(surface);

  // Subtle joint lines
  const joint = makeBox(width, thickness + 0.001, 0.002, M.darkAlum, { castShadow: false });
  joint.position.set(0, thickness / 2, depth / 2 - 0.001);
  g.add(joint);

  return g;
}

// ============================================================
// CEILING BUILDERS (8-15)
// ============================================================

// 8. GRID CEILING - T-bar grid system
function buildGridCeiling({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  // White inner panel
  const panel = makeBox(width - 0.025, 0.012, depth - 0.025, M.whitePanel);
  panel.position.y = 0;
  g.add(panel);

  // T-bar grid frame (4 sides)
  const barH = 0.018;
  const barT = 0.012;
  const t1 = makeBox(width, barH, barT, M.brushedAlum, { castShadow: false });
  t1.position.set(0, 0, depth / 2 - barT / 2);
  g.add(t1);
  const t2 = t1.clone();
  t2.position.z = -depth / 2 + barT / 2;
  g.add(t2);
  const t3 = makeBox(barT, barH, depth, M.brushedAlum, { castShadow: false });
  t3.position.set(width / 2 - barT / 2, 0, 0);
  g.add(t3);
  const t4 = t3.clone();
  t4.position.x = -width / 2 + barT / 2;
  g.add(t4);

  return g;
}

// 9. CEILING PANEL - Smooth metal panel
function buildCeilingPanel({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const panel = makeBox(width, 0.015, depth, M.whitePanel);
  g.add(panel);

  // Subtle reveal line on edges
  const revealMat = M.ceilingDark;
  const r1 = makeBox(width, 0.016, 0.0025, revealMat, { castShadow: false });
  r1.position.set(0, 0, depth / 2 - 0.00125);
  g.add(r1);

  const r2 = r1.clone();
  r2.position.z = -depth / 2 + 0.00125;
  g.add(r2);

  return g;
}

// 10. SUSPENDED CEILING - Acoustic panel
// ============================================================
// 10. SUSPENDED CEILING - Lindner overlapping rectangular panels
// ============================================================
function buildSuspendedCeiling({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();

  const panelThickness = 0.018;
  const jointWidth = 0.003;       // Thin joint line (~3mm)
  const jointDepth = 0.004;       // Slightly recessed groove

  // ===== Main panel material - subtle perforated white look =====
  const panelTex = getSuspendedCeilingTexture();
  const panelMat = new THREE.MeshStandardMaterial({
    map: panelTex,
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.05,
  });

  // ===== Dark joint material (visible recess between panels) =====
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x5a5e64,
    roughness: 0.8,
    metalness: 0.1,
  });

  // ===== Main panel body (slightly inset to make room for joint reveals) =====
  const innerW = width - jointWidth;
  const innerD = depth - jointWidth;

  const panel = makeBox(innerW, panelThickness, innerD, panelMat);
  panel.position.y = 0;
  g.add(panel);

  // ===== Joint reveals (4 sides — slim dark lines) =====
  // Front joint
  const jointFront = makeBox(width, panelThickness + 0.001, jointWidth, jointMat, { castShadow: false });
  jointFront.position.set(0, -jointDepth / 2, depth / 2 - jointWidth / 2);
  g.add(jointFront);

  // Back joint
  const jointBack = makeBox(width, panelThickness + 0.001, jointWidth, jointMat, { castShadow: false });
  jointBack.position.set(0, -jointDepth / 2, -depth / 2 + jointWidth / 2);
  g.add(jointBack);

  // Right joint
  const jointRight = makeBox(jointWidth, panelThickness + 0.001, depth, jointMat, { castShadow: false });
  jointRight.position.set(width / 2 - jointWidth / 2, -jointDepth / 2, 0);
  g.add(jointRight);

  // Left joint
  const jointLeft = makeBox(jointWidth, panelThickness + 0.001, depth, jointMat, { castShadow: false });
  jointLeft.position.set(-width / 2 + jointWidth / 2, -jointDepth / 2, 0);
  g.add(jointLeft);

  return g;
}

// 11. CASSETTE CEILING - Recessed tray
function buildCassetteCeiling({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  // Outer tray frame
  const trayH = 0.025;
  const tray = makeBox(width, trayH, depth, M.brushedAlum);
  g.add(tray);

  // Inner recessed panel (slightly raised from top of tray)
  const inner = makeBox(width - 0.04, 0.018, depth - 0.04,
    new THREE.MeshStandardMaterial({
      color: 0xdcdfe3, roughness: 0.5, metalness: 0.4
    }), { castShadow: false });
  inner.position.y = -0.003;
  g.add(inner);

  return g;
}

// 12. EXPANDED METAL CEILING - Mesh pattern
function buildExpandedMetalCeiling({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  // Dark backing for depth
  const back = makeBox(width, 0.005, depth, M.ceilingDark, { castShadow: false });
  back.position.y = -0.008;
  g.add(back);

  // Perforated metal sheet
  const panel = makeBox(width, 0.012, depth, M.perfMetal);
  g.add(panel);

  // Subtle hole pattern hint (using small dark squares - much fewer than before)
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const step = 0.10;
  for (let x = -width / 2 + step / 2; x < width / 2; x += step) {
    for (let z = -depth / 2 + step / 2; z < depth / 2; z += step) {
      const hole = makeBox(0.018, 0.013, 0.018, holeMat, { castShadow: false });
      hole.position.set(x, 0, z);
      g.add(hole);
    }
  }

  return g;
}

// 13. LAMELLA CEILING - Linear slats
function buildLamellaCeiling({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  // Dark backing
  const back = makeBox(width, 0.005, depth, M.ceilingDark, { castShadow: false });
  back.position.y = -0.025;
  g.add(back);

  // Aluminum slats
  const slatW = 0.04;
  const gap = 0.025;
  const slatCount = Math.floor(depth / (slatW + gap));
  const totalUsed = slatCount * (slatW + gap) - gap;
  const startZ = -totalUsed / 2 + slatW / 2;

  for (let i = 0; i < slatCount; i++) {
    const slat = makeBox(width, 0.035, slatW, M.brushedAlum);
    slat.position.set(0, 0, startZ + i * (slatW + gap));
    g.add(slat);
  }

  return g;
}

// 14. TORSION SPRING CEILING - Hook-on white panel
function buildTorsionSpringCeiling({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const panel = makeBox(width, 0.020, depth, M.cleanWhite);
  g.add(panel);

  // Reveal joints on all 4 sides
  const revealT = 0.004;
  const r1 = makeBox(width, 0.022, revealT, M.ceilingDark, { castShadow: false });
  r1.position.set(0, 0, depth / 2 - revealT / 2);
  g.add(r1);

  const r2 = r1.clone();
  r2.position.z = -depth / 2 + revealT / 2;
  g.add(r2);

  const r3 = makeBox(revealT, 0.022, depth, M.ceilingDark, { castShadow: false });
  r3.position.set(width / 2 - revealT / 2, 0, 0);
  g.add(r3);

  const r4 = r3.clone();
  r4.position.x = -width / 2 + revealT / 2;
  g.add(r4);

  return g;
}

// 15. CLEAN ROOM CEILING - High-purity flush panel
function buildCleanRoomCeiling({ width = 0.6, depth = 0.6 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const panel = makeBox(width, 0.025, depth, M.cleanWhite);
  g.add(panel);

  // Silicone sealed joints (subtle grey lines)
  const sealMat = new THREE.MeshStandardMaterial({ color: 0xc0c4ca, roughness: 0.7 });
  const sealT = 0.003;

  const s1 = makeBox(width, 0.026, sealT, sealMat, { castShadow: false });
  s1.position.set(0, 0, depth / 2 - sealT / 2);
  g.add(s1);

  const s2 = s1.clone();
  s2.position.z = -depth / 2 + sealT / 2;
  g.add(s2);

  return g;
}

// ============================================================
// DOOR BUILDERS (16-19)
// ============================================================

// 16. GLASS DOOR 1-LEAF (GTB style - frameless glass)
// ============================================================
// 16. GLASS DOOR 1-LEAF (Lindner GTB style)
// ============================================================
function buildGlassDoor1Leaf({ width, height }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  // ===== Dimensions matching real Lindner GTB =====
  const frameW = 0.045;          // 4.5cm frame width
  const frameD = 0.06;            // 6cm frame depth
  const glassThickness = 0.010;   // 10mm glass

  // ===== Materials =====
  // Brushed aluminum frame (matches reference - silver/grey)
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0xc8ccd1,
    metalness: 0.85,
    roughness: 0.25,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
  });

  // Polished chrome for hardware
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0e3e8,
    metalness: 0.98,
    roughness: 0.1,
    clearcoat: 0.9,
  });

  // Dark grey for handle grip (matte aluminum)
  const handleMat = new THREE.MeshPhysicalMaterial({
    color: 0x8a8d92,
    metalness: 0.9,
    roughness: 0.3,
  });

  // ===== 1. FRAME (4 sides) =====
  // Top frame
  const frameTop = makeBox(width, frameW, frameD, frameMat);
  frameTop.position.set(0, height - frameW / 2, 0);
  g.add(frameTop);

  // Bottom frame (threshold)
  const frameBot = makeBox(width, frameW, frameD, frameMat);
  frameBot.position.set(0, frameW / 2, 0);
  g.add(frameBot);

  // Left frame (hinge side)
  const frameL = makeBox(frameW, height, frameD, frameMat);
  frameL.position.set(-width / 2 + frameW / 2, height / 2, 0);
  g.add(frameL);

  // Right frame (handle side)
  const frameR = makeBox(frameW, height, frameD, frameMat);
  frameR.position.set(width / 2 - frameW / 2, height / 2, 0);
  g.add(frameR);

  // ===== 2. GLASS PANE =====
  const glassW = width - frameW * 2 - 0.01;
  const glassH = height - frameW * 2 - 0.01;
  const glass = makeBox(glassW, glassH, glassThickness, M.glass);
  glass.position.set(0, height / 2, 0);
  g.add(glass);

  // ===== 3. HINGES (3 hinges on left side) =====
  const hingeMat = chromeMat;
  const hingeW = 0.015;
  const hingeH = 0.10;
  const hingeD = 0.05;

  const hingePositions = [
    height * 0.15,   // Bottom hinge
    height * 0.50,   // Middle hinge
    height * 0.85,   // Top hinge
  ];

  for (const hy of hingePositions) {
    const hinge = makeBox(hingeW, hingeH, hingeD, hingeMat);
    hinge.position.set(-width / 2 + frameW / 2 - hingeW / 2 + 0.005, hy, 0);
    g.add(hinge);

    // Hinge pin (cylindrical detail)
    const pin = makeCylinder(0.006, 0.006, hingeH * 1.15, chromeMat, 12);
    pin.position.set(-width / 2 - 0.005, hy, 0);
    g.add(pin);
  }

  // ===== 4. HORIZONTAL HANDLE (like the reference) =====
  // Handle is positioned at typical hip height (~1m from floor)
  const handleY = Math.min(1.05, height * 0.5);
  const handleLength = 0.16;            // 16cm horizontal handle
  const handleDiameter = 0.022;
  const handleOffset = 0.04;             // Handle sticks out from door

  // Handle support plate (the rectangular escutcheon on the door)
  const platePlate = makeBox(0.06, 0.18, 0.008, chromeMat);
  platePlate.position.set(width / 2 - 0.10, handleY, frameD / 2 - 0.001);
  g.add(platePlate);

  // Handle bar (horizontal, sticks out toward viewer)
  const handleBar = makeCylinder(handleDiameter / 2, handleDiameter / 2, handleLength, handleMat, 16);
  handleBar.rotation.z = Math.PI / 2;    // Make horizontal
  handleBar.position.set(width / 2 - 0.10 - handleLength / 2, handleY, frameD / 2 + handleOffset);
  g.add(handleBar);

  // Handle support arm (connects bar to plate)
  const handleArm = makeCylinder(0.012, 0.012, handleOffset, handleMat, 12);
  handleArm.position.set(width / 2 - 0.10, handleY, frameD / 2 + handleOffset / 2);
  g.add(handleArm);

  // Second handle support (at the end of the bar)
  const handleArm2 = makeCylinder(0.012, 0.012, handleOffset, handleMat, 12);
  handleArm2.position.set(width / 2 - 0.10 - handleLength, handleY, frameD / 2 + handleOffset / 2);
  g.add(handleArm2);

  // ===== 5. LOCK CYLINDER (below the handle) =====
  const lockY = handleY - 0.08;
  const lockBody = makeCylinder(0.012, 0.012, 0.015, chromeMat, 16);
  lockBody.rotation.x = Math.PI / 2;
  lockBody.position.set(width / 2 - 0.10, lockY, frameD / 2 + 0.005);
  g.add(lockBody);

  // Lock keyhole detail
  const keyhole = makeCylinder(0.004, 0.004, 0.005, 
    new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), 12);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(width / 2 - 0.10, lockY, frameD / 2 + 0.015);
  g.add(keyhole);

  // ===== 6. Mirror handle on the BACK side =====
  // (because doors are visible from both sides)
  const backPlate = makeBox(0.06, 0.18, 0.008, chromeMat);
  backPlate.position.set(width / 2 - 0.10, handleY, -frameD / 2 + 0.001);
  g.add(backPlate);

  const backHandleBar = makeCylinder(handleDiameter / 2, handleDiameter / 2, handleLength, handleMat, 16);
  backHandleBar.rotation.z = Math.PI / 2;
  backHandleBar.position.set(width / 2 - 0.10 - handleLength / 2, handleY, -frameD / 2 - handleOffset);
  g.add(backHandleBar);

  const backArm = makeCylinder(0.012, 0.012, handleOffset, handleMat, 12);
  backArm.position.set(width / 2 - 0.10, handleY, -frameD / 2 - handleOffset / 2);
  g.add(backArm);

  const backArm2 = makeCylinder(0.012, 0.012, handleOffset, handleMat, 12);
  backArm2.position.set(width / 2 - 0.10 - handleLength, handleY, -frameD / 2 - handleOffset / 2);
  g.add(backArm2);

  return g;
}

// 17. GLASS DOOR 2-LEAF (double glass)
// ============================================================
// 17. GLASS DOOR 2-LEAF (Active + Fixed/Passive leaf)
// ============================================================
function buildGlassDoor2Leaf({ width, height }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  // ===== Dimensions =====
  const frameW = 0.045;
  const frameD = 0.06;
  const glassThickness = 0.010;
  const centerMullionW = 0.06;       // Wider center post between leaves
  const leafGap = 0.005;               // Small gap between leaves

  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0xc8ccd1, metalness: 0.85, roughness: 0.25,
    clearcoat: 0.5, clearcoatRoughness: 0.2,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0e3e8, metalness: 0.98, roughness: 0.1, clearcoat: 0.9,
  });

  const handleMat = new THREE.MeshPhysicalMaterial({
    color: 0x8a8d92, metalness: 0.9, roughness: 0.3,
  });

  // ===== Outer frame (around both leaves) =====
  const frameTop = makeBox(width, frameW, frameD, frameMat);
  frameTop.position.set(0, height - frameW / 2, 0);
  g.add(frameTop);

  const frameBot = makeBox(width, frameW, frameD, frameMat);
  frameBot.position.set(0, frameW / 2, 0);
  g.add(frameBot);

  const frameL = makeBox(frameW, height, frameD, frameMat);
  frameL.position.set(-width / 2 + frameW / 2, height / 2, 0);
  g.add(frameL);

  const frameR = makeBox(frameW, height, frameD, frameMat);
  frameR.position.set(width / 2 - frameW / 2, height / 2, 0);
  g.add(frameR);

  // ===== Center mullion (the post between the two leaves) =====
  const centerMullion = makeBox(centerMullionW, height - frameW * 2, frameD, frameMat);
  centerMullion.position.set(0, height / 2, 0);
  g.add(centerMullion);

  // ===== Calculate leaf positions =====
  const leafW = (width - frameW * 2 - centerMullionW) / 2 - leafGap;
  const leftLeafX = -width / 2 + frameW + leafW / 2;
  const rightLeafX = width / 2 - frameW - leafW / 2;
  const leafH = height - frameW * 2;
  const leafY = frameW + leafH / 2;

  // ===== LEFT LEAF: FIXED/PASSIVE (no handle, no hinge cylinder) =====
  // Subtle inner frame around the glass
  const fixedFrameW = 0.025;
  
  // Fixed leaf inner frame (thinner)
  const fixedTop = makeBox(leafW, fixedFrameW, frameD - 0.005, frameMat);
  fixedTop.position.set(leftLeafX, leafY + leafH / 2 - fixedFrameW / 2, 0);
  g.add(fixedTop);

  const fixedBot = makeBox(leafW, fixedFrameW, frameD - 0.005, frameMat);
  fixedBot.position.set(leftLeafX, leafY - leafH / 2 + fixedFrameW / 2, 0);
  g.add(fixedBot);

  const fixedLeft = makeBox(fixedFrameW, leafH, frameD - 0.005, frameMat);
  fixedLeft.position.set(leftLeafX - leafW / 2 + fixedFrameW / 2, leafY, 0);
  g.add(fixedLeft);

  const fixedRight = makeBox(fixedFrameW, leafH, frameD - 0.005, frameMat);
  fixedRight.position.set(leftLeafX + leafW / 2 - fixedFrameW / 2, leafY, 0);
  g.add(fixedRight);

  // Fixed leaf glass
  const fixedGlassW = leafW - fixedFrameW * 2;
  const fixedGlassH = leafH - fixedFrameW * 2;
  const fixedGlass = makeBox(fixedGlassW, fixedGlassH, glassThickness, M.glass);
  fixedGlass.position.set(leftLeafX, leafY, 0);
  g.add(fixedGlass);

  // Small "fixed" indicator: a slim bolt at top and bottom (typical hardware)
  const fixedBolt1 = makeCylinder(0.005, 0.005, 0.025, chromeMat, 8);
  fixedBolt1.position.set(leftLeafX + leafW / 2 - 0.01, leafY + leafH * 0.45, frameD / 2);
  g.add(fixedBolt1);

  const fixedBolt2 = makeCylinder(0.005, 0.005, 0.025, chromeMat, 8);
  fixedBolt2.position.set(leftLeafX + leafW / 2 - 0.01, leafY - leafH * 0.45, frameD / 2);
  g.add(fixedBolt2);

  // ===== RIGHT LEAF: ACTIVE (with handle, hinges, lock) =====
  // Active leaf inner frame
  const activeTop = makeBox(leafW, fixedFrameW, frameD - 0.005, frameMat);
  activeTop.position.set(rightLeafX, leafY + leafH / 2 - fixedFrameW / 2, 0);
  g.add(activeTop);

  const activeBot = makeBox(leafW, fixedFrameW, frameD - 0.005, frameMat);
  activeBot.position.set(rightLeafX, leafY - leafH / 2 + fixedFrameW / 2, 0);
  g.add(activeBot);

  const activeLeft = makeBox(fixedFrameW, leafH, frameD - 0.005, frameMat);
  activeLeft.position.set(rightLeafX - leafW / 2 + fixedFrameW / 2, leafY, 0);
  g.add(activeLeft);

  const activeRight = makeBox(fixedFrameW, leafH, frameD - 0.005, frameMat);
  activeRight.position.set(rightLeafX + leafW / 2 - fixedFrameW / 2, leafY, 0);
  g.add(activeRight);

  // Active leaf glass
  const activeGlass = makeBox(fixedGlassW, fixedGlassH, glassThickness, M.glass);
  activeGlass.position.set(rightLeafX, leafY, 0);
  g.add(activeGlass);

  // Hinges on the RIGHT side of active leaf (against the right frame)
  const hingeMat = chromeMat;
  const hingeW = 0.012;
  const hingeH = 0.08;
  const hingeD = 0.045;
  const hingePositions = [height * 0.18, height * 0.50, height * 0.82];

  for (const hy of hingePositions) {
    const hinge = makeBox(hingeW, hingeH, hingeD, hingeMat);
    hinge.position.set(rightLeafX + leafW / 2 + 0.005, hy, 0);
    g.add(hinge);
  }

  // HANDLE on the LEFT side of active leaf (closest to center mullion)
  const handleY = Math.min(1.05, height * 0.45);
  const handleLength = 0.13;
  const handleDiameter = 0.020;
  const handleOffset = 0.04;
  const handleX = rightLeafX - leafW / 2 + 0.05;

  // Handle plate
  const handlePlate = makeBox(0.05, 0.15, 0.006, chromeMat);
  handlePlate.position.set(handleX, handleY, frameD / 2 - 0.001);
  g.add(handlePlate);

  // Horizontal handle bar
  const handleBar = makeCylinder(handleDiameter / 2, handleDiameter / 2, handleLength, handleMat, 12);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(handleX - handleLength / 2 + 0.02, handleY, frameD / 2 + handleOffset);
  g.add(handleBar);

  // Handle support arms
  const arm1 = makeCylinder(0.009, 0.009, handleOffset, handleMat, 8);
  arm1.position.set(handleX + 0.02, handleY, frameD / 2 + handleOffset / 2);
  g.add(arm1);

  const arm2 = makeCylinder(0.009, 0.009, handleOffset, handleMat, 8);
  arm2.position.set(handleX - handleLength + 0.02, handleY, frameD / 2 + handleOffset / 2);
  g.add(arm2);

  // Lock cylinder below handle
  const lockY = handleY - 0.08;
  const lockBody = makeCylinder(0.011, 0.011, 0.012, chromeMat, 12);
  lockBody.rotation.x = Math.PI / 2;
  lockBody.position.set(handleX, lockY, frameD / 2 + 0.004);
  g.add(lockBody);

  // Mirror handle on BACK side of active leaf
  const handlePlateBack = makeBox(0.05, 0.15, 0.006, chromeMat);
  handlePlateBack.position.set(handleX, handleY, -frameD / 2 + 0.001);
  g.add(handlePlateBack);

  const handleBarBack = makeCylinder(handleDiameter / 2, handleDiameter / 2, handleLength, handleMat, 12);
  handleBarBack.rotation.z = Math.PI / 2;
  handleBarBack.position.set(handleX - handleLength / 2 + 0.02, handleY, -frameD / 2 - handleOffset);
  g.add(handleBarBack);

  const arm1Back = makeCylinder(0.009, 0.009, handleOffset, handleMat, 8);
  arm1Back.position.set(handleX + 0.02, handleY, -frameD / 2 - handleOffset / 2);
  g.add(arm1Back);

  const arm2Back = makeCylinder(0.009, 0.009, handleOffset, handleMat, 8);
  arm2Back.position.set(handleX - handleLength + 0.02, handleY, -frameD / 2 - handleOffset / 2);
  g.add(arm2Back);

  return g;
}

// 18. ALUMINUM DOOR 1-LEAF (ATB style)
// ============================================================
// 18. ALUMINUM DOOR 1-LEAF (Lindner ATB style)
// ============================================================
function buildAluminumDoor1Leaf({ width, height }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  // ===== Dimensions =====
  const frameW = 0.06;            // 6cm thick aluminum frame
  const frameD = 0.068;            // 68mm depth (ATB 68 model)
  const glassThickness = 0.012;
  const innerFrameW = 0.025;

  // ===== Materials - ANTHRACITE (dark grey - real Lindner color) =====
  const anthraciteFrame = new THREE.MeshPhysicalMaterial({
    color: 0x3a3e44,                // Dark anthracite (RAL 7016)
    metalness: 0.55,
    roughness: 0.45,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xc8ccd2,
    metalness: 0.95,
    roughness: 0.15,
    clearcoat: 0.6,
  });

  const handleMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8acb2,
    metalness: 0.9,
    roughness: 0.25,
  });

  // ===== 1. OUTER FRAME (4 sides) =====
  const frameTop = makeBox(width, frameW, frameD, anthraciteFrame);
  frameTop.position.set(0, height - frameW / 2, 0);
  g.add(frameTop);

  const frameBot = makeBox(width, frameW, frameD, anthraciteFrame);
  frameBot.position.set(0, frameW / 2, 0);
  g.add(frameBot);

  const frameL = makeBox(frameW, height, frameD, anthraciteFrame);
  frameL.position.set(-width / 2 + frameW / 2, height / 2, 0);
  g.add(frameL);

  const frameR = makeBox(frameW, height, frameD, anthraciteFrame);
  frameR.position.set(width / 2 - frameW / 2, height / 2, 0);
  g.add(frameR);

  // ===== 2. INNER FRAME around glass (slightly raised, gives depth) =====
  const innerY = frameW + (height - frameW * 2) / 2;
  const innerH = height - frameW * 2;
  
  // Top inner frame
  const innerTop = makeBox(width - frameW * 2, innerFrameW, frameD - 0.005, anthraciteFrame);
  innerTop.position.set(0, height - frameW - innerFrameW / 2, frameD * 0.02);
  g.add(innerTop);

  // Bottom inner frame
  const innerBot = makeBox(width - frameW * 2, innerFrameW, frameD - 0.005, anthraciteFrame);
  innerBot.position.set(0, frameW + innerFrameW / 2, frameD * 0.02);
  g.add(innerBot);

  // Left inner frame
  const innerL = makeBox(innerFrameW, innerH - innerFrameW * 2, frameD - 0.005, anthraciteFrame);
  innerL.position.set(-width / 2 + frameW + innerFrameW / 2, innerY, frameD * 0.02);
  g.add(innerL);

  // Right inner frame
  const innerR = makeBox(innerFrameW, innerH - innerFrameW * 2, frameD - 0.005, anthraciteFrame);
  innerR.position.set(width / 2 - frameW - innerFrameW / 2, innerY, frameD * 0.02);
  g.add(innerR);

  // ===== 3. GLASS PANEL (full height like reference) =====
  const glassW = width - frameW * 2 - innerFrameW * 2;
  const glassH = innerH - innerFrameW * 2;
  const glass = makeBox(glassW, glassH, glassThickness, M.glass);
  glass.position.set(0, innerY, 0);
  g.add(glass);

  // ===== 4. HINGES (3 hinges on LEFT side) =====
  const hingeW = 0.018;
  const hingeH = 0.10;
  const hingeD = 0.055;

  const hingePositions = [
    height * 0.15,
    height * 0.50,
    height * 0.85,
  ];

  for (const hy of hingePositions) {
    const hinge = makeBox(hingeW, hingeH, hingeD, chromeMat);
    hinge.position.set(-width / 2 + frameW / 2 - hingeW / 2 + 0.008, hy, 0);
    g.add(hinge);

    // Hinge knuckle (cylindrical part visible at side)
    const knuckle = makeCylinder(0.012, 0.012, hingeH * 1.1, chromeMat, 12);
    knuckle.position.set(-width / 2 - 0.002, hy, 0);
    g.add(knuckle);
  }

  // ===== 5. LEVER HANDLE (not pull bar - real ATB uses lever) =====
  const handleY = Math.min(1.05, height * 0.45);
  const handleX = width / 2 - frameW / 2 - 0.04;  // Near right edge

  // Rosette (circular plate behind handle)
  const rosetteFront = makeCylinder(0.032, 0.032, 0.008, chromeMat, 24);
  rosetteFront.rotation.x = Math.PI / 2;
  rosetteFront.position.set(handleX, handleY, frameD / 2 + 0.004);
  g.add(rosetteFront);

  // Lever arm horizontal
  const leverLength = 0.11;
  const leverShaft = makeCylinder(0.009, 0.009, leverLength, handleMat, 12);
  leverShaft.rotation.z = Math.PI / 2;
  leverShaft.position.set(handleX - leverLength / 2 - 0.005, handleY, frameD / 2 + 0.025);
  g.add(leverShaft);

  // Lever connector (the small cylinder going through the rosette)
  const leverConnector = makeCylinder(0.011, 0.011, 0.025, handleMat, 12);
  leverConnector.rotation.x = Math.PI / 2;
  leverConnector.position.set(handleX, handleY, frameD / 2 + 0.018);
  g.add(leverConnector);

  // Lever end cap (slight ball at end)
  const leverEnd = makeCylinder(0.011, 0.009, 0.015, handleMat, 12);
  leverEnd.rotation.z = Math.PI / 2;
  leverEnd.position.set(handleX - leverLength - 0.005, handleY, frameD / 2 + 0.025);
  g.add(leverEnd);

  // ===== 6. LOCK CYLINDER (below handle) =====
  const lockY = handleY - 0.07;
  
  // Lock rosette
  const lockRosette = makeCylinder(0.022, 0.022, 0.006, chromeMat, 16);
  lockRosette.rotation.x = Math.PI / 2;
  lockRosette.position.set(handleX, lockY, frameD / 2 + 0.003);
  g.add(lockRosette);

  // Lock cylinder body
  const lockBody = makeCylinder(0.013, 0.013, 0.010, chromeMat, 16);
  lockBody.rotation.x = Math.PI / 2;
  lockBody.position.set(handleX, lockY, frameD / 2 + 0.011);
  g.add(lockBody);

  // Keyhole (dark center)
  const keyhole = makeCylinder(0.004, 0.004, 0.003, 
    new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), 8);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(handleX, lockY, frameD / 2 + 0.017);
  g.add(keyhole);

  // ===== 7. Mirror handle + lock on BACK side =====
  // Back rosette
  const rosetteBack = makeCylinder(0.032, 0.032, 0.008, chromeMat, 24);
  rosetteBack.rotation.x = Math.PI / 2;
  rosetteBack.position.set(handleX, handleY, -frameD / 2 - 0.004);
  g.add(rosetteBack);

  // Back lever
  const leverBack = makeCylinder(0.009, 0.009, leverLength, handleMat, 12);
  leverBack.rotation.z = Math.PI / 2;
  leverBack.position.set(handleX - leverLength / 2 - 0.005, handleY, -frameD / 2 - 0.025);
  g.add(leverBack);

  const leverConnBack = makeCylinder(0.011, 0.011, 0.025, handleMat, 12);
  leverConnBack.rotation.x = Math.PI / 2;
  leverConnBack.position.set(handleX, handleY, -frameD / 2 - 0.018);
  g.add(leverConnBack);

  const leverEndBack = makeCylinder(0.011, 0.009, 0.015, handleMat, 12);
  leverEndBack.rotation.z = Math.PI / 2;
  leverEndBack.position.set(handleX - leverLength - 0.005, handleY, -frameD / 2 - 0.025);
  g.add(leverEndBack);

  // Back lock
  const lockRosetteBack = makeCylinder(0.022, 0.022, 0.006, chromeMat, 16);
  lockRosetteBack.rotation.x = Math.PI / 2;
  lockRosetteBack.position.set(handleX, lockY, -frameD / 2 - 0.003);
  g.add(lockRosetteBack);

  const lockBodyBack = makeCylinder(0.013, 0.013, 0.010, chromeMat, 16);
  lockBodyBack.rotation.x = Math.PI / 2;
  lockBodyBack.position.set(handleX, lockY, -frameD / 2 - 0.011);
  g.add(lockBodyBack);

  return g;
}

// 19. ALUMINUM DOOR 2-LEAF
// ============================================================
// 19. ALUMINUM DOOR 2-LEAF (Lindner ATB - Active + Fixed)
// ============================================================
function buildAluminumDoor2Leaf({ width, height }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  // ===== Dimensions =====
  const frameW = 0.06;
  const frameD = 0.068;
  const glassThickness = 0.012;
  const innerFrameW = 0.025;
  const centerMullionW = 0.07;
  const leafGap = 0.005;

  // ===== Materials (anthracite to match 1-leaf) =====
  const anthraciteFrame = new THREE.MeshPhysicalMaterial({
    color: 0x3a3e44,
    metalness: 0.55,
    roughness: 0.45,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xc8ccd2,
    metalness: 0.95,
    roughness: 0.15,
    clearcoat: 0.6,
  });

  const handleMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8acb2,
    metalness: 0.9,
    roughness: 0.25,
  });

  // ===== 1. OUTER FRAME =====
  const frameTop = makeBox(width, frameW, frameD, anthraciteFrame);
  frameTop.position.set(0, height - frameW / 2, 0);
  g.add(frameTop);

  const frameBot = makeBox(width, frameW, frameD, anthraciteFrame);
  frameBot.position.set(0, frameW / 2, 0);
  g.add(frameBot);

  const frameL = makeBox(frameW, height, frameD, anthraciteFrame);
  frameL.position.set(-width / 2 + frameW / 2, height / 2, 0);
  g.add(frameL);

  const frameR = makeBox(frameW, height, frameD, anthraciteFrame);
  frameR.position.set(width / 2 - frameW / 2, height / 2, 0);
  g.add(frameR);

  // ===== 2. CENTER MULLION =====
  const centerMullion = makeBox(centerMullionW, height - frameW * 2, frameD, anthraciteFrame);
  centerMullion.position.set(0, height / 2, 0);
  g.add(centerMullion);

  // ===== Calculate leaf positions =====
  const leafW = (width - frameW * 2 - centerMullionW) / 2 - leafGap;
  const leftLeafX = -width / 2 + frameW + leafW / 2;
  const rightLeafX = width / 2 - frameW - leafW / 2;
  const leafH = height - frameW * 2;
  const leafY = frameW + leafH / 2;

  // ============================================================
  // LEFT LEAF: FIXED / PASSIVE (no handle)
  // ============================================================
  
  // Inner frame around fixed leaf glass
  const fLeafTop = makeBox(leafW, innerFrameW, frameD - 0.005, anthraciteFrame);
  fLeafTop.position.set(leftLeafX, leafY + leafH / 2 - innerFrameW / 2, frameD * 0.02);
  g.add(fLeafTop);

  const fLeafBot = makeBox(leafW, innerFrameW, frameD - 0.005, anthraciteFrame);
  fLeafBot.position.set(leftLeafX, leafY - leafH / 2 + innerFrameW / 2, frameD * 0.02);
  g.add(fLeafBot);

  const fLeafL = makeBox(innerFrameW, leafH - innerFrameW * 2, frameD - 0.005, anthraciteFrame);
  fLeafL.position.set(leftLeafX - leafW / 2 + innerFrameW / 2, leafY, frameD * 0.02);
  g.add(fLeafL);

  const fLeafR = makeBox(innerFrameW, leafH - innerFrameW * 2, frameD - 0.005, anthraciteFrame);
  fLeafR.position.set(leftLeafX + leafW / 2 - innerFrameW / 2, leafY, frameD * 0.02);
  g.add(fLeafR);

  // Fixed leaf glass
  const fGlassW = leafW - innerFrameW * 2;
  const fGlassH = leafH - innerFrameW * 2;
  const fixedGlass = makeBox(fGlassW, fGlassH, glassThickness, M.glass);
  fixedGlass.position.set(leftLeafX, leafY, 0);
  g.add(fixedGlass);

  // Fixed leaf indicator bolts (top and bottom on inner edge)
  const fBolt1 = makeCylinder(0.006, 0.006, 0.025, chromeMat, 8);
  fBolt1.position.set(leftLeafX + leafW / 2 - 0.012, leafY + leafH * 0.45, frameD / 2 + 0.005);
  g.add(fBolt1);

  const fBolt2 = makeCylinder(0.006, 0.006, 0.025, chromeMat, 8);
  fBolt2.position.set(leftLeafX + leafW / 2 - 0.012, leafY - leafH * 0.45, frameD / 2 + 0.005);
  g.add(fBolt2);

  // ============================================================
  // RIGHT LEAF: ACTIVE (with lever handle + lock + hinges)
  // ============================================================

  // Inner frame around active leaf glass
  const aLeafTop = makeBox(leafW, innerFrameW, frameD - 0.005, anthraciteFrame);
  aLeafTop.position.set(rightLeafX, leafY + leafH / 2 - innerFrameW / 2, frameD * 0.02);
  g.add(aLeafTop);

  const aLeafBot = makeBox(leafW, innerFrameW, frameD - 0.005, anthraciteFrame);
  aLeafBot.position.set(rightLeafX, leafY - leafH / 2 + innerFrameW / 2, frameD * 0.02);
  g.add(aLeafBot);

  const aLeafL = makeBox(innerFrameW, leafH - innerFrameW * 2, frameD - 0.005, anthraciteFrame);
  aLeafL.position.set(rightLeafX - leafW / 2 + innerFrameW / 2, leafY, frameD * 0.02);
  g.add(aLeafL);

  const aLeafR = makeBox(innerFrameW, leafH - innerFrameW * 2, frameD - 0.005, anthraciteFrame);
  aLeafR.position.set(rightLeafX + leafW / 2 - innerFrameW / 2, leafY, frameD * 0.02);
  g.add(aLeafR);

  // Active leaf glass
  const activeGlass = makeBox(fGlassW, fGlassH, glassThickness, M.glass);
  activeGlass.position.set(rightLeafX, leafY, 0);
  g.add(activeGlass);

  // ===== HINGES on RIGHT side of active leaf =====
  const hingeW = 0.018;
  const hingeH = 0.10;
  const hingeD = 0.055;
  const hingePositions = [height * 0.18, height * 0.50, height * 0.82];

  for (const hy of hingePositions) {
    const hinge = makeBox(hingeW, hingeH, hingeD, chromeMat);
    hinge.position.set(rightLeafX + leafW / 2 + hingeW / 2 + 0.002, hy, 0);
    g.add(hinge);

    const knuckle = makeCylinder(0.012, 0.012, hingeH * 1.1, chromeMat, 12);
    knuckle.position.set(width / 2 - 0.002, hy, 0);
    g.add(knuckle);
  }

  // ===== LEVER HANDLE on LEFT side of active leaf (near center mullion) =====
  const handleY = Math.min(1.05, height * 0.45);
  const handleX = rightLeafX - leafW / 2 + 0.05;

  // Rosette
  const rosetteFront = makeCylinder(0.030, 0.030, 0.008, chromeMat, 24);
  rosetteFront.rotation.x = Math.PI / 2;
  rosetteFront.position.set(handleX, handleY, frameD / 2 + 0.004);
  g.add(rosetteFront);

  // Lever handle (points LEFT toward fixed leaf)
  const leverLength = 0.10;
  const leverShaft = makeCylinder(0.009, 0.009, leverLength, handleMat, 12);
  leverShaft.rotation.z = Math.PI / 2;
  leverShaft.position.set(handleX - leverLength / 2 - 0.005, handleY, frameD / 2 + 0.025);
  g.add(leverShaft);

  // Lever connector
  const leverConnector = makeCylinder(0.011, 0.011, 0.025, handleMat, 12);
  leverConnector.rotation.x = Math.PI / 2;
  leverConnector.position.set(handleX, handleY, frameD / 2 + 0.018);
  g.add(leverConnector);

  // Lever end cap
  const leverEnd = makeCylinder(0.011, 0.009, 0.015, handleMat, 12);
  leverEnd.rotation.z = Math.PI / 2;
  leverEnd.position.set(handleX - leverLength - 0.005, handleY, frameD / 2 + 0.025);
  g.add(leverEnd);

  // ===== LOCK below handle =====
  const lockY = handleY - 0.07;
  
  const lockRosette = makeCylinder(0.020, 0.020, 0.006, chromeMat, 16);
  lockRosette.rotation.x = Math.PI / 2;
  lockRosette.position.set(handleX, lockY, frameD / 2 + 0.003);
  g.add(lockRosette);

  const lockBody = makeCylinder(0.013, 0.013, 0.010, chromeMat, 16);
  lockBody.rotation.x = Math.PI / 2;
  lockBody.position.set(handleX, lockY, frameD / 2 + 0.011);
  g.add(lockBody);

  const keyhole = makeCylinder(0.004, 0.004, 0.003, 
    new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), 8);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(handleX, lockY, frameD / 2 + 0.017);
  g.add(keyhole);

  // ===== Mirror handle + lock on BACK side =====
  const rosetteBack = makeCylinder(0.030, 0.030, 0.008, chromeMat, 24);
  rosetteBack.rotation.x = Math.PI / 2;
  rosetteBack.position.set(handleX, handleY, -frameD / 2 - 0.004);
  g.add(rosetteBack);

  const leverBack = makeCylinder(0.009, 0.009, leverLength, handleMat, 12);
  leverBack.rotation.z = Math.PI / 2;
  leverBack.position.set(handleX - leverLength / 2 - 0.005, handleY, -frameD / 2 - 0.025);
  g.add(leverBack);

  const leverConnBack = makeCylinder(0.011, 0.011, 0.025, handleMat, 12);
  leverConnBack.rotation.x = Math.PI / 2;
  leverConnBack.position.set(handleX, handleY, -frameD / 2 - 0.018);
  g.add(leverConnBack);

  const leverEndBack = makeCylinder(0.011, 0.009, 0.015, handleMat, 12);
  leverEndBack.rotation.z = Math.PI / 2;
  leverEndBack.position.set(handleX - leverLength - 0.005, handleY, -frameD / 2 - 0.025);
  g.add(leverEndBack);

  const lockRosetteBack = makeCylinder(0.020, 0.020, 0.006, chromeMat, 16);
  lockRosetteBack.rotation.x = Math.PI / 2;
  lockRosetteBack.position.set(handleX, lockY, -frameD / 2 - 0.003);
  g.add(lockRosetteBack);

  const lockBodyBack = makeCylinder(0.013, 0.013, 0.010, chromeMat, 16);
  lockBodyBack.rotation.x = Math.PI / 2;
  lockBodyBack.position.set(handleX, lockY, -frameD / 2 - 0.011);
  g.add(lockBodyBack);

  return g;
}

// ============================================================
// 20. ZUMTOBEL LED LIGHT STRIP (LINARIA)
// ============================================================
// ============================================================
// 20. ZUMTOBEL LINARIA LED LIGHT STRIP
// ============================================================
function buildLEDStrip({ length = 1.5 }) {
  const g = new THREE.Group();
  const M = getSharedMaterials();

  const housingW = 0.06;       // 6cm wide
  const housingH = 0.045;      // 4.5cm tall housing
  const diffuserH = 0.018;     // Glowing part

  // Aluminum housing (top part - rectangular extrusion)
  const housingMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe2e6,
    metalness: 0.92,
    roughness: 0.22,
    clearcoat: 0.5,
  });

  // Glowing diffuser material
  const diffuserMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e7,
    emissive: 0xfff0c8,
    emissiveIntensity: 2.0,
    roughness: 0.4,
    metalness: 0.0,
  });

  // End caps (slightly darker)
  const endCapMat = new THREE.MeshPhysicalMaterial({
    color: 0xa0a4a8,
    metalness: 0.85,
    roughness: 0.3,
  });

  // ===== Main housing (extruded aluminum profile) =====
  const housing = makeBox(length, housingH, housingW, housingMat);
  housing.position.y = 0;
  g.add(housing);

  // ===== End caps =====
  const endCapW = 0.012;
  const endCapL = makeBox(endCapW, housingH * 1.05, housingW * 1.05, endCapMat, { castShadow: false });
  endCapL.position.set(-length / 2 + endCapW / 2, 0, 0);
  g.add(endCapL);

  const endCapR = makeBox(endCapW, housingH * 1.05, housingW * 1.05, endCapMat, { castShadow: false });
  endCapR.position.set(length / 2 - endCapW / 2, 0, 0);
  g.add(endCapR);

  // ===== Glowing LED diffuser (bottom face) =====
  const diffuser = makeBox(length - endCapW * 2, diffuserH, housingW - 0.008, diffuserMat, { castShadow: false });
  diffuser.position.y = -housingH / 2 - diffuserH / 2 + 0.005;
  g.add(diffuser);

  // ===== Suspension cables (visual only - thin chrome cables) =====
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0xc0c4c8,
    metalness: 0.7,
    roughness: 0.4,
  });

  const cableLength = 0.3;  // 30cm suspension
  const cableR = 0.0015;
  
  // Left suspension cable
  const cableL = makeCylinder(cableR, cableR, cableLength, cableMat, 6, { castShadow: false });
  cableL.position.set(-length / 2 + 0.15, housingH / 2 + cableLength / 2, 0);
  g.add(cableL);

  // Right suspension cable
  const cableR2 = makeCylinder(cableR, cableR, cableLength, cableMat, 6, { castShadow: false });
  cableR2.position.set(length / 2 - 0.15, housingH / 2 + cableLength / 2, 0);
  g.add(cableR2);

  // Cable mount points (small discs on housing top)
  const mountL = makeCylinder(0.008, 0.008, 0.004, endCapMat, 12, { castShadow: false });
  mountL.position.set(-length / 2 + 0.15, housingH / 2 + 0.002, 0);
  g.add(mountL);

  const mountR = makeCylinder(0.008, 0.008, 0.004, endCapMat, 12, { castShadow: false });
  mountR.position.set(length / 2 - 0.15, housingH / 2 + 0.002, 0);
  g.add(mountR);

  // Ceiling mount canopies (top of cables)
  const canopyL = makeCylinder(0.025, 0.025, 0.008, endCapMat, 16, { castShadow: false });
  canopyL.position.set(-length / 2 + 0.15, housingH / 2 + cableLength, 0);
  g.add(canopyL);

  const canopyR = makeCylinder(0.025, 0.025, 0.008, endCapMat, 16, { castShadow: false });
  canopyR.position.set(length / 2 - 0.15, housingH / 2 + cableLength, 0);
  g.add(canopyR);

  return g;
}

// ============================================================
// 21-31. PEDESTAL TYPES (M1-M4, H1-H4, L1-L3)
// ============================================================
// ============================================================
// 21-31. PEDESTALS (M1-M4, H1-H4, L1-L3) - Real Lindner style
// ============================================================
// ============================================================
// 21-31. PEDESTALS - Simple unified design with matching plates
// ============================================================
function buildPedestal(type, totalHeight) {
  const g = new THREE.Group();

  const h = Math.max(0.05, totalHeight);

  const isHeavy = type.startsWith("H");

  let plateSize = 0.15;
  let tubeRadius = 0.018;

  if (type === "M1" || type === "H1" || type === "L1") {
    plateSize = 0.12;
    tubeRadius = 0.015;
  }
  if (type === "M4" || type === "H4" || type === "L3") {
    plateSize = 0.18;
    tubeRadius = 0.022;
  }
  if (isHeavy) tubeRadius += 0.003;

  const plateThick = 0.008;

  // ===== Materials =====
  const platesMat = new THREE.MeshStandardMaterial({
    color: 0xd8dce2,
    metalness: 0.85,
    roughness: 0.35,
  });

  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e5e9,
    metalness: 0.9,
    roughness: 0.25,
  });

  // ===== Shared plate geometry =====
  const plateGeo = new THREE.BoxGeometry(plateSize, plateThick, plateSize);

  // BASE PLATE
  const basePlate = new THREE.Mesh(plateGeo, platesMat);
  basePlate.position.y = plateThick / 2;
  g.add(basePlate);

  // TOP PLATE (identical)
  const topPlate = new THREE.Mesh(plateGeo, platesMat);
  topPlate.position.y = h - plateThick / 2;
  g.add(topPlate);

  // VERTICAL TUBE
  const tubeBottomY = plateThick;
  const tubeTopY = h - plateThick;
  const tubeHeight = Math.max(0.005, tubeTopY - tubeBottomY);

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeHeight, 12),
    tubeMat
  );
  tube.position.y = tubeBottomY + tubeHeight / 2;
  g.add(tube);

  // Heavy reinforcement plate (only for H types)
  if (isHeavy) {
    const reinfGeo = new THREE.BoxGeometry(plateSize * 1.12, 0.004, plateSize * 1.12);
    const reinfB = new THREE.Mesh(reinfGeo, platesMat);
    reinfB.position.y = plateThick + 0.002;
    g.add(reinfB);
  }

  return g;
}

// ============================================================
// FLOWER-SHAPED TOP PLATE (Lindner signature)
// ============================================================
function buildFlowerTopPlate(parent, y, baseSize, mat, isLight = false) {
  const flowerGroup = new THREE.Group();
  flowerGroup.position.y = y;

  const plateThick = 0.005;
  const centerR = baseSize * 0.18;
  const petalR = baseSize * 0.32;
  const petalCount = 6;

  // Center disc
  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(centerR, centerR, plateThick, 24),
    mat
  );
  center.castShadow = true;
  flowerGroup.add(center);

  // 6 petals around the center
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const petalSize = baseSize * 0.16;
    const petalDistance = centerR + petalSize * 0.4;

    const petal = new THREE.Mesh(
      new THREE.CylinderGeometry(petalSize, petalSize, plateThick, 16),
      mat
    );
    petal.position.set(
      Math.cos(angle) * petalDistance,
      0,
      Math.sin(angle) * petalDistance
    );
    petal.castShadow = true;
    flowerGroup.add(petal);
  }

  // Center mounting hole (dark circle in the center)
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x2a2c30,
    metalness: 0.3,
    roughness: 0.8,
  });
  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(centerR * 0.3, centerR * 0.3, plateThick + 0.001, 16),
    holeMat
  );
  hole.position.y = 0.0005;
  flowerGroup.add(hole);

  // Embossed cross pattern on center (decorative)
  const crossMat = new THREE.MeshStandardMaterial({
    color: 0xb0b4ba,
    metalness: 0.7,
    roughness: 0.5,
  });
  const crossArmH = 0.0008;
  const cross1 = new THREE.Mesh(
    new THREE.BoxGeometry(centerR * 1.3, crossArmH, centerR * 0.15),
    crossMat
  );
  cross1.position.y = plateThick / 2 + crossArmH / 2;
  flowerGroup.add(cross1);

  const cross2 = new THREE.Mesh(
    new THREE.BoxGeometry(centerR * 0.15, crossArmH, centerR * 1.3),
    crossMat
  );
  cross2.position.y = plateThick / 2 + crossArmH / 2;
  flowerGroup.add(cross2);

  // L-type has additional cup-like cradle on top
  if (isLight) {
    const cupMat = new THREE.MeshPhysicalMaterial({
      color: 0xc0c4ca,
      metalness: 0.85,
      roughness: 0.3,
    });
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(centerR * 0.7, centerR * 0.5, 0.008, 16),
      cupMat
    );
    cup.position.y = plateThick + 0.004;
    flowerGroup.add(cup);
  }

  parent.add(flowerGroup);
}

// ============================================================
// LIGNA CHIPBOARD TEXTURE (particleboard pattern)
// ============================================================
let _lignaTextureCache = null;

function getLignaTexture() {
  if (_lignaTextureCache) return _lignaTextureCache;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Base color - warm beige/tan like raw particleboard
  ctx.fillStyle = "#b89968";
  ctx.fillRect(0, 0, size, size);

  // Subtle base gradient
  const bg = ctx.createRadialGradient(size/2, size/2, 50, size/2, size/2, size);
  bg.addColorStop(0, "rgba(200, 170, 120, 0.3)");
  bg.addColorStop(1, "rgba(140, 110, 70, 0.2)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Wood chip particles (the key feature of chipboard)
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const chipW = 3 + Math.random() * 15;
    const chipH = 2 + Math.random() * 8;
    const angle = Math.random() * Math.PI * 2;

    // Random brown shades for chips
    const brightness = Math.random();
    let r, gg, b;
    if (brightness < 0.3) {
      // Dark chip
      r = 100 + Math.random() * 40;
      gg = 70 + Math.random() * 30;
      b = 40 + Math.random() * 25;
    } else if (brightness < 0.7) {
      // Medium chip
      r = 170 + Math.random() * 40;
      gg = 140 + Math.random() * 30;
      b = 90 + Math.random() * 30;
    } else {
      // Light chip
      r = 210 + Math.random() * 30;
      gg = 180 + Math.random() * 25;
      b = 130 + Math.random() * 25;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(gg)}, ${Math.round(b)}, ${0.6 + Math.random() * 0.3})`;
    ctx.fillRect(-chipW / 2, -chipH / 2, chipW, chipH);
    ctx.restore();
  }

  // Add small dark specks (resin/glue spots)
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.5 + Math.random() * 1.5;
    ctx.fillStyle = `rgba(60, 40, 20, ${0.3 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle film noise
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.9));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.7));
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  _lignaTextureCache = tex;
  return tex;
}

// ============================================================
// FLOOR and more® TEXTURE (white panel with branding)
// ============================================================
let _floorAndMoreTextureCache = null;

function getFloorAndMoreTexture() {
  if (_floorAndMoreTextureCache) return _floorAndMoreTextureCache;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // ===== Off-white base color (calcium sulphate look) =====
  ctx.fillStyle = "#f0eee8";
  ctx.fillRect(0, 0, size, size);

  // Subtle vignette for depth
  const grad = ctx.createRadialGradient(size/2, size/2, 50, size/2, size/2, size * 0.7);
  grad.addColorStop(0, "rgba(255, 254, 250, 0.6)");
  grad.addColorStop(1, "rgba(225, 220, 210, 0.3)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // ===== Very subtle surface texture (fine specks) =====
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const grey = 200 + Math.floor(Math.random() * 30);
    const alpha = Math.random() * 0.08;
    ctx.fillStyle = `rgba(${grey},${grey - 5},${grey - 10},${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // ===== Slightly darker corners (corner reinforcement detail) =====
  const cornerSize = 28;
  const cornerColor = "rgba(180, 175, 165, 0.4)";
  ctx.fillStyle = cornerColor;
  ctx.beginPath();
  ctx.arc(cornerSize / 2, cornerSize / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size - cornerSize / 2, cornerSize / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cornerSize / 2, size - cornerSize / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size - cornerSize / 2, size - cornerSize / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // ===== "FLOOR and more®" branding text =====
  ctx.save();
  ctx.translate(size / 2, size / 2);
  
  ctx.font = "italic 600 38px 'Helvetica', 'Arial', sans-serif";
  ctx.fillStyle = "rgba(140, 135, 125, 0.55)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FLOOR and more®", 0, 0);

  ctx.restore();

  // ===== Subtle film noise =====
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 6;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;   // No tiling - one logo per panel
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  _floorAndMoreTextureCache = tex;
  return tex;
}

// ============================================================
// SUSPENDED CEILING TEXTURE (subtle perforated white)
// ============================================================
let _suspendedCeilingTextureCache = null;

function getSuspendedCeilingTexture() {
  if (_suspendedCeilingTextureCache) return _suspendedCeilingTextureCache;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Pure white base
  ctx.fillStyle = "#fafbfc";
  ctx.fillRect(0, 0, size, size);

  // Very subtle perforation pattern (tiny dots in regular grid)
  const dotSpacing = 12;
  const dotRadius = 0.7;
  ctx.fillStyle = "rgba(180, 185, 192, 0.25)";

  for (let x = dotSpacing / 2; x < size; x += dotSpacing) {
    for (let y = dotSpacing / 2; y < size; y += dotSpacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Very subtle film noise for realism
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 4;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(4, 4);  // Tile small perforation pattern

  _suspendedCeilingTextureCache = tex;
  return tex;
}
// ============================================================
// PRODUCT REGISTRY - 31 Products
// ============================================================
export const LINDNER_PRODUCTS = {
  "Glass partition Wall": { category: "wall", panelWidth: 1.25, build: (p) => buildGlassPartitionWall(p) },
  "Wooden partition wall": { category: "wall", panelWidth: 1.2, build: (p) => buildWoodenPartitionWall(p) },

  "Ligna": { category: "floor", build: (p) => buildLignaFloor(p) },
  "Floor and more": { category: "floor", build: (p) => buildFloorAndMoreFloor(p) },
  "Loop": { category: "floor", build: (p) => buildLoopFloor(p) },
  "Norit": { category: "floor", build: (p) => buildNoritFloor(p) },
  "Nortec": { category: "floor", build: (p) => buildNortecFloor(p) },

  "Grid ceilings": { category: "ceiling", build: (p) => buildGridCeiling(p) },
  "Ceiling panels": { category: "ceiling", build: (p) => buildCeilingPanel(p) },
  "Suspended ceilings": { category: "ceiling", build: (p) => buildSuspendedCeiling(p) },
  "cassette ceilings": { category: "ceiling", build: (p) => buildCassetteCeiling(p) },
  "Expanded metal ceilings": { category: "ceiling", build: (p) => buildExpandedMetalCeiling(p) },
  "lamella ceilings": { category: "ceiling", build: (p) => buildLamellaCeiling(p) },
  "Torsion Spring": { category: "ceiling", build: (p) => buildTorsionSpringCeiling(p) },
  "Clean room post cap ceilings": { category: "ceiling", build: (p) => buildCleanRoomCeiling(p) },

  "Glass door 1 lfg": { category: "door", build: (p) => buildGlassDoor1Leaf(p) },
  "Glass door 2 lfg": { category: "door", build: (p) => buildGlassDoor2Leaf(p) },
  "Aluminium door 1 lfg": { category: "door", build: (p) => buildAluminumDoor1Leaf(p) },
  "Aluminium door 2 lfg": { category: "door", build: (p) => buildAluminumDoor2Leaf(p) },

  "Zumtobel LED light strip": { category: "lights", build: (p) => buildLEDStrip(p) },

  "M1": { category: "pedestal", build: (p) => buildPedestal("M1", p?.height || 0.03) },
"M2": { category: "pedestal", build: (p) => buildPedestal("M2", p?.height || 0.10) },
"M3": { category: "pedestal", build: (p) => buildPedestal("M3", p?.height || 0.20) },
"M4": { category: "pedestal", build: (p) => buildPedestal("M4", p?.height || 0.45) },
"H1": { category: "pedestal", build: (p) => buildPedestal("H1", p?.height || 0.03) },
"H2": { category: "pedestal", build: (p) => buildPedestal("H2", p?.height || 0.15) },
"H3": { category: "pedestal", build: (p) => buildPedestal("H3", p?.height || 0.50) },
"H4": { category: "pedestal", build: (p) => buildPedestal("H4", p?.height || 0.50) },
"L1": { category: "pedestal", build: (p) => buildPedestal("L1", p?.height || 0.06) },
"L2": { category: "pedestal", build: (p) => buildPedestal("L2", p?.height || 0.30) },
"L3": { category: "pedestal", build: (p) => buildPedestal("L3", p?.height || 0.50) },
};

export function getProduct(productName) {
  if (!productName) return null;
  if (LINDNER_PRODUCTS[productName]) return LINDNER_PRODUCTS[productName];
  const trimmed = productName.trim();
  for (const key of Object.keys(LINDNER_PRODUCTS)) {
    if (key.trim() === trimmed) return LINDNER_PRODUCTS[key];
  }
  return null;
}