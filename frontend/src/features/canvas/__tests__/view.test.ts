import { describe, expect, it } from 'vitest'
import { clampZoom, screenToCanvas, zoomAtPoint } from '../engine/view'

describe('view transform math', () => {
  it('clamps zoom between 0.5× and 6×', () => {
    expect(clampZoom(0.1)).toBe(0.5)
    expect(clampZoom(9)).toBe(6)
  })
  it('keeps the cursor anchored while zooming', () => {
    const view = zoomAtPoint({ zoom: 1, panX: 20, panY: 10 }, 2, { x: 100, y: 80 })
    expect(view).toEqual({ zoom: 2, panX: -60, panY: -60 })
    expect(screenToCanvas({ x: 100, y: 80 }, view, 512)).toEqual({ x: 160, y: 140 })
  })
})
