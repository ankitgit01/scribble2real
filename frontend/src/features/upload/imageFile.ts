export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
export const MAX_IMAGE_SIDE = 2000
export class ImageFileError extends Error { constructor(message: string) { super(message); this.name = 'ImageFileError' } }
export interface ImageDimensions { width: number; height: number }

export function validateImageFile(file: File, maxBytes = MAX_UPLOAD_BYTES): void {
  if (!file.type || !file.type.startsWith('image/')) throw new ImageFileError('Choose an image file such as a PNG or JPEG.')
  if (file.size <= 0) throw new ImageFileError('This image file is empty.')
  if (file.size > maxBytes) throw new ImageFileError('This image is larger than 15 MB. Choose a smaller file.')
}
export function getDownscaledDimensions(width: number, height: number, maxSide = MAX_IMAGE_SIDE): ImageDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new ImageFileError('The image dimensions are invalid.')
  if (!Number.isFinite(maxSide) || maxSide < 1) throw new ImageFileError('The maximum image size must be positive.')
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
function canvasBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new ImageFileError('The image could not be prepared. Please choose another file.')), mimeType, quality))
}
export async function prepareImageFile(file: File, options: { maxBytes?: number; maxSide?: number } = {}): Promise<Blob> {
  validateImageFile(file, options.maxBytes)
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new ImageFileError('This image could not be opened. Try saving it as a PNG or JPEG.') }
  try {
    const dimensions = getDownscaledDimensions(bitmap.width, bitmap.height, options.maxSide)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width; canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) throw new ImageFileError('Image preparation is unavailable in this browser.')
    const mime = file.type.toLowerCase() === 'image/png' ? 'image/png' : 'image/jpeg'
    if (mime === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, dimensions.width, dimensions.height) }
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height)
    return await canvasBlob(canvas, mime, 0.92)
  } finally { bitmap.close() }
}
