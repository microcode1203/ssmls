// ai.controller.js — Google Gemini AI proxy with retry
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

// POST /api/ai/chat
const chat = async (req, res) => {
  try {
    const { system, messages } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ success: false, message: 'Messages are required.' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey)
      return res.status(503).json({ success: false, message: 'AI Tutor is not configured. Contact your administrator.' })

    // Build contents — Gemini uses 'user' and 'model' roles
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 4000) }]
    }))

    const payload = {
      contents,
      ...(system && { system_instruction: { parts: [{ text: system }] } }),
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    }

    // Try models in order — fallback if one is rate limited
    const models = [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash-8b',
    ]

    let lastError = null

    for (const model of models) {
      try {
        const result = await geminiRequest(apiKey, payload, model)

        if (result.status === 200) {
          const reply = result.body.candidates?.[0]?.content?.parts?.[0]?.text
            || 'I could not generate a response. Please try again.'
          return res.json({ success: true, reply, model })
        }

        if (result.status === 429) {
          // Rate limited — try next model
          console.warn(`Model ${model} rate limited, trying next...`)
          lastError = 'rate_limit'
          // Small delay before trying next model
          await new Promise(r => setTimeout(r, 500))
          continue
        }

        if (result.status === 403) {
          return res.status(503).json({ success: false, message: 'Invalid API key. Go to Render → Environment and check GEMINI_API_KEY.' })
        }

        console.error(`Gemini ${model} error:`, result.status, JSON.stringify(result.body))
        lastError = result.body?.error?.message || 'Unknown error'
        continue

      } catch (err) {
        console.error(`Model ${model} request failed:`, err.message)
        lastError = err.message
        continue
      }
    }

    // All models failed
    if (lastError === 'rate_limit') {
      return res.status(429).json({
        success: false,
        message: 'The AI service is currently at capacity. Please wait 1 minute and try again.'
      })
    }

    return res.status(503).json({
      success: false,
      message: `AI service error: ${lastError || 'All models unavailable'}`
    })

  } catch (err) {
    console.error('AI chat error:', err.message)
    res.status(500).json({ success: false, message: 'Failed to reach AI service: ' + err.message })
  }
}

module.exports = { chat }
