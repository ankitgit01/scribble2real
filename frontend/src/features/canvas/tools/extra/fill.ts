import type { ToolHandler } from '../types'

const WALL_ALPHA = 32
const CLOSE_GAP_RADIUS = 2

function readWalls(context: CanvasRenderingContext2D): Uint8Array {
  const { width, height } = context.canvas
  const alpha = context.getImageData(0, 0, width, height).data
  const blocked = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (alpha[(y * width + x) * 4 + 3] <= WALL_ALPHA) continue
    for (let dy = -CLOSE_GAP_RADIUS; dy <= CLOSE_GAP_RADIUS; dy += 1) for (let dx = -CLOSE_GAP_RADIUS; dx <= CLOSE_GAP_RADIUS; dx += 1) {
      const nx = x + dx; const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) blocked[ny * width + nx] = 1
    }
  }
  return blocked
}

function colorBytes(color: string): [number, number, number, number] {
  const sample = document.createElement('canvas'); sample.width = 1; sample.height = 1
  const sampleContext = sample.getContext('2d')
  if (!sampleContext) throw new Error('Canvas 2D context is unavailable')
  sampleContext.fillStyle = color; sampleContext.fillRect(0, 0, 1, 1)
  const pixel = sampleContext.getImageData(0, 0, 1, 1).data
  return [pixel[0], pixel[1], pixel[2], 255]
}

function scanlineFill(walls: Uint8Array, width: number, height: number, x: number, y: number, paint: Uint8ClampedArray, rgba: [number, number, number, number]): boolean {
  if (x < 0 || x >= width || y < 0 || y >= height) return false
  const start = y * width + x
  if (walls[start]) return false
  const stack = new Int32Array(width * height)
  let top = 0
  stack[top++] = start
  let changed = false
  while (top > 0) {
    const seed = stack[--top]
    if (walls[seed]) continue
    const row = Math.floor(seed / width)
    let left = seed % width
    while (left > 0 && !walls[row * width + left - 1]) left -= 1
    let aboveOpen = false
    let belowOpen = false
    for (let cx = left; cx < width; cx += 1) {
      const index = row * width + cx
      if (walls[index]) break
      walls[index] = 1
      const offset = index * 4
      if (paint[offset] !== rgba[0] || paint[offset + 1] !== rgba[1] || paint[offset + 2] !== rgba[2] || paint[offset + 3] !== rgba[3]) changed = true
      paint[offset] = rgba[0]; paint[offset + 1] = rgba[1]; paint[offset + 2] = rgba[2]; paint[offset + 3] = rgba[3]
      if (row > 0) {
        const open = !walls[index - width]
        if (open && !aboveOpen && top < stack.length) stack[top++] = index - width
        aboveOpen = open
      }
      if (row < height - 1) {
        const open = !walls[index + width]
        if (open && !belowOpen && top < stack.length) stack[top++] = index + width
        belowOpen = open
      }
    }
  }
  return changed
}

const fillTool: ToolHandler = {
  id: 'fill', labelKey: 'canvas-tools.fill', cursor: 'crosshair',
  onDown(context, event) {
    const point = context.point(event)
    const x = Math.floor(point.x); const y = Math.floor(point.y)
    const target = context.ctx
    const walls = readWalls(context.getLayerCtx('line'))
    const { width, height } = target.canvas
    const pixels = target.getImageData(0, 0, width, height)
    const changed = scanlineFill(walls, width, height, x, y, pixels.data, colorBytes(context.color))
    if (!changed) return
    target.putImageData(pixels, 0, 0)
    context.commit()
  },
  onMove() {},
  onUp() {},
  onCancel() {}
}
export default fillTool
