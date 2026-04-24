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
