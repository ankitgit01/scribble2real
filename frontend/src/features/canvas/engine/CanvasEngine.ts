import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Check, Clipboard, Copy, Scissors, Trash2, X } from 'lucide-react'
import { getCanvasApi, registerCanvasApi } from '../canvasApi'
import { useCanvasStore } from '../canvasStore'
import { getToolHandler } from '../tools'
import type { LayerId, ToolContext } from '../tools/types'
import { CanvasHistory } from './history'
import { clearCanvas, createCanvasApi, drawSketchAsTransparentInk, type CanvasLayers } from './exports'
import { canvasToScreen, distance, midpoint, panBy, screenToCanvas, zoomAtPoint, type Point2D, type ViewTransform } from './view'

const ARTBOARD_SIZE = 1024
const WORLD_SIZE = ARTBOARD_SIZE * 2
type CanvasRefs = { line: HTMLCanvasElement | null; color: HTMLCanvasElement | null; reference: HTMLCanvasElement | null; overlay: HTMLCanvasElement | null }
interface ActiveStroke { pointerId: number; pointerType: string; layer: LayerId; context: ToolContext; handler: ReturnType<typeof getToolHandler> }
interface PanGesture { pointerId: number; last: Point2D }
interface PinchGesture { startView: ViewTransform; startDistance: number; startCenter: Point2D }
interface SelectionRect { x: number; y: number; width: number; height: number }
interface TextEditor { id: number; x: number; y: number; screenX: number; screenY: number; value: string; layer: LayerId; color: string; size: number }
interface ClipboardPixels { canvas: HTMLCanvasElement; layer: LayerId }
interface FloatingPixels extends ClipboardPixels { x: number; y: number; width: number; height: number; moving: boolean; dragOffsetX: number; dragOffsetY: number }

function selectionRect(start: Point2D, end: Point2D): SelectionRect {
  const x = Math.max(0, Math.min(WORLD_SIZE, Math.min(start.x, end.x)))
  const y = Math.max(0, Math.min(WORLD_SIZE, Math.min(start.y, end.y)))
  const right = Math.max(0, Math.min(WORLD_SIZE, Math.max(start.x, end.x)))
  const bottom = Math.max(0, Math.min(WORLD_SIZE, Math.max(start.y, end.y)))
  return { x: Math.floor(x), y: Math.floor(y), width: Math.max(0, Math.ceil(right) - Math.floor(x)), height: Math.max(0, Math.ceil(bottom) - Math.floor(y)) }
}

export default function CanvasEngine({ className = 'relative aspect-square w-full touch-none overflow-hidden rounded-xl bg-white shadow-inner' }: { className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLCanvasElement>(null)
  const colorRef = useRef<HTMLCanvasElement>(null)
  const referenceRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const historyRef = useRef(new CanvasHistory(30))
  const listenersRef = useRef(new Set<() => void>())
  const activeStrokeRef = useRef<ActiveStroke | null>(null)
  const activePointersRef = useRef(new Map<number, { point: Point2D; type: string }>())
  const touchPointsRef = useRef(new Map<number, Point2D>())
  const pinchRef = useRef<PinchGesture | null>(null)
  const panRef = useRef<PanGesture | null>(null)
  const penActiveRef = useRef(false)
  const rasterBaselineRef = useRef(false)
  const initialFrameSizeRef = useRef<{ width: number; height: number } | null>(null)
  const spaceDownRef = useRef(false)
  const lastTapRef = useRef(0)
  const selectionRef = useRef<SelectionRect | null>(null)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const selectionDragRef = useRef<{ pointerId: number; start: Point2D } | null>(null)
  const floatingRef = useRef<FloatingPixels | null>(null)
  const [floating, setFloating] = useState<FloatingPixels | null>(null)
  const floatingDragRef = useRef<{ pointerId: number } | null>(null)
  const clipboardRef = useRef<ClipboardPixels | null>(null)
  const [hasClipboard, setHasClipboard] = useState(false)
  const textEditorRef = useRef<TextEditor | null>(null)
  const [textEditor, setTextEditor] = useState<TextEditor | null>(null)
  const nextTextIdRef = useRef(0)
  const viewRef = useRef<ViewTransform>({ zoom: 1, panX: 0, panY: 0 })
  const [renderedView, setRenderedView] = useState<ViewTransform>({ zoom: 1, panX: 0, panY: 0 })
  const toolId = useCanvasStore((state) => state.tool)
  const activeLayer = useCanvasStore((state) => state.activeLayer)
  const visibility = useCanvasStore((state) => state.layerVisible)
  const zoom = useCanvasStore((state) => state.zoom)
  const handler = useMemo(() => getToolHandler(toolId), [toolId])

  const canvases = useCallback((): CanvasRefs => ({ line: lineRef.current, color: colorRef.current, reference: referenceRef.current, overlay: overlayRef.current }), [])
  const contexts = useCallback(() => {
    const refs = canvases()
    const result: Partial<Record<keyof CanvasRefs, CanvasRenderingContext2D>> = {}
    for (const name of ['reference', 'color', 'line', 'overlay'] as const) {
      const context = refs[name]?.getContext('2d', { willReadFrequently: name !== 'overlay' })
      if (context) result[name] = context
    }
    return result
  }, [canvases])
  const notify = useCallback(() => { for (const listener of listenersRef.current) listener() }, [])
  const updateFlags = useCallback(() => useCanvasStore.setState(historyRef.current.flags()), [])
  const setView = useCallback((next: ViewTransform) => {
    const frame = frameRef.current
    const clampPan = (pan: number, size: number) => Math.max(size - size * 2 * next.zoom, Math.min(0, pan))
    const bounded = frame ? { ...next, panX: clampPan(next.panX, frame.clientWidth), panY: clampPan(next.panY, frame.clientHeight) } : next
    viewRef.current = bounded
    setRenderedView(bounded)
    useCanvasStore.setState({ zoom: bounded.zoom, panX: bounded.panX, panY: bounded.panY })
  }, [])
  const restoreHistoryEntry = useCallback((image: ImageData, layer: LayerId, x: number, y: number) => {
    const context = contexts()[layer]
    if (!context) return
    context.putImageData(image, x, y)
    if (layer === 'line') {
      const fullImage = context.getImageData(0, 0, context.canvas.width, context.canvas.height)
      let opaque = 0
      for (let index = 3; index < fullImage.data.length; index += 4) if (fullImage.data[index] > 240) opaque += 1
      // Accepted generated images cover the current viewport, which can be a
      // quarter of the backing world when the view is zoomed all the way out.
      rasterBaselineRef.current = opaque > fullImage.width * fullImage.height * 0.1
    }
    updateFlags()
    notify()
  }, [contexts, notify, updateFlags])

  useEffect(() => {
    const layerContexts = contexts()
    const line = lineRef.current; const colorCanvas = colorRef.current
    if (!line || !colorCanvas || !layerContexts.line || !layerContexts.color) return
    historyRef.current.initialize('line', layerContexts.line)
    historyRef.current.initialize('color', layerContexts.color)
    const contentListeners = listenersRef.current
    const api = createCanvasApi(
      { line, color: colorCanvas, reference: referenceRef.current! } satisfies CanvasLayers,
      {
        visible: () => useCanvasStore.getState().layerVisible,
        view() {
          const frame = frameRef.current
          return { ...viewRef.current, width: frame?.clientWidth || ARTBOARD_SIZE, height: frame?.clientHeight || ARTBOARD_SIZE }
        },
        async importSketch(blob) {
          const ctx = contexts().line
          const color = contexts().color
          if (!ctx || !color) throw new Error('Canvas layers are unavailable')
          historyRef.current.begin('line', ctx)
          historyRef.current.begin('color', color)
          try {
            await drawSketchAsTransparentInk(ctx.canvas, blob, ARTBOARD_SIZE)
            clearCanvas(color.canvas)
          }
          catch (error) {
            const before = historyRef.current.abort('line'); if (before) ctx.putImageData(before, 0, 0)
            const colorBefore = historyRef.current.abort('color'); if (colorBefore) color.putImageData(colorBefore, 0, 0)
            throw error
          }
          historyRef.current.commit('line', ctx)
          historyRef.current.commit('color', color)
          rasterBaselineRef.current = false
          useCanvasStore.getState().setActiveLayer('line')
          updateFlags(); notify()
        },
        async replaceCanvasWithImage(blob) {
          const line = contexts().line
          if (!line) throw new Error('Line layer is unavailable')
          const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
          try {
            const frame = frameRef.current
            const frameWidth = frame?.clientWidth || ARTBOARD_SIZE
            const frameHeight = frame?.clientHeight || ARTBOARD_SIZE
            const view = viewRef.current
            const worldX = (-view.panX / view.zoom) * ARTBOARD_SIZE / frameWidth
            const worldY = (-view.panY / view.zoom) * ARTBOARD_SIZE / frameHeight
            const worldWidth = ARTBOARD_SIZE / view.zoom
            const worldHeight = ARTBOARD_SIZE / view.zoom
            historyRef.current.begin('line', line)
            historyRef.current.begin('color', contexts().color!)
            clearCanvas(line.canvas)
            clearCanvas(contexts().color!.canvas)
            clearCanvas(contexts().reference!.canvas)
            line.save()
            line.globalCompositeOperation = 'source-over'
            line.fillStyle = '#fff'; line.fillRect(worldX, worldY, worldWidth, worldHeight)
            const scale = Math.min(worldWidth / bitmap.width, worldHeight / bitmap.height)
            const width = bitmap.width * scale; const height = bitmap.height * scale
            line.drawImage(bitmap, worldX + (worldWidth - width) / 2, worldY + (worldHeight - height) / 2, width, height)
            line.restore()
            historyRef.current.commit('line', line)
            const color = contexts().color!
            historyRef.current.commit('color', color)
            rasterBaselineRef.current = true
            useCanvasStore.getState().setActiveLayer('line')
          } catch (error) {
            const lineBefore = historyRef.current.abort('line')
            const colorBefore = historyRef.current.abort('color')
            if (lineBefore) line.putImageData(lineBefore, 0, 0)
            const color = contexts().color
            if (colorBefore && color) color.putImageData(colorBefore, 0, 0)
            throw error
          } finally { bitmap.close() }
          updateFlags(); notify()
        },
        hasRasterBaseline() { return rasterBaselineRef.current },
        async setReference(blob) {
          const ctx = contexts().reference
          if (!ctx) throw new Error('Reference layer is unavailable')
          clearCanvas(ctx.canvas)
          if (blob) {
            const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
            try {
              const artboardOffset = (WORLD_SIZE - ARTBOARD_SIZE) / 2
              const scale = Math.min(ARTBOARD_SIZE / bitmap.width, ARTBOARD_SIZE / bitmap.height)
              const width = bitmap.width * scale; const height = bitmap.height * scale
              ctx.drawImage(bitmap, artboardOffset + (ARTBOARD_SIZE - width) / 2, artboardOffset + (ARTBOARD_SIZE - height) / 2, width, height)
            } finally { bitmap.close() }
          }
          notify()
        },
        clearLineLayer() { clearLayerWithHistory('line') },
        clearAll() {
          clearLayerWithHistory('line'); clearLayerWithHistory('color')
          const reference = contexts().reference
          if (reference) clearCanvas(reference.canvas)
          notify()
        },
        onContentChange(callback) { contentListeners.add(callback); return () => { contentListeners.delete(callback) } }
      }
    )
    function clearLayerWithHistory(layer: LayerId): void {
      const ctx = contexts()[layer]
      if (!ctx) return
      historyRef.current.begin(layer, ctx)
      clearCanvas(ctx.canvas)
      historyRef.current.commit(layer, ctx)
      if (layer === 'line') rasterBaselineRef.current = false
      updateFlags(); notify()
    }
    registerCanvasApi(api)
    const undo = () => { const entry = historyRef.current.undo(); if (entry) restoreHistoryEntry(entry.after, entry.layer, entry.x, entry.y); updateFlags() }
    const redo = () => { const entry = historyRef.current.redo(); if (entry) restoreHistoryEntry(entry.after, entry.layer, entry.x, entry.y); updateFlags() }
    useCanvasStore.setState({ commands: { undo, redo, clearLayer: clearLayerWithHistory, zoomBy(factor) { const frame = frameRef.current; if (!frame) return; setView(zoomAtPoint(viewRef.current, factor, { x: frame.clientWidth / 2, y: frame.clientHeight / 2 })) }, resetView() { const frame = frameRef.current; setView({ zoom: 1, panX: -(frame?.clientWidth ?? 0) / 2, panY: -(frame?.clientHeight ?? 0) / 2 }) } } })
    return () => {
      if (getCanvasApi() === api) registerCanvasApi(null)
      useCanvasStore.setState({ commands: null })
      historyRef.current.clear()
    }
  }, [contexts, notify, restoreHistoryEntry, setView, updateFlags])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const centerAtCurrentZoom = () => {
      const width = frame.clientWidth; const height = frame.clientHeight
      const previous = initialFrameSizeRef.current
      if (!previous) {
        initialFrameSizeRef.current = { width, height }
        setView({ zoom: viewRef.current.zoom, panX: width * (0.5 - viewRef.current.zoom), panY: height * (0.5 - viewRef.current.zoom) })
        return
      }
      if (previous.width === width && previous.height === height) return
      initialFrameSizeRef.current = { width, height }
      setView({ ...viewRef.current, panX: viewRef.current.panX + (width - previous.width) * (0.5 - viewRef.current.zoom), panY: viewRef.current.panY + (height - previous.height) * (0.5 - viewRef.current.zoom) })
    }
    centerAtCurrentZoom()
    const observer = new ResizeObserver(centerAtCurrentZoom)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [setView])

  const eventPoint = useCallback((event: PointerEvent): { x: number; y: number; pressure: number } => {
    // Use the canvas element's rendered bounds, which already include CSS pan/zoom.
    // This keeps drawing aligned with the visible canvas after stretching, zooming,
    // and panning instead of relying on a second copy of the CSS transform math.
    const frame = frameRef.current
    const rect = frame?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0, pressure: 0.5 }
    const mapped = screenToCanvas(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      viewRef.current,
      rect.width,
      rect.height,
      ARTBOARD_SIZE
    )
    mapped.x = Math.max(0, Math.min(WORLD_SIZE, mapped.x))
    mapped.y = Math.max(0, Math.min(WORLD_SIZE, mapped.y))
    const pressure = event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5
    return { ...mapped, pressure }
  }, [])
  const contextFor = useCallback((layer: LayerId): ToolContext | null => {
    const all = contexts()
    const ctx = all[layer]; const overlay = all.overlay
    if (!ctx || !overlay) return null
    return { layer, ctx, overlay, getLayerCtx: (target) => { const value = contexts()[target]; if (!value) throw new Error(`Canvas layer ${target} is unavailable`); return value }, color: useCanvasStore.getState().color, size: useCanvasStore.getState().size, point: eventPoint, commit(target = layer) { const targetContext = contexts()[target]; if (!targetContext) return; historyRef.current.commit(target, targetContext); updateFlags(); notify() } }
  }, [contexts, eventPoint, notify, updateFlags])

  const localPoint = useCallback((event: PointerEvent): Point2D => {
    const rect = frameRef.current?.getBoundingClientRect()
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: event.clientX, y: event.clientY }
  }, [])
  const setCurrentSelection = useCallback((next: SelectionRect | null) => {
    selectionRef.current = next
    setSelection(next)
  }, [])
  const drawSelectionOverlay = useCallback((rect = selectionRef.current, moving = floatingRef.current) => {
    const overlay = overlayRef.current?.getContext('2d')
    if (!overlay) return
    overlay.clearRect(0, 0, overlay.canvas.width, overlay.canvas.height)
    if (moving) overlay.drawImage(moving.canvas, moving.x, moving.y, moving.width, moving.height)
    const shown = moving ? { x: moving.x, y: moving.y, width: moving.width, height: moving.height } : rect
    if (!shown || shown.width <= 0 || shown.height <= 0) return
    overlay.save()
    overlay.strokeStyle = '#2878ff'
    overlay.lineWidth = 2
    overlay.setLineDash([10, 7])
    overlay.strokeRect(shown.x + 1, shown.y + 1, Math.max(0, shown.width - 2), Math.max(0, shown.height - 2))
    overlay.restore()
  }, [])
  const copyRegion = useCallback((layer: LayerId, rect: SelectionRect): ClipboardPixels | null => {
    if (rect.width < 1 || rect.height < 1) return null
    const context = contexts()[layer]
    if (!context) return null
    const pixels = context.getImageData(rect.x, rect.y, rect.width, rect.height)
    const canvas = document.createElement('canvas')
    canvas.width = rect.width; canvas.height = rect.height
    const copyContext = canvas.getContext('2d')
    if (!copyContext) return null
    copyContext.putImageData(pixels, 0, 0)
    return { canvas, layer }
  }, [contexts])
  const copySelection = useCallback(() => {
    const currentFloating = floatingRef.current
    const copied = currentFloating
      ? { canvas: currentFloating.canvas, layer: currentFloating.layer }
      : selectionRef.current ? copyRegion(useCanvasStore.getState().activeLayer, selectionRef.current) : null
    if (!copied) return
    clipboardRef.current = copied
    setHasClipboard(true)
  }, [copyRegion])
  const commitFloating = useCallback((drawPixels = true) => {
    const current = floatingRef.current
    if (!current) return
    const context = contexts()[current.layer]
    if (!context) return
    if (!current.moving) historyRef.current.begin(current.layer, context)
    if (drawPixels) context.drawImage(current.canvas, current.x, current.y, current.width, current.height)
    historyRef.current.commit(current.layer, context)
    floatingRef.current = null
    setFloating(null)
    setCurrentSelection(drawPixels ? { x: current.x, y: current.y, width: current.width, height: current.height } : null)
    drawSelectionOverlay(drawPixels ? { x: current.x, y: current.y, width: current.width, height: current.height } : null, null)
    updateFlags(); notify()
  }, [contexts, drawSelectionOverlay, notify, setCurrentSelection, updateFlags])
  const cancelFloating = useCallback(() => {
    const current = floatingRef.current
    if (!current) return
    if (current.moving) {
      const context = contexts()[current.layer]
      const before = historyRef.current.abort(current.layer)
      if (context && before) context.putImageData(before, 0, 0)
      updateFlags(); notify()
    }
    floatingRef.current = null
    setFloating(null)
    drawSelectionOverlay()
  }, [contexts, drawSelectionOverlay, notify, updateFlags])
  const cutSelection = useCallback(() => {
    const currentFloating = floatingRef.current
    if (currentFloating) {
      clipboardRef.current = { canvas: currentFloating.canvas, layer: currentFloating.layer }
      setHasClipboard(true)
      commitFloating(false)
      return
    }
    const rect = selectionRef.current
    if (!rect) return
    const layer = useCanvasStore.getState().activeLayer
    const copied = copyRegion(layer, rect)
    if (!copied) return
    clipboardRef.current = copied; setHasClipboard(true)
    const context = contexts()[layer]
    if (!context) return
    historyRef.current.begin(layer, context)
    context.clearRect(rect.x, rect.y, rect.width, rect.height)
    historyRef.current.commit(layer, context)
    setCurrentSelection(rect); drawSelectionOverlay(rect)
    updateFlags(); notify()
  }, [commitFloating, contexts, copyRegion, drawSelectionOverlay, notify, setCurrentSelection, updateFlags])
  const pasteSelection = useCallback(() => {
    const copied = clipboardRef.current
    if (!copied) return
    if (floatingRef.current) commitFloating()
    const frame = frameRef.current
    const width = copied.canvas.width; const height = copied.canvas.height
    const center = frame ? screenToCanvas({ x: frame.clientWidth / 2, y: frame.clientHeight / 2 }, viewRef.current, frame.clientWidth, frame.clientHeight, ARTBOARD_SIZE) : { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 }
    const next: FloatingPixels = { ...copied, width, height, x: Math.max(0, Math.min(WORLD_SIZE - width, Math.round(center.x - width / 2))), y: Math.max(0, Math.min(WORLD_SIZE - height, Math.round(center.y - height / 2))), moving: false, dragOffsetX: 0, dragOffsetY: 0 }
    floatingRef.current = next; setFloating(next)
    setCurrentSelection({ x: next.x, y: next.y, width, height })
    drawSelectionOverlay(selectionRef.current, next)
  }, [commitFloating, drawSelectionOverlay, setCurrentSelection])
  const deleteSelection = useCallback(() => {
    const current = floatingRef.current
    if (current) {
      if (current.moving) commitFloating(false)
      else { floatingRef.current = null; setFloating(null); setCurrentSelection(null); drawSelectionOverlay(null) }
      return
    }
    const rect = selectionRef.current
    if (!rect) return
    const layer = useCanvasStore.getState().activeLayer
    const context = contexts()[layer]
    if (!context) return
    historyRef.current.begin(layer, context)
    context.clearRect(rect.x, rect.y, rect.width, rect.height)
    historyRef.current.commit(layer, context)
    setCurrentSelection(null); drawSelectionOverlay(null)
    updateFlags(); notify()
  }, [commitFloating, contexts, drawSelectionOverlay, notify, setCurrentSelection, updateFlags])
  const finishText = useCallback((commit: boolean) => {
    const editor = textEditorRef.current
    if (!editor) return
    textEditorRef.current = null; setTextEditor(null)
    const text = editor.value.trimEnd()
    if (!commit || !text) return
    const context = contexts()[editor.layer]
    if (!context) return
    historyRef.current.begin(editor.layer, context)
    const fontSize = Math.max(14, editor.size * 3)
    context.save()
    context.globalCompositeOperation = 'source-over'
    context.fillStyle = editor.color
    context.font = `${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
    context.textBaseline = 'top'
    text.split(/\r?\n/).forEach((line, index) => context.fillText(line, editor.x, editor.y + index * fontSize * 1.3))
    context.restore()
    historyRef.current.commit(editor.layer, context)
    updateFlags(); notify()
  }, [contexts, notify, updateFlags])
  const startTextEditor = useCallback((point: Point2D) => {
    const frame = frameRef.current
    if (!frame) return
    const screen = canvasToScreen(point, viewRef.current, frame.clientWidth, frame.clientHeight, ARTBOARD_SIZE)
    const store = useCanvasStore.getState()
    const next: TextEditor = { id: ++nextTextIdRef.current, x: point.x, y: point.y, screenX: screen.x, screenY: screen.y, value: '', layer: store.activeLayer, color: store.color, size: store.size }
    textEditorRef.current = next
    setTextEditor(next)
  }, [])
  useEffect(() => {
    if (textEditor) textInputRef.current?.focus()
  }, [textEditor?.id])
  useEffect(() => {
    if (toolId === 'select') useCanvasStore.getState().setActiveLayer('line')
    if (toolId !== 'select' && floatingRef.current) commitFloating()
  }, [commitFloating, toolId])
  useEffect(() => {
    if (toolId === 'select') return
    setCurrentSelection(null)
    drawSelectionOverlay(null)
  }, [drawSelectionOverlay, setCurrentSelection, toolId])
  useEffect(() => {
    if (toolId !== 'text' && textEditorRef.current) finishText(true)
  }, [finishText, toolId])
  const cancelActiveStroke = useCallback((commit: boolean) => {
    const stroke = activeStrokeRef.current
    if (!stroke) return
    if (commit) stroke.handler.onUp(stroke.context, new PointerEvent('pointerup', { pointerId: stroke.pointerId, pointerType: stroke.pointerType }))
    else {
      stroke.handler.onCancel?.(stroke.context)
      const context = contexts()[stroke.layer]
      if (context) {
        const before = historyRef.current.abort(stroke.layer)
        if (before) context.putImageData(before, 0, 0)
        updateFlags()
      }
    }
    activeStrokeRef.current = null
  }, [contexts, updateFlags])

  useEffect(() => {
    const overlay = overlayRef.current
    const frame = frameRef.current
    if (!overlay || !frame) return
    const updatePinch = () => {
      const entries = [...touchPointsRef.current.entries()]
      if (entries.length < 2) { pinchRef.current = null; return }
      const first = entries[0][1]; const second = entries[1][1]
      const center = midpoint(first, second); const gap = Math.max(1, distance(first, second))
      if (!pinchRef.current) {
        cancelActiveStroke(false)
        const startCenter = center
        pinchRef.current = { startView: { ...viewRef.current }, startDistance: gap, startCenter }
      } else {
        const pinch = pinchRef.current
        const zoomed = zoomAtPoint(pinch.startView, gap / pinch.startDistance, pinch.startCenter)
        setView(panBy(zoomed, { x: center.x - pinch.startCenter.x, y: center.y - pinch.startCenter.y }))
      }
    }
    const pointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-canvas-ui]')) return
      if (event.pointerType === 'touch' && penActiveRef.current) return
      if (event.pointerType === 'pen') {
        penActiveRef.current = true
        if (activeStrokeRef.current?.pointerType === 'touch') cancelActiveStroke(false)
        for (const [id, pointer] of activePointersRef.current) if (pointer.type === 'touch') { activePointersRef.current.delete(id); touchPointsRef.current.delete(id) }
      }
      try { frame.setPointerCapture(event.pointerId) } catch { /* Some synthetic events cannot be captured. */ }
      const point = localPoint(event)
      activePointersRef.current.set(event.pointerId, { point, type: event.pointerType })
      if (event.pointerType === 'touch') {
        touchPointsRef.current.set(event.pointerId, point)
        if (touchPointsRef.current.size >= 2) { updatePinch(); event.preventDefault(); return }
        const timestamp = performance.now()
        if (timestamp - lastTapRef.current < 280) { setView({ zoom: 1, panX: 0, panY: 0 }); lastTapRef.current = 0; return }
        lastTapRef.current = timestamp
      }
      if (event.button === 1 || spaceDownRef.current) { panRef.current = { pointerId: event.pointerId, last: point }; event.preventDefault(); return }
      if (event.button !== 0) return
      const canvasPoint = eventPoint(event)
      if (toolId === 'text') { startTextEditor(canvasPoint); return }
      if (toolId === 'select') {
        const currentFloating = floatingRef.current
        if (currentFloating) {
          const inside = canvasPoint.x >= currentFloating.x && canvasPoint.x <= currentFloating.x + currentFloating.width && canvasPoint.y >= currentFloating.y && canvasPoint.y <= currentFloating.y + currentFloating.height
          if (inside) {
            const moved = { ...currentFloating, dragOffsetX: canvasPoint.x - currentFloating.x, dragOffsetY: canvasPoint.y - currentFloating.y }
            floatingRef.current = moved; setFloating(moved); floatingDragRef.current = { pointerId: event.pointerId }
            return
          }
          commitFloating()
        }
        const selected = selectionRef.current
        const insideSelection = selected && canvasPoint.x >= selected.x && canvasPoint.x <= selected.x + selected.width && canvasPoint.y >= selected.y && canvasPoint.y <= selected.y + selected.height
        if (insideSelection && !floatingRef.current) {
          const layer = useCanvasStore.getState().activeLayer
          const copied = copyRegion(layer, selected)
          const context = contexts()[layer]
          if (copied && context) {
            historyRef.current.begin(layer, context)
            context.clearRect(selected.x, selected.y, selected.width, selected.height)
            const moved: FloatingPixels = { ...copied, x: selected.x, y: selected.y, width: selected.width, height: selected.height, moving: true, dragOffsetX: canvasPoint.x - selected.x, dragOffsetY: canvasPoint.y - selected.y }
            floatingRef.current = moved; setFloating(moved); floatingDragRef.current = { pointerId: event.pointerId }
            drawSelectionOverlay(selected, moved)
            return
          }
        }
        setCurrentSelection(null)
        floatingRef.current = null; setFloating(null)
        selectionDragRef.current = { pointerId: event.pointerId, start: canvasPoint }
        const initial = selectionRect(canvasPoint, canvasPoint)
        setCurrentSelection(initial); drawSelectionOverlay(initial, null)
        return
      }
      const context = contextFor(activeLayer)
      if (!context) return
      historyRef.current.begin(activeLayer, context.ctx)
      handler.onDown(context, event)
      activeStrokeRef.current = { pointerId: event.pointerId, pointerType: event.pointerType, layer: activeLayer, context, handler }
    }
    const pointerMove = (event: PointerEvent) => {
      const pointer = activePointersRef.current.get(event.pointerId)
      if (!pointer) return
      if (penActiveRef.current && pointer.type === 'touch') return
      const position = localPoint(event)
      pointer.point = position
      if (pointer.type === 'touch') { touchPointsRef.current.set(event.pointerId, position); if (touchPointsRef.current.size >= 2) { updatePinch(); return } }
      if (pinchRef.current) return
      if (panRef.current?.pointerId === event.pointerId) { setView(panBy(viewRef.current, { x: position.x - panRef.current.last.x, y: position.y - panRef.current.last.y })); panRef.current.last = position; return }
      if (selectionDragRef.current?.pointerId === event.pointerId) {
        const rect = selectionRect(selectionDragRef.current.start, eventPoint(event))
        setCurrentSelection(rect); drawSelectionOverlay(rect, null); return
      }
      if (floatingDragRef.current?.pointerId === event.pointerId && floatingRef.current) {
        const current = floatingRef.current
        const point = eventPoint(event)
        const moved = { ...current, x: Math.max(0, Math.min(WORLD_SIZE - current.width, point.x - current.dragOffsetX)), y: Math.max(0, Math.min(WORLD_SIZE - current.height, point.y - current.dragOffsetY)) }
        floatingRef.current = moved; setFloating(moved)
        setCurrentSelection({ x: moved.x, y: moved.y, width: moved.width, height: moved.height })
        drawSelectionOverlay(selectionRef.current, moved); return
      }
      const stroke = activeStrokeRef.current
      if (stroke?.pointerId !== event.pointerId) return
      const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : []
      for (const sample of samples.length ? samples : [event]) stroke.handler.onMove(stroke.context, sample)
    }
    const finishPointer = (event: PointerEvent, cancelled = false) => {
      const pointer = activePointersRef.current.get(event.pointerId)
      if (!pointer) return
      if (event.pointerType === 'touch') touchPointsRef.current.delete(event.pointerId)
      if (panRef.current?.pointerId === event.pointerId) panRef.current = null
      if (selectionDragRef.current?.pointerId === event.pointerId) {
        const dragStart = selectionDragRef.current.start
        selectionDragRef.current = null
        const selected = selectionRef.current
        if (!selected || selected.width < 2 || selected.height < 2) {
          const clickSelection = selectionRect({ x: dragStart.x - 32, y: dragStart.y - 32 }, { x: dragStart.x + 32, y: dragStart.y + 32 })
          setCurrentSelection(clickSelection); drawSelectionOverlay(clickSelection, null)
        }
        else drawSelectionOverlay(selected, null)
        activePointersRef.current.delete(event.pointerId)
        if (event.pointerType === 'pen') penActiveRef.current = false
        return
      }
      if (floatingDragRef.current?.pointerId === event.pointerId) {
        floatingDragRef.current = null
        if (cancelled) cancelFloating()
        else if (floatingRef.current) drawSelectionOverlay(selectionRef.current, floatingRef.current)
        activePointersRef.current.delete(event.pointerId)
        if (event.pointerType === 'pen') penActiveRef.current = false
        return
      }
      const stroke = activeStrokeRef.current
      if (stroke?.pointerId === event.pointerId) {
        if (cancelled) {
          stroke.handler.onCancel?.(stroke.context)
          const context = contexts()[stroke.layer]
          const before = historyRef.current.abort(stroke.layer)
          if (context && before) context.putImageData(before, 0, 0)
          updateFlags()
        }
        else { stroke.handler.onUp(stroke.context, event); historyRef.current.abort(stroke.layer) }
        const overlayContext = overlay.getContext('2d')
        overlayContext?.clearRect(0, 0, WORLD_SIZE, WORLD_SIZE)
        activeStrokeRef.current = null
      }
      activePointersRef.current.delete(event.pointerId)
      if (event.pointerType === 'pen') penActiveRef.current = false
      if (touchPointsRef.current.size < 2) pinchRef.current = null
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = frame.getBoundingClientRect()
      setView(zoomAtPoint(viewRef.current, Math.exp(-event.deltaY * 0.0015), { x: event.clientX - rect.left, y: event.clientY - rect.top }))
    }
    const doubleClick = () => setView({ zoom: 1, panX: 0, panY: 0 })
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-canvas-text-editor]')) return
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && event.key.toLowerCase() === 'c' && selectionRef.current) { event.preventDefault(); copySelection(); return }
      if (modifier && event.key.toLowerCase() === 'x' && selectionRef.current) { event.preventDefault(); cutSelection(); return }
      if (modifier && event.key.toLowerCase() === 'v' && clipboardRef.current) { event.preventDefault(); pasteSelection(); return }
      if (event.key === 'Escape') {
        if (floatingRef.current) cancelFloating()
        else if (selectionRef.current) { setCurrentSelection(null); drawSelectionOverlay(null) }
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectionRef.current) { event.preventDefault(); deleteSelection(); return }
      if (event.key === 'Enter' && floatingRef.current) { event.preventDefault(); commitFloating(); return }
      if (event.code === 'Space') { spaceDownRef.current = true; event.preventDefault() }
    }
    const keyUp = (event: KeyboardEvent) => { if (event.code === 'Space') spaceDownRef.current = false }
    frame.addEventListener('pointerdown', pointerDown)
    frame.addEventListener('pointermove', pointerMove)
    const pointerUp = (event: PointerEvent) => finishPointer(event)
    const pointerCancel = (event: PointerEvent) => finishPointer(event, true)
    frame.addEventListener('pointerup', pointerUp)
    frame.addEventListener('pointercancel', pointerCancel)
    frame.addEventListener('lostpointercapture', pointerCancel)
    frame.addEventListener('wheel', wheel, { passive: false })
    frame.addEventListener('dblclick', doubleClick)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      frame.removeEventListener('pointerdown', pointerDown); frame.removeEventListener('pointermove', pointerMove)
      frame.removeEventListener('pointerup', pointerUp); frame.removeEventListener('pointercancel', pointerCancel); frame.removeEventListener('lostpointercapture', pointerCancel)
      frame.removeEventListener('wheel', wheel); frame.removeEventListener('dblclick', doubleClick)
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp)
      cancelActiveStroke(false)
      activePointersRef.current.clear(); touchPointsRef.current.clear(); pinchRef.current = null
    }
  }, [activeLayer, cancelActiveStroke, cancelFloating, commitFloating, contextFor, copySelection, cutSelection, deleteSelection, drawSelectionOverlay, eventPoint, handler, localPoint, pasteSelection, setCurrentSelection, setView, startTextEditor, toolId])

  useEffect(() => {
    const closeSelectionOutsideCanvas = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && frameRef.current?.contains(target)) return
      if (floatingRef.current) commitFloating()
      setCurrentSelection(null)
      drawSelectionOverlay(null)
    }
    window.addEventListener('pointerdown', closeSelectionOutsideCanvas)
    return () => window.removeEventListener('pointerdown', closeSelectionOutsideCanvas)
  }, [commitFloating, drawSelectionOverlay, setCurrentSelection])

  useEffect(() => { if (viewRef.current.zoom !== zoom) { viewRef.current = { ...viewRef.current, zoom }; setRenderedView(viewRef.current) } }, [zoom])
  const transform = `translate(${renderedView.panX}px, ${renderedView.panY}px) scale(${renderedView.zoom})`
  const frame = frameRef.current
  const selectionScreen = selection && frame ? canvasToScreen({ x: selection.x, y: selection.y }, renderedView, frame.clientWidth, frame.clientHeight, ARTBOARD_SIZE) : null
  const floatingBar = selection && selectionScreen ? createElement('div', {
    'data-canvas-ui': true,
    className: 'absolute z-40 flex items-center gap-1 rounded-xl border border-white/80 bg-white/95 p-1 shadow-xl backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/95',
    style: { left: Math.max(8, Math.min((frame?.clientWidth ?? 500) - 205, selectionScreen.x)), top: Math.max(8, selectionScreen.y - 44) },
    role: 'toolbar', 'aria-label': 'Selection actions'
  }, floating
    ? createElement('button', { type: 'button', onClick: () => commitFloating(), className: 'grid h-9 w-9 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950', title: 'Place selection', 'aria-label': 'Place selection' }, createElement(Check, { size: 17 }))
    : createElement('button', { type: 'button', onClick: copySelection, className: 'grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800', title: 'Copy selection', 'aria-label': 'Copy selection' }, createElement(Copy, { size: 16 })),
    floating
      ? createElement('button', { type: 'button', onClick: () => cancelFloating(), className: 'grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800', title: 'Cancel selection move', 'aria-label': 'Cancel selection move' }, createElement(X, { size: 16 }))
      : createElement('button', { type: 'button', onClick: cutSelection, className: 'grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800', title: 'Cut selection', 'aria-label': 'Cut selection' }, createElement(Scissors, { size: 16 })),
    createElement('button', { type: 'button', onClick: pasteSelection, disabled: !hasClipboard, className: 'grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 disabled:opacity-35 dark:hover:bg-slate-800', title: 'Paste selection', 'aria-label': 'Paste selection' }, createElement(Clipboard, { size: 16 })),
    createElement('button', { type: 'button', onClick: deleteSelection, className: 'grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950', title: 'Delete selection', 'aria-label': 'Delete selection' }, createElement(Trash2, { size: 16 }))
  ) : null
  const textOverlay = textEditor ? createElement('div', {
    'data-canvas-ui': true,
    'data-canvas-text-editor': true,
    className: 'absolute z-50 flex items-start gap-1 rounded-lg border border-brand/50 bg-white/95 p-1 shadow-xl dark:bg-slate-900/95',
    style: { left: textEditor.screenX, top: textEditor.screenY, width: 250 }
  }, createElement('textarea', {
    ref: textInputRef,
    autoFocus: true,
    rows: 2,
    value: textEditor.value,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = { ...textEditor, value: event.target.value }
      textEditorRef.current = next; setTextEditor(next)
    },
    onBlur: () => finishText(true),
    onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finishText(false) }
      else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); finishText(true) }
    },
    placeholder: 'Type a label or question…',
    'aria-label': 'Text to place on canvas',
    className: 'min-w-0 flex-1 resize rounded-md border border-slate-200 bg-white/90 p-2 leading-snug text-slate-900 outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-950 dark:text-white',
    style: { color: textEditor.color, fontSize: Math.max(14, Math.min(64, textEditor.size * 3 * renderedView.zoom)) }
  }), createElement('button', { type: 'button', onMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault(), onClick: () => finishText(true), className: 'grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand text-white hover:bg-brand-dark', title: 'Place text', 'aria-label': 'Place text' }, createElement(Check, { size: 16 }))) : null
  return createElement('div', { ref: frameRef, className, 'aria-label': 'Drawing canvas', style: { cursor: handler.cursor } },
    createElement('div', { className: 'absolute left-0 top-0', style: { width: '200%', height: '200%', transform, transformOrigin: 'top left' } },
      createElement('canvas', { ref: referenceRef, width: WORLD_SIZE, height: WORLD_SIZE, 'aria-label': 'Reference layer', className: 'absolute inset-0 h-full w-full', style: { display: visibility.reference ? 'block' : 'none' } }),
      createElement('canvas', { ref: lineRef, width: WORLD_SIZE, height: WORLD_SIZE, 'aria-label': 'Line layer', className: 'absolute inset-0 h-full w-full', style: { visibility: visibility.line ? 'visible' : 'hidden' } }),
      createElement('canvas', { ref: colorRef, width: WORLD_SIZE, height: WORLD_SIZE, 'aria-label': 'Color layer', className: 'absolute inset-0 h-full w-full', style: { visibility: visibility.color ? 'visible' : 'hidden' } }),
      createElement('canvas', { ref: overlayRef, width: WORLD_SIZE, height: WORLD_SIZE, 'aria-label': 'Drawing preview', className: 'absolute inset-0 h-full w-full touch-none', style: { pointerEvents: 'none' } })
    ), floatingBar, textOverlay
  )
}
