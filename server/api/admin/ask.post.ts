// AI text assistant — streams a Gemini response back as SSE.
// Requires NUXT_SYSTEM_GEMINI_KEY in .dev.vars / Cloudflare secrets.

import { sendStream, setResponseHeader } from 'h3'
import { z } from 'zod'
import { resolveFlashModel } from '~/server/utils/gemini'

const Schema = z.object({
  question: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'question is required' })
  }

  const config = useRuntimeConfig(event)
  const apiKey = (config.systemGeminiKey as string) || (event.context.cloudflare?.env as Record<string, string> | undefined)?.NUXT_SYSTEM_GEMINI_KEY || ''
  if (!apiKey) {
    throw createError({ statusCode: 503, message: 'AI not configured — add NUXT_SYSTEM_GEMINI_KEY to .dev.vars' })
  }

  const modelName = await resolveFlashModel(apiKey)

  const makeUrl = (model: string) =>
    `https://generativelanguage.googleapis.com/v1beta/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

  async function callGemini(model: string) {
    return fetch(makeUrl(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: parsed.data.question }] }],
        generation_config: { temperature: 0.4, top_p: 0.9 },
      }),
    })
  }

  let res = await callGemini(modelName)

  if (!res.ok || !res.body) {
    let errPayload: { error?: { status?: string; message?: string } } = {}
    try { errPayload = await res.json() } catch { /* ignore */ }

    const geminiMsg = errPayload?.error?.message ?? `HTTP ${res.status}`
    if (errPayload?.error?.status === 'UNAVAILABLE') {
      res = await callGemini(FALLBACK_MODEL)
    }
    if (!res.ok || !res.body) {
      throw createError({ statusCode: 502, message: `Gemini error: ${geminiMsg}` })
    }
  }

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  return sendStream(event, res.body)
})
