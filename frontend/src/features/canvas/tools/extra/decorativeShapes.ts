import type { Point, ToolHandler } from '../types'

type Shape = 'arrow' | 'star' | 'hexagon'
const starts = new WeakMap<CanvasRenderingContext2D, Point>()
function draw(ctx: CanvasRenderingContext2D, shape: Shape, start: Point, end: Point, color: string, size: number): void {
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath()
  if (shape === 'arrow') {
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const head = Math.max(size * 3, Math.min(26, Math.hypot(end.x - start.x, end.y - start.y) * 0.22))
    ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y)
    ctx.moveTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6)); ctx.lineTo(end.x, end.y)
    ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6))
  } else {
    const radiusX = Math.max(1, Math.abs(end.x - start.x) / 2); const radiusY = Math.max(1, Math.abs(end.y - start.y) / 2)
    const centerX = (start.x + end.x) / 2; const centerY = (start.y + end.y) / 2
    const count = shape === 'star' ? 10 : 6
    for (let index = 0; index < count; index += 1) {
      const outer = shape === 'hexagon' || index % 2 === 0
      const radius = outer ? 1 : 0.43
      const angle = -Math.PI / 2 + index * Math.PI * 2 / count
      const x = centerX + Math.cos(angle) * radiusX * radius
      const y = centerY + Math.sin(angle) * radiusY * radius
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }
  ctx.stroke(); ctx.restore()
}
function createTool(shape: Shape): ToolHandler {
  return {
    id: shape, labelKey: `canvas-tools.${shape}`, cursor: 'crosshair',
    onDown(context, event) { const start = context.point(event); starts.set(context.overlay, start); draw(context.overlay, shape, start, start, context.color, context.size) },
    onMove(context, event) { const start = starts.get(context.overlay); if (!start) return; context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); draw(context.overlay, shape, start, context.point(event), context.color, context.size) },
    onUp(context, event) { const start = starts.get(context.overlay); if (!start) return; draw(context.ctx, shape, start, context.point(event), context.color, context.size); starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); context.commit() },
    onCancel(context) { starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height) }
  }
}
export const arrowTool = createTool('arrow')
export const starTool = createTool('star')
export const hexagonTool = createTool('hexagon')
