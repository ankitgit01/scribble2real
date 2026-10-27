import { beforeEach, describe, expect, it, vi } from 'vitest'
import fillTool from '../tools/extra/fill'
import type { ToolContext } from '../tools/types'

const SIZE = 1024
function makeContext(pixels: Uint8ClampedArray) {
  return {
    canvas: { width: SIZE, height: SIZE },
    getImageData: () => ({ data: pixels, width: SIZE, height: SIZE, colorSpace: 'srgb' }),
    putImageData: vi.fn(), fillRect: vi.fn(), set fillStyle(_value: string) {}, get fillStyle() { return '#000' }
  } as unknown as CanvasRenderingContext2D
}
function setup(point: { x: number; y: number }, layer: 'line' | 'color' = 'color') {
  const lines = new Uint8ClampedArray(SIZE * SIZE * 4)
  const colors = new Uint8ClampedArray(SIZE * SIZE * 4)
  const lineIndex = (x: number, y: number) => (y * SIZE + x) * 4
  for (let x = 10; x <= 20; x += 1) { lines[lineIndex(x, 10) + 3] = 255; lines[lineIndex(x, 20) + 3] = 255 }
  for (let y = 10; y <= 20; y += 1) { lines[lineIndex(10, y) + 3] = 255; lines[lineIndex(20, y) + 3] = 255 }
  const lineContext = makeContext(lines); const colorContext = makeContext(colors)
  const commit = vi.fn()
  const context: ToolContext = {
    layer, ctx: layer === 'line' ? lineContext : colorContext, overlay: makeContext(new Uint8ClampedArray(SIZE * SIZE * 4)),
    getLayerCtx: (layer) => layer === 'line' ? lineContext : colorContext,
    color: '#ff0000', size: 8, point: () => ({ ...point, pressure: 1 }), commit
  }
  return { context, colors, lineIndex, colorContext, commit }
}
beforeEach(() => {
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement
    const canvas = { width: 1, height: 1, getContext: () => ({ fillStyle: '', fillRect: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([255, 0, 0, 255]) }) }) }
    return canvas as unknown as HTMLCanvasElement
  })
})
describe('fill tool', () => {
  it('fills a closed room into the color layer only', () => {
    const { context, colors, lineIndex, colorContext, commit } = setup({ x: 15, y: 15 }, 'color')
    fillTool.onDown(context, {} as PointerEvent)
    expect(colors.slice(lineIndex(15, 15), lineIndex(15, 15) + 4)).toEqual(new Uint8ClampedArray([255, 0, 0, 255]))
    expect(colors[lineIndex(5, 5) + 3]).toBe(0)
    expect(colorContext.putImageData).toHaveBeenCalledOnce()
    expect(commit).toHaveBeenCalledWith('color')
  })
  it('closes a small gap in a boundary before filling', () => {
    const { context, colors, lineIndex, commit } = setup({ x: 15, y: 15 }, 'color')
    const line = context.getLayerCtx('line').getImageData(0, 0, SIZE, SIZE).data
    line[lineIndex(15, 10) + 3] = 0
    fillTool.onDown(context, {} as PointerEvent)
    expect(colors[lineIndex(15, 15) + 3]).toBe(255)
    expect(commit).toHaveBeenCalledOnce()
  })
  it('does nothing when the pointer lands on a wall', () => {
    const { context, colorContext, commit } = setup({ x: 10, y: 15 })
    fillTool.onDown(context, {} as PointerEvent)
    expect(colorContext.putImageData).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
  })
})
