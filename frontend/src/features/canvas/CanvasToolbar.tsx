import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUpRight, BoxSelect, Brush, Circle, Eraser, Hexagon, Minus, PaintBucket, Pencil, Plus, Redo2, Shapes, Square, Star, Type, Undo2, ZoomIn, ZoomOut, Trash2, Triangle } from 'lucide-react'
import { t } from '../../i18n'
import { useCanvasStore } from './canvasStore'
import type { ToolId } from './tools/types'

const quickColors = ['#151827', '#ffffff', '#f46d52', '#f2b34b', '#5dbb91']
const toolItems: Array<{ id: ToolId; label: string; icon: typeof Brush }> = [
  { id: 'brush', label: 'Brush', icon: Brush },
  { id: 'pencil', label: 'Pencil', icon: Pencil },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'fill', label: 'Fill', icon: PaintBucket },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'select', label: 'Select', icon: BoxSelect }
]

function Divider() { return <span aria-hidden="true" className="mx-0.5 h-7 w-px shrink-0 bg-slate-200 dark:bg-slate-700" /> }

export default function CanvasToolbar() {
  const tool = useCanvasStore((state) => state.tool)
  const size = useCanvasStore((state) => state.size)
  const color = useCanvasStore((state) => state.color)
  const canUndo = useCanvasStore((state) => state.canUndo)
  const canRedo = useCanvasStore((state) => state.canRedo)
  const zoom = useCanvasStore((state) => state.zoom)
  const setTool = useCanvasStore((state) => state.setTool)
  const setSize = useCanvasStore((state) => state.setSize)
  const setColor = useCanvasStore((state) => state.setColor)
  const undo = useCanvasStore((state) => state.undo)
  const redo = useCanvasStore((state) => state.redo)
  const clearLayer = useCanvasStore((state) => state.clearLayer)
  const zoomIn = useCanvasStore((state) => state.zoomIn)
  const zoomOut = useCanvasStore((state) => state.zoomOut)
  const resetView = useCanvasStore((state) => state.resetView)
  const [sizeText, setSizeText] = useState(String(size))
  const [shapesOpen, setShapesOpen] = useState(false)
  const shapesRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setSizeText(String(size)), [size])
  useEffect(() => {
    if (!shapesOpen) return
    const closeOnOutside = (event: PointerEvent) => { if (!shapesRef.current?.contains(event.target as Node)) setShapesOpen(false) }
    window.addEventListener('pointerdown', closeOnOutside)
    return () => window.removeEventListener('pointerdown', closeOnOutside)
  }, [shapesOpen])

  const commitSize = () => {
    const parsed = Number.parseInt(sizeText, 10)
    const next = Number.isFinite(parsed) ? Math.max(1, Math.min(60, parsed)) : size
    setSize(next)
    setSizeText(String(next))
  }
  const onSizeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') { event.currentTarget.blur(); commitSize() } }
  const buttonClass = (active = false) => `grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all duration-300 ${active ? 'bg-white text-brand shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-600' : 'text-slate-700 hover:bg-white/75 hover:text-brand dark:text-slate-200 dark:hover:bg-slate-800'}`
  const chooseTool = (id: ToolId) => { setTool(id); setShapesOpen(false) }

  return <div className="absolute left-1/2 top-3 z-30 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-nowrap items-center justify-center gap-1.5 overflow-visible whitespace-nowrap rounded-full border border-white/70 bg-surface/85 px-3 py-1.5 text-slate-800 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-all duration-300 dark:border-slate-600/70 dark:bg-slate-900/85 dark:text-slate-100" role="toolbar" aria-label={t('canvas-tools.toolbar')}>
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={t('canvas-tools.tools')}>
      {toolItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} title={label} aria-pressed={tool === id} onClick={() => chooseTool(id)} className={buttonClass(tool === id)}><Icon size={18} strokeWidth={1.8} /></button>)}
    </div>
    <Divider />
    <div className="relative shrink-0" ref={shapesRef}>
      <button type="button" aria-label="Shapes" aria-haspopup="menu" aria-expanded={shapesOpen} onClick={() => setShapesOpen((open) => !open)} className={`${buttonClass(['line', 'rect', 'ellipse', 'triangle'].includes(tool))} px-2`}><Shapes size={17} /></button>
      {shapesOpen && <div role="menu" aria-label="Shapes" className="absolute left-1/2 top-full z-50 mt-2 grid w-64 -translate-x-1/2 grid-cols-3 gap-2 rounded-2xl border border-white/80 bg-white p-2.5 shadow-2xl shadow-slate-900/20 backdrop-blur-xl dark:border-slate-600 dark:bg-slate-900">
        {([{ id: 'line', name: 'Line', Icon: Minus }, { id: 'rect', name: 'Square', Icon: Square }, { id: 'ellipse', name: 'Circle', Icon: Circle }, { id: 'triangle', name: 'Triangle', Icon: Triangle }, { id: 'arrow', name: 'Arrow', Icon: ArrowUpRight }, { id: 'star', name: 'Star', Icon: Star }, { id: 'hexagon', name: 'Hexagon', Icon: Hexagon }] as const).map(({ id, name, Icon }) => <button key={id} type="button" role="menuitemradio" aria-checked={tool === id} title={name} aria-label={name} onClick={() => chooseTool(id)} className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-all duration-200 ${tool === id ? 'border-brand bg-brand-soft text-brand-dark ring-1 ring-brand/20 dark:bg-blue-950 dark:text-blue-200' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800'}`}><Icon size={19} strokeWidth={1.8} /><span>{name}</span></button>)}
      </div>}
    </div>
    <Divider />
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Brush size">
      <button type="button" aria-label="Decrease size" onClick={() => setSize(size - 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/80"><Minus size={15} /></button>
      <label className="sr-only" htmlFor="brush-size-number">Brush size</label>
      <input id="brush-size-number" type="text" inputMode="numeric" pattern="[0-9]*" value={sizeText} onChange={(event) => setSizeText(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))} onBlur={commitSize} onKeyDown={onSizeKeyDown} className="h-8 w-9 rounded-lg border border-slate-200 bg-white/80 text-center text-sm font-medium tabular-nums outline-none focus:border-brand dark:border-slate-600 dark:bg-slate-800" aria-valuemin={1} aria-valuemax={60} />
      <button type="button" aria-label="Increase size" onClick={() => setSize(size + 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/80"><Plus size={15} /></button>
    </div>
    <Divider />
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Colors">
      {quickColors.map((swatch) => <button key={swatch} type="button" title={swatch} aria-label={`Choose ${swatch}`} aria-pressed={color.toLowerCase() === swatch} onClick={() => setColor(swatch)} className={`h-7 w-7 rounded-full border-2 transition-all duration-300 ${color.toLowerCase() === swatch ? 'scale-110 border-brand ring-2 ring-brand/25' : 'border-white shadow-sm'}`} style={{ backgroundColor: swatch }} />)}
      <button type="button" aria-label="More colors" title="More colors" onClick={() => colorInputRef.current?.click()} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[conic-gradient(at_50%_50%,#ff595e,#ffca3a,#8ac926,#1982c4,#6a4c93,#ff595e)] p-1 shadow-sm ring-2 ring-white"><span className="h-4 w-4 rounded-full border border-white bg-white/50" /></button>
      <input ref={colorInputRef} type="color" value={color} onChange={(event) => setColor(event.target.value)} className="sr-only" aria-label="Choose a custom color" />
    </div>
    <Divider />
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={t('canvas-tools.history')}>
      <button type="button" disabled={!canUndo} onClick={undo} aria-label={t('canvas-tools.undo')} title={t('canvas-tools.undo')} className={`${buttonClass()} disabled:opacity-35`}><Undo2 size={18} /></button>
      <button type="button" disabled={!canRedo} onClick={redo} aria-label={t('canvas-tools.redo')} title={t('canvas-tools.redo')} className={`${buttonClass()} disabled:opacity-35`}><Redo2 size={18} /></button>
    </div>
    <Divider />
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={t('canvas-tools.zoom')}>
      <button type="button" onClick={zoomOut} aria-label={t('canvas-tools.zoomOut')} className={buttonClass()}><ZoomOut size={17} /></button>
      <button type="button" onClick={resetView} aria-label={t('canvas-tools.resetView')} className="min-w-12 rounded-lg px-1 text-xs font-medium tabular-nums hover:bg-white/70">{Math.round(zoom * 100)}%</button>
      <button type="button" onClick={zoomIn} aria-label={t('canvas-tools.zoomIn')} className={buttonClass()}><ZoomIn size={17} /></button>
    </div>
    <Divider />
    <button type="button" onClick={() => { if (window.confirm(t('canvas-tools.clearConfirm'))) clearLayer() }} aria-label={t('canvas-tools.clearLayer')} title={t('canvas-tools.clearLayer')} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-rose-600 transition-all duration-300 hover:bg-rose-50"><Trash2 size={17} /></button>
  </div>
}
