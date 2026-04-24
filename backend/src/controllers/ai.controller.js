// ai.controller.js — Google Gemini (uses built-in https, no extra deps)
const https = require('https')

const chat = async (req, res) => {
  try {
    const { system, messages } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ success: false, message: 'Messages are required.' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey)
      return res.status(503).json({ success: false, message: 'AI Tutor is not configured. Contact your administrator.' })

    // Gemini uses 'user' and 'model' roles
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 4000) }]
    }))

    const payload = JSON.stringify({
      contents,
      ...(system && { system_instruction: { parts: [{ text: system }] } }),
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    })

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }

      const request = https.request(options, (response) => {
        let data = ''
        response.on('data', chunk => data += chunk)
        response.on('end', () => {
          try {
            resolve({ status: response.statusCode, body: JSON.parse(data) })
          } catch {
            reject(new Error('Invalid JSON from Gemini'))
          }
        })
      })

      request.on('error', reject)
      request.write(payload)
      request.end()
    })

    if (result.status !== 200) {
      console.error('Gemini error:', result.status, JSON.stringify(result.body))
      if (result.status === 400) return res.status(400).json({ success: false, message: 'Bad request to AI service.' })
      if (result.status === 403) return res.status(503).json({ success: false, message: 'Invalid API key. Contact your administrator.' })
      if (result.status === 429) return res.status(429).json({ success: false, message: 'AI is busy. Please wait and try again.' })
      return res.status(503).json({ success: false, message: `AI error: ${result.body?.error?.message || 'Unknown error'}` })
    }

    const reply = result.body.candidates?.[0]?.content?.parts?.[0]?.text
      || 'Could not generate a response. Please try again.'

    res.json({ success: true, reply })

  } catch (err) {
    console.error('AI chat error:', err.message)
    res.status(500).json({ success: false, message: 'Failed to reach AI service: ' + err.message })
  }
}

module.exports = { chat }
