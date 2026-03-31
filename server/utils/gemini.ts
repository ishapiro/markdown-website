const FLASH_MODEL_FALLBACK = 'models/gemini-3-flash'

const EXCLUDE_PATTERNS = ['image', 'audio', 'tts', 'live', 'native']

interface GeminiModelEntry {
  name?: string
  displayName?: string
  supportedGenerationMethods?: string[]
}

async function fetchModels(apiKey: string): Promise<GeminiModelEntry[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  if (!res.ok) return []
  const data = (await res.json()) as { models?: GeminiModelEntry[] }
  return data.models ?? []
}

function isTextModel(m: GeminiModelEntry): boolean {
  const name = m.name ?? ''
  return (
    (m.supportedGenerationMethods ?? []).includes('generateContent') &&
    !EXCLUDE_PATTERNS.some((p) => name.toLowerCase().includes(p))
  )
}

export async function resolveFlashModel(apiKey: string): Promise<string> {
  try {
    const models = await fetchModels(apiKey)
    const flashModels = models
      .filter((m) => isTextModel(m) && (m.name ?? '').includes('flash'))
      .map((m) => m.name ?? '')
      .sort()
      .reverse()
    return flashModels[0] || FLASH_MODEL_FALLBACK
  } catch {
    return FLASH_MODEL_FALLBACK
  }
}
