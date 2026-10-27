import type { Point, ToolContext, ToolHandler } from './types'

interface StrokeState { previous: Point; previousMidpoint: { x: number; y: number }; drawing: boolean }
const states = new WeakMap<CanvasRenderingContext2D, StrokeState>()

function drawDot(context: ToolContext, point: Point, kind: 'brush' | 'pencil' | 'eraser', pressureSensitive: boolean): void {
  const ctx = context.ctx
  const baseWidth = kind === 'pencil' ? Math.max(1, Math.min(context.size, 2)) : context.size
  const pressure = kind !== 'pencil' && pressureSensitive ? Math.max(0.2, Math.min(1, point.pressure)) : 1
  ctx.save()
  ctx.globalCompositeOperation = kind === 'eraser' ? 'destination-out' : 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = context.color
  if (kind === 'brush') {
    const radius = Math.max(0.5, baseWidth * pressure / 2)
    const gradient = ctx.createRadialGradient(point.x, point.y, radius * 0.18, point.x, point.y, radius)
    gradient.addColorStop(0, context.color)
    gradient.addColorStop(1, `${context.color}00`)
    ctx.fillStyle = gradient
  }
  ctx.beginPath()
  ctx.arc(point.x, point.y, Math.max(0.5, baseWidth * pressure / 2), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSmoothSegment(context: ToolContext, state: StrokeState, point: Point, kind: 'brush' | 'pencil' | 'eraser', pressureSensitive: boolean): void {
  const midpoint = { x: (state.previous.x + point.x) / 2, y: (state.previous.y + point.y) / 2 }
  const pressure = pressureSensitive ? (state.previous.pressure + point.pressure) / 2 : 1
  const width = kind === 'pencil' ? Math.max(1, Math.min(context.size, 2)) : context.size * Math.max(0.2, Math.min(1, pressure))
  const ctx = context.ctx
  ctx.save()
  ctx.globalCompositeOperation = kind === 'eraser' ? 'destination-out' : 'source-over'
  ctx.globalAlpha = 1
  ctx.strokeStyle = context.color
  ctx.fillStyle = context.color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'brush') ctx.shadowBlur = Math.max(1, width * 0.28)
  else ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.moveTo(state.previousMidpoint.x, state.previousMidpoint.y)
  ctx.quadraticCurveTo(state.previous.x, state.previous.y, midpoint.x, midpoint.y)
  ctx.stroke()
  ctx.restore()
  state.previous = point
  state.previousMidpoint = midpoint
}

function createTool(id: 'brush' | 'pencil' | 'eraser'): ToolHandler {
  return {
    id,
    labelKey: `canvas.${id}`,
    cursor: id === 'eraser' ? 'cell' : 'crosshair',
    onDown(context, event) {
      const point = context.point(event)
      const state: StrokeState = { previous: point, previousMidpoint: point, drawing: true }
      states.set(context.ctx, state)
      drawDot(context, point, id, event.pointerType === 'pen')
    },
    onMove(context, event) {
      const state = states.get(context.ctx)
      if (!state?.drawing) return
      drawSmoothSegment(context, state, context.point(event), id, event.pointerType === 'pen')
    },
    onUp(context, event) {
      const state = states.get(context.ctx)
      if (!state?.drawing) return
      drawSmoothSegment(context, state, context.point(event), id, event.pointerType === 'pen')
      state.drawing = false
      states.delete(context.ctx)
      context.commit()
    },
    onCancel(context) {
      const state = states.get(context.ctx)
      if (state) state.drawing = false
      states.delete(context.ctx)
    }
  }
}

export const brushTool = createTool('brush')
export const pencilTool = createTool('pencil')
export const eraserTool = createTool('eraser')
