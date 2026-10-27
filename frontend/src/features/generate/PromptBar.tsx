import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { useSettingsStore } from '../../state/settingsStore'
import { useWorkshopStore } from '../../state/workshopStore'
import { useGenerationStore } from '../../state/generationStore'
import { getCanvasApi } from '../canvas/canvasApi'
import { stopMagicPolling } from './runMagic'
import StyleChips from './StyleChips'

export default function PromptBar() {
  const prompt = useSettingsStore((state) => state.prompt)
  const quality = useSettingsStore((state) => state.quality)
  const fidelity = useSettingsStore((state) => state.fidelity)
  const creativity = useSettingsStore((state) => state.creativity)
  const autoGenerate = useSettingsStore((state) => state.autoGenerate)
  const setField = useSettingsStore((state) => state.setField)
  const phase = useGenerationStore((state) => state.phase)
  const generationStatus = useGenerationStore((state) => state.status)
  const queuePosition = useGenerationStore((state) => state.queuePosition)
  const progress = useGenerationStore((state) => state.progress)
  const generationError = useGenerationStore((state) => state.error)
  const runMagic = useGenerationStore((state) => state.runMagic)
  const paused = useWorkshopStore((state) => state.status?.paused ?? false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const lastAutoAt = useRef(0)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busy = generationStatus === 'analyzing' || generationStatus === 'generating' || phase === 'preparing' || phase === 'queued' || phase === 'running'
  const buttonLabel = generationStatus === 'analyzing'
    ? 'Analyzing sketch...'
    : generationStatus === 'generating'
      ? 'Generating image...'
      : 'Make it'

  useEffect(() => () => stopMagicPolling(), [])

  useEffect(() => {
    if (!autoGenerate || paused) return
    let unsubscribe: (() => void) | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (autoTimer.current) clearTimeout(autoTimer.current)
      const quietAndCooldown = Math.max(6000, lastAutoAt.current + 20000 - Date.now())
      autoTimer.current = setTimeout(() => {
        const current = useGenerationStore.getState()
        if (!useSettingsStore.getState().autoGenerate || useWorkshopStore.getState().status?.paused || ['preparing', 'queued', 'running'].includes(current.phase) || !getCanvasApi()?.hasLineContent()) return
        lastAutoAt.current = Date.now()
        current.runMagic()
      }, quietAndCooldown)
    }
    const attach = () => {
      const canvas = getCanvasApi()
      if (canvas) unsubscribe = canvas.onContentChange(schedule)
      else retryTimer = setTimeout(attach, 150)
    }
    attach()
    return () => { unsubscribe?.(); if (retryTimer) clearTimeout(retryTimer); if (autoTimer.current) clearTimeout(autoTimer.current); autoTimer.current = null }
  }, [autoGenerate, paused])

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="prompt-heading">
    <div className="flex items-center justify-between gap-3"><div><h2 id="prompt-heading" className="font-semibold">{t('generate.makeItYours')}</h2><p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{t('generate.shortPromptHint')}</p></div><button type="button" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700">{advancedOpen ? t('generate.lessOptions') : t('generate.moreOptions')}</button></div>
    <div className="mt-3"><StyleChips /></div>
    <label htmlFor="image-prompt" className="sr-only">{t('generate.promptLabel')}</label>
    <div className="relative mt-3"><textarea id="image-prompt" maxLength={300} rows={2} value={prompt} onChange={(event) => setField('prompt', event.target.value.slice(0, 300))} placeholder={t('generate.promptPlaceholder')} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 pr-16 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-950" /><span aria-live="polite" className="absolute bottom-2 right-3 text-xs text-ink-soft">{prompt.length}/300</span></div>
    {advancedOpen && <div className="mt-4 grid gap-3 rounded-xl bg-surface-alt p-3 dark:bg-slate-800 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm"><span>{t('generate.quality')}</span><select value={quality} onChange={(event) => setField('quality', event.target.value as 'fast' | 'better')} className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-900"><option value="fast">{t('generate.fast')}</option><option value="better">{t('generate.better')}</option></select></label>
      <label className="flex flex-col gap-1 text-sm"><span>{t('generate.fidelity')}: {Math.round(fidelity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={fidelity} onChange={(event) => setField('fidelity', Number(event.target.value))} className="min-h-11 accent-brand" /><span className="text-xs text-ink-soft">{t('generate.fidelityHint')}</span></label>
      <label className="flex flex-col gap-1 text-sm"><span>{t('generate.creativity')}: {Math.round(creativity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={creativity} onChange={(event) => setField('creativity', Number(event.target.value))} className="min-h-11 accent-brand" /><span className="text-xs text-ink-soft">{t('generate.creativityHint')}</span></label>
    </div>}
    <div className="mt-3">
      <button type="button" onClick={runMagic} disabled={paused || busy} className="min-h-12 w-full rounded-xl bg-ink px-7 font-semibold text-white shadow-md transition-all duration-300 hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand">{buttonLabel}</button>
    </div>
    {phase === 'preparing' && <p role="status" className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />Reading your sketch and preparing the image…</p>}
    {phase === 'queued' && <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-300">In the image queue{queuePosition ? ` · position ${queuePosition}` : ''}</p>}
    {phase === 'running' && <div role="status" className="mt-2"><div className="flex justify-between text-xs text-slate-600 dark:text-slate-300"><span>Creating your image</span><span>{Math.round(progress * 100)}%</span></div><progress className="mt-1 h-2 w-full accent-brand" max={1} value={progress} aria-label="Image generation progress" /></div>}
    {phase === 'error' && generationError && <p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{t(`errors.${generationError.code}`) === `errors.${generationError.code}` ? generationError.message : t(`errors.${generationError.code}`)}</p>}
    {phase === 'done' && <p role="status" className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">Your image is ready on the canvas. Accept it or undo to keep sketching.</p>}
    {paused && <p role="status" className="mt-2 text-sm text-amber-800">{t('generate.pausedHint')}</p>}
  </section>
}
