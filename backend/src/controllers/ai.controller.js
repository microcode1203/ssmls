// ai.controller.js — Google Gemini AI proxy (FREE)
// Place in: backend/src/controllers/ai.controller.js

const fetch = require('node-fetch');

// POST /api/ai/chat
const chat = async (req, res) => {
  try {
    const { system, messages } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'Messages are required.' })
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'AI Tutor is not configured yet. Please contact your administrator to set up the API key.'
      })
    }

    // Build Gemini contents array
    // Gemini uses 'user' and 'model' roles (not 'assistant')
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content).slice(0, 4000) }]
    }))

    // System instruction
    const systemInstruction = system
      ? { parts: [{ text: system }] }
      : undefined

    const body = {
      contents,
      ...(systemInstruction && { system_instruction: systemInstruction }),
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API error:', data)
      if (response.status === 403)
        return res.status(503).json({ success: false, message: 'AI service API key is invalid. Please contact your administrator.' })
      if (response.status === 429)
        return res.status(429).json({ success: false, message: 'AI service is busy. Please wait a moment and try again.' })
      return res.status(503).json({ success: false, message: 'AI service is temporarily unavailable.' })
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      || 'I could not generate a response. Please try again.'

    res.json({ success: true, reply })

  } catch (err) {
    console.error('AI chat error:', err.message)
    res.status(500).json({ success: false, message: 'Failed to get AI response. Please try again.' })
  }
}

module.exports = { chat }
