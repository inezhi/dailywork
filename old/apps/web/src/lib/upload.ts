import type { Attachment } from '@daily/contracts'
import { uploadAttachment } from './api'

async function makeThumbnail(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return null
  try {
    const bitmap = await createImageBitmap(file)
    const max = 320
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
  } catch {
    return null
  }
}

export async function uploadOwnerFile(
  ownerType: 'task' | 'document' | 'memo',
  ownerId: string,
  file: File,
): Promise<Attachment> {
  const thumb = await makeThumbnail(file)
  return (await uploadAttachment(ownerType, ownerId, file, thumb)) as Attachment
}
