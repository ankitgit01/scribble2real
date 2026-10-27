import { Eye, EyeOff, Layers } from 'lucide-react'
import { t } from '../../i18n'
import { useEffect, useState } from 'react'
import { useCanvasStore } from './canvasStore'
import type { LayerId } from './tools/types'

export default function LayerPanel() {
  const active = useCanvasStore((state) => state.activeLayer)
  const visible = useCanvasStore((state) => state.layerVisible)
  const setActive = useCanvasStore((state) => state.setActiveLayer)
  const toggle = useCanvasStore((state) => state.toggleLayerVisible)
  const [selected, setSelected] = useState<keyof typeof visible>(active)
  useEffect(() => { setSelected(active) }, [active])
  const layers: Array<{ id: keyof typeof visible; name: string; selectable?: LayerId }> = [
    { id: 'line', name: t('canvas-tools.lines'), selectable: 'line' },
    { id: 'color', name: t('canvas-tools.colorLayer'), selectable: 'color' },
    { id: 'reference', name: t('canvas-tools.reference') }
  ]
  return <section className="absolute bottom-3 right-3 z-20 rounded-2xl border border-white/70 bg-surface/85 p-2 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-all duration-300 dark:border-slate-600 dark:bg-slate-900/85" aria-label={t('canvas-tools.layers')}>
    <div className="mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Layers size={13} />{t('canvas-tools.layers')}</div>
    <div className="flex items-center gap-1">
      {layers.map((layer) => <div key={layer.id} className={`flex items-center rounded-xl transition-all duration-300 ${selected === layer.id ? 'bg-brand/10 ring-1 ring-brand/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
        <button type="button" aria-pressed={selected === layer.id} onClick={() => { setSelected(layer.id); if (layer.selectable) setActive(layer.selectable) }} className="min-h-9 px-2 text-xs font-medium" title={layer.id === 'reference' ? 'Reference is a display-only layer' : `Edit ${layer.name}`}>{layer.name}</button>
        <button type="button" aria-label={`${visible[layer.id] ? t('canvas-tools.hide') : t('canvas-tools.show')} ${layer.name}`} aria-pressed={visible[layer.id]} onClick={() => toggle(layer.id)} className="grid min-h-9 min-w-8 place-items-center rounded-lg text-slate-500 hover:text-brand" title={visible[layer.id] ? t('canvas-tools.hide') : t('canvas-tools.show')}>{visible[layer.id] ? <Eye size={15} /> : <EyeOff size={15} />}</button>
      </div>)}
    </div>
  </section>
}
