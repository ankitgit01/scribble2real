import type { CanvasApi } from '../canvasApi'

export type CanvasLayerName = 'reference' | 'color' | 'line'
export type CanvasLayers = Record<CanvasLayerName, HTMLCanvasElement>
export type LayerVisibility = { line: boolean; color: boolean; reference: boolean }
export interface CanvasExportView { zoom: number; panX: number; panY: number; width: number; height: number }
const SIZE = 1024

export function createCanvas(width = SIZE, height = SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  return canvas
}
export function isCanvasEmpty(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return true
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) return false
  return true
}
export function lineLayerToOpaqueGrayscale(source: Uint8ClampedArray): Uint8ClampedArray {
  const result = new Uint8ClampedArray(source.length)
  for (let index = 0; index < source.length; index += 4) {
    // The layer stores ink on transparency. Alpha becomes black ink density;
    // the output is an opaque white page with antialiased dark strokes.
    const gray = 255 - source[index + 3]
    result[index] = gray
    result[index + 1] = gray
    result[index + 2] = gray
    result[index + 3] = 255
  }
  return result
}
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode canvas as PNG')), 'image/png'))
}
function renderViewport(source: HTMLCanvasElement, view: CanvasExportView, includeWhite = false): HTMLCanvasElement {
  const canvas = createCanvas()
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is unavailable')
  if (includeWhite) { context.fillStyle = '#fff'; context.fillRect(0, 0, SIZE, SIZE) }
  const width = Math.max(1, view.width); const height = Math.max(1, view.height)
  context.setTransform(view.zoom, 0, 0, view.zoom, view.panX * SIZE / width, view.panY * SIZE / height)
  context.drawImage(source, 0, 0)
  return canvas
}
function composite(layers: CanvasLayers, visible: LayerVisibility, view: CanvasExportView): HTMLCanvasElement {
  const canvas = createCanvas()
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is unavailable')
  context.fillStyle = '#fff'; context.fillRect(0, 0, SIZE, SIZE)
  for (const name of ['reference', 'line', 'color'] as const) if (visible[name]) context.drawImage(renderViewport(layers[name], view), 0, 0)
  return canvas
}
function lineMap(layers: CanvasLayers, view: CanvasExportView): HTMLCanvasElement {
  const sourceCanvas = createCanvas(layers.line.width, layers.line.height)
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  const lineContext = layers.line.getContext('2d', { willReadFrequently: true })
  if (!sourceContext || !lineContext) throw new Error('Canvas 2D context is unavailable')
  const source = lineContext.getImageData(0, 0, layers.line.width, layers.line.height)
  const pixels = sourceContext.createImageData(layers.line.width, layers.line.height)
  // Without alpha normalization the exported transparent pixels were decoded
  // as black by the backend, making the drawing disappear from both AI paths.
  pixels.data.set(lineLayerToOpaqueGrayscale(source.data))
  sourceContext.putImageData(pixels, 0, 0)
  return renderViewport(sourceCanvas, view, true)
}
function defaultView(layers: CanvasLayers): CanvasExportView {
  return { zoom: 1, panX: 0, panY: 0, width: layers.line.width, height: layers.line.height }
}
export async function exportLineMapPNG(layers: CanvasLayers, rasterBaseline = false, view = defaultView(layers)): Promise<Blob> {
  return canvasToBlob(rasterBaseline ? renderViewport(layers.line, view, true) : lineMap(layers, view))
}
export async function exportColorLayerPNG(layers: CanvasLayers, view = defaultView(layers)): Promise<Blob | null> {
  const visible = renderViewport(layers.color, view)
  return isCanvasEmpty(visible) ? null : canvasToBlob(visible)
}
export async function exportReferencePNG(layers: CanvasLayers, view = defaultView(layers)): Promise<Blob | null> {
  const visible = renderViewport(layers.reference, view)
  return isCanvasEmpty(visible) ? null : canvasToBlob(visible)
}
export async function exportCompositePNG(layers: CanvasLayers, visible: LayerVisibility, view = defaultView(layers)): Promise<Blob> { return canvasToBlob(composite(layers, visible, view)) }
export function hasLineContent(layers: CanvasLayers, view = defaultView(layers)): boolean { return !isCanvasEmpty(renderViewport(layers.line, view)) }

/** Build the stable CanvasApi surface around engine-owned layers and lifecycle handlers. */
export function createCanvasApi(layers: CanvasLayers, options: {
  visible(): LayerVisibility
  importSketch(blob: Blob): Promise<void>
  replaceCanvasWithImage(blob: Blob): Promise<void>
  hasRasterBaseline(): boolean
  view(): CanvasExportView
  setReference(blob: Blob | null): Promise<void>
  clearLineLayer(): void
  clearAll(): void
  onContentChange(callback: () => void): () => void
}): CanvasApi {
  return {
    exportLineMapPNG: () => exportLineMapPNG(layers, options.hasRasterBaseline(), options.view()),
    exportColorLayerPNG: () => exportColorLayerPNG(layers, options.view()),
    exportReferencePNG: () => exportReferencePNG(layers, options.view()),
    exportCompositePNG: () => exportCompositePNG(layers, options.visible(), options.view()),
    hasLineContent: () => hasLineContent(layers, options.view()),
    importSketch: options.importSketch,
    replaceCanvasWithImage: options.replaceCanvasWithImage,
    hasRasterBaseline: options.hasRasterBaseline,
    setReference: options.setReference,
    clearLineLayer: options.clearLineLayer,
    clearAll: options.clearAll,
    onContentChange: options.onContentChange
  }
}

/** Replace an image with its dark-line alpha mask, preserving antialiased pencil edges. */
export async function drawSketchAsTransparentInk(canvas: HTMLCanvasElement, blob: Blob, drawingSize = SIZE): Promise<void> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas 2D context is unavailable')
    const temp = createCanvas(canvas.width, canvas.height)
    const tempContext = temp.getContext('2d', { willReadFrequently: true })
    if (!tempContext) throw new Error('Canvas 2D context is unavailable')
    const scale = Math.min(drawingSize / bitmap.width, drawingSize / bitmap.height)
    const width = bitmap.width * scale; const height = bitmap.height * scale
    const offsetX = (canvas.width - drawingSize) / 2; const offsetY = (canvas.height - drawingSize) / 2
    const x = offsetX + (drawingSize - width) / 2; const y = offsetY + (drawingSize - height) / 2
    tempContext.fillStyle = '#fff'; tempContext.fillRect(offsetX, offsetY, drawingSize, drawingSize)
    tempContext.drawImage(bitmap, x, y, width, height)
    const pixels = tempContext.getImageData(0, 0, canvas.width, canvas.height)
    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance = 0.2126 * pixels.data[index] + 0.7152 * pixels.data[index + 1] + 0.0722 * pixels.data[index + 2]
      const alpha = Math.round((255 - luminance) * pixels.data[index + 3] / 255)
      pixels.data[index] = 0; pixels.data[index + 1] = 0; pixels.data[index + 2] = 0; pixels.data[index + 3] = alpha
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.putImageData(pixels, 0, 0)
  } finally { bitmap.close() }
}

export function clearCanvas(canvas: HTMLCanvasElement): void {
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
}
