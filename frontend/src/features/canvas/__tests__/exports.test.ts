import { describe, expect, it } from 'vitest'
import { lineLayerToOpaqueGrayscale } from '../engine/exports'

describe('line layer export', () => {
  it('encodes transparent layer pixels as an opaque white page with dark antialiased ink', () => {
    const source = new Uint8ClampedArray([
      0, 0, 0, 0,
      20, 30, 40, 128,
      0, 0, 0, 255
    ])

    expect(lineLayerToOpaqueGrayscale(source)).toEqual(new Uint8ClampedArray([
      255, 255, 255, 255,
      127, 127, 127, 255,
      0, 0, 0, 255
    ]))
  })
})
