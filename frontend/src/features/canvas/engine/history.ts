import type { LayerId } from '../tools/types'

export interface HistoryEntry { layer: LayerId; before: ImageData; after: ImageData; x: number; y: number }
export interface HistoryFlags { canUndo: boolean; canRedo: boolean }
function readPixels(source: CanvasRenderingContext2D | HTMLCanvasElement | ImageData): ImageData {
  if ('data' in source) return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  const context = 'getContext' in source ? source.getContext('2d', { willReadFrequently: true }) : source
  if (!context) throw new Error('Canvas 2D context is unavailable')
  return context.getImageData(0, 0, context.canvas.width, context.canvas.height)
}

/** Unified, bounded undo/redo history. One committed pointer gesture is one entry. */
export class CanvasHistory {
  private undoEntries: HistoryEntry[] = []
  private redoEntries: HistoryEntry[] = []
  private current = new Map<LayerId, ImageData>()
  private pending = new Map<LayerId, ImageData>()
  readonly limit: number
  constructor(limit = 30) { this.limit = Math.max(1, Math.floor(limit)) }
  initialize(layer: LayerId, source: CanvasRenderingContext2D | HTMLCanvasElement | ImageData): void {
    this.current.set(layer, readPixels(source)); this.pending.delete(layer)
  }
  begin(layer: LayerId, source: CanvasRenderingContext2D | HTMLCanvasElement | ImageData): void {
    this.pending.set(layer, readPixels(source))
  }
  commit(layer: LayerId, source: CanvasRenderingContext2D | HTMLCanvasElement | ImageData): HistoryFlags {
    const after = readPixels(source)
    const before = this.pending.get(layer) ?? this.current.get(layer) ?? after
    this.pending.delete(layer)
    const bounds = changedBounds(before, after)
    if (bounds) {
      this.undoEntries.push({ layer, before: crop(before, bounds), after: crop(after, bounds), x: bounds.x, y: bounds.y })
      if (this.undoEntries.length > this.limit) this.undoEntries.splice(0, this.undoEntries.length - this.limit)
      this.redoEntries = []
    }
    this.current.set(layer, after)
    return this.flags()
  }
  abort(layer: LayerId): ImageData | null {
    const snapshot = this.pending.get(layer) ?? null
    this.pending.delete(layer)
    return snapshot
  }
  hasPending(layer: LayerId): boolean { return this.pending.has(layer) }
  undo(): HistoryEntry | null {
    const entry = this.undoEntries.pop()
    if (!entry) return null
    this.redoEntries.push(entry)
    patchPixels(this.current.get(entry.layer), entry.before, entry.x, entry.y)
    return { layer: entry.layer, before: entry.after, after: entry.before, x: entry.x, y: entry.y }
  }
  redo(): HistoryEntry | null {
    const entry = this.redoEntries.pop()
    if (!entry) return null
    this.undoEntries.push(entry)
    patchPixels(this.current.get(entry.layer), entry.after, entry.x, entry.y)
    return { layer: entry.layer, before: entry.before, after: entry.after, x: entry.x, y: entry.y }
  }
  flags(): HistoryFlags { return { canUndo: this.undoEntries.length > 0, canRedo: this.redoEntries.length > 0 } }
  clear(): void { this.undoEntries = []; this.redoEntries = []; this.pending.clear() }
  get undoCount(): number { return this.undoEntries.length }
  get redoCount(): number { return this.redoEntries.length }
}

interface Bounds { x: number; y: number; width: number; height: number }
function changedBounds(left: ImageData, right: ImageData): Bounds | null {
  if (left.width !== right.width || left.height !== right.height) return { x: 0, y: 0, width: right.width, height: right.height }
  let minX = left.width; let minY = left.height; let maxX = -1; let maxY = -1
  for (let y = 0; y < left.height; y += 1) for (let x = 0; x < left.width; x += 1) {
    const index = (y * left.width + x) * 4
    if (left.data[index] !== right.data[index] || left.data[index + 1] !== right.data[index + 1] || left.data[index + 2] !== right.data[index + 2] || left.data[index + 3] !== right.data[index + 3]) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
function crop(source: ImageData, bounds: Bounds): ImageData {
  const data = new Uint8ClampedArray(bounds.width * bounds.height * 4)
  for (let row = 0; row < bounds.height; row += 1) {
    const sourceStart = ((bounds.y + row) * source.width + bounds.x) * 4
    data.set(source.data.subarray(sourceStart, sourceStart + bounds.width * 4), row * bounds.width * 4)
  }
  return new ImageData(data, bounds.width, bounds.height)
}
function patchPixels(target: ImageData | undefined, patch: ImageData, x: number, y: number): void {
  if (!target) return
  for (let row = 0; row < patch.height; row += 1) {
    const targetStart = ((y + row) * target.width + x) * 4
    target.data.set(patch.data.subarray(row * patch.width * 4, (row + 1) * patch.width * 4), targetStart)
  }
}
