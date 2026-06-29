const STORAGE_KEY = 'lindnerCart_v2';
let cart = [];

// ============================================================
//  Hilfsfunktionen
// ============================================================
function makeUniqueSvg(svgString, code) {
  const suffix = 'ov-' + code.replace('.', '_');
  return svgString
    .replace(/id="g([A-Z0-9_]+)"/g, 'id="g$1-' + suffix + '"')
    .replace(/url\(#g([A-Z0-9_]+)\)/g, 'url(#g$1-' + suffix + ')');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatResultList(resultText) {
  return resultText
    .split('\n')
    .filter(r => r.trim())
    .map(r => '<li>' + escapeHtml(r.trim()) + '</li>')
    .join('');
}

// ============================================================
//  Persistenz (localStorage)
// ============================================================
function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    console.warn('Cart konnte nicht gespeichert werden:', e);
  }
}

function loadCart() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        cart = parsed.filter(c => c && c.code && data.some(d => d.code === c.code));
      }
    }
  } catch (e) {
    console.warn('Cart konnte nicht geladen werden:', e);
    cart = [];
  }
}

// ============================================================
//  Logo: SVG -> PNG rastern (für PDF)
// ============================================================
window._lindnerLogoPNG = null;

function preloadLogo() {
  if (!window.LINDNER_LOGO) {
    console.warn('Logo nicht eingebettet (logo.js fehlt) – PDF nutzt Text-Fallback.');
    return;
  }
  window._lindnerLogoPNG = window.LINDNER_LOGO;
  const img = new Image();
  img.onload = () => { window._lindnerLogoRatio = img.naturalWidth / img.naturalHeight; };
  img.src = window.LINDNER_LOGO;
}

// ============================================================
//  PDF-Export (lädt jsPDF on-demand vom CDN)
// ============================================================
let _jspdfLoadPromise = null;

function loadJsPDF() {
  if (window.jspdf) return Promise.resolve();
  if (_jspdfLoadPromise) return _jspdfLoadPromise;
  _jspdfLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { _jspdfLoadPromise = null; reject(new Error('jsPDF Ladevorgang fehlgeschlagen')); };
    document.head.appendChild(s);
  });
  return _jspdfLoadPromise;
}

// PDF-Farbpalette (neue Markenfarben)
const PDF_COLORS = {
  petrol:     [53, 98, 113],   // #356271  Hauptfarbe
  petrolDark: [36, 76, 90],    // #244C5A
  petrolDeep: [4, 68, 89],     // #044459
  navy:       [4, 68, 89],     // #044459
  accentRed:  [174, 12, 30],   // #AE0C1E
  bgSubtle:   [248, 250, 251],
  textMuted:  [107, 122, 124],
  border:     [220, 228, 230],
  white:      [255, 255, 255]
};

const PDF_LAYOUT = { PW: 210, PH: 297, M: 18, BOTTOM: 279 };

// Registriert die eingebettete Nunito-Schrift in jsPDF (falls vorhanden)
function registerFonts(doc) {
  if (!window.LINDNER_FONTS) {
    console.warn('Nunito-Schrift nicht gefunden – nutze Helvetica (Sonderzeichen ggf. fehlerhaft).');
    return 'helvetica';
  }
  doc.addFileToVFS('Nunito-Regular.ttf', window.LINDNER_FONTS.regular);
  doc.addFont('Nunito-Regular.ttf', 'Nunito', 'normal');
  doc.addFileToVFS('Nunito-Bold.ttf', window.LINDNER_FONTS.bold);
  doc.addFont('Nunito-Bold.ttf', 'Nunito', 'bold');
  return 'Nunito';
}

async function exportCartToPDF(evt) {
  if (cart.length === 0) {
    alert('Ihre Merkliste ist leer.');
    return;
  }

  const btn = evt && evt.currentTarget;
  let originalHTML = '';
  if (btn) {
    originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="action-btn-icon">⏳</span><span>Lädt...</span>';
    btn.disabled = true;
  }

  try {
    await loadJsPDF();
    buildPDF();
  } catch (e) {
    alert('PDF konnte nicht erstellt werden:\n' + e.message);
    console.error(e);
  } finally {
    if (btn) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }
}

function buildPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const FONT = registerFonts(doc);
  const C = PDF_COLORS;
  const { PW, PH, M, BOTTOM } = PDF_LAYOUT;
  const CW = PW - 2 * M;

  // --- Helfer ---
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (style) => doc.setFont(FONT, style);

  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const groups = [...new Set(cart.map(c => c.code[0]))];

  // Reihenfolge der Leistungen entspricht der Reihenfolge in `data`
  const items = data.filter(d => cart.some(c => c.code === d.code));

  // ============================================================
  //  SEITE 1 – DECKBLATT (Variante a, schlicht)
  // ============================================================
  setFill(C.petrol);
  doc.rect(0, 0, PW, PH, 'F');

  // dunkles Band oben
  setFill(C.petrolDeep);
  doc.rect(0, 0, PW, 70, 'F');

  // Logo oben (per Canvas gerastert) – mit Text-Fallback
   // Logo oben (PNG) – mit Text-Fallback
  if (window._lindnerLogoPNG) {
    const logoH = 14;
    const logoW = logoH * (window._lindnerLogoRatio || 3.7);
    doc.addImage(window._lindnerLogoPNG, 'PNG', M, 28, logoW, logoH);
  } else {
    font('bold');
    doc.setFontSize(26);
    setText(C.white);
    doc.text('LINDNER', M, 40);
  }

  font('bold');
  doc.setFontSize(11);
  setText(C.white);
  doc.text('NACHHALTIGES BAUEN 2026', M, 58);

  // Titel
  font('bold');
  doc.setFontSize(34);
  setText(C.white);
  doc.text('Ihre', M, 150);
  doc.text('Leistungsauswahl', M, 166);

  font('normal');
  doc.setFontSize(12);
  doc.text('Erstellt am ' + today, M, 182);

  // Statistik unten
  font('bold');
  doc.setFontSize(40);
  doc.text(String(items.length), M, 240);
  doc.text(String(groups.length), M + 50, 240);
  font('normal');
  doc.setFontSize(10);
  doc.text('Leistungen', M, 248);
  doc.text('Kompetenzfelder', M + 50, 248);

  // ============================================================
  //  SEITE 2 – INHALTSVERZEICHNIS
  // ============================================================
  doc.addPage();
  let y = 30;

  font('bold');
  doc.setFontSize(22);
  setText(C.navy);
  doc.text('Inhaltsverzeichnis', M, y);
  setDraw(C.petrol);
  doc.setLineWidth(1.2);
  doc.line(M, y + 3, M + 45, y + 3);
  y += 18;

  const groupNames = {};
  items.forEach(it => { groupNames[it.group] = true; });

  Object.keys(groupNames).forEach(groupName => {
    const groupItems = items.filter(it => it.group === groupName);

    font('bold');
    doc.setFontSize(11);
    setText(C.petrol);
    doc.text(groupName.toUpperCase(), M, y);
    y += 8;

    groupItems.forEach(it => {
      font('normal');
      doc.setFontSize(10);
      setText(C.navy);
      doc.text(it.code, M + 4, y);
      const titleMax = CW - 30;
      let title = it.title;
      while (doc.getTextWidth(title) > titleMax && title.length > 10) {
        title = title.slice(0, -4) + '…';
      }
      doc.text(title, M + 20, y);
      y += 7;
      if (y > BOTTOM - 10) { doc.addPage(); y = 30; }
    });
    y += 4;
  });

  // ============================================================
  //  AB SEITE 3 – LEISTUNGEN
  // ============================================================
  doc.addPage();
  y = 24;

  function drawRunningHeader() {
    setFill(C.petrol);
    doc.rect(0, 0, PW, 14, 'F');
    font('bold');
    doc.setFontSize(8);
    setText(C.white);
    doc.text('LINDNER', M, 9);
    font('normal');
    doc.setFontSize(7);
    doc.text('Nachhaltiges Bauen', M + 24, 9);
    font('bold');
    doc.setFontSize(8);
    doc.text('Ihre Leistungsauswahl', PW - M, 9, { align: 'right' });
  }

  function drawFooter() {
    const fy = PH - 10;
    setDraw(C.border);
    doc.setLineWidth(0.3);
    doc.line(M, fy - 4, PW - M, fy - 4);
    font('normal');
    doc.setFontSize(7);
    setText(C.textMuted);
    doc.text('Lindner Group KG · Bahnhofstraße 29 · 94424 Arnstorf', M, fy);
    doc.text('nachhaltiges.bauen@lindner-group.com', PW / 2, fy, { align: 'center' });
  }

  function newPage() {
    drawFooter();
    doc.addPage();
    drawRunningHeader();
    y = 24;
  }

  function ensureSpace(needed) {
    if (y + needed > BOTTOM) newPage();
  }

  drawRunningHeader();

  let currentGroup = null;

  items.forEach((item) => {
    // Gruppen-Trennüberschrift
    if (item.group !== currentGroup) {
      currentGroup = item.group;
      ensureSpace(20);
      font('bold');
      doc.setFontSize(13);
      setText(C.petrolDeep);
      doc.text(item.group, M, y);
      setDraw(C.petrol);
      doc.setLineWidth(0.8);
      doc.line(M, y + 2.5, M + 40, y + 2.5);
      y += 12;
    }

    ensureSpace(40);

    // Code-Badge
    setFill(C.petrol);
    doc.roundedRect(M, y, 18, 8, 1.5, 1.5, 'F');
    font('bold');
    doc.setFontSize(9);
    setText(C.white);
    doc.text(item.code, M + 9, y + 5.6, { align: 'center' });

    // Titel
    doc.setFontSize(14);
    setText(C.navy);
    const titleLines = doc.splitTextToSize(item.title, CW - 26);
    doc.text(titleLines, M + 26, y + 5.8);
    y += Math.max(10, titleLines.length * 6) + 5;

    setDraw(C.border);
    doc.setLineWidth(0.3);
    doc.line(M, y, PW - M, y);
    y += 6;

    // Leistungsumfang
    ensureSpace(14);
    font('bold');
    doc.setFontSize(7);
    setText(C.petrol);
    doc.text('LEISTUNGSUMFANG', M, y);
    y += 5;

    font('normal');
    doc.setFontSize(9);
    setText(C.textMuted);
    item.details.forEach((detail) => {
      const lines = doc.splitTextToSize(detail, CW - 7);
      const blockH = lines.length * 4.2 + 1.5;
      if (y + blockH > BOTTOM) {
        newPage();
        font('bold');
        doc.setFontSize(7);
        setText(C.petrol);
        doc.text('LEISTUNGSUMFANG (Forts.)', M, y);
        y += 5;
        font('normal');
        doc.setFontSize(9);
        setText(C.textMuted);
      }
      setFill(C.petrol);
      doc.rect(M, y - 1.2, 3, 0.6, 'F');
      doc.text(lines, M + 5, y);
      y += blockH;
    });
    y += 6;

    // Ergebnis-Box
    const resultLines = item.result.split('\n').filter(r => r.trim());
    const resultBoxH = 11 + resultLines.length * 4.5 + 6;
    ensureSpace(Math.min(resultBoxH, 30));
    const actualBoxH = Math.min(resultBoxH, BOTTOM - y);
    if (actualBoxH > 5) {
      setFill(C.bgSubtle);
      setDraw(C.border);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, CW, actualBoxH, 2, 2, 'FD');
      setFill(C.petrol);
      doc.rect(M, y, 40, 1.2, 'F');
      font('bold');
      doc.setFontSize(7);
      setText(C.petrol);
      doc.text('ERGEBNIS', M + 4, y + 7);

      font('normal');
      doc.setFontSize(9);
      setText(C.navy);
      let ry = y + 11;
      resultLines.forEach((line) => {
        if (ry + 4 > y + actualBoxH - 2) return;
        setFill(C.petrol);
        doc.circle(M + 4.5, ry - 1.3, 0.8, 'F');
        doc.text(line.trim(), M + 8, ry);
        ry += 4.5;
      });
      y += actualBoxH + 10;
    }
  });

  // Abschluss-Block
  ensureSpace(30);
  setFill(C.petrolDeep);
  doc.roundedRect(M, y, CW, 24, 3, 3, 'F');
  font('bold');
  doc.setFontSize(11);
  setText(C.white);
  doc.text('Lassen Sie uns gemeinsam bauen.', M + 6, y + 9);
  font('normal');
  doc.setFontSize(8);
  doc.text('nachhaltiges.bauen@lindner-group.com  ·  +49 8723 20-0', M + 6, y + 16);

  drawFooter();

  // Seitenzahlen (ab Seite 3; Deckblatt + TOC ohne Nummer)
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 3; i <= totalPages; i++) {
    doc.setPage(i);
    font('normal');
    doc.setFontSize(7);
    setText(C.textMuted);
    doc.text('Seite ' + (i - 2) + ' von ' + (totalPages - 2), PW - M, PH - 10, { align: 'right' });
  }

  doc.save('Lindner_Leistungsauswahl.pdf');
}

// ============================================================
//  Reveal-Animation
// ============================================================
const revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

function observeNew() {
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
}

// ============================================================
//  Initialisierung
// ============================================================
function init() {
  const overviewPage = document.getElementById('overviewPage');
  const drawerWrap = document.getElementById('cartDrawerWrap');
  const cartModal = document.getElementById('cartModal');
  const mainContent = document.getElementById('mainContent');
  const mainFooter = document.getElementById('mainFooter');

  if (overviewPage) {
    overviewPage.classList.remove('active');
    overviewPage.setAttribute('aria-hidden', 'true');
    overviewPage.style.display = '';
  }
  if (drawerWrap) drawerWrap.classList.remove('open');
  if (cartModal) cartModal.classList.remove('open');
  if (mainContent) mainContent.style.display = '';
  if (mainFooter) mainFooter.style.display = '';
  document.body.style.overflow = '';

  loadCart();
  renderAll();
  setupFilters();
  updateCartUI();
  preloadLogo();
}

// ============================================================
//  Rendering: Karten
// ============================================================
function renderAll() {
  const content = document.getElementById('content');
  if (!content) return;

  const groups = {};
  data.forEach(item => {
    if (!groups[item.group]) groups[item.group] = { icon: item.icon, items: [] };
    groups[item.group].items.push(item);
  });

  let html = '';
  Object.entries(groups).forEach(([groupName, g]) => {
    html += '<section class="group-section reveal" data-group="' + escapeHtml(groupName) + '">';
    html +=   '<div class="group-header">';
    html +=     '<div class="group-header-left">';
    html +=       '<div class="group-icon" aria-hidden="true">' + g.icon + '</div>';
    html +=       '<h2>' + escapeHtml(groupName) + '</h2>';
    html +=     '</div>';
    html +=     '<div class="group-count">' + String(g.items.length).padStart(2, '0') + ' Leistungen</div>';
    html +=   '</div>';
    html +=   '<div class="grid">';
    g.items.forEach(item => {
      const inCart = cart.some(c => c.code === item.code);
      html += '<article class="card reveal" data-code="' + item.code + '">';
      html +=   '<div class="card-visual">' + item.svg + '</div>';
      html +=   '<div class="card-body">';
      html +=     '<button class="card-toggle" aria-expanded="false" onclick="toggleCard(this)" onkeydown="handleCardKey(event, this)" type="button">';
      html +=       '<div class="card-header">';
      html +=         '<span class="code-badge">' + item.code + '</span>';
      html +=         '<div class="expand-icon" aria-hidden="true"></div>';
      html +=       '</div>';
      html +=       '<h3>' + escapeHtml(item.title) + '</h3>';
      html +=     '</button>';
      html +=     '<div class="card-details">';
      html +=       '<ul>' + item.details.map(d => '<li>' + escapeHtml(d) + '</li>').join('') + '</ul>';
      html +=       '<button class="cart-add-btn ' + (inCart ? 'active' : '') + '" type="button" onclick="toggleCartItem(event, \'' + item.code + '\')" aria-pressed="' + (inCart ? 'true' : 'false') + '" aria-label="' + (inCart ? 'Hinzugefügt' : 'Zur Anfrage hinzufügen') + '" title="' + (inCart ? 'Hinzugefügt' : 'Zur Anfrage hinzufügen') + '">';
      html +=         '<span class="cart-icon" aria-hidden="true">' + (inCart ? '✓' : '+') + '</span>';
      html +=         '<span class="cart-text">' + (inCart ? 'Hinzugefügt' : 'Zur Anfrage') + '</span>';
      html +=       '</button>';
      html +=     '</div>';
      html +=   '</div>';
      html +=   '<div class="card-result">';
      html +=     '<div class="card-result-label">Ergebnis</div>';
      html +=     '<ul class="result-list">' + formatResultList(item.result) + '</ul>';
      html +=   '</div>';
      html += '</article>';
    });
    html +=   '</div>';
    html += '</section>';
  });

  content.innerHTML = html;
  observeNew();
}

function toggleCard(btn) {
  const card = btn.closest('.card');
  if (!card) return;
  const isExpanded = card.classList.toggle('expanded');
  btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
}

function handleCardKey(e, btn) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleCard(btn);
  }
}

// ============================================================
//  Warenkorb-Logik
// ============================================================
function toggleCartItem(e, code) {
  e.stopPropagation();
  const item = data.find(d => d.code === code);
  if (!item) return;
  const idx = cart.findIndex(c => c.code === code);
  const btn = e.currentTarget;

  if (idx > -1) {
    cart.splice(idx, 1);
    setCartButton(btn, false);
  } else {
    cart.push({ code: item.code, title: item.title });
    setCartButton(btn, true);
  }
  updateCartUI();
}

// Setzt den visuellen Zustand eines "Zur Anfrage"-Buttons
function setCartButton(btn, inCart) {
  if (!btn) return;
  btn.classList.toggle('active', inCart);
  btn.setAttribute('aria-pressed', inCart ? 'true' : 'false');
  btn.setAttribute('aria-label', inCart ? 'Hinzugefügt' : 'Zur Anfrage hinzufügen');
  btn.setAttribute('title', inCart ? 'Hinzugefügt' : 'Zur Anfrage hinzufügen');
  const icon = btn.querySelector('.cart-icon');
  const text = btn.querySelector('.cart-text');
  if (icon) icon.textContent = inCart ? '✓' : '+';
  if (text) text.textContent = inCart ? 'Hinzugefügt' : 'Zur Anfrage';
}

function removeFromCart(code) {
  cart = cart.filter(c => c.code !== code);
  const card = document.querySelector('.card[data-code="' + code + '"]');
  if (card) setCartButton(card.querySelector('.cart-add-btn'), false);
  updateCartUI();
}

function removeFromCartAndOverview(code) {
  removeFromCart(code);
  if (cart.length === 0) hideOverview();
}

function clearCart() {
  cart = [];
  document.querySelectorAll('.cart-add-btn').forEach(btn => setCartButton(btn, false));
  updateCartUI();
}

function updateCartUI() {
  saveCart();
  updateCartBar();
  updateCartFab();
  renderCartDrawer();
  renderOverview();
}

function updateCartBar() {
  const bar = document.getElementById('cartBar');
  const list = document.getElementById('cartList');
  const count = document.getElementById('cartCount');
  if (!bar || !list || !count) return;
  if (cart.length === 0) {
    bar.classList.remove('active');
    return;
  }
  bar.classList.add('active');
  count.textContent = cart.length;
  list.innerHTML = cart.map(c =>
    '<span class="cart-chip">' + escapeHtml(c.code) +
    '<button type="button" onclick="removeFromCart(\'' + c.code + '\')" aria-label="' + escapeHtml(c.code) + ' entfernen">×</button>' +
    '</span>'
  ).join('');
}

function updateCartFab() {
  const fab = document.getElementById('cartFab');
  const count = document.getElementById('fabCount');
  if (!fab || !count) return;
  if (cart.length > 0) {
    fab.classList.add('active');
    count.textContent = cart.length;
  } else {
    fab.classList.remove('active');
  }
}

// ============================================================
//  Drawer (Merkliste)
// ============================================================
function renderCartDrawer() {
  const body = document.getElementById('drawerBody');
  if (!body) return;
  if (cart.length === 0) {
    body.innerHTML = '<div class="drawer-empty"><p>Ihre Merkliste ist leer.</p><p style="font-size:0.9rem;margin-top:8px;">Wählen Sie Leistungen aus, um sie hier zu sammeln.</p></div>';
    return;
  }
  body.innerHTML = cart.map(c => {
    const item = data.find(d => d.code === c.code);
    return '<div class="drawer-item">' +
      '<div class="drawer-item-code">' + c.code + '</div>' +
      '<div class="drawer-item-info">' +
        '<div class="drawer-item-title">' + escapeHtml(c.title) + '</div>' +
        '<div class="drawer-item-group">' + escapeHtml(item ? item.group : '') + '</div>' +
      '</div>' +
      '<button class="drawer-item-remove" onclick="removeFromCart(\'' + c.code + '\')" type="button" aria-label="Entfernen">×</button>' +
    '</div>';
  }).join('');
}

function openCartDrawer() {
  const wrap = document.getElementById('cartDrawerWrap');
  if (!wrap) return;
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  const wrap = document.getElementById('cartDrawerWrap');
  if (!wrap) return;
  wrap.classList.remove('open');
  const modal = document.getElementById('cartModal');
  if (!modal || !modal.classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

// ============================================================
//  Übersichtsseite
// ============================================================
function showOverview() {
  if (cart.length === 0) return;
  const mainContent = document.getElementById('mainContent');
  const mainFooter = document.getElementById('mainFooter');
  const cartBar = document.getElementById('cartBar');
  const drawerWrap = document.getElementById('cartDrawerWrap');
  const page = document.getElementById('overviewPage');

  if (mainContent) mainContent.style.display = 'none';
  if (mainFooter) mainFooter.style.display = 'none';
  if (cartBar) cartBar.classList.remove('active');
  if (drawerWrap) drawerWrap.classList.remove('open');
  document.body.style.overflow = '';

  if (page) {
    page.classList.add('active');
    page.setAttribute('aria-hidden', 'false');
  }
  window.scrollTo(0, 0);
  renderOverview();
}

function hideOverview() {
  const mainContent = document.getElementById('mainContent');
  const mainFooter = document.getElementById('mainFooter');
  const overviewPage = document.getElementById('overviewPage');

  if (mainContent) { mainContent.style.display = ''; mainContent.removeAttribute('hidden'); }
  if (mainFooter) { mainFooter.style.display = ''; mainFooter.removeAttribute('hidden'); }
  if (overviewPage) {
    overviewPage.classList.remove('active');
    overviewPage.setAttribute('aria-hidden', 'true');
    overviewPage.style.display = '';
  }
  document.body.style.overflow = '';
  window.scrollTo(0, 0);
  updateCartUI();
  if (location.hash === '#auswahl') {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

function renderOverview() {
  const grid = document.getElementById('overviewGrid');
  const subtitle = document.getElementById('overviewSubtitle');
  const summary = document.getElementById('overviewSummary');
  const actions = document.getElementById('overviewActions');
  if (!grid || !subtitle || !summary || !actions) return;

  if (cart.length === 0) {
    subtitle.textContent = 'Sie haben noch keine Leistungen vorgemerkt.';
    grid.innerHTML = '';
    summary.innerHTML = '';
    actions.style.display = 'none';
    return;
  }

  const groups = [...new Set(cart.map(c => c.code[0]))];
  subtitle.textContent = 'Sie haben ' + cart.length + ' Leistung' + (cart.length !== 1 ? 'en' : '') +
    ' aus ' + groups.length + ' Kompetenzfelder' + (groups.length !== 1 ? 'n' : '') + ' vorgemerkt.';

  summary.innerHTML =
    '<div class="overview-stat"><div class="overview-stat-num">' + cart.length + '</div><div class="overview-stat-label">Leistungen</div></div>' +
    '<div class="overview-stat"><div class="overview-stat-num">' + groups.length + '</div><div class="overview-stat-label">Kompetenzfelder</div></div>';

  grid.innerHTML = cart.map(c => {
    const item = data.find(d => d.code === c.code);
    if (!item) return '';
    const uniqueSvg = makeUniqueSvg(item.svg, c.code);
    return '<article class="card" style="cursor: default;">' +
      '<div class="card-visual">' + uniqueSvg + '</div>' +
      '<div class="card-body">' +
        '<div class="card-header" style="margin-bottom: 12px;"><span class="code-badge">' + item.code + '</span></div>' +
        '<h3 style="margin-bottom: 12px;">' + escapeHtml(item.title) + '</h3>' +
        '<ul class="overview-details">' + item.details.map(d => '<li>' + escapeHtml(d) + '</li>').join('') + '</ul>' +
        '<div class="card-result" style="margin: 0;">' +
          '<div class="card-result-label">Ergebnis</div>' +
          '<ul class="result-list">' + formatResultList(item.result) + '</ul>' +
        '</div>' +
        '<button class="cart-add-btn" type="button" onclick="removeFromCartAndOverview(\'' + item.code + '\')" style="margin-top: 20px; pointer-events: auto; background: white; color: var(--petrol); border-color: var(--card-border);">' +
          '<span class="cart-icon">−</span><span class="cart-text">Entfernen</span>' +
        '</button>' +
      '</div>' +
    '</article>';
  }).join('');

  actions.style.display = 'flex';
}

// ============================================================
//  Filter
// ============================================================
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      applyFilter(btn.dataset.filter);
      const filterBar = document.querySelector('.filter-bar');
      if (filterBar) {
        const y = filterBar.getBoundingClientRect().top + window.pageYOffset - 40;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });
}

function applyFilter(filter) {
  document.querySelectorAll('.card').forEach(card => {
    const code = card.getAttribute('data-code');
    if (!code) return;
    const show = filter === 'all' || code.startsWith(filter);
    card.style.display = show ? '' : 'none';
    if (!show) {
      card.classList.remove('expanded');
      const toggle = card.querySelector('.card-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.querySelectorAll('.group-section').forEach(section => {
    const visibleCards = Array.from(section.querySelectorAll('.card')).filter(c => c.style.display !== 'none');
    section.style.display = visibleCards.length ? '' : 'none';
  });
}

// ============================================================
//  Anfrage-Modal
// ============================================================
function openCartModal() {
  if (cart.length === 0) return;
  const modal = document.getElementById('cartModal');
  const formWrap = document.getElementById('modalFormWrap');
  const success = document.getElementById('modalSuccess');
  const list = document.getElementById('modalCartList');
  if (!modal || !formWrap || !success || !list) return;

  formWrap.style.display = 'block';
  success.style.display = 'none';
  list.innerHTML = cart.map(c =>
    '<li><strong>' + escapeHtml(c.code) + '</strong> – ' + escapeHtml(c.title) + '</li>'
  ).join('');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const input = modal.querySelector('input');
    if (input) input.focus();
  }, 50);
}

function closeCartModal() {
  const modal = document.getElementById('cartModal');
  if (!modal) return;
  modal.classList.remove('open');
  const drawer = document.getElementById('cartDrawerWrap');
  if (!drawer || !drawer.classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

function submitInquiry(e) {
  e.preventDefault();
  const form = e.target;
  const lines = [
    'Anfrage über Leistungen:',
    ...cart.map(c => '- ' + c.code + ': ' + c.title),
    '',
    'Name: ' + form.name.value,
    'Firma: ' + form.company.value,
    'E-Mail: ' + form.email.value,
    'Telefon: ' + (form.phone.value || '-'),
    '',
    'Nachricht:',
    form.message.value
  ];
  const body = encodeURIComponent(lines.join('\n'));
  const subject = encodeURIComponent('Anfrage Nachhaltiges Bauen – ' + cart.map(c => c.code).join(', '));
  window.location.href = 'mailto:nachhaltiges.bauen@lindner-group.com?subject=' + subject + '&body=' + body;

  const formWrap = document.getElementById('modalFormWrap');
  const success = document.getElementById('modalSuccess');
  if (formWrap) formWrap.style.display = 'none';
  if (success) success.style.display = 'block';
}

// ============================================================
//  Globale Tastatur-Shortcuts
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overview = document.getElementById('overviewPage');
    if (overview && overview.classList.contains('active')) {
      hideOverview();
    } else {
      closeCartDrawer();
      closeCartModal();
    }
  }
});

document.addEventListener('DOMContentLoaded', init);