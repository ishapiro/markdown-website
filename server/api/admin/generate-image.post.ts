import { useR2, base64ToArrayBuffer, mimeToExt } from '~/server/utils/r2'

const FALLBACK_MODEL = 'models/gemini-2.0-flash-exp-image-generation'

async function resolveImageGenModel(apiKey: string): Promise<string> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (!res.ok) return FALLBACK_MODEL
    const data = await res.json() as { models?: { name?: string; supportedGenerationMethods?: string[] }[] }
    const match = (data.models ?? [])
      .filter((m) =>
        m.name?.includes('image') &&
        m.supportedGenerationMethods?.includes('generateContent'),
      )
      .map((m) => m.name ?? '')
      .sort()
      .reverse()[0]
    return match || FALLBACK_MODEL
  } catch {
    return FALLBACK_MODEL
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const apiKey = config.systemGeminiKey as string
  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'Image generation not configured (NUXT_SYSTEM_GEMINI_KEY missing)' })
  }

  const body = await readBody<{
    prompt: string
    previousPrompt?: string
    previousImage?: { mimeType: string; data: string }
  }>(event)

  if (!body?.prompt?.trim()) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  const prompt = body.prompt.trim()
  const previousPrompt = body.previousPrompt?.trim() ?? null
  const previousImage = body.previousImage ?? null

  const modelName = await resolveImageGenModel(apiKey)
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`

  const contents = previousImage
    ? [
        { role: 'user', parts: [{ text: previousPrompt || 'generate an image' }] },
        { role: 'model', parts: [{ inlineData: { mimeType: previousImage.mimeType, data: previousImage.data } }] },
        { role: 'user', parts: [{ text: prompt }] },
      ]
    : [{ role: 'user', parts: [{ text: prompt }] }]

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })

  if (!res.ok) {
    let msg = 'Image generation failed'
    try {
      const err = await res.json() as { error?: { message?: string } }
      msg = err?.error?.message || msg
    } catch { /* ignore */ }
    throw createError({ statusCode: 502, message: msg })
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType: string; data: string }
        }>
      }
    }>
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p) => p.inlineData?.data)

  if (!imagePart?.inlineData) {
    throw createError({ statusCode: 502, message: 'No image was generated. Try a different prompt.' })
  }

  const { mimeType, data: rawData } = imagePart.inlineData
  const key = `images/${crypto.randomUUID()}.${mimeToExt(mimeType)}`

  const r2 = useR2(event)
  await r2.put(key, base64ToArrayBuffer(rawData), { httpMetadata: { contentType: mimeType } })

  return {
    url: `/api/images/${key}`,
    key,
    mimeType,
    // Raw base64 returned so client can pass it back for iterative refinement without re-fetching from R2
    data: rawData,
  }
})
