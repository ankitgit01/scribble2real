import { useEffect, useState } from 'react'
import { useCanvasStore } from './canvasStore'
import type { ToolId } from './tools/types'

const keyTools: Record<string, ToolId> = { b: 'brush', p: 'pencil', e: 'eraser', g: 'fill', l: 'line', r: 'rect', o: 'ellipse', t: 'text', v: 'select', y: 'triangle', a: 'arrow', s: 'star', h: 'hexagon' }
export function useCanvasShortcuts(): { helpOpen: boolean; setHelpOpen: (open: boolean) => void } {
  const [helpOpen, setHelpOpen] = useState(false)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-canvas-text-editor]')) return
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      const key = event.key.toLowerCase()
      const store = useCanvasStore.getState()
      if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); if (event.shiftKey) store.redo(); else store.undo(); return }
      if ((event.ctrlKey || event.metaKey) && key === 'y') { event.preventDefault(); store.redo(); return }
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (keyTools[key]) { store.setTool(keyTools[key]); return }
      if (key === '[') { store.setSize(store.size - 1); return }
      if (key === ']') store.setSize(store.size + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return { helpOpen, setHelpOpen }
}
