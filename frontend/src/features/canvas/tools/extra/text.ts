import type { ToolHandler } from '../types'

const textTool: ToolHandler = {
  id: 'text',
  labelKey: 'canvas-tools.text',
  cursor: 'text',
  onDown() {},
  onMove() {},
  onUp() {}
}

export default textTool
