// Image upload for the admin editor. Returns the URL for insertion into Markdown.

export default defineEventHandler(async (event) => {
  const form = await readFormData(event)
  const file = form.get('file') as File | null

  if (!file) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    throw createError({ statusCode: 400, message: 'Only image files are allowed' })
  }

  const ext = file.name.split('.').pop()
  const key = `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  await blob.put(key, file, {
    contentType: file.type,
    addRandomSuffix: false,
  })

  return { ok: true, key, url: `/api/images/${key}` }
})
