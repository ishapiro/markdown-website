import { useR2 } from '~/server/utils/r2'

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key') as string

  const r2 = useR2(event)
  const object = await r2.get(key)

  if (!object) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }

  const contentType = object.httpMetadata?.contentType ?? 'image/jpeg'
  setResponseHeader(event, 'Content-Type', contentType)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  return sendStream(event, object.body)
})
