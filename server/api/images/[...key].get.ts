// Serve images stored in blob storage (R2 in production, fs in dev).
// Uses blob.serve() which handles Content-Type and streaming automatically.

export default defineEventHandler(async (event) => {
  // keyParts already contains the full blob key, e.g. 'images/P1030821.jpg'
  const key = getRouterParam(event, 'key') as string

  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return blob.serve(event, key)
})
