export interface Point2D { x: number; y: number }
export interface ViewTransform { zoom: number; panX: number; panY: number }
export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 6
export function clampZoom(zoom: number): number { return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }
/** Change zoom while keeping the canvas-space point under the cursor stationary. */
export function zoomAtPoint(view: ViewTransform, factor: number, cursor: Point2D): ViewTransform {
  const zoom = clampZoom(view.zoom * factor)
  const actualFactor = zoom / view.zoom
  return { zoom, panX: cursor.x - (cursor.x - view.panX) * actualFactor, panY: cursor.y - (cursor.y - view.panY) * actualFactor }
}
export function zoomBy(view: ViewTransform, factor: number, center: Point2D): ViewTransform { return zoomAtPoint(view, factor, center) }
export function panBy(view: ViewTransform, delta: Point2D): ViewTransform { return { ...view, panX: view.panX + delta.x, panY: view.panY + delta.y } }
export function screenToCanvas(point: Point2D, view: ViewTransform, cssWidth: number, cssHeight = cssWidth, resolution = 1024): Point2D {
  const scaledX = (point.x - view.panX) / view.zoom
  const scaledY = (point.y - view.panY) / view.zoom
  return { x: scaledX * resolution / cssWidth, y: scaledY * resolution / cssHeight }
}
export function canvasToScreen(point: Point2D, view: ViewTransform, cssWidth: number, cssHeight = cssWidth, resolution = 1024): Point2D {
  return { x: point.x * cssWidth / resolution * view.zoom + view.panX, y: point.y * cssHeight / resolution * view.zoom + view.panY }
}
export function distance(a: Point2D, b: Point2D): number { return Math.hypot(b.x - a.x, b.y - a.y) }
export function midpoint(a: Point2D, b: Point2D): Point2D { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
