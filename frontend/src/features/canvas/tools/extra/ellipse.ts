import type { Point, ToolHandler } from '../types'
const starts = new WeakMap<CanvasRenderingContext2D, Point>()
function constrainedEnd(start: Point, end: Point, constrain: boolean): Point {
  if (!constrain) return end
  const radius = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  return { x: start.x + Math.sign(end.x - start.x || 1) * radius, y: start.y + Math.sign(end.y - start.y || 1) * radius, pressure: end.pressure }
}
function draw(ctx: CanvasRenderingContext2D, start: Point, end: Point, color: string, size: number, constrain: boolean): void {
  const point = constrainedEnd(start, end, constrain)
  const left = Math.min(start.x, point.x); const top = Math.min(start.y, point.y)
  const rx = Math.max(0.5, Math.abs(point.x - start.x) / 2); const ry = Math.max(0.5, Math.abs(point.y - start.y) / 2)
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; ctx.lineWidth = size
  ctx.beginPath(); ctx.ellipse(left + rx, top + ry, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
}
const ellipseTool: ToolHandler = {
  id: 'ellipse', labelKey: 'canvas-tools.ellipse', cursor: 'crosshair',
  onDown(context, event) { const start = context.point(event); starts.set(context.overlay, start); draw(context.overlay, start, start, context.color, context.size, event.shiftKey) },
  onMove(context, event) { const start = starts.get(context.overlay); if (!start) return; context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); draw(context.overlay, start, context.point(event), context.color, context.size, event.shiftKey) },
  onUp(context, event) { const start = starts.get(context.overlay); if (!start) return; draw(context.ctx, start, context.point(event), context.color, context.size, event.shiftKey); starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); context.commit() },
  onCancel(context) { starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height) }
}
export default ellipseTool
