import type { Point, ToolHandler } from '../types'
const starts = new WeakMap<CanvasRenderingContext2D, Point>()
function constrainedEnd(start: Point, end: Point, constrain: boolean): Point {
  if (!constrain) return end
  const width = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  return { x: start.x + Math.sign(end.x - start.x || 1) * width, y: start.y + Math.sign(end.y - start.y || 1) * width, pressure: end.pressure }
}
function draw(ctx: CanvasRenderingContext2D, start: Point, end: Point, color: string, size: number, constrain: boolean): void {
  const point = constrainedEnd(start, end, constrain)
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; ctx.lineWidth = size
  ctx.beginPath(); ctx.rect(start.x, start.y, point.x - start.x, point.y - start.y); ctx.stroke(); ctx.restore()
}
const rectangleTool: ToolHandler = {
  id: 'rect', labelKey: 'canvas-tools.rectangle', cursor: 'crosshair',
  onDown(context, event) { const start = context.point(event); starts.set(context.overlay, start); draw(context.overlay, start, start, context.color, context.size, event.shiftKey) },
  onMove(context, event) { const start = starts.get(context.overlay); if (!start) return; context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); draw(context.overlay, start, context.point(event), context.color, context.size, event.shiftKey) },
  onUp(context, event) { const start = starts.get(context.overlay); if (!start) return; draw(context.ctx, start, context.point(event), context.color, context.size, event.shiftKey); starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); context.commit() },
  onCancel(context) { starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height) }
}
export default rectangleTool
