/* ════════════════════════════════════════════════════════════════════
   LINDNER PDF ENGINE — Asset Loader
   ────────────────────────────────────────────────────────────────────
   Loads logo/wordmark images as data URLs for jsPDF embedding.
   
   Looks for assets in pdf-engine/assets/ folder first, then falls back
   to various legacy paths so it works during the migration period.
   
   Returns: { headerCompass, lindner, lindnerWhite, wordmark }
   - headerCompass: small compass icon (used as watermark)
   - lindner:       Lindner red logo on transparent
   - lindnerWhite:  Lindner white logo (for dark banner headers)
   - wordmark:      CO2 Compass wordmark
   
   Each value is either a base64 data URL or null (if asset missing).
   
   Version: 1.0 · 2026
   ════════════════════════════════════════════════════════════════════ */

(function (window) {
  'use strict';

  /**
   * Auto-detect where pdf-assets.js was loaded from
   * so we know the path to the assets/ sibling folder.
   */
  function getEnginePath() {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src;
      if (src && src.indexOf('pdf-assets.js') !== -1) {
        return src.replace('pdf-assets.js', '');
      }
    }
    return 'pdf-engine/'; // fallback
  }

  const ENGINE_BASE = getEnginePath();
  const ASSETS_BASE = ENGINE_BASE + 'assets/';

  /**
   * Try loading an image from a list of paths.
   * Returns the data URL of the first one that loads successfully.
   */
  async function _loadImageAsDataURL(paths) {
    for (const p of paths) {
      try {
        const res = await fetch(p);
        if (!res.ok) continue;
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        return dataUrl;
      } catch (_) {}
    }
    return null;
  }

  /**
   * Loads all PDF report assets in parallel.
   * Returns: { headerCompass, lindner, lindnerWhite, wordmark }
   */
  async function loadReportAssets() {
    // ─── Compass icon (used as watermark on every page) ───
    const compassPaths = [
      ASSETS_BASE + 'compass123.png',
      ASSETS_BASE + 'compass.png',
      // Fallbacks for boden's local copy during transition
      'compass123.png',
      './compass123.png',
      '../compass123.png',
      '../pdf-engine/assets/compass123.png'
    ];
    const headerCompass = await _loadImageAsDataURL(compassPaths);

    // ─── Lindner white logo (preferred for dark headers) ───
    const lindnerWhitePaths = [
      ASSETS_BASE + 'lindner_white.png',
      ASSETS_BASE + 'lindner_white.jpeg',
      ASSETS_BASE + 'lindner_white.jpg',
      // Fallbacks
      'lindner_white.png',
      'lindner_white.jpeg',
      'lindner_white.jpg',
      './lindner_white.png',
      '../lindner_white.png',
      '../pdf-engine/assets/lindner_white.png'
    ];
    const lindnerWhite = await _loadImageAsDataURL(lindnerWhitePaths);

    // ─── Lindner color logo fallback (used if white isn't available) ───
    const lindnerColorPaths = [
      ASSETS_BASE + 'Lindner_Logo-1.png',
      ASSETS_BASE + 'lindner_logo.png',
      // Fallbacks
      'Lindner_Logo-1.png',
      '../Lindner_Logo-1.png',
      '../pdf-engine/assets/Lindner_Logo-1.png'
    ];
    const lindner = lindnerWhite || (await _loadImageAsDataURL(lindnerColorPaths));

    // ─── CO2 Compass wordmark ───
    const wordmarkPaths = [
      ASSETS_BASE + 'wordmark.png',
      // Fallbacks
      'wordmark.png',
      './wordmark.png',
      '../wordmark.png',
      '../pdf-engine/assets/wordmark.png'
    ];
    const wordmark = await _loadImageAsDataURL(wordmarkPaths);

    return { headerCompass, lindner, lindnerWhite, wordmark };
  }

  // Expose to window
  window.LindnerPDFAssets = {
    load: loadReportAssets,
    enginePath: ENGINE_BASE,
    assetsPath: ASSETS_BASE
  };

  console.log('[LindnerPDF] Assets module loaded. Assets path:', ASSETS_BASE);

})(window);