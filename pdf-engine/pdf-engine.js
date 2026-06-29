/* ════════════════════════════════════════════════════════════════════
   LINDNER PDF ENGINE — Main Report Builder
   ────────────────────────────────────────────────────────────────────
   Generates a 2-page A4 CO2 sustainability report PDF.
   
   Layout:
   ─ PAGE 1 ─────────────────────────────────────────
     • Steel-blue gradient banner (Compass wordmark + Lindner logo)
     • Product title
     • 3 highlighted technical metric cards
     • Two-column: Tech specs + Phase legend (L) | EoL scenarios (R)
     • Module results table (color-coded by phase, GWP highlights)
     • Bar chart of carbon profile by module
     • Footer with page number
   
   ─ PAGE 2 ─────────────────────────────────────────
     • Slim banner
     • 3 scenario comparison cards (per scenario)
     • Two stacked bar charts (A1-C4 total + Net Carbon)
     • Donut rings showing % A1-C4 burden avoided
     • KEY INSIGHT box (AI-generated or fallback)
     • Disclaimer
     • Footer
   
   Dependencies (must be loaded BEFORE this file):
   - jsPDF library (window.jspdf)
   - pdf-assets.js (window.LindnerPDFAssets)
   - pdf-insight.js (window.LindnerPDFInsight)
   
   Public API:
     LindnerPDF.export({
       // Data extraction callbacks
       selected:        [scenario, ...]
       impact:          impact object
       getA1c4:         (s) => number
       getD:            (s) => number
       getModule:       (col, s) => number
       getFixed:        (col) => number
       buildModGroups:  () => groups
       getScenarioDesc: (s) => string
       
       // Page-specific labels
       titleLine1:      string  (e.g. product type)
       titleLine2:      string  (e.g. variant)
       floorType:       string
       techItems:       [[label, value], ...]
       
       // Output
       filename:        string
     })
       → Promise<void>
   
   Version: 1.0 · 2026
   ════════════════════════════════════════════════════════════════════ */

(function (window) {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────
     CONFIG — Page geometry & colors
     ───────────────────────────────────────────────────────────────── */

  const PAGE_W = 210; // mm (A4 portrait)
  const PAGE_H = 297;
  const MARGIN_L = 15;
  const MARGIN_R = 15;
  const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
  const FOOTER_Y = PAGE_H - 12;
  const HIGH_VALUE_THRESHOLD = 1.5; // kg CO2eq/m² — values above this flagged red

  // Lindner brand color palette (RGB arrays for jsPDF)
  const C = {
    red: [200, 16, 46],
    redDark: [155, 12, 36],
    redLight: [232, 32, 62],
    redBg: [252, 235, 238],
    redText: [155, 12, 36],
    steelDarkest: [61, 81, 88],
    steelDark: [74, 95, 102],
    steelMid: [107, 128, 134],
    steelLight: [138, 156, 161],
    steelPale: [180, 192, 195],
    steelPaler: [213, 220, 222],
    steelMist: [236, 240, 241],
    inkBlack: [47, 63, 68],
    ink: [60, 75, 80],
    grey800: [85, 100, 105],
    grey600: [120, 135, 140],
    grey500: [150, 162, 167],
    grey400: [180, 192, 195],
    grey300: [205, 213, 215],
    grey200: [225, 230, 232],
    grey150: [235, 238, 239],
    grey100: [245, 247, 248],
    grey50: [250, 251, 252],
    white: [255, 255, 255],
    benefitBg: [236, 240, 241],
    benefitTxt: [74, 95, 102],
    hiBg: [252, 235, 238],
    hiText: [155, 12, 36]
  };

  // Scenario series colors (slate-grey shades for clean PDF look)
  const SERIES = [[61, 81, 88], [107, 128, 134], [180, 192, 195]];
  const SERIES_BG = [[240, 244, 245], [245, 248, 249], [248, 250, 251]];
  const sc = (i) => SERIES[i] || SERIES[0];
  const scBg = (i) => SERIES_BG[i] || SERIES_BG[0];

  // Phase colors for module table bands
  const PHASE = {
    prod: [74, 95, 102],
    cons: [107, 128, 134],
    eol: [138, 156, 161],
    ben: [180, 192, 195]
  };


  /* ─────────────────────────────────────────────────────────────────
     UTILITIES
     ───────────────────────────────────────────────────────────────── */

  function pdfFmt(value) {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) return '--';
    const abs = Math.abs(number);
    if (abs === 0) return '0.00';
    if (abs >= 10000) return number.toFixed(0);
    if (abs < 0.0001) return number.toFixed(5);
    if (abs < 0.001) return number.toFixed(4);
    if (abs < 0.01) return number.toFixed(3);
    return number.toFixed(2);
  }

  function niceCeil(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / mag;
    if (norm <= 1) return mag;
    if (norm <= 2) return 2 * mag;
    if (norm <= 5) return 5 * mag;
    return 10 * mag;
  }

  /** Strip Unicode chars that jsPDF's helvetica font can't render */
  function ascii(str) {
    return String(str || '').replace(/[\u0080-\uFFFF]/g, (c) => {
      if ('\u00B2\u00B3\u2082\u00B0\u00B7\u2013\u2014\u2192'.includes(c)) return c;
      const map = { '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2192': '->' };
      return map[c] || '';
    });
  }


  /* ─────────────────────────────────────────────────────────────────
     CORE BUILDER — buildReport(opts)
     ───────────────────────────────────────────────────────────────── */

  async function buildReport(opts) {
    const {
      doc,
      assets,
      today,
      issueD,
      validD,
      titleLine1,
      titleLine2,
      floorType,
      techItems,
      selected,
      impact,
      getA1c4,
      getD,
      getModule,
      getFixed,
      buildModGroups,
      getScenarioDesc,
      filename
    } = opts;

    let pageNum = 0;

    // ─── Helper closures (need access to doc) ───────────────────────
    const sf = (sty, sz, col) => {
      doc.setFont('helvetica', sty || 'normal');
      doc.setFontSize(sz);
      doc.setTextColor(...(col || C.ink));
    };
    const fb = (x, y, w, h, col) => {
      doc.setFillColor(...col);
      doc.rect(x, y, w, h, 'F');
    };
    const fr = (x, y, w, h, r, col) => {
      doc.setFillColor(...col);
      doc.roundedRect(x, y, w, h, r, r, 'F');
    };
    const ln = (x1, y1, x2, y2, col, wt) => {
      doc.setDrawColor(...(col || C.grey200));
      doc.setLineWidth(wt || 0.2);
      doc.line(x1, y1, x2, y2);
    };

    function gradientBar(x, y, w, h, c1, c2, steps) {
      const n = steps || 60;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        doc.setFillColor(
          Math.round(c1[0] + (c2[0] - c1[0]) * t),
          Math.round(c1[1] + (c2[1] - c1[1]) * t),
          Math.round(c1[2] + (c2[2] - c1[2]) * t)
        );
        doc.rect(x + (w / n) * i, y, w / n + 0.3, h, 'F');
      }
    }

    function addWatermark() {
      if (!assets?.headerCompass) return;
      try {
        if (doc.GState) {
          const gs = new doc.GState({ opacity: 0.03 });
          doc.saveGraphicsState();
          doc.setGState(gs);
          doc.addImage(
            assets.headerCompass,
            'PNG',
            PAGE_W / 2 - 28,
            PAGE_H / 2 - 28,
            56,
            56,
            'wm' + pageNum,
            'FAST'
          );
          doc.restoreGraphicsState();
        }
      } catch (_) {}
    }

    function secHead(txt, x, y, lineW) {
      sf('bold', 7, C.grey600);
      doc.text(txt.toUpperCase(), x, y);
      doc.setDrawColor(...C.red);
      doc.setLineWidth(1.5);
      doc.line(x, y + 2, x + (lineW || 30), y + 2);
      return y + 8;
    }

    function drawFooter() {
      ln(MARGIN_L, FOOTER_Y, MARGIN_L + CONTENT_W, FOOTER_Y, C.grey200, 0.3);
      sf('normal', 6, C.grey500);
      doc.text('CO2 Compass  \u00B7  Lindner Group', MARGIN_L, FOOTER_Y + 8);
      sf('normal', 5.5, C.grey500);
      doc.text(
        'GWP in kg CO2eq / m\u00B2  |  EN 15804+A2  |  For internal reference only',
        PAGE_W / 2,
        FOOTER_Y + 8,
        { align: 'center' }
      );
      pageNum++;
      sf('bold', 7, C.grey500);
      doc.text(`${pageNum} / 2`, PAGE_W - MARGIN_R, FOOTER_Y + 8, { align: 'right' });
    }

    // ─── Filter out EPD rows from tech items (they go in banner) ───
    const filteredTech = (techItems || []).filter(
      ([l]) => !String(l || '').toLowerCase().includes('epd')
    );

    // ─── Generate AI insight in parallel (don't block) ───
    let aiInsight = null;
    try {
      aiInsight = await window.LindnerPDFInsight.generate({
        selected,
        getA1c4,
        getD,
        product: titleLine1 || '',
        variant: titleLine2 || ''
      });
    } catch (_) {}


    /* ══════════════════════════════════════════════════════════════
       PAGE 1
       ══════════════════════════════════════════════════════════════ */

    const HDR_H = 36;
    gradientBar(0, 0, PAGE_W, HDR_H, C.steelDarkest, C.steelLight, 80);

    // ─── LEFT: CO2 Compass wordmark + tagline ───
    const wmW = 58, wmH = 18;
    const wmX = MARGIN_L;
    const wmY = (HDR_H - wmH) / 2 - 1.5;
    if (assets?.wordmark) {
      try {
        doc.addImage(assets.wordmark, 'PNG', wmX, wmY, wmW, wmH, 'wh', 'SLOW');
      } catch (_) {
        try {
          doc.addImage(assets.wordmark, 'JPEG', wmX, wmY, wmW, wmH, 'wh2', 'SLOW');
        } catch (_2) {
          sf('bold', 12, C.white);
          doc.text('CO2 COMPASS', wmX, wmY + wmH - 4);
        }
      }
    } else {
      sf('bold', 12, C.white);
      doc.text('CO2 COMPASS', wmX, wmY + wmH - 4);
    }
    sf('normal', 6.5, [195, 212, 218]);
    doc.text('Understand  \u00B7  Navigate  \u00B7  Reduce', wmX + 2, wmY + wmH + 4);

    // ─── RIGHT: title + Lindner logo ───
    const rX = PAGE_W - MARGIN_R;
    const titleSize = 11.5;
    const rLogoBoxW = 38, rLogoBoxH = 12.5;
    const rTitleLogoGap = 4.5;
    const rightBlockH = titleSize + rTitleLogoGap + rLogoBoxH;
    const rightBlockY = (HDR_H - rightBlockH) / 2 + titleSize;
    sf('bold', titleSize, C.white);
    doc.text('Nachhaltiges Bauen CO2 Report', rX - 2, rightBlockY, { align: 'right' });

    const rLogoY = rightBlockY + rTitleLogoGap;
    const rLogoX = rX - rLogoBoxW - 2;
    if (assets?.lindnerWhite || assets?.lindner) {
      const logo = assets.lindnerWhite || assets.lindner;
      try {
        doc.addImage(logo, 'PNG', rLogoX, rLogoY, rLogoBoxW, rLogoBoxH, 'lh', 'SLOW');
      } catch (_) {
        try {
          doc.addImage(logo, 'JPEG', rLogoX, rLogoY, rLogoBoxW, rLogoBoxH, 'lh2', 'SLOW');
        } catch (_2) {
          sf('bold', 10, C.white);
          doc.text('Lindner', rX - 2, rLogoY + rLogoBoxH / 2 + 3, { align: 'right' });
        }
      }
    } else {
      sf('bold', 10, C.white);
      doc.text('Lindner', rX - 2, rLogoY + rLogoBoxH / 2 + 3, { align: 'right' });
    }

    fb(0, HDR_H, PAGE_W, 2, C.red);
    let y = HDR_H + 2;
    addWatermark();
    y += 6;

    // ─── Product title ───
    sf('bold', 18, C.inkBlack);
    const tLines = doc
      .splitTextToSize(ascii(titleLine2 || titleLine1 || ''), CONTENT_W * 0.7)
      .slice(0, 3);
    doc.text(tLines, MARGIN_L, y);
    y += tLines.length * 7 + 2;

    sf('normal', 7.5, C.grey500);
    doc.text(
      ascii([floorType, `EPD valid ${issueD} - ${validD}`, today].filter(Boolean).join('  \xB7  ')),
      MARGIN_L,
      y
    );
    y += 9;

    // ─── METRIC CARDS ───
    const mW3 = (CONTENT_W - 4) / 3, mH = 14;
    filteredTech.slice(0, 3).forEach(([lbl, val], i) => {
      const mx = MARGIN_L + i * (mW3 + 2);
      fb(mx, y, mW3, mH, i === 0 ? C.steelMist : C.grey100);
      doc.setDrawColor(...C.grey200);
      doc.setLineWidth(0.3);
      doc.rect(mx, y, mW3, mH, 'S');
      if (i === 0) {
        doc.setFillColor(...C.red);
        doc.rect(mx, y, 3, mH, 'F');
      }
      sf('normal', 6, C.grey500);
      doc.text(ascii(lbl), mx + (i === 0 ? 6 : 4), y + 5);
      sf('bold', 10.5, C.inkBlack);
      doc.text(ascii(String(val || '--')), mx + (i === 0 ? 6 : 4), y + 12);
    });
    y += mH + 5;
    ln(MARGIN_L, y, MARGIN_L + CONTENT_W, y, C.grey200, 0.3);
    y += 5;

    // ─── TWO COLUMN: Specs + Phase legend (L) | Scenarios (R) ───
    const colGap = 7;
    const leftW = (CONTENT_W - colGap) * 0.4;
    const rightW = CONTENT_W - leftW - colGap;
    const leftX = MARGIN_L;
    const rightX = MARGIN_L + leftW + colGap;
    const twoY = y;

    let lY2 = secHead('Technical specifications', leftX, y, leftW - 2);
    const spH = 5.8;
    filteredTech.forEach(([lbl, val], i) => {
      const ry = lY2 + i * spH;
      if (i % 2 === 0) fb(leftX, ry, leftW, spH, C.grey100);
      sf('normal', 7, C.grey500);
      doc.text(ascii(lbl), leftX + 3, ry + spH - 1.5);
      sf('bold', 7.5, C.inkBlack);
      doc.text(ascii(String(val || '--')), leftX + leftW - 3, ry + spH - 1.5, { align: 'right' });
    });
    lY2 += filteredTech.length * spH + 5;

    // Phase legend block
    lY2 = secHead('Lifecycle phase legend', leftX, lY2, leftW - 2) - 1;
    const phases = [
      { lbl: 'A1-A3', name: 'Production', col: PHASE.prod },
      { lbl: 'A4-A5', name: 'Construction', col: PHASE.cons },
      { lbl: 'C1-C4', name: 'End of life', col: PHASE.eol },
      { lbl: 'D', name: 'Benefit', col: PHASE.ben }
    ];
    const legW = (leftW - 3) / 2, legH = 12;
    phases.forEach((ph, pi) => {
      const px = leftX + (pi % 2) * (legW + 3);
      const py = lY2 + Math.floor(pi / 2) * (legH + 3);
      fr(px, py, legW, legH, 2, ph.col);
      sf('bold', 8.5, C.white);
      doc.text(ph.lbl, px + legW / 2, py + 5.5, { align: 'center' });
      sf('normal', 6, [235, 238, 239]);
      doc.text(ph.name, px + legW / 2, py + 10, { align: 'center' });
    });
    lY2 += 2 * (legH + 3) + 3;

    // Scenarios (RIGHT)
    let rY2 = secHead('End-of-life scenarios', rightX, twoY, rightW - 2);
    selected.forEach((s, i) => {
      const desc = getScenarioDesc ? getScenarioDesc(s) : '';
      const dl = desc ? doc.splitTextToSize(ascii(desc), rightW - 12) : [];
      const bH = Math.max(8 + (dl.length > 0 ? dl.length * 3.8 + 2 : 0), 13);
      fb(rightX, rY2, rightW, bH, scBg(i));
      fb(rightX, rY2, rightW, 3, sc(i));
      doc.setFillColor(...sc(i));
      doc.rect(rightX, rY2, 3, bH, 'F');
      doc.setDrawColor(...C.grey200);
      doc.setLineWidth(0.3);
      doc.roundedRect(rightX, rY2, rightW, bH, 1, 1, 'S');
      sf('bold', 8.5, C.inkBlack);
      doc.text(ascii(s.name), rightX + 6, rY2 + 9);
      if (dl.length > 0) {
        sf('normal', 6.5, C.grey600);
        doc.text(dl, rightX + 6, rY2 + 14);
      }
      rY2 += bH + 3;
    });

    y = Math.max(lY2, rY2) + 3;
    ln(MARGIN_L, y, MARGIN_L + CONTENT_W, y, C.grey200, 0.3);
    y += 5;

    // ─── MODULE TABLE ───
    y = secHead('Module results  (GWP \u2013 kg CO2eq / m\u00B2)', MARGIN_L, y, CONTENT_W * 0.55);
    const mods = [
      { key: 'A1-A3', ph: 'prod' },
      { key: 'A4', ph: 'cons' },
      { key: 'A5', ph: 'cons' },
      { key: 'C1', ph: 'eol' },
      { key: 'C2', ph: 'eol' },
      { key: 'C3', ph: 'eol' },
      { key: 'C4', ph: 'eol' },
      { key: 'D', ph: 'ben' }
    ];
    const phBand = { prod: PHASE.prod, cons: PHASE.cons, eol: PHASE.eol, ben: PHASE.ben };
    const phGrps = [
      { lbl: 'PRODUCTION', mods: ['A1-A3'], col: PHASE.prod },
      { lbl: 'CONSTRUCTION', mods: ['A4', 'A5'], col: PHASE.cons },
      { lbl: 'END OF LIFE', mods: ['C1', 'C2', 'C3', 'C4'], col: PHASE.eol },
      { lbl: 'BENEFIT', mods: ['D'], col: PHASE.ben }
    ];
    const scW = 44, mWx = (CONTENT_W - scW) / mods.length, rH = 7.5;

    fb(MARGIN_L, y, scW, 6, C.steelDarkest);
    sf('bold', 5, C.white);
    doc.text('SCENARIO', MARGIN_L + scW / 2, y + 4, { align: 'center' });
    let phX = MARGIN_L + scW;
    phGrps.forEach((ph) => {
      const bw = ph.mods.length * mWx;
      fb(phX, y, bw, 6, ph.col);
      sf('bold', 4.5, [240, 242, 243]);
      doc.text(ph.lbl, phX + bw / 2, y + 4, { align: 'center' });
      phX += bw;
    });
    y += 6;
    fb(MARGIN_L, y, scW, 5, C.steelDark);
    sf('bold', 5, [195, 205, 207]);
    doc.text('Module \u2192', MARGIN_L + scW / 2, y + 3.5, { align: 'center' });
    mods.forEach((m, mi) => {
      const mx = MARGIN_L + scW + mi * mWx;
      fb(mx, y, mWx, 5, phBand[m.ph]);
      sf('bold', 7, C.white);
      doc.text(m.key, mx + mWx / 2, y + 3.5, { align: 'center' });
    });
    y += 5;

    const tblStart = y;
    selected.forEach((s, si) => {
      fb(MARGIN_L, y, CONTENT_W, rH, si % 2 === 0 ? C.white : C.grey100);
      doc.setFillColor(...sc(si));
      doc.rect(MARGIN_L, y + 1, 2.5, rH - 2, 'F');
      sf('bold', 8, C.inkBlack);
      doc.text(ascii((s.name || '').substring(0, 22)), MARGIN_L + 5, y + rH / 2 + 2);
      mods.forEach((m, mi) => {
        const mx = MARGIN_L + scW + mi * mWx;
        let v;
        if (m.key === 'A1-A3') v = getFixed('A1-A3');
        else if (m.key === 'A4') v = getFixed('A4');
        else if (m.key === 'A5') v = getFixed('A5');
        else if (m.key === 'D') v = getD(s);
        else v = getModule(m.key, s);
        const isNeg = typeof v === 'number' && v < 0;
        const isD = m.key === 'D';
        const isHigh = typeof v === 'number' && v > HIGH_VALUE_THRESHOLD && !isNeg;
        if (isD && isNeg) fb(mx + 0.4, y + 0.4, mWx - 0.8, rH - 0.8, C.benefitBg);
        if (isHigh) fb(mx + 0.4, y + 0.4, mWx - 0.8, rH - 0.8, C.hiBg);
        sf(
          isNeg || isHigh ? 'bold' : 'normal',
          isD ? 8 : 7.5,
          isHigh ? C.hiText : (isNeg ? C.benefitTxt : C.ink)
        );
        doc.text(pdfFmt(v), mx + mWx / 2, y + rH / 2 + 2, { align: 'center' });
      });
      ln(MARGIN_L, y + rH, MARGIN_L + CONTENT_W, y + rH, C.grey200, 0.12);
      y += rH;
    });

    sf('normal', 5.5, C.hiText);
    doc.text(
      '* Values above ' + HIGH_VALUE_THRESHOLD + ' kg CO2eq/m\u00B2 are highlighted as significant contributors',
      MARGIN_L,
      y + 3
    );
    doc.setDrawColor(...C.grey300);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN_L, tblStart - 10, CONTENT_W, y - tblStart + 10, 1, 1, 'S');
    y += 8;

    // ─── BAR CHART ───
    y = secHead('Carbon profile by module', MARGIN_L, y, CONTENT_W * 0.45);
    selected.forEach((s, i) => {
      fr(MARGIN_L + i * 66, y, 5, 5, 1, sc(i));
      sf('normal', 7, C.grey600);
      doc.text(ascii((s.name || '').substring(0, 22)), MARGIN_L + i * 66 + 7.5, y + 4);
    });
    y += 8;

    const grps = buildModGroups();
    const availH = FOOTER_Y - y - 20;
    const pH = Math.min(Math.max(availH, 26), 46);
    const YAX = 12, pX = MARGIN_L + YAX, pW = CONTENT_W - YAX;
    const allV = grps.flatMap((g) => g.bars.map((b) => b.value)).filter((v) => v !== null);
    const rawPos = Math.max(0, ...allV.filter((v) => v > 0)) || 1;
    const rawNeg = Math.max(0, ...allV.filter((v) => v < 0).map((v) => Math.abs(v))) || 0;
    const mxPos = niceCeil(rawPos);
    const mxNeg = rawNeg > 0 ? niceCeil(rawNeg) : 0.5;
    const totR = mxPos + mxNeg;
    const posZ = totR > 0 ? (mxPos / totR) * pH : pH;
    const zY = y + posZ;
    fr(pX, y, pW, pH, 2, C.grey50);

    const gridVals = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      t,
      v: mxPos - t * totR,
      gy: y + t * pH
    }));
    gridVals.forEach(({ v, gy }) => {
      doc.setDrawColor(220, 225, 226);
      doc.setLineWidth(0.08);
      doc.line(pX, gy, pX + pW, gy);
      if (Math.abs(v) > 0.01) {
        sf('normal', 4.5, C.grey500);
        doc.text(pdfFmt(v), pX - 1.5, gy + 1.2, { align: 'right' });
      }
    });
    doc.setDrawColor(...C.red);
    doc.setLineWidth(0.6);
    doc.line(pX, zY, pX + pW, zY);
    sf('bold', 5, C.red);
    doc.text('0', pX - 1.5, zY + 1.2, { align: 'right' });

    const gW = pW / Math.max(grps.length, 1);
    grps.forEach((grp, gi) => {
      const gx = pX + gi * gW;
      const nB = grp.bars.length;
      const bW = Math.max((gW - 4) / Math.max(nB, 1) - 1, 2.5);
      const tot = nB * bW + (nB - 1) * 1;
      const sx = gx + (gW - tot) / 2;
      grp.bars.forEach((bar, bi) => {
        if (bar.value === null) return;
        const col = sc(bar.seriesIndex ?? bi);
        const isP = bar.value >= 0;
        const isHigh = isP && bar.value > HIGH_VALUE_THRESHOLD;
        const mag = isP
          ? (bar.value / mxPos) * posZ
          : (Math.abs(bar.value) / mxNeg) * (pH - posZ);
        const bH = Math.max(mag, 1.5);
        const bx = sx + bi * (bW + 1);
        const by = isP ? zY - bH : zY;
        const fillCol = isHigh ? C.red : col;
        doc.setFillColor(...fillCol);
        doc.roundedRect(bx, by, bW, bH, 0.8, 0.8, 'F');
        if (bH > 2.5) {
          sf('bold', 5.5, isHigh ? C.red : col);
          if (isP) doc.text(pdfFmt(bar.value), bx + bW / 2, by - 1, { align: 'center' });
          else doc.text(pdfFmt(bar.value), bx + bW / 2, by + bH + 3, { align: 'center' });
        }
      });
      sf('bold', 5.5, C.inkBlack);
      doc.text(grp.label, gx + gW / 2, y + pH + 4.5, { align: 'center' });
      sf('normal', 4, C.grey500);
      const subLines = doc.splitTextToSize(ascii(grp.sub || ''), gW + 4);
      doc.text(subLines.slice(0, 2), gx + gW / 2, y + pH + 7.5, { align: 'center' });
    });

    drawFooter();


    /* ══════════════════════════════════════════════════════════════
       PAGE 2
       ══════════════════════════════════════════════════════════════ */

    doc.addPage();
    const SH = 24;
    gradientBar(0, 0, PAGE_W, SH, C.steelDarkest, C.steelLight, 60);

    // ─── LEFT: small wordmark ───
    const swmW = 40, swmH = 12;
    const sTagSize = 6, sTagGap = 1.5;
    const sLeftBlockH = swmH + sTagGap + sTagSize;
    const swmX = MARGIN_L;
    const swmY = (SH - sLeftBlockH) / 2;
    if (assets?.wordmark) {
      try {
        doc.addImage(assets.wordmark, 'PNG', swmX, swmY, swmW, swmH, 'swh', 'SLOW');
      } catch (_) {
        sf('bold', 9, C.white);
        doc.text('CO2 COMPASS', swmX, swmY + swmH - 3);
      }
    } else {
      sf('bold', 9, C.white);
      doc.text('CO2 COMPASS', swmX, swmY + swmH - 3);
    }
    sf('normal', sTagSize, [215, 228, 232]);
    doc.text(
      'Understand   \u00B7   Navigate   \u00B7   Reduce',
      swmX,
      swmY + swmH + sTagGap + sTagSize - 1
    );

    // ─── RIGHT: title + small Lindner ───
    const srX = PAGE_W - MARGIN_R;
    const sTitleSize = 9;
    const slBoxW = 25, slBoxH = 8.5;
    const sRTitleLogoGap = 2.5;
    const sRightBlockH = sTitleSize + sRTitleLogoGap + slBoxH;
    const sRightBlockY = (SH - sRightBlockH) / 2 + sTitleSize;
    sf('bold', sTitleSize, C.white);
    doc.text('Nachhaltiges Bauen CO2 Report', srX - 2, sRightBlockY, { align: 'right' });

    const slY = sRightBlockY + sRTitleLogoGap;
    const slX = srX - slBoxW - 2;
    if (assets?.lindnerWhite || assets?.lindner) {
      const logo = assets.lindnerWhite || assets.lindner;
      try {
        doc.addImage(logo, 'PNG', slX, slY, slBoxW, slBoxH, 'lhsm', 'SLOW');
      } catch (_) {
        try {
          doc.addImage(logo, 'JPEG', slX, slY, slBoxW, slBoxH, 'lhsm2', 'SLOW');
        } catch (_2) {
          sf('bold', 8, C.white);
          doc.text('Lindner', srX - 2, slY + slBoxH / 2 + 2, { align: 'right' });
        }
      }
    } else {
      sf('bold', 8, C.white);
      doc.text('Lindner', srX - 2, slY + slBoxH / 2 + 2, { align: 'right' });
    }

    fb(0, SH, PAGE_W, 2, C.red);
    y = SH + 2;
    addWatermark();
    y += 6;

    // ─── SCENARIO COMPARISON CARDS ───
    y = secHead('Scenario comparison', MARGIN_L, y, 55);
    const nC = selected.length, gapC = 5;
    const cW2 = (CONTENT_W - (nC - 1) * gapC) / Math.max(nC, 1);
    const cH = 58;
    selected.forEach((s, i) => {
      const cx = MARGIN_L + i * (cW2 + gapC);
      const col = sc(i);
      const a = getA1c4(s), d = getD(s);
      const net = a !== null && d !== null ? a + d : a;
      const saved = a !== null && net !== null ? a - net : null;
      fb(cx, y, cW2, cH, scBg(i));
      fb(cx, y, cW2, 5, col);
      doc.setDrawColor(...C.grey300);
      doc.setLineWidth(0.35);
      doc.roundedRect(cx, y, cW2, cH, 2, 2, 'S');
      sf('bold', 9.5, C.inkBlack);
      doc.text(ascii((s.name || '').substring(0, 26)), cx + 5, y + 13, { maxWidth: cW2 - 10 });
      [
        ['A1-C4 total', a, false],
        ['Module D', d, d !== null && d < 0],
        ['Net carbon', net, net !== null && net < 0]
      ].forEach(([lbl, val, isG], ri) => {
        const ky = y + 19 + ri * 10.5;
        sf('normal', 7, C.grey500);
        doc.text(lbl, cx + 5, ky);
        sf('bold', isG ? 11.5 : 10.5, isG ? C.benefitTxt : C.inkBlack);
        doc.text(pdfFmt(val), cx + cW2 - 5, ky, { align: 'right' });
        if (ri < 2) ln(cx + 5, ky + 2.8, cx + cW2 - 5, ky + 2.8, C.grey200, 0.12);
      });
      if (saved !== null && saved > 0.001) {
        fr(cx + 4, y + cH - 10, cW2 - 8, 8, 2, C.redBg);
        sf('bold', 6, C.red);
        doc.text(
          'Saved ' + pdfFmt(saved) + ' kg CO2eq vs A1-C4',
          cx + cW2 / 2,
          y + cH - 5,
          { align: 'center', maxWidth: cW2 - 10 }
        );
      }
    });
    y += cH + 8;

    // ─── A1-C4 + NET CARBON CHARTS ───
    y = secHead('A1-C4 total  &  net carbon per scenario', MARGIN_L, y, 88);
    const hW = (CONTENT_W - 7) / 2;
    const ch2 = 60;
    [
      ['A1-C4 lifecycle total', (s2) => getA1c4(s2)],
      ['Net carbon  (A1-C4 + D)', (s2) => {
        const a2 = getA1c4(s2), d2 = getD(s2);
        return a2 === null ? null : d2 !== null ? a2 + d2 : a2;
      }]
    ].forEach(([title, getVal], ci) => {
      const cx2 = MARGIN_L + ci * (hW + 7);
      const vals = selected.map((s2) => ({ v: Number(getVal(s2)), s: s2 }));
      const maxV = Math.max(...vals.map((x) => Math.abs(x.v || 0)), 0.001) * 1.15;
      const hasNeg = vals.some((x) => x.v !== null && x.v < 0);
      sf('bold', 8, C.grey800);
      doc.text(ascii(title), cx2, y);
      sf('normal', 5.5, C.grey500);
      doc.text('kg CO2eq / m\u00B2', cx2, y + 5);
      const cpY = y + 8, cpH = ch2 - 16;
      fr(cx2, cpY, hW, cpH, 2, C.grey50);
      doc.setDrawColor(...C.grey200);
      doc.setLineWidth(0.15);
      doc.roundedRect(cx2, cpY, hW, cpH, 2, 2, 'S');
      const zBase = hasNeg ? cpY + cpH * 0.6 : cpY + cpH - 2;
      doc.setDrawColor(...C.red);
      doc.setLineWidth(0.45);
      doc.line(cx2 + 4, zBase, cx2 + hW - 4, zBase);
      sf('bold', 6, C.red);
      doc.text('0', cx2 + 2, zBase + 1.5);
      const slW = (hW - 14) / Math.max(selected.length, 1);
      const bW2 = Math.min(slW - 4, 22);
      vals.forEach(({ v, s: s2 }, bi) => {
        if (v === null || Number.isNaN(v)) return;
        const col2 = sc(bi);
        const slX = cx2 + 7 + bi * slW;
        const bx2 = slX + (slW - bW2) / 2;
        const isP2 = v >= 0;
        const mxBH = isP2 ? zBase - cpY - 3 : cpY + cpH - zBase - 3;
        const bH2 = Math.max((Math.abs(v) / maxV) * mxBH * 0.95, 2.5);
        const by2 = isP2 ? zBase - bH2 : zBase;
        doc.setFillColor(...col2);
        doc.roundedRect(bx2, by2, bW2, bH2, 1.5, 1.5, 'F');
        sf('bold', 7, col2);
        if (isP2) doc.text(pdfFmt(v), bx2 + bW2 / 2, by2 - 1.5, { align: 'center' });
        else doc.text(pdfFmt(v), bx2 + bW2 / 2, by2 + bH2 + 4, { align: 'center' });
        sf('normal', 5.5, C.grey500);
        const lns = doc.splitTextToSize(ascii(s2.name || ''), slW + 4);
        doc.text(lns[0], slX + slW / 2, cpY + cpH + 5, { align: 'center' });
        if (lns[1]) doc.text(lns[1], slX + slW / 2, cpY + cpH + 9, { align: 'center' });
      });
    });
    y += ch2 + 7;

    // ─── DONUT RINGS ───
    y = secHead('Module D benefit  \u2013  % of A1-C4 burden avoided', MARGIN_L, y, 98);
    const rSz = 44, rStk = 10, rR2 = (rSz - rStk) / 2;
    const rSpc = CONTENT_W / Math.max(selected.length, 1);
    selected.forEach((s, i) => {
      const a1 = Number(getA1c4(s));
      const dv = Number(getD(s));
      const nv = a1 !== null && !Number.isNaN(dv) ? a1 + dv : a1;
      let sv = 0;
      if (a1 !== null && nv !== null && a1 !== 0 && !Number.isNaN(a1)) {
        sv = Math.max(0, 100 - Math.abs(nv / a1) * 100);
      }
      const cx3 = MARGIN_L + i * rSpc + rSpc / 2;
      const cy3 = y + rSz / 2 + 4;
      doc.setDrawColor(...C.steelPaler);
      doc.setLineWidth(rStk);
      doc.circle(cx3, cy3, rR2, 'S');

      // Draw gradient arc by stepping
      if (sv > 0.5) {
        const sA = -Math.PI / 2;
        const steps = 120;
        const colorStart = [200, 16, 46];
        const colorEnd = [155, 12, 36];
        doc.setLineWidth(rStk);
        doc.setLineCap('butt');
        let prev = null;
        for (let pi = 0; pi <= steps; pi++) {
          const t = pi / steps;
          if (t > sv / 100) break;
          const r = Math.round(colorStart[0] + (colorEnd[0] - colorStart[0]) * t);
          const g = Math.round(colorStart[1] + (colorEnd[1] - colorStart[1]) * t);
          const b = Math.round(colorStart[2] + (colorEnd[2] - colorStart[2]) * t);
          doc.setDrawColor(r, g, b);
          const ang = sA + t * 2 * Math.PI;
          const rx = cx3 + Math.cos(ang) * rR2;
          const ry = cy3 + Math.sin(ang) * rR2;
          if (prev) doc.line(prev.x, prev.y, rx, ry);
          prev = { x: rx, y: ry };
        }
      }

      sf('bold', 13, C.red);
      doc.text(sv.toFixed(1) + '%', cx3, cy3 + 4, { align: 'center' });
      sf('bold', 5, C.grey500);
      doc.text('SAVED', cx3, cy3 + 9, { align: 'center' });
      const lbY = cy3 + rSz / 2 + 7;
      sf('bold', 8.5, C.inkBlack);
      doc.text(ascii((s.name || '').substring(0, 22)), cx3, lbY, { align: 'center', maxWidth: rSpc - 5 });
      sf('normal', 6, C.grey500);
      doc.text('Net: ' + pdfFmt(nv), cx3, lbY + 6, { align: 'center' });
      doc.text('A1-C4: ' + pdfFmt(a1), cx3, lbY + 11, { align: 'center' });
    });
    y += rSz + 28;

    // ─── KEY INSIGHT BOX ───
    const rawInsight = aiInsight || window.LindnerPDFInsight.fallback({ selected, getA1c4, getD });
    const boxH = 30;
    fb(MARGIN_L, y, CONTENT_W, boxH, C.steelMist);
    doc.setFillColor(...C.red);
    doc.rect(MARGIN_L, y, 4, boxH, 'F');
    doc.setDrawColor(...C.grey300);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN_L, y, CONTENT_W, boxH, 2, 2, 'S');
    sf('bold', 7.5, C.red);
    doc.text('KEY INSIGHT', MARGIN_L + 8, y + 8);
    sf('normal', 7, C.ink);
    const iMaxW = CONTENT_W - 16;
    doc.splitTextToSize(ascii(rawInsight), iMaxW).slice(0, 4).forEach((l2, idx) => {
      doc.text(l2, MARGIN_L + 8, y + 15 + idx * 5.5, { maxWidth: iMaxW });
    });
    y += boxH + 6;

    // ─── DISCLAIMER ───
    ln(MARGIN_L, y, MARGIN_L + CONTENT_W, y, C.grey200, 0.15);
    y += 4;
    sf('normal', 6, C.grey500);
    doc.text(
      'GWP values in kg CO2eq per m\u00B2. Negative values indicate carbon benefit. System boundary per EN 15804+A2.',
      MARGIN_L,
      y,
      { maxWidth: CONTENT_W }
    );
    y += 4.5;
    doc.text(
      'Generated from EPD data for internal reference only. Consult the verified EPD document for full disclosure.',
      MARGIN_L,
      y,
      { maxWidth: CONTENT_W }
    );

    drawFooter();
    doc.save(filename);
  }


  /* ─────────────────────────────────────────────────────────────────
     PUBLIC API
     ───────────────────────────────────────────────────────────────── */

  /**
   * Main entry point. Page-tool callers pass all data + labels via opts.
   * Auto-loads jsPDF, assets, and builds the report.
   */
  async function exportReport(opts) {
    // Dependency checks
    if (!window.jspdf) {
      alert('PDF library (jsPDF) not loaded. Check your HTML includes.');
      return;
    }
    if (!window.LindnerPDFAssets) {
      alert('PDF assets module not loaded. Check pdf-assets.js is included.');
      return;
    }
    if (!window.LindnerPDFInsight) {
      alert('PDF insight module not loaded. Check pdf-insight.js is included.');
      return;
    }

    const { jsPDF } = window.jspdf;

    // Auto-load assets
    const assets = await window.LindnerPDFAssets.load();

    // Create doc
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Build
    await buildReport({
      ...opts,
      doc,
      assets
    });
  }

  // Expose to window
  window.LindnerPDF = {
    export: exportReport,
    version: '1.0',
    // Expose utils in case sub-tools need them
    utils: { pdfFmt, niceCeil, ascii }
  };

  console.log('[LindnerPDF] Engine loaded. Public API: window.LindnerPDF.export(opts)');

})(window);