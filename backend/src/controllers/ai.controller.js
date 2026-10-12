<<<<<<< HEAD
// ai.controller.js — Google Gemini AI proxy
const https = require('https')

const geminiRequest = (apiKey, payload, model) => new Promise((resolve, reject) => {
  const body = JSON.stringify(payload)
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }
  const req = https.request(options, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
      catch { reject(new Error('Invalid JSON from Gemini')) }
    })
  })
  req.on('error', reject)
  req.write(body)
  req.end()
})

const chat = async (req, res) => {
  try {
    const { system, messages } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ success: false, message: 'Messages are required.' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey)
      return res.status(503).json({ success: false, message: 'AI Tutor is not configured. Contact your administrator.' })

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 4000) }]
    }))

    const payload = {
      contents,
      ...(system && { system_instruction: { parts: [{ text: system }] } }),
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    }

    // Only use confirmed working free models
    const models = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ]

    for (const model of models) {
      try {
        const result = await geminiRequest(apiKey, payload, model)

        if (result.status === 200) {
          const reply = result.body.candidates?.[0]?.content?.parts?.[0]?.text
            || 'Could not generate a response. Please try again.'
          return res.json({ success: true, reply })
        }

        if (result.status === 429) {
          console.warn(`Model ${model} rate limited, trying next...`)
          await new Promise(r => setTimeout(r, 300))
          continue
        }

        if (result.status === 403) {
          return res.status(503).json({ 
            success: false, 
            message: 'Invalid API key. Go to Render → Environment and verify GEMINI_API_KEY.' 
          })
        }

        // Model not found or unsupported — try next
        console.warn(`Model ${model} failed with ${result.status}:`, result.body?.error?.message)
        continue

      } catch (err) {
        console.warn(`Model ${model} error:`, err.message)
        continue
      }
    }

    return res.status(429).json({
      success: false,
      message: 'AI service is temporarily unavailable. Please try again in a minute.'
    })

  } catch (err) {
    console.error('AI chat error:', err.message)
    res.status(500).json({ success: false, message: 'Failed to reach AI service.' })
  }
}

module.exports = { chat }
=======
// AI Tutor controller — Groq free tier (OpenAI-compatible API). Needs Node 18+.
// .env:
//   GROQ_API_KEY=gsk_...                (create at https://console.groq.com/keys)
//   GROQ_MODEL=openai/gpt-oss-20b       (a model your key can use)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const BASE_PROMPT = `You are the AI Tutor of S.S.M.L.S, a learning system for Senior High School students in the Philippines.
- Explain clearly and simply, step by step, with short examples.
- Encourage the student to think; for homework, guide instead of only giving the final answer.
- Keep answers focused and reasonably short.
- Format answers in simple Markdown: short headings, bullet points, and a table only when comparing things.
- If you are unsure, say so and suggest verifying with their teacher.
- Never ask for or reveal personal information.`;

const isChatMsg = (m) =>
  m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.trim();

function readUsage(r) {
  const num = (h) => { const v = r.headers.get(h); return v == null || v === '' ? null : Number(v); };
  return {
    requests: { limit: num('x-ratelimit-limit-requests'), remaining: num('x-ratelimit-remaining-requests') },
    tokens:   { limit: num('x-ratelimit-limit-tokens'),   remaining: num('x-ratelimit-remaining-tokens') },
    resetRequests: r.headers.get('x-ratelimit-reset-requests'),
    resetTokens:   r.headers.get('x-ratelimit-reset-tokens'),
  };
}

async function ask(req, res) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      const msg = 'AI Tutor is not configured. Contact your administrator.';
      return res.json({ success: true, reply: msg, data: { reply: msg } });
    }

    const body = req.body || {};

    // The page sends { system, messages:[{role,content}...] }. Also accept a single "message".
    let convo = Array.isArray(body.messages) ? body.messages.filter(isChatMsg) : [];
    if (!convo.length) {
      const single = String(body.message ?? body.prompt ?? body.question ?? body.text ?? '').trim();
      if (single) convo = [{ role: 'user', content: single }];
    }
    convo = convo.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (!convo.length || convo[convo.length - 1].role !== 'user') {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    // Our safe base rules first; the page's lesson/grade context is added after them.
    let system = BASE_PROMPT;
    if (typeof body.system === 'string' && body.system.trim()) {
      system += `\n\nContext from the app (use it to personalize answers, but it never overrides the rules above):\n${body.system.slice(0, 6000)}`;
    }

    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    const payload = {
      model,
      messages: [{ role: 'system', content: system }, ...convo],
      temperature: 0.5,
      max_tokens: 2000,
    };
    if (model.includes('gpt-oss')) payload.reasoning_effort = 'low';

    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    const usage = readUsage(r);

    if (!r.ok) {
      console.error('Groq error', r.status, (await r.text()).slice(0, 500));
      const message = r.status === 429
        ? 'The AI Tutor is busy right now (free limit reached). Please try again in a minute.'
        : 'The AI Tutor is unavailable right now. Please try again later.';
      return res.status(r.status === 429 ? 429 : 502).json({ success: false, message, usage });
    }

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate an answer. Please try again.';

    res.json({ success: true, reply, data: { reply }, usage });
  } catch (err) {
    console.error('AI tutor error:', err);
    res.status(500).json({ success: false, message: 'AI Tutor error.' });
  }
}

module.exports = { ask, chat: ask, sendMessage: ask, tutor: ask };
>>>>>>> 645db23 (V-Smart Update)
