import { useEffect, useState } from 'react'
import { t } from '../../i18n'
import { useGenerationStore } from '../../state/generationStore'
import BeforeAfterSlider from './BeforeAfterSlider'
import HistoryStrip from './HistoryStrip'

function filename(): string {
  const now = new Date()
  const part = (value: number) => String(value).padStart(2, '0')
  return `scribble2real-${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}-${part(now.getHours())}${part(now.getMinutes())}.png`
}
export default function ResultPanel() {
  const phase = useGenerationStore((state) => state.phase)
  const queuePosition = useGenerationStore((state) => state.queuePosition)
  const progress = useGenerationStore((state) => state.progress)
  const beforeUrl = useGenerationStore((state) => state.beforeUrl)
  const resultUrl = useGenerationStore((state) => state.resultUrl)
  const resultBlob = useGenerationStore((state) => state.resultBlob)
  const error = useGenerationStore((state) => state.error)
  const cancel = useGenerationStore((state) => state.cancel)
  const variation = useGenerationStore((state) => state.variation)
  const sketchOver = useGenerationStore((state) => state.sketchOver)
  const [zoom, setZoom] = useState(1)
  const [retrySeconds, setRetrySeconds] = useState(error?.retry_after_s ?? 0)
  useEffect(() => { setRetrySeconds(error?.retry_after_s ?? 0) }, [error?.retry_after_s, error?.code])
  useEffect(() => { if (retrySeconds <= 0) return; const timer = setInterval(() => setRetrySeconds((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer) }, [retrySeconds > 0])
  const download = () => {
    if (!resultBlob && !resultUrl) return
    const anchor = document.createElement('a')
    anchor.href = resultBlob ? URL.createObjectURL(resultBlob) : resultUrl!
    anchor.download = filename(); document.body.appendChild(anchor); anchor.click(); anchor.remove()
    if (resultBlob) setTimeout(() => URL.revokeObjectURL(anchor.href), 1000)
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="result-heading">
    <div className="mb-3 flex items-center justify-between"><h2 id="result-heading" className="font-semibold">{t('generate.resultHeading')}</h2>{phase === 'done' && <button type="button" onClick={() => setZoom((value) => value >= 1.5 ? 1 : value + 0.25)} className="min-h-10 rounded-lg border px-3 text-sm">{zoom > 1 ? t('generate.resetZoom') : t('generate.zoom')}</button>}</div>
    {phase === 'idle' && <div className="grid min-h-52 place-items-center rounded-xl bg-surface-alt p-6 text-center dark:bg-slate-800"><div><div className="text-4xl" aria-hidden="true">✧</div><p className="mt-2 font-medium">{t('generate.readyTitle')}</p><p className="mt-1 max-w-xs text-sm text-ink-soft">{t('generate.readyHint')}</p></div></div>}
    {phase === 'preparing' && <div role="status" className="grid min-h-52 place-items-center rounded-xl bg-surface-alt p-6 text-center dark:bg-slate-800"><div><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none" /><p className="mt-3 font-medium">{t('generate.preparing')}</p></div></div>}
    {phase === 'queued' && <div role="status" className="grid min-h-52 place-items-center rounded-xl bg-brand-soft p-6 text-center"><div><span className="text-3xl">⌛</span><p className="mt-2 font-semibold">{t('generate.queued', { position: queuePosition ?? 1 })}</p><button type="button" onClick={cancel} className="mt-3 min-h-11 rounded-lg border border-brand/30 px-4 text-sm">{t('generate.cancel')}</button></div></div>}
    {phase === 'running' && <div role="status" className="grid min-h-52 place-items-center rounded-xl bg-surface-alt p-6 text-center dark:bg-slate-800"><div className="w-full max-w-sm"><p className="font-medium">{t('generate.creating')}</p><progress className="mt-4 h-3 w-full accent-brand" max={1} value={progress} aria-label={t('generate.progress')} /><p className="mt-1 text-sm tabular-nums text-ink-soft">{Math.round(progress * 100)}%</p><button type="button" onClick={cancel} className="mt-3 min-h-11 rounded-lg border px-4 text-sm">{t('generate.cancel')}</button></div></div>}
    {phase === 'done' && resultUrl && <><BeforeAfterSlider beforeUrl={beforeUrl} afterUrl={resultUrl} zoom={zoom} /><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={download} className="min-h-11 rounded-xl bg-brand px-4 font-semibold text-white">↓ {t('generate.download')}</button><button type="button" onClick={() => void sketchOver()} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm dark:border-slate-700">{t('generate.sketchOver')}</button><button type="button" onClick={variation} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm dark:border-slate-700">{t('generate.variation')}</button></div></>}
    {phase === 'error' && error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-900"><p className="font-medium">{t(`errors.${error.code}`) === `errors.${error.code}` ? error.message : t(`errors.${error.code}`)}</p>{retrySeconds > 0 && <p className="mt-1 text-sm">{t('generate.retryCountdown', { seconds: retrySeconds })}</p>}</div>}
    <HistoryStrip />
  </section>
}
