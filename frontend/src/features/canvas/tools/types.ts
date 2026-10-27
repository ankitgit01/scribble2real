export type LayerId = 'line' | 'color'
export type ToolId = 'brush' | 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'ellipse' | 'triangle' | 'arrow' | 'star' | 'hexagon' | 'text' | 'select'
export interface Point { x: number; y: number; pressure: number }
export interface ToolContext {
  layer: LayerId
  ctx: CanvasRenderingContext2D
  overlay: CanvasRenderingContext2D
  getLayerCtx(layer: LayerId): CanvasRenderingContext2D
  color: string
  size: number
  point(event: PointerEvent): Point
  commit(layer?: LayerId): void
}
export interface ToolHandler {
  id: ToolId
  labelKey: string
  cursor: string
  onDown(context: ToolContext, event: PointerEvent): void
  onMove(context: ToolContext, event: PointerEvent): void
  onUp(context: ToolContext, event: PointerEvent): void
  onCancel?(context: ToolContext): void
}
