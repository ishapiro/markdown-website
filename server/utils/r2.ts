import type { H3Event } from 'h3'

/** Minimal subset of the R2Bucket interface used by this app. */
export interface AppR2Bucket {
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>
  get(key: string): Promise<{ body: ReadableStream; text(): Promise<string>; httpMetadata?: { contentType?: string } } | null>
  delete(key: string): Promise<void>
}

export function useR2(event: H3Event): AppR2Bucket {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r2 = (event.context.cloudflare?.env as any)?.BLOB
  if (!r2) {
    throw createError({ statusCode: 500, message: 'R2 binding BLOB not available' })
  }
  return r2 as AppR2Bucket
}

/** Decode a base64 string to an ArrayBuffer. */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/** Derive a file extension from a MIME type. */
export function mimeToExt(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  return 'jpg'
}
