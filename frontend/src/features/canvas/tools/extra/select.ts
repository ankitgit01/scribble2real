import type { ToolHandler } from '../types'

const selectTool: ToolHandler = {
  id: 'select',
  labelKey: 'canvas-tools.select',
  cursor: 'crosshair',
  onDown() {},
  onMove() {},
  onUp() {}
}

export default selectTool
