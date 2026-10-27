import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasHistory } from '../engine/history'

class TestImageData {
  data: Uint8ClampedArray
  width: number
  height: number
  constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height }
}
beforeEach(() => vi.stubGlobal('ImageData', TestImageData))
afterEach(() => vi.unstubAllGlobals())

function fakeContext(): CanvasRenderingContext2D {
  let pixels = { data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData
  const canvas = { width: 1, height: 1 } as HTMLCanvasElement
  return { canvas, getImageData: () => ({ data: new Uint8ClampedArray(pixels.data), width: 1, height: 1 }) as ImageData, putImageData: (image: ImageData) => { pixels = image } } as unknown as CanvasRenderingContext2D
}
function paint(context: CanvasRenderingContext2D, red: number): void { const image = context.getImageData(0, 0, 1, 1); image.data[0] = red; image.data[3] = 255; context.putImageData(image, 0, 0) }

describe('CanvasHistory', () => {
  it('tracks gesture order and updates undo/redo flags', () => {
    const history = new CanvasHistory(30)
    const line = fakeContext()
    history.initialize('line', line)
    history.begin('line', line); paint(line, 10); history.commit('line', line)
    history.begin('line', line); paint(line, 20); history.commit('line', line)
    expect(history.flags()).toEqual({ canUndo: true, canRedo: false })
    expect(history.undo()?.after.data[0]).toBe(10)
    expect(history.undo()?.after.data[0]).toBe(0)
    expect(history.flags()).toEqual({ canUndo: false, canRedo: true })
    expect(history.redo()?.after.data[0]).toBe(10)
    expect(history.flags()).toEqual({ canUndo: true, canRedo: true })
  })

  it('caps history at the configured number of entries and clears redo on a new commit', () => {
    const history = new CanvasHistory(2)
    const line = fakeContext()
    history.initialize('line', line)
    for (const value of [1, 2, 3]) { history.begin('line', line); paint(line, value); history.commit('line', line) }
    expect(history.undoCount).toBe(2)
    history.undo()
    history.begin('line', line); paint(line, 9); history.commit('line', line)
    expect(history.redoCount).toBe(0)
  })
})
