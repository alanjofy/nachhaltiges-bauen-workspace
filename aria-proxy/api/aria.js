// Vercel Serverless Function — ARIA Gemini Proxy
// The Gemini API key lives ONLY here (as an env var), never in the browser.

export default async function handler(req, res) {
  // ─── CORS — allow your GitHub Pages site to call this ───
  const ALLOWED_ORIGIN = "https://alanjofy.github.io";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "Server not configured (missing key)" });
  }

  try {
    const { messages, systemPrompt } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: messages required" });
    }

    const model = "gemini-2.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt || "" }] },
        contents,
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
      })
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      const msg = errData?.error?.message || `Gemini error ${geminiRes.status}`;
      return res.status(geminiRes.status).json({ error: msg });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: "Proxy error: " + (err.message || "unknown") });
  }
}