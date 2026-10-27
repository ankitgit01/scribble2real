import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { t } from '../../i18n'

interface Props { beforeUrl: string | null; afterUrl: string; zoom?: number; className?: string; frameClassName?: string; stretch?: boolean }

export default function BeforeAfterSlider({ beforeUrl, afterUrl, zoom = 1, className = '', frameClassName = '', stretch = false }: Props) {
  const [split, setSplit] = useState(50)
  const frameRef = useRef<HTMLDivElement>(null)
  const updateFromPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = frameRef.current?.getBoundingClientRect()
    if (!bounds) return
    setSplit(Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)))
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); setSplit((value) => Math.max(0, value - (event.shiftKey ? 10 : 2))) }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); setSplit((value) => Math.min(100, value + (event.shiftKey ? 10 : 2))) }
    if (event.key === 'Home') { event.preventDefault(); setSplit(0) }
    if (event.key === 'End') { event.preventDefault(); setSplit(100) }
  }

  return <div className={`relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 ${className}`} aria-label={t('generate.beforeAfter')}>
    <div ref={frameRef} className={`relative aspect-square w-full overflow-hidden touch-pan-y ${frameClassName}`}>
      <img src={afterUrl} alt={t('generate.afterAlt')} draggable={false} className={`absolute inset-0 h-full w-full select-none ${stretch ? 'object-fill' : 'object-contain'}`} style={{ transform: `scale(${zoom})` }} />
      {beforeUrl && <img src={beforeUrl} alt={t('generate.beforeAlt')} draggable={false} className={`absolute inset-0 h-full w-full select-none ${stretch ? 'object-fill' : 'object-contain'}`} style={{ clipPath: `inset(0 ${100 - split}% 0 0)`, transform: `scale(${zoom})` }} />}
      {beforeUrl && <>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(15,23,42,.45)]" style={{ left: `${split}%` }} />
        <button type="button" role="slider" aria-label={t('generate.compareSlider')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)} aria-valuetext={`${Math.round(split)}% ${t('generate.before')}`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateFromPointer(event) }} onPointerMove={(event) => { if (event.buttons > 0) updateFromPointer(event) }} onKeyDown={handleKeyDown} className="absolute top-1/2 z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 border-white bg-white/95 text-slate-800 shadow-lg transition-transform duration-150 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" style={{ left: `${split}%` }}><ArrowLeftRight size={18} /></button>
      </>}
      <span className="absolute left-3 top-3 z-10 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-medium text-white">{beforeUrl ? t('generate.after') : t('generate.result')}</span>
      {beforeUrl && <span className="absolute bottom-3 left-3 z-10 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-medium text-white">{t('generate.before')}</span>}
    </div>
  </div>
}
