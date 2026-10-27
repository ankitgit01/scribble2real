import { t } from '../../i18n'
import { useGenerationStore } from '../../state/generationStore'
export default function HistoryStrip() {
  const history = useGenerationStore((state) => state.history)
  const openHistory = useGenerationStore((state) => state.openHistory)
  const clearHistory = useGenerationStore((state) => state.clearHistory)
  if (history.length === 0) return null
  return <section className="mt-4" aria-labelledby="history-heading"><div className="mb-2 flex items-center justify-between"><h3 id="history-heading" className="text-sm font-semibold">{t('generate.recentCreations')}</h3><button type="button" onClick={clearHistory} className="min-h-10 px-2 text-xs text-ink-soft underline">{t('generate.clearAll')}</button></div><div className="flex gap-2 overflow-x-auto pb-2">{history.map((item) => <button key={item.id} type="button" onClick={() => openHistory(item)} title={item.prompt} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand dark:border-slate-700"><img src={item.thumbnailUrl || item.resultUrl} alt={item.prompt || t('generate.previousResult')} loading="lazy" className="h-full w-full object-cover" /></button>)}</div></section>
}
