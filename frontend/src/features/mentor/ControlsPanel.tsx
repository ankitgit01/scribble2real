import { useState } from 'react'
import { api } from '../../api/client'
import type { WorkshopStatus } from '../../api/types'
import { t } from '../../i18n'
interface Props { pin: string; status: WorkshopStatus; onStatus(status: WorkshopStatus): void }
export default function ControlsPanel({ pin, status, onStatus }: Props) {
  const [banner, setBanner] = useState(status.banner_message ?? '')
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const run = async (action: () => Promise<WorkshopStatus>) => { setBusy(true); setMessage(''); try { onStatus(await action()) } catch (error) { setMessage(error instanceof Error ? error.message : t('mentor.updateFailed')) } finally { setBusy(false) } }
  const togglePause = () => void run(() => api.mentor.pause(pin, { paused: !status.paused }))
  const saveBanner = () => void run(async () => {
    const next = await api.mentor.settings(pin, { banner_message: banner.trim() || null })
    setBanner(next.banner_message ?? '')
    return next
  })
  const changeSettings = (patch: { learn_enabled?: boolean; max_jobs_per_client?: number }) => void run(() => api.mentor.settings(pin, patch))
  const clearQueue = async () => {
    if (!window.confirm(t('mentor.clearQueueConfirm'))) return
    setBusy(true); setMessage('')
    try { const result = await api.mentor.clearQueue(pin); setMessage(t('mentor.queueCleared', { count: result.cleared })) }
    catch (error) { setMessage(error instanceof Error ? error.message : t('mentor.updateFailed')) }
    finally { setBusy(false) }
  }
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="controls-heading">
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-5 dark:border-slate-800 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Workshop setup</p><h2 id="controls-heading" className="mt-1 text-lg font-bold">{t('mentor.controls')}</h2></div><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${status.paused ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'}`}><span className={`h-2 w-2 rounded-full ${status.paused ? 'bg-amber-500' : 'bg-emerald-500'}`} />{status.paused ? t('mentor.paused') : t('mentor.live')}</span></div>
    <div className="space-y-5 p-5">
      <div><div className="mb-2"><h3 className="text-sm font-semibold">Class prompt for image ideas</h3><p className="mt-0.5 text-xs leading-relaxed text-ink-soft">Guide the sketch analysis and image suggestion for everyone in this workshop.</p></div><textarea maxLength={180} rows={2} value={banner} onChange={(event) => setBanner(event.target.value)} placeholder={t('mentor.bannerPlaceholder')} className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-slate-700 dark:bg-slate-950" /><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-ink-soft">{banner.length}/180</span><button type="button" disabled={busy || banner.trim() === (status.banner_message ?? '')} onClick={saveBanner} className="min-h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45">Save class prompt</button></div></div>
      <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">Session controls</h3><div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled={busy} onClick={togglePause} className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white transition disabled:opacity-50 ${status.paused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700'}`}>{status.paused ? t('mentor.resume') : t('mentor.pause')}</button><button type="button" disabled={busy} onClick={() => void clearQueue()} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{t('mentor.clearQueue')}</button></div></div>
      <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">Student access</h3><div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3 dark:divide-slate-800 dark:border-slate-700"><label className="flex min-h-12 items-center justify-between gap-3 text-sm"><span><span className="block font-medium">{t('mentor.learn')}</span><span className="block text-xs text-ink-soft">Sketch explanations and prompt suggestions</span></span><input type="checkbox" checked={status.learn_enabled} onChange={(event) => changeSettings({ learn_enabled: event.target.checked })} className="h-5 w-5 accent-brand" disabled={busy} /></label><div className="flex min-h-12 items-center justify-between gap-3 text-sm"><span><span className="block font-medium">{t('mentor.jobsPerStudent')}</span><span className="block text-xs text-ink-soft">Concurrent image requests per device</span></span><span className="flex items-center gap-2"><button type="button" disabled={busy || status.max_jobs_per_client <= 1} onClick={() => changeSettings({ max_jobs_per_client: status.max_jobs_per_client - 1 })} aria-label={t('mentor.decreaseLimit')} className="min-h-9 min-w-9 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">−</button><output className="min-w-5 text-center font-semibold tabular-nums">{status.max_jobs_per_client}</output><button type="button" disabled={busy || status.max_jobs_per_client >= 4} onClick={() => changeSettings({ max_jobs_per_client: status.max_jobs_per_client + 1 })} aria-label={t('mentor.increaseLimit')} className="min-h-9 min-w-9 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">+</button></span></div></div></div>
    </div>
    {message && <p role="status" className="mt-3 text-sm text-ink-soft">{message}</p>}
  </section>
}
