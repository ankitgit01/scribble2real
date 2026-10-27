import { Check, Clock3, X } from 'lucide-react'
import { useGenerationStore } from '../../state/generationStore'
import BeforeAfterSlider from '../generate/BeforeAfterSlider'
import CanvasEngine from './engine/CanvasEngine'
import CanvasToolbar from './CanvasToolbar'
import LayerPanel from './LayerPanel'
import { t } from '../../i18n'

export default function CanvasPanel({ historyOpen, onToggleHistory }: { historyOpen: boolean; onToggleHistory(): void }) {
  const resultUrl = useGenerationStore((state) => state.resultUrl)
  const phase = useGenerationStore((state) => state.phase)
  const beforeUrl = useGenerationStore((state) => state.beforeUrl)
  const acceptResult = useGenerationStore((state) => state.acceptResult)
  const dismissResult = useGenerationStore((state) => state.dismissResult)
  return <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f1ea] transition-all duration-300 dark:bg-slate-950" aria-labelledby="canvas-heading">
    <h2 id="canvas-heading" className="sr-only">{t('canvas.heading')}</h2>
    <CanvasToolbar />
    <div className="absolute inset-0 p-1 pb-12 pt-[4.25rem] sm:p-1.5 sm:pb-12 sm:pt-[4.25rem]">
      <CanvasEngine className="relative h-full w-full touch-none overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/10" />
    </div>
    {resultUrl && phase === 'done' && <>
      <div className="pointer-events-none absolute inset-x-2 bottom-20 top-[4.25rem] z-20 sm:inset-x-3">
        <BeforeAfterSlider beforeUrl={beforeUrl} afterUrl={resultUrl} stretch className="pointer-events-auto h-full w-full shadow-2xl ring-1 ring-white/80" frameClassName="h-full w-full aspect-auto" />
      </div>
      <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-xl backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/90">
        <button type="button" onClick={dismissResult} className="flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"><X size={16} />Undo</button>
        <button type="button" onClick={() => void acceptResult()} className="flex min-h-10 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-dark"><Check size={16} />Accept</button>
      </div>
    </>}
    {!historyOpen && <button type="button" aria-expanded={false} onClick={onToggleHistory} className="absolute left-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-white/80 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition-all duration-300 hover:bg-white hover:text-brand" aria-label="Open recent creations" title="Recent creations"><Clock3 size={17} /></button>}
    <LayerPanel />
    <p className="absolute bottom-4 left-4 z-10 hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">{t('canvas.help')}</p>
  </section>
}
