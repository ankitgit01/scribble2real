import { describe, expect, it } from 'vitest'
import { getDownscaledDimensions, ImageFileError, validateImageFile } from '../imageFile'

describe('image file preparation helpers', () => {
  it('preserves aspect ratio when downscaling', () => {
    expect(getDownscaledDimensions(4000, 2000)).toEqual({ width: 2000, height: 1000 })
    expect(getDownscaledDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })
  it('rejects non-image files and files above the size limit', () => {
    expect(() => validateImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toThrow(ImageFileError)
    expect(() => validateImageFile(new File(['image'], 'large.png', { type: 'image/png' }), 2)).toThrow(/15 MB/)
  })
})
