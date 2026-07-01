// ============================================================
// CONTEXT-AWARE GUIDED TOUR (auto-continues across pages)
// ============================================================

export function initTour() {
  const els = {
    helpBtn: document.getElementById("helpBtn"),
    overlay: document.getElementById("tourOverlay"),
    spotlight: document.getElementById("tourSpotlight"),
    tooltip: document.getElementById("tourTooltip"),
    title: document.getElementById("tourTitle"),
    body: document.getElementById("tourBody"),
    count: document.getElementById("tourStepCount"),
    next: document.getElementById("tourNext"),
    skip: document.getElementById("tourSkip"),
    prev: document.getElementById("tourPrev"),
    progress: document.getElementById("tourProgress"),
    langBtns: document.querySelectorAll(".tour-lang-toggle button"),
    arrow: document.getElementById("tourArrow"),
  };

  let lang = localStorage.getItem("tourLang") || "en";
  let steps = [];
  let stepIndex = 0;
  let active = false;
  let trackFn = null;
  let waitCleanup = [];
  let currentContext = null;
  let pageWatcher = null;

  const L = {
    en: { next: "Next →", done: "Finish ✓", skip: "Skip", prev: "← Back",
          step: (a, b) => `Step ${a} of ${b}`,
          hint: "👆 Try it now — then click Next",
          mustClick: "👉 Click the highlighted button to continue" },
    de: { next: "Weiter →", done: "Fertig ✓", skip: "Überspringen", prev: "← Zurück",
          step: (a, b) => `Schritt ${a} von ${b}`,
          hint: "👆 Probieren Sie es aus — dann Weiter",
          mustClick: "👉 Klicken Sie auf die markierte Schaltfläche" },
  };

  // ============================================================
  // CONTEXT DETECTION
  // ============================================================
  function detectContext() {
    const appRoot = document.getElementById("appRoot");
    const scenarioListEl = document.getElementById("scenarioList");

    if (appRoot.classList.contains("mode-total")) return "total";

    if (appRoot.classList.contains("mode-scenarios")) {
      // ring grids = per-component detail (choosing initial/RE)
      const hasRings = scenarioListEl?.querySelector(".ring-grid, .ring-item");
      if (hasRings) return "scenarioDetail";
      // building overview = room blocks with View/Edit buttons
      const hasRoomBlocks = scenarioListEl?.querySelector(".comp-scenarios");
      if (hasRoomBlocks) return "buildingScenarios";
      return "scenarioDetail";
    }
    return "room";
  }

  // check if all building rooms are fully configured
  function allRoomsConfigured() {
    const showBtn = document.getElementById("showTotalBtn");
    return showBtn && !showBtn.disabled;
  }

  // ============================================================
  // STEP SETS
  // ============================================================
  const CONTEXTS = {
    room: [
      { target: ".building-nav-card",
        title: { en: "Welcome to RE Tool", de: "Willkommen bei RE Tool" },
        body: { en: "This tour guides you through your project. Use the tool freely at each step, then click Next.",
                de: "Diese Tour führt Sie durch Ihr Projekt. Klicken Sie auf Weiter." },
        placement: "right" },
      { target: "#buildingNameInput",
        title: { en: "1 · Name your project", de: "1 · Projekt benennen" },
        body: { en: "Type a name for your building, then click Next.",
                de: "Geben Sie einen Namen ein, dann Weiter." },
        placement: "right", hint: true },
      { target: ".building-nav-card .field-grid",
        title: { en: "2 · Location & type", de: "2 · Standort & Typ" },
        body: { en: "Enter location and choose a project type, then click Next.",
                de: "Geben Sie Standort und Typ ein, dann Weiter." },
        placement: "right", hint: true },
      { target: "#addFloorBtn",
        title: { en: "3 · Add floors", de: "3 · Etagen hinzufügen" },
        body: { en: "Click '+ Add Floor' to add floors, then click Next.",
                de: "Klicken Sie auf '+ Etage hinzufügen', dann Weiter." },
        placement: "above", hint: true },
      { target: ".building-tree",
        title: { en: "4 · Add & name rooms", de: "4 · Räume hinzufügen" },
        body: { en: "Use '+ Add Room' under a floor. Click a name to rename. Then click Next.",
                de: "Nutzen Sie '+ Raum hinzufügen'. Dann Weiter." },
        placement: "right", hint: true },
      { target: ".building-tree",
        title: { en: "5 · Select a room", de: "5 · Raum auswählen" },
        body: { en: "Click a room to select it — details load below. Then click Next.",
                de: "Klicken Sie auf einen Raum. Dann Weiter." },
        placement: "right", hint: true },
      { target: ".card:has(#lengthInput)", fallback: "#lengthInput",
        title: { en: "6 · Set dimensions", de: "6 · Maße festlegen" },
        body: { en: "Enter dimensions, click 'Generate Room', then click Next.",
                de: "Maße eingeben, 'Raum erstellen', dann Weiter." },
        placement: "right", hint: true },
      { target: "#componentRows",
        title: { en: "7 · Add components", de: "7 · Komponenten hinzufügen" },
        body: { en: "Click a component to add it — options expand below. Set area, product & type. Then click Next.",
                de: "Klicken Sie auf eine Komponente. Dann Weiter." },
        placement: "right", hint: true },
      { target: "#goScenariosBtn",
        title: { en: "8 · Go to RE-Strategies", de: "8 · Zu RE-Strategien" },
        body: { en: "Click this button to open RE-Strategy selection. You must click it to continue.",
                de: "Klicken Sie auf diese Schaltfläche. Sie müssen klicken." },
        placement: "above",
        mustClick: { selector: "#goScenariosBtn", requireEnabled: true, changesPage: true } },
    ],

        buildingScenarios: [
      { target: "#scenarioList",
        title: { en: "Configure each room", de: "Jeden Raum konfigurieren" },
        body: { en: "This room still needs configuring. Click its button to set the components' scenarios.",
                de: "Dieser Raum muss noch konfiguriert werden. Klicken Sie auf die Schaltfläche." },
        placement: "right",
        mustClick: { findUnconfiguredRoomBtn: true, changesPage: true } },
    ],

    // when ALL rooms configured
    buildingReady: [
      { target: "#showTotalBtn",
        title: { en: "Show building CO₂ savings", de: "CO₂-Einsparung anzeigen" },
        body: { en: "All rooms are configured! 🎉 Click here to calculate the building's total CO₂ savings.",
                de: "Alle Räume konfiguriert! 🎉 Klicken Sie hier für die Gesamteinsparung." },
        placement: "above",
        mustClick: { selector: "#showTotalBtn", requireEnabled: true, changesPage: true } },
    ],

            scenarioDetail: [
      { target: "#scenarioList",
        title: { en: "Select scenarios", de: "Szenarien wählen" },
        body: { en: "For each component: choose the INITIAL state, then the RE-Strategy. The tour updates as you go.",
                de: "Wählen Sie für jede Komponente den Ausgangszustand, dann die RE-Strategie." },
        placement: "right",
        smartScenario: true },   // ← special: auto-tracks progress
      { target: "#backToRoomBtn",
        title: { en: "Back to Building Scenarios", de: "Zurück zu Gebäude-Szenarien" },
        body: { en: "This room is done! Click here to go back and configure the next room.",
                de: "Raum fertig! Klicken Sie hier für den nächsten Raum." },
        placement: "below",
        mustClick: { selector: "#backToRoomBtn", changesPage: true } },
    ],

    total: [
      { target: "#totalCard",
        title: { en: "Your results 🌱", de: "Ihre Ergebnisse 🌱" },
        body: { en: "Here are your total CO₂ savings — initial, after RE, and how much you saved. Tour complete!",
                de: "Hier sind Ihre CO₂-Einsparungen. Tour abgeschlossen!" },
        placement: "left" },
    ],
  };

    function buildStepsForContext(ctx) {
    if (ctx === "buildingReadyDirect") {
      return [...CONTEXTS.buildingReady];
    }
    if (ctx === "buildingScenarios") {
      if (allRoomsConfigured()) return [...CONTEXTS.buildingReady];
      // check if there's an unconfigured room
      const nextBtn = findNextRoomButton();
      if (!nextBtn) return [...CONTEXTS.buildingReady];   // safety
      return [...CONTEXTS.buildingScenarios];
    }
    return [...(CONTEXTS[ctx] || CONTEXTS.room)];
  }

  // ============================================================
  // PAGE-CHANGE WATCHER — the KEY fix
  // After a page-changing click, wait for the DOM/mode to settle,
  // then re-detect context and continue the tour automatically.
  // ============================================================
    function waitForPageChangeThenContinue() {
    const prevContext = currentContext;
    let settleTimer = null;
    let fired = false;

    const check = () => {
      if (fired || !active) return;
      const newCtx = detectContext();

      // Determine if something meaningful changed
      let shouldContinue = false;
      let targetCtx = newCtx;

      if (newCtx !== prevContext) {
        shouldContinue = true;
        // if we landed on building scenarios, decide: more rooms or ready?
        if (newCtx === "buildingScenarios") {
          targetCtx = allRoomsConfigured() ? "buildingReadyDirect"
                    : (findNextRoomButton() ? "buildingScenarios" : "buildingReadyDirect");
        }
      }

      if (shouldContinue) {
        fired = true;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          if (!active) return;
          restartInContext(targetCtx);
        }, 500);
      }
    };

    if (pageWatcher) pageWatcher.disconnect();
    pageWatcher = new MutationObserver(check);
    pageWatcher.observe(document.getElementById("appRoot"), {
      attributes: true, childList: true, subtree: true,
      attributeFilter: ["class"],
    });

    let polls = 0;
    const poll = setInterval(() => {
      if (!active || fired || polls++ > 25) { clearInterval(poll); return; }
      check();
    }, 300);
    clickWaitCleanup.push(() => clearInterval(poll));
  }

  function restartInContext(ctx) {
    currentContext = ctx;
    steps = buildStepsForContext(ctx);
    stepIndex = 0;
    if (pageWatcher) { pageWatcher.disconnect(); pageWatcher = null; }
    showStep(0);
  }

  // ============================================================
  function findTarget(step) {
    let el = null;
    try { el = document.querySelector(step.target); } catch {}
    if (!el && step.fallback) el = document.querySelector(step.fallback);
    return el;
  }

  function showStep(i) {
    stepIndex = i;
    const step = steps[i];
    if (!step) return endTour();

    const el = findTarget(step);
    if (!el) {
      // retry once (dynamic content), else center
      setTimeout(() => {
        const retry = findTarget(step);
        if (retry) positionOnTarget(retry, step);
        else positionCentered(step);
      }, 400);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    setTimeout(() => positionOnTarget(el, step), 380);
  }

  function positionCentered(step) {
    els.spotlight.style.width = "0px";
    els.spotlight.style.height = "0px";
    els.spotlight.classList.remove("pulse");
    renderContent(step);
    els.tooltip.style.left = `${window.innerWidth / 2 - 170}px`;
    els.tooltip.style.top = `${window.innerHeight / 2 - 120}px`;
    els.arrow.className = "tour-arrow arrow-hidden";
    stopTracking();
  }

    function positionOnTarget(el, step) {
    const rect = el.getBoundingClientRect();
    const pad = 8;
    els.spotlight.style.left = `${rect.left - pad}px`;
    els.spotlight.style.top = `${rect.top - pad}px`;
    els.spotlight.style.width = `${rect.width + pad * 2}px`;
    els.spotlight.style.height = `${rect.height + pad * 2}px`;
    els.spotlight.classList.add("pulse");

    renderContent(step);
    placeTooltip(rect, step.placement || "auto");
    startTracking(el, step);

    cleanupClickWaits();

    if (step.mustClick) {
      els.next.style.display = "none";
      attachMustClick(step.mustClick);
    } else if (step.smartScenario) {
      attachSmartScenario();      // ← NEW
    } else {
      els.next.style.display = "";
    }
  }

    // Reads the app's actual scenario progress and updates the tooltip live.
  // Auto-advances to the "Back" step when ALL components are done.
  let scenarioObserver = null;
  function attachSmartScenario() {
    els.next.style.display = "none";   // controlled automatically
    updateScenarioHint();

    // watch scenario list for changes (user picks a ring → app re-renders)
    const listEl = document.getElementById("scenarioList");
    if (scenarioObserver) scenarioObserver.disconnect();
    scenarioObserver = new MutationObserver(() => {
      if (!active) return;
      updateScenarioHint();
    });
    scenarioObserver.observe(listEl, { childList: true, subtree: true });
    clickWaitCleanup.push(() => { scenarioObserver?.disconnect(); scenarioObserver = null; });
  }

  function updateScenarioHint() {
    const listEl = document.getElementById("scenarioList");
    if (!listEl) return;

    const blocks = [...listEl.querySelectorAll(".comp-scenarios")];
    if (!blocks.length) return;

    let total = blocks.length;
    let done = 0;
    let currentComp = null;
    let currentStage = null;   // "initial" | "re"

    for (const block of blocks) {
      const name = block.querySelector(".comp-scenarios-name")?.textContent || "component";
      const text = block.textContent.toLowerCase();

      // Detect stage from the app's own labels
      const isDone = /→/.test(block.textContent) &&   // has arrow (init→re result)
                     !/step 1|step 2|choose initial|choose re/i.test(text);
      const isInitial = /step 1|choose initial/i.test(text);
      const isRE = /step 2|choose re/i.test(text);

      if (isDone) { done++; continue; }

      if (!currentComp) {
        currentComp = name;
        currentStage = isRE ? "re" : "initial";
      }
    }

    // update tooltip content dynamically
    if (done >= total) {
      // all components done → move to "Back to Building Scenarios"
      cleanupClickWaits();
      if (scenarioObserver) { scenarioObserver.disconnect(); scenarioObserver = null; }
      goNext();   // advance to the Back step
      return;
    }

    // still configuring — show which comp & stage
    els.count.textContent = `${done}/${total} ${lang === "de" ? "konfiguriert" : "configured"}`;
    if (currentStage === "initial") {
      els.title.textContent = lang === "de"
        ? `Ausgangszustand für ${currentComp}`
        : `Choose INITIAL for ${currentComp}`;
      els.body.textContent = lang === "de"
        ? "Klicken Sie auf einen Ring, um den Ausgangszustand zu wählen (oder 'Neues Produkt')."
        : "Click a ring to choose the INITIAL state (or 'New Product').";
    } else {
      els.title.textContent = lang === "de"
        ? `RE-Strategie für ${currentComp}`
        : `Choose RE-Strategy for ${currentComp}`;
      els.body.textContent = lang === "de"
        ? "Wählen Sie jetzt die RE-Strategie für diese Komponente."
        : "Now choose the RE-Strategy for this component.";
    }

    // refresh hint
    removeHint();
    addHint(L[lang].hint, false);
    els.next.style.display = "none";
  }
   let clickWaitCleanup = [];
  function attachMustClick(cfg) {
    let target = null;

    if (cfg.selector) {
      target = document.querySelector(cfg.selector);
    }
    else if (cfg.findUnconfiguredRoomBtn) {
      // find the FIRST room button that still needs configuring
      target = findNextRoomButton();
    }
    else if (cfg.selectorContains) {
      const re = new RegExp(cfg.selectorContains, "i");
      target = [...document.querySelectorAll("#scenarioList button")].find(b => re.test(b.textContent));
    }

    if (!target) {
      // No unconfigured room found → all done! Advance to "show total"
      cleanupClickWaits();
      if (allRoomsConfigured()) {
        restartInContext("buildingReadyDirect");
      }
      return;
    }

    // point spotlight at the actual target button
    repointSpotlight(target);

    const h = () => {
      if (cfg.requireEnabled && target.disabled) return;
      if (cfg.changesPage) {
        cleanupClickWaits();
        stopTracking();
        waitForPageChangeThenContinue();
      } else {
        setTimeout(() => { if (active) goNext(); }, 400);
      }
    };
    target.addEventListener("click", h);
    clickWaitCleanup.push(() => target.removeEventListener("click", h));
  }

  // find the next room that isn't fully configured (its "Configure Scenarios" button)
  function findNextRoomButton() {
    const blocks = document.querySelectorAll("#scenarioList .comp-scenarios");
    for (const block of blocks) {
      const statusEl = block.querySelector(".comp-scenarios-header, div");
      const btn = block.querySelector("button");
      if (!btn) continue;
      const txt = btn.textContent.toLowerCase();
      // "configure scenarios (X remaining)" = needs work
      // "view / edit scenarios" with a ✓ = done
      const isDone = txt.includes("view") || txt.includes("edit") || txt.includes("✓");
      const needsWork = txt.includes("configure") || txt.includes("remaining");
      if (needsWork && !isDone) {
        return btn;   // ← the next room to configure
      }
    }
    return null;   // all rooms done
  }

  function repointSpotlight(el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      const pad = 8;
      els.spotlight.style.left = `${r.left - pad}px`;
      els.spotlight.style.top = `${r.top - pad}px`;
      els.spotlight.style.width = `${r.width + pad * 2}px`;
      els.spotlight.style.height = `${r.height + pad * 2}px`;
      placeTooltip(r, "right");
      startTracking(el, { placement: "right" });
    }, 350);
  }

  function cleanupClickWaits() {
    clickWaitCleanup.forEach(fn => fn());
    clickWaitCleanup = [];
  }

  function renderContent(step) {
    els.count.textContent = L[lang].step(stepIndex + 1, steps.length);
    els.title.textContent = step.title[lang];
    els.body.textContent = step.body[lang];
    els.next.textContent = stepIndex === steps.length - 1 ? L[lang].done : L[lang].next;
    els.skip.textContent = L[lang].skip;
    els.prev.textContent = L[lang].prev;
    els.prev.style.visibility = stepIndex === 0 ? "hidden" : "visible";
    els.progress.style.width = `${((stepIndex + 1) / steps.length) * 100}%`;

    removeHint();
    if (step.mustClick) addHint(L[lang].mustClick, true);
    else if (step.hint) addHint(L[lang].hint, false);
  }

  function addHint(text, strong) {
    const hint = document.createElement("div");
    hint.id = "tourHint";
    hint.className = "tour-wait-hint" + (strong ? " tour-hint-strong" : "");
    hint.textContent = text;
    els.body.after(hint);
  }
  function removeHint() { document.getElementById("tourHint")?.remove(); }

  function placeTooltip(rect, placement) {
    const ttW = 340, ttH = els.tooltip.offsetHeight || 220, gap = 18;
    const fits = {
      right: rect.right + gap + ttW < window.innerWidth - 12,
      left: rect.left - gap - ttW > 12,
      below: rect.bottom + gap + ttH < window.innerHeight - 12,
      above: rect.top - gap - ttH > 12,
    };
    let choice = placement;
    if (placement === "auto" || !fits[placement]) {
      choice = fits.right ? "right" : fits.below ? "below" : fits.left ? "left" : "above";
    }
    let left, top, arrowSide;
    switch (choice) {
      case "right": left = rect.right + gap; top = rect.top + rect.height/2 - ttH/2; arrowSide="left"; break;
      case "left":  left = rect.left - gap - ttW; top = rect.top + rect.height/2 - ttH/2; arrowSide="right"; break;
      case "below": left = rect.left + rect.width/2 - ttW/2; top = rect.bottom + gap; arrowSide="top"; break;
      default:      left = rect.left + rect.width/2 - ttW/2; top = rect.top - gap - ttH; arrowSide="bottom"; break;
    }
    left = Math.max(12, Math.min(left, window.innerWidth - ttW - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - ttH - 12));
    els.tooltip.style.left = `${left}px`;
    els.tooltip.style.top = `${top}px`;
    els.arrow.className = `tour-arrow arrow-${arrowSide}`;
  }

  function startTracking(el, step) {
    stopTracking();
    trackFn = () => {
      if (!active) return;
      const rect = el.getBoundingClientRect();
      const pad = 8;
      els.spotlight.style.left = `${rect.left - pad}px`;
      els.spotlight.style.top = `${rect.top - pad}px`;
      els.spotlight.style.width = `${rect.width + pad * 2}px`;
      els.spotlight.style.height = `${rect.height + pad * 2}px`;
      placeTooltip(rect, step.placement || "auto");
    };
    window.addEventListener("scroll", trackFn, true);
    window.addEventListener("resize", trackFn);
    if (el._tourRO) el._tourRO.disconnect();
    el._tourRO = new ResizeObserver(() => trackFn());
    el._tourRO.observe(el);
  }
  function stopTracking() {
    if (trackFn) {
      window.removeEventListener("scroll", trackFn, true);
      window.removeEventListener("resize", trackFn);
      trackFn = null;
    }
  }

  function cleanupWaits() {
    waitCleanup.forEach(fn => fn()); waitCleanup = [];
    cleanupClickWaits();
    if (pageWatcher) { pageWatcher.disconnect(); pageWatcher = null; }
  }

  function goNext() {
    cleanupClickWaits(); removeHint();
    if (stepIndex >= steps.length - 1) return endTour();
    showStep(stepIndex + 1);
  }
  function goPrev() {
    cleanupClickWaits(); removeHint();
    if (stepIndex > 0) showStep(stepIndex - 1);
  }

  function startTour() {
    currentContext = detectContext();
    steps = buildStepsForContext(currentContext);
    if (!steps.length) return;
    active = true; stepIndex = 0;
    els.overlay.classList.remove("tour-hidden");
    document.body.classList.add("tour-active");
    showStep(0);
  }
  function endTour() {
    active = false;
    cleanupWaits(); stopTracking(); removeHint();
    els.overlay.classList.add("tour-hidden");
    els.spotlight.classList.remove("pulse");
    document.body.classList.remove("tour-active");
  }

  els.helpBtn.addEventListener("click", startTour);
  els.next.addEventListener("click", goNext);
  els.prev.addEventListener("click", goPrev);
  els.skip.addEventListener("click", endTour);

  els.langBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang;
      localStorage.setItem("tourLang", lang);
      els.langBtns.forEach(b => b.classList.toggle("active", b === btn));
      const lbl = document.querySelector(".help-label");
      if (lbl) lbl.textContent = lang === "de" ? "Hilfe" : "Help";
      if (active) showStep(stepIndex);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (active && e.key === "Escape") endTour();
  });

  els.langBtns.forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
  const lbl = document.querySelector(".help-label");
  if (lbl) lbl.textContent = lang === "de" ? "Hilfe" : "Help";
}