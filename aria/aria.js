/* ════════════════════════════════════════════════════════════════════
   ARIA — Lindner Sustainability Intelligence
   ────────────────────────────────────────────────────────────────────
   Global drop-in chatbot module
   
   Public API:
     ARIA.init({ page, contextProvider })
       - page: string identifier ('main', 'boden', 'ceiling', ...)
       - contextProvider: () => object — page-specific data
   
   Usage:
     <link rel="stylesheet" href="../aria/aria.css">
     <script src="../aria/aria.js"></script>
     <script>
       ARIA.init({
         page: 'boden',
         contextProvider: () => buildBodenContext()
       });
     </script>
   
   Version: 1.0 · 2026
   ════════════════════════════════════════════════════════════════════ */

(function(window) {
  'use strict';

  const ARIA_VERSION = '1.0';
  const CONTACT_EMAIL = 'denisa.krauss@lindner-group.com';

  // ════════════════════════════════════════════════════════════════
  // EMBEDDED HTML — no fetch needed, works on any protocol/path
  // ════════════════════════════════════════════════════════════════
  const ARIA_HTML = `
<button id="ariaToggleBtn" class="aria-toggle-btn" aria-label="Open ARIA Assistant">
  <div class="aria-toggle-inner">
    <span class="aria-toggle-badge">ARIA</span>
    <span class="aria-toggle-label">Ask ARIA</span>
  </div>
  <span id="ariaBadge" class="aria-notif-badge" style="display:none">1</span>
</button>

<div id="ariaPanel" class="aria-panel" style="display:none" role="dialog" aria-label="ARIA Sustainability Intelligence">
  <div class="aria-header">
    <div class="aria-header-left">
      <div class="aria-avatar">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
          <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.15)"/>
          <path d="M8 9h8M8 12h5M8 15h3" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="aria-header-info">
        <span class="aria-name">ARIA</span>
        <span id="ariaProviderBadge" class="aria-provider-badge" style="display:none">Gemini</span>
        <span class="aria-tagline">Lindner Sustainability Intelligence</span>
      </div>
    </div>
    <div class="aria-header-right">
      <button id="ariaContactHeaderBtn" class="aria-hbtn" title="Contact Lindner Team" aria-label="Contact Lindner Team">
        <svg viewBox="0 0 20 20" fill="none" width="13" height="13">
          <path d="M3 4h14v12H3z" stroke="currentColor" stroke-width="1.4"/>
          <path d="M3 4l7 7 7-7" stroke="currentColor" stroke-width="1.4"/>
        </svg>
      </button>
      <button id="ariaResetKeyBtn" class="aria-hbtn" title="Reset API Key" aria-label="Reset API Key">
        <svg viewBox="0 0 20 20" fill="none" width="13" height="13">
          <path d="M13 8a4 4 0 1 0-3.5 3.97V14h-2v2h2v2h2v-2h2v-2h-2v-2.03A4 4 0 0 0 13 8z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button id="ariaClearBtn" class="aria-hbtn" title="Clear chat" aria-label="Clear chat history">
        <svg viewBox="0 0 20 20" fill="none" width="13" height="13">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
      <button id="ariaCloseBtn" class="aria-hbtn" title="Close ARIA" aria-label="Close ARIA">
        <svg viewBox="0 0 20 20" fill="none" width="13" height="13">
          <path d="M4 16l12-12M4 4l12 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>

  <div id="ariaApiSetup" class="aria-api-setup">
    <div class="aria-api-icon">ARIA</div>
    <h4 class="aria-api-title">Activate ARIA</h4>
    <p class="aria-api-desc">Paste your API key to enable AI-powered sustainability intelligence.</p>
    <div class="aria-provider-tabs">
      <button class="aria-provider-tab active" data-provider="gemini">
        <span class="aria-provider-dot" style="background:#4285f4"></span>
        Gemini <span class="aria-provider-free">FREE</span>
      </button>
      <button class="aria-provider-tab" data-provider="anthropic">
        <span class="aria-provider-dot" style="background:#d97706"></span>
        Anthropic Claude
      </button>
    </div>
    <div class="aria-provider-hint" id="ariaProviderHint">
      Get a free key at <strong>aistudio.google.com/apikey</strong> — no credit card needed
    </div>
    <input type="password" id="ariaApiKeyInput" class="aria-api-input" placeholder="Paste your Gemini API key..." autocomplete="off" />
    <button id="ariaApiSaveBtn" class="aria-api-btn">Activate ARIA</button>
    <p class="aria-api-note">Key stored locally in your browser only.</p>
  </div>

  <div id="ariaMessages" class="aria-messages" style="display:none"></div>

  <div id="ariaInputArea" class="aria-input-area" style="display:none">
    <textarea id="ariaInput" class="aria-input" rows="1" placeholder="Ask ARIA anything..."></textarea>
    <button id="ariaSendBtn" class="aria-send-btn" aria-label="Send message">
      <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
        <path d="M3 10L17 3l-7 14-2-7-5-3z" fill="currentColor"/>
      </svg>
    </button>
  </div>
</div>
`;

  /* ────────────────────────────────────────────────────────────────
     STATE
     ──────────────────────────────────────────────────────────────── */
  
  const state = {
    open: false,
    history: [],
    anthropicKey: null,
    geminiKey: null,
    activeProvider: null,
    loading: false,
    pageId: null,
    contextProvider: null,
    initialized: false,
    welcomeChips: null
  };

  /* ────────────────────────────────────────────────────────────────
     PROVIDER DETECTION
     ──────────────────────────────────────────────────────────────── */
  
  function detectProvider(key) {
    if (!key) return null;
    const k = key.trim();
    if (k.startsWith('sk-ant-')) return 'anthropic';
    if (k.startsWith('AIza') || k.startsWith('AQ.') || k.length >= 30) return 'gemini';
    return null;
  }

  function getStoredKey() {
    return localStorage.getItem('co2compass_gemini_key') ||
           localStorage.getItem('co2compass_apikey') || null;
  }

  /* ────────────────────────────────────────────────────────────────
     PAGE-SPECIFIC WELCOME CHIPS
     ──────────────────────────────────────────────────────────────── */
  
  const WELCOME_CHIPS = {
    main: [
      { q: 'Which tool should I use for measuring CO2 in floor panels?', label: 'Help me choose' },
      { q: 'Explain what CO2 Compass does in simple terms.', label: 'About CO2 Compass' },
      { q: 'What is the difference between A1-C4 total and Module D?', label: 'A1-C4 vs Module D' },
      { q: 'Explain what an EPD is.', label: 'What is an EPD?' },
      { q: 'I need to contact the Lindner sustainability team.', label: 'Contact team' }
    ],
    boden: [
      { q: 'Give me a complete LCA summary for the currently selected product.', label: 'LCA Summary' },
      { q: 'Which end-of-life scenario has the best environmental performance and why?', label: 'Best scenario?' },
      { q: 'Explain what Module D means and why it matters for this product.', label: 'What is Module D?' },
      { q: 'How does this product compare across scenarios in terms of net carbon?', label: 'Compare scenarios' },
      { q: 'Which modules have GWP values above 1.5 kg CO2eq and what does that mean?', label: 'High GWP modules' },
      { q: 'I need to request a competitor that is not currently in CO2 Compass.', label: 'Request competitor' },
      { q: 'I need to contact the Lindner sustainability team.', label: 'Contact team' },
      { q: 'Explain the difference between A1-C4 total and net carbon.', label: 'A1-C4 vs Net carbon' }
    ],
    default: [
      { q: 'Explain what an EPD is in simple terms.', label: 'What is an EPD?' },
      { q: 'What does Module D mean in lifecycle assessment?', label: 'What is Module D?' },
      { q: 'I need to contact the Lindner sustainability team.', label: 'Contact team' }
    ]
  };

  /* ────────────────────────────────────────────────────────────────
     SYSTEM PROMPT
     ──────────────────────────────────────────────────────────────── */
  
  const SYSTEM_PROMPT = `You are ARIA (AI Research & Insight Assistant), the intelligent sustainability advisor embedded in Lindner Group's CO2 Compass EPD tool.

You help sales engineers, sustainability managers, and project teams understand and communicate the environmental performance of Lindner sustainable building products.

YOUR CAPABILITIES:
- Explain EPD lifecycle assessment data (EN 15804+A2 standard)
- Compare end-of-life scenarios and recommend the best environmental strategy
- Explain LCA terminology: GWP, A1-C4, Module D, net carbon, declared unit, EPD, etc.
- Generate professional LCA summaries for client presentations
- Identify which modules have high GWP (above 1.5 kg CO2eq/m2) and explain why
- Answer questions about the CO2 Compass tool itself
- Help users choose the right tool when they're on the CO2 Compass landing page
- Connect users with the Lindner sustainability team

SPECIAL ACTIONS — include these exact markers when you detect these intents:
- User wants to contact Lindner team for support or questions: include [ACTION:support]
- User wants to request a missing competitor: include [ACTION:competitor] — ask for competitor name, product family, and any EPD details they have
- User asks to generate an LCA summary: format it with these sections:
  PRODUCT OVERVIEW | KEY ENVIRONMENTAL METRICS | SCENARIO ANALYSIS | MODULE BREAKDOWN | RECOMMENDATION

RESPONSE GUIDELINES:
- Be concise and professional — this is used in client-facing and internal contexts
- Always cite specific numbers from the provided session data when available
- Keep responses under 250 words unless generating a full LCA summary
- For LCA summaries, be thorough and structured
- If no product is selected, guide the user appropriately based on the current page
- Use plain text — no Unicode subscripts. Write CO2eq not CO2 subscript, m2 not superscript
- Highlight if any module values exceed 1.5 kg CO2eq/m2 as these are significant contributors`;

  /* ────────────────────────────────────────────────────────────────
     INJECT HTML FRAGMENT
     ──────────────────────────────────────────────────────────────── */
  
  function injectHTML() {
    // Check if already injected
    if (document.getElementById('ariaPanel')) return true;
    
    try {
      const mount = document.getElementById('aria-mount') || document.body;
      
      const container = document.createElement('div');
      container.innerHTML = ARIA_HTML;
      
      while (container.firstChild) {
        mount.appendChild(container.firstChild);
      }
      
      return true;
    } catch (err) {
      console.error('[ARIA] Failed to inject HTML:', err);
      return false;
    }
  }

  /* ────────────────────────────────────────────────────────────────
     CONTEXT BUILDING
     ──────────────────────────────────────────────────────────────── */
  
  function buildContext() {
    const lines = ['=== CO2 COMPASS — SESSION DATA ===\n'];
    lines.push(`Current page: ${state.pageId}`);
    
    if (state.contextProvider && typeof state.contextProvider === 'function') {
      try {
        const ctx = state.contextProvider();
        if (ctx) {
          if (typeof ctx === 'string') {
            lines.push(ctx);
          } else if (typeof ctx === 'object') {
            Object.entries(ctx).forEach(([key, value]) => {
              if (value === null || value === undefined) return;
              if (typeof value === 'object') {
                lines.push(`\n${key.toUpperCase()}:`);
                lines.push(JSON.stringify(value, null, 2));
              } else {
                lines.push(`${key}: ${value}`);
              }
            });
          }
        }
      } catch (err) {
        console.error('[ARIA] Context provider error:', err);
        lines.push('(Context provider error)');
      }
    } else {
      lines.push('No additional context available for this page.');
    }
    
    lines.push('\n=== END ===');
    return lines.join('\n');
  }

  /* ────────────────────────────────────────────────────────────────
     API CALLS
     ──────────────────────────────────────────────────────────────── */
  
  async function callGemini(messages) {
    const model = 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.geminiKey}`;
    
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
      })
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini error ${res.status}`);
    }
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
  }

  async function callAnthropic(messages) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages
      })
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }
    
    const data = await res.json();
    return data.content?.[0]?.text || 'No response.';
  }

  /* ────────────────────────────────────────────────────────────────
     EMAIL CONTACT
     ──────────────────────────────────────────────────────────────── */
  
  function openEmail(type, context) {
    let subject, body;
    if (type === 'support') {
      subject = 'CO2 Compass — Support Request';
      body = `Hello,\n\nI have a question regarding the CO2 Compass tool:\n\n${context}\n\nBest regards`;
    } else if (type === 'competitor') {
      subject = 'CO2 Compass — Competitor Data Request';
      body = `Hello,\n\nI would like to request the following competitor to be added to CO2 Compass:\n\n${context}\n\nPlease advise on next steps.\n\nBest regards`;
    } else {
      subject = 'CO2 Compass — Inquiry';
      body = `Hello,\n\n${context}\n\nBest regards`;
    }
    window.open(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }

  /* ────────────────────────────────────────────────────────────────
     UI HELPERS
     ──────────────────────────────────────────────────────────────── */
  
  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function welcomeHTML() {
    const chips = state.welcomeChips || WELCOME_CHIPS[state.pageId] || WELCOME_CHIPS.default;
    const chipsHTML = chips.map(c =>
      `<button class="aria-chip" data-aria-q="${escapeHtml(c.q)}">${escapeHtml(c.label)}</button>`
    ).join('');
    
    return `
      <div class="aria-welcome">
        <div class="aria-welcome-logo">ARIA</div>
        <p class="aria-welcome-sub">Lindner Sustainability Intelligence</p>
        <p class="aria-welcome-desc">Ask me about EPD data, LCA summaries, scenarios, or request support from the Lindner team.</p>
        <div class="aria-chips">${chipsHTML}</div>
      </div>`;
    }

  function showChat() {
    const setup = document.getElementById('ariaApiSetup');
    const msgs = document.getElementById('ariaMessages');
    const inputArea = document.getElementById('ariaInputArea');
    const badge = document.getElementById('ariaProviderBadge');
    
    if (setup) setup.style.display = 'none';
    if (msgs) {
      msgs.style.display = 'flex';
      if (!msgs.innerHTML.trim()) msgs.innerHTML = welcomeHTML();
    }
    if (inputArea) inputArea.style.display = 'flex';
    if (badge) {
      badge.textContent = state.activeProvider === 'gemini' ? 'Gemini' : 'Claude';
      badge.style.display = 'inline-flex';
    }
  }

  function showSetup() {
    const setup = document.getElementById('ariaApiSetup');
    const msgs = document.getElementById('ariaMessages');
    const inputArea = document.getElementById('ariaInputArea');
    const badge = document.getElementById('ariaProviderBadge');
    
    if (setup) setup.style.display = 'flex';
    if (msgs) { msgs.style.display = 'none'; msgs.innerHTML = ''; }
    if (inputArea) inputArea.style.display = 'none';
    if (badge) badge.style.display = 'none';
  }

  function appendMessage(role, text, actions) {
    const msgs = document.getElementById('ariaMessages');
    if (!msgs) return;
    
    const div = document.createElement('div');
    div.className = `aria-msg aria-msg-${role}`;
    
    let html = '';
    if (role === 'user') {
      html = `<div class="aria-bubble aria-bubble-user">${escapeHtml(text)}</div>`;
    } else if (role === 'error') {
      html = `<div class="aria-bubble aria-bubble-error">${escapeHtml(text)}</div>`;
    } else {
      const formatted = escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      
      let actionHTML = '';
      if (actions?.length) {
        actionHTML = `<div class="aria-action-row">${actions.map(a =>
          `<button class="aria-action-btn" data-aria-action="${escapeHtml(a.type)}" data-aria-ctx="${escapeHtml(a.ctx)}">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
              <path d="M3 10l14-7-7 14-2-7-5-3z" fill="currentColor"/>
            </svg>
            ${escapeHtml(a.label)}
          </button>`
        ).join('')}</div>`;
      }
      
      html = `<div class="aria-bubble aria-bubble-assistant">${formatted}${actionHTML}</div>`;
    }
    
    div.innerHTML = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const msgs = document.getElementById('ariaMessages');
    if (!msgs) return null;
    
    const id = 'aria_t_' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'aria-msg aria-msg-assistant';
    div.innerHTML = `<div class="aria-bubble aria-bubble-assistant aria-typing"><span></span><span></span><span></span></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return id;
  }

  function hideTyping(id) {
    if (id) document.getElementById(id)?.remove();
  }

  function updateSendBtn(loading) {
    const btn = document.getElementById('ariaSendBtn');
    if (btn) {
      btn.disabled = loading;
      btn.style.opacity = loading ? '0.45' : '1';
    }
  }

  /* ────────────────────────────────────────────────────────────────
     ACTIONS
     ──────────────────────────────────────────────────────────────── */
  
  function togglePanel(open) {
    state.open = open;
    const panel = document.getElementById('ariaPanel');
    const badge = document.getElementById('ariaBadge');
    if (!panel) return;
    panel.style.display = open ? 'flex' : 'none';
    if (badge) badge.style.display = 'none';
  }

  function clearChat() {
    state.history = [];
    const msgs = document.getElementById('ariaMessages');
    if (msgs) msgs.innerHTML = welcomeHTML();
  }

  function resetApiKey() {
    if (!confirm('Reset API key? You will need to enter a new one.')) return;
    localStorage.removeItem('co2compass_apikey');
    localStorage.removeItem('co2compass_gemini_key');
    state.anthropicKey = null;
    state.geminiKey = null;
    state.activeProvider = null;
    state.history = [];
    showSetup();
    const keyInput = document.getElementById('ariaApiKeyInput');
    if (keyInput) keyInput.value = '';
  }

  async function handleSend() {
    if (state.loading) return;
    
    const input = document.getElementById('ariaInput');
    const userMsg = input?.value?.trim();
    if (!userMsg) return;
    
    if (!state.activeProvider) {
      togglePanel(true);
      return;
    }
    
    input.value = '';
    input.style.height = 'auto';
    document.querySelector('.aria-welcome')?.remove();
    
    appendMessage('user', userMsg);
    state.history.push({ role: 'user', content: userMsg });
    
    const typingId = showTyping();
    state.loading = true;
    updateSendBtn(true);
    
    try {
      const context = buildContext();
      const messages = [...state.history.slice(-10)];
      messages[messages.length - 1] = {
        role: 'user',
        content: `${context}\n\nUser question: ${userMsg}`
      };
      
      let reply;
      if (state.activeProvider === 'gemini') {
        reply = await callGemini(messages);
      } else {
        reply = await callAnthropic(messages);
      }
      
      hideTyping(typingId);
      
      // Parse action markers
      const actions = [];
      if (reply.includes('[ACTION:support]')) {
        actions.push({
          type: 'support',
          label: 'Contact Lindner Team',
          ctx: 'I need support with the CO2 Compass tool.'
        });
        reply = reply.replace('[ACTION:support]', '').trim();
      }
      if (reply.includes('[ACTION:competitor]')) {
        const match = reply.match(/competitor[^.]*?:\s*([^\n.]+)/i);
        const cName = match?.[1]?.trim() || 'competitor product';
        actions.push({
          type: 'competitor',
          label: 'Send Competitor Request',
          ctx: `Competitor request: ${cName}`
        });
        reply = reply.replace('[ACTION:competitor]', '').trim();
      }
      
      appendMessage('assistant', reply, actions);
      state.history.push({ role: 'assistant', content: reply });
      
      if (!state.open) {
        const badge = document.getElementById('ariaBadge');
        if (badge) badge.style.display = 'flex';
      }
    } catch (err) {
      hideTyping(typingId);
      let errorMsg = 'Error: ' + err.message;
      if (err.message.includes('credit')) errorMsg += ' — Try adding credits at console.anthropic.com';
      if (err.message.includes('quota')) errorMsg += ' — Gemini free quota reached. Try again later.';
      appendMessage('error', errorMsg);
    } finally {
      state.loading = false;
      updateSendBtn(false);
    }
  }

  /* ────────────────────────────────────────────────────────────────
     EVENT BINDING
     ──────────────────────────────────────────────────────────────── */
  
  function bindEvents() {
    const $ = id => document.getElementById(id);
    
    $('ariaToggleBtn')?.addEventListener('click', () => togglePanel(!state.open));
    $('ariaCloseBtn')?.addEventListener('click', () => togglePanel(false));
    $('ariaClearBtn')?.addEventListener('click', clearChat);
    $('ariaResetKeyBtn')?.addEventListener('click', resetApiKey);
    $('ariaContactHeaderBtn')?.addEventListener('click', () => {
      openEmail('support', 'I have a question about the CO2 Compass tool.');
    });
    $('ariaSendBtn')?.addEventListener('click', handleSend);
    
    const input = $('ariaInput');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }
    
    // API key save
    $('ariaApiSaveBtn')?.addEventListener('click', () => {
      const key = $('ariaApiKeyInput')?.value?.trim();
      if (!key || key.length < 10) {
        alert('Please enter a valid API key.');
        return;
      }
      const provider = detectProvider(key);
      if (!provider) {
        alert('Key not recognised. Paste your Gemini key (from aistudio.google.com) or Anthropic key (starts with sk-ant-).');
        return;
      }
      if (provider === 'anthropic') {
        state.anthropicKey = key;
        localStorage.setItem('co2compass_apikey', key);
      } else {
        state.geminiKey = key;
        localStorage.setItem('co2compass_gemini_key', key);
      }
      state.activeProvider = provider;
      showChat();
      appendMessage('assistant',
        `ARIA activated with ${provider === 'gemini' ? 'Google Gemini (free tier)' : 'Anthropic Claude'}. Ask me anything about CO2 Compass, EPD data, LCA summaries, or sustainability topics.`
      );
    });
    
    // Provider tab switching
    document.querySelectorAll('.aria-provider-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.aria-provider-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const p = tab.dataset.provider;
        const hints = {
          gemini: 'Get a free key at <strong>aistudio.google.com/apikey</strong> — no credit card needed',
          anthropic: 'Get a key at <strong>console.anthropic.com</strong> — add $5 credit to start'
        };
        const placeholders = {
          gemini: 'Paste your Gemini API key...',
          anthropic: 'sk-ant-...'
        };
        const hint = $('ariaProviderHint');
        const inp = $('ariaApiKeyInput');
        if (hint) hint.innerHTML = hints[p];
        if (inp) inp.placeholder = placeholders[p];
      });
    });
    
    // Welcome chip clicks + action button clicks (delegated)
    document.addEventListener('click', e => {
      const chip = e.target.closest('[data-aria-q]');
      if (chip) {
        const q = chip.dataset.ariaQ;
        if (q && $('ariaInput')) {
          $('ariaInput').value = q;
          handleSend();
        }
        return;
      }
      const actionBtn = e.target.closest('[data-aria-action]');
      if (actionBtn) {
        openEmail(actionBtn.dataset.ariaAction, actionBtn.dataset.ariaCtx || '');
      }
    });
  }

  /* ────────────────────────────────────────────────────────────────
     PUBLIC API: ARIA.init()
     ──────────────────────────────────────────────────────────────── */
  
  function init(options = {}) {
    if (state.initialized) {
      console.warn('[ARIA] Already initialized — skipping.');
      return;
    }
    
    state.pageId = options.page || 'default';
    state.contextProvider = options.contextProvider || null;
    state.welcomeChips = options.welcomeChips || null;
    
    // Inject HTML (synchronous — no fetch)
    const injected = injectHTML();
    if (!injected) {
      console.error('[ARIA] Failed to initialize — HTML injection failed.');
      return;
    }
    
    // Load stored API key
    const storedKey = getStoredKey();
    if (storedKey) {
      const provider = detectProvider(storedKey);
      if (provider === 'anthropic') state.anthropicKey = storedKey;
      else if (provider === 'gemini') state.geminiKey = storedKey;
      state.activeProvider = provider;
    }
    
    // Bind events
    bindEvents();
    
    // Show chat if API key already present
    if (state.activeProvider) showChat();
    
    state.initialized = true;
    console.log(`[ARIA] Initialized on page: ${state.pageId}`);
  }
  /* ────────────────────────────────────────────────────────────────
     EXPORT
     ──────────────────────────────────────────────────────────────── */
  
  window.ARIA = {
    init,
    version: ARIA_VERSION,
    // Optional helpers for advanced use
    open:  () => togglePanel(true),
    close: () => togglePanel(false),
    clear: clearChat,
    reset: resetApiKey
  };

})(window);