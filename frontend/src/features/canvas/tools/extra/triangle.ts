import type { Point, ToolHandler } from '../types'
const starts = new WeakMap<CanvasRenderingContext2D, Point>()
function draw(ctx: CanvasRenderingContext2D, start: Point, end: Point, color: string, size: number): void {
  const left = Math.min(start.x, end.x); const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y); const bottom = Math.max(start.y, end.y)
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; ctx.lineWidth = size
  ctx.beginPath(); ctx.moveTo((left + right) / 2, top); ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath(); ctx.stroke(); ctx.restore()
}
const triangleTool: ToolHandler = {
  id: 'triangle', labelKey: 'canvas-tools.triangle', cursor: 'crosshair',
  onDown(context, event) { const start = context.point(event); starts.set(context.overlay, start); draw(context.overlay, start, start, context.color, context.size) },
  onMove(context, event) { const start = starts.get(context.overlay); if (!start) return; context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); draw(context.overlay, start, context.point(event), context.color, context.size) },
  onUp(context, event) { const start = starts.get(context.overlay); if (!start) return; draw(context.ctx, start, context.point(event), context.color, context.size); starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); context.commit() },
  onCancel(context) { starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height) }
}
export default triangleTool
