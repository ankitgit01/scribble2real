import type { Point } from '../types'
import type { ToolHandler } from '../types'
const starts = new WeakMap<CanvasRenderingContext2D, Point>()
function endPoint(start: Point, end: Point, constrain: boolean): Point {
  if (!constrain) return end
  const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.hypot(dx, dy)
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length, pressure: end.pressure }
}
function draw(context: CanvasRenderingContext2D, start: Point, end: Point, color: string, size: number, constrained: boolean): void {
  const target = endPoint(start, end, constrained)
  context.save(); context.globalCompositeOperation = 'source-over'; context.strokeStyle = color; context.lineWidth = size; context.lineCap = 'round'
  context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(target.x, target.y); context.stroke(); context.restore()
}
const lineTool: ToolHandler = {
  id: 'line', labelKey: 'canvas-tools.line', cursor: 'crosshair',
  onDown(context, event) { const start = context.point(event); starts.set(context.overlay, start); draw(context.overlay, start, start, context.color, context.size, event.shiftKey) },
  onMove(context, event) { const start = starts.get(context.overlay); if (!start) return; context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); draw(context.overlay, start, context.point(event), context.color, context.size, event.shiftKey) },
  onUp(context, event) { const start = starts.get(context.overlay); if (!start) return; draw(context.ctx, start, context.point(event), context.color, context.size, event.shiftKey); starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height); context.commit() },
  onCancel(context) { starts.delete(context.overlay); context.overlay.clearRect(0, 0, context.overlay.canvas.width, context.overlay.canvas.height) }
}
export default lineTool
