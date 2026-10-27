import { create } from 'zustand'
import type { ToolId } from './tools/types'
import type { LayerId } from './tools/types'

export interface CanvasCommands { undo(): void; redo(): void; clearLayer(layer: LayerId): void; zoomBy(delta: number): void; resetView(): void }
interface Visibility { line: boolean; color: boolean; reference: boolean }
export interface CanvasState {
  tool: ToolId; size: number; color: string; recentColors: string[]; activeLayer: LayerId; layerVisible: Visibility; canUndo: boolean; canRedo: boolean; zoom: number; panX: number; panY: number; commands: CanvasCommands | null
  setTool(tool: ToolId): void; setSize(size: number): void; setColor(color: string): void; setActiveLayer(layer: LayerId): void; toggleLayerVisible(layer: keyof Visibility): void
  undo(): void; redo(): void; clearLayer(): void; zoomIn(): void; zoomOut(): void; resetView(): void
}
const invoke = (commands: CanvasCommands | null, action: keyof CanvasCommands, ...args: never[]) => {
  const fn = commands?.[action] as ((...values: never[]) => void) | undefined
  fn?.(...args)
}
export const useCanvasStore = create<CanvasState>((set, get) => ({
  tool: 'brush', size: 6, color: '#111111', recentColors: ['#111111'], activeLayer: 'line',
  layerVisible: { line: true, color: true, reference: true }, canUndo: false, canRedo: false, zoom: 1, panX: 0, panY: 0, commands: null,
  setTool: (tool) => set({ tool }),
  setSize: (size) => set({ size: Math.max(1, Math.min(60, Math.round(size))) }),
  setColor: (color) => set((state) => ({ color, recentColors: [color, ...state.recentColors.filter((entry) => entry.toLowerCase() !== color.toLowerCase())].slice(0, 8) })),
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  toggleLayerVisible: (layer) => set((state) => ({ layerVisible: { ...state.layerVisible, [layer]: !state.layerVisible[layer] } })),
  undo: () => invoke(get().commands, 'undo'),
  redo: () => invoke(get().commands, 'redo'),
  clearLayer: () => get().commands?.clearLayer(get().activeLayer),
  zoomIn: () => get().commands?.zoomBy(1.2),
  zoomOut: () => get().commands?.zoomBy(1 / 1.2),
  resetView: () => get().commands?.resetView()
}))
