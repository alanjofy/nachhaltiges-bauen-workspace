/* ════════════════════════════════════════════════════════════════════
   LINDNER PDF ENGINE — AI Insight Generator
   ────────────────────────────────────────────────────────────────────
   Generates the "KEY INSIGHT" paragraph for PDF reports using Claude.
   
   Uses the same API key as ARIA chatbot (localStorage: co2compass_apikey).
   Returns null if no key, or if API call fails. PDF engine has a
   built-in fallback heuristic for that case.
   
   Public API:
     LindnerPDFInsight.generate({
       selected:   [scenario, ...]  — array of selected scenarios
       getA1c4:    (s) => number    — extracts A1-C4 value for scenario
       getD:       (s) => number    — extracts Module D value for scenario
       product:    string           — product type label
       variant:    string           — variant label
     })
       → Promise<string | null>
   
   Version: 1.0 · 2026
   ════════════════════════════════════════════════════════════════════ */

(function (window) {
  'use strict';

  const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
  const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
  const MAX_TOKENS = 160;

  /**
   * Reads the Claude API key from localStorage.
   * (Same key ARIA uses — shared across all features.)
   */
  function getApiKey() {
    return localStorage.getItem('co2compass_apikey');
  }

  /**
   * Builds the insight prompt for Claude.
   */
  function buildPrompt(selected, getA1c4, getD, product, variant) {
    const lines = selected.map((s) => {
      const a = getA1c4(s);
      const d = getD(s);
      const net = a !== null && d !== null ? +(a + d).toFixed(2) : null;
      return `${s.name}: A1-C4=${a?.toFixed(2)}, D=${d?.toFixed(2)}, Net=${net}`;
    });

    return (
      `Write exactly 2 concise sentences for a Lindner ${product} (${variant}) ` +
      `sustainability report. Plain ASCII only - write CO2eq not subscript, m2 not superscript. ` +
      `Highlight the best end-of-life scenario and Module D circular economy benefit. ` +
      `Data: ${lines.join('; ')}. Output only the 2 sentences.`
    );
  }

  /**
   * Generates the insight via Claude API.
   * @returns {Promise<string|null>} Insight text or null if unavailable
   */
  async function generate({ selected, getA1c4, getD, product, variant }) {
    const key = getApiKey();
    if (!key) return null;
    if (!selected || !selected.length) return null;

    try {
      const res = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          messages: [
            {
              role: 'user',
              content: buildPrompt(selected, getA1c4, getD, product || '', variant || '')
            }
          ]
        })
      });

      if (!res.ok) {
        console.warn('[LindnerPDF] Claude insight returned', res.status);
        return null;
      }

      const data = await res.json();
      return data.content?.[0]?.text?.trim() || null;
    } catch (err) {
      console.warn('[LindnerPDF] Claude insight failed:', err.message);
      return null;
    }
  }

  /**
   * Fallback insight when AI is not available.
   * Picks the best scenario by net carbon and writes a deterministic summary.
   */
  function fallback({ selected, getA1c4, getD }) {
    if (!selected || !selected.length) {
      return 'Insufficient scenario data to generate insight.';
    }

    const best = selected.reduce((a, b) => {
      const av = (getA1c4(a) || 0) + (getD(a) || 0);
      const bv = (getA1c4(b) || 0) + (getD(b) || 0);
      return av < bv ? a : b;
    });

    const bNet = ((getA1c4(best) || 0) + (getD(best) || 0)).toFixed(2);
    const bD = Math.abs(getD(best) || 0).toFixed(2);

    return (
      `The ${best.name} scenario achieves the lowest net carbon footprint ` +
      `of ${bNet} kg CO2eq/m\u00B2. Module D credits ${bD} kg CO2eq/m\u00B2 ` +
      `in avoided production burdens, demonstrating the value of Lindner's ` +
      `circular economy end-of-life approach.`
    );
  }

  // Expose to window
  window.LindnerPDFInsight = {
    generate,
    fallback,
    hasApiKey: () => !!getApiKey()
  };

  console.log('[LindnerPDF] Insight module loaded.');

})(window);