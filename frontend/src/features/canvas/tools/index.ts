import type { ToolHandler } from './types'
import { brushTool, eraserTool, pencilTool } from './brush'

const extras = import.meta.glob<Record<string, ToolHandler>>('./extra/*.ts', { eager: true })
const handlers = [brushTool, pencilTool, eraserTool, ...Object.values(extras).flatMap((module) => Object.values(module))]
export const tools: ReadonlyMap<ToolHandler['id'], ToolHandler> = new Map(handlers.map((handler) => [handler.id, handler]))
export function getToolHandler(id: ToolHandler['id']): ToolHandler {
  const handler = tools.get(id)
  if (!handler) throw new Error(`No handler registered for canvas tool "${id}"`)
  return handler
}
export { brushTool, pencilTool, eraserTool }
export type { LayerId, Point, ToolContext, ToolHandler, ToolId } from './types'
