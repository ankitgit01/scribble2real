import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowLeft, Cpu, LockKeyhole, Sparkles } from 'lucide-react'
import { ApiError, api } from '../../api/client'
import type { ActivityItem, ClientSummary, MentorOverview, WorkshopStatus } from '../../api/types'
import { t } from '../../i18n'
import PinGate from './PinGate'
import ControlsPanel from './ControlsPanel'
import ClientsTable from './ClientsTable'
import ProjectorQr from './ProjectorQr'

const SESSION_KEY = 's2r.mentorPin'
function storedPin(): string {
  try { return sessionStorage.getItem(SESSION_KEY) ?? '' } catch { return '' }
}
export function mergeActivity(previous: ActivityItem[], incoming: ActivityItem[]): ActivityItem[] {
  const unique = new Map<number, ActivityItem>()
  for (const item of [...previous, ...incoming]) unique.set(item.id, item)
  return [...unique.values()].sort((a, b) => b.id - a.id).slice(0, 20)
}

function ActivityPlot({ items, status }: { items: ActivityItem[]; status: WorkshopStatus }) {
  const now = Date.now() / 1000
  const start = now - 3600
  const buckets = Array.from({ length: 12 }, () => ({ images: 0, explanations: 0, other: 0 }))
  for (const item of items) {
    if (item.ts < start) continue
    const index = Math.min(11, Math.floor((item.ts - start) / 300))
    if (item.kind === 'generate') buckets[index].images += 1
    else if (item.kind === 'learn') buckets[index].explanations += 1
    else buckets[index].other += 1
  }
  const max = Math.max(2, ...buckets.map((bucket) => bucket.images + bucket.explanations + bucket.other))
  const gridY = [28, 70, 112, 154]
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="activity-trend-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><Activity size={17} /></span><div><h2 id="activity-trend-heading" className="text-base font-bold">Workshop activity</h2><p className="text-xs text-ink-soft">Live · past hour</p></div></div><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft"><i className="h-2 w-2 rounded-sm bg-indigo-500" />Images</span><span className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft"><i className="h-2 w-2 rounded-sm bg-teal-400" />Explanations</span></div></div>
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950/60"><span className="font-semibold text-slate-500 dark:text-slate-400">Now</span><span className="h-3 w-px bg-slate-200 dark:bg-slate-700" /><span className="text-slate-600 dark:text-slate-300">Queued <b className="ml-1 text-slate-900 dark:text-white">{status.queue_length}</b></span><span className="text-slate-600 dark:text-slate-300">Generating <b className="ml-1 text-slate-900 dark:text-white">{status.running}</b></span><span className="text-slate-600 dark:text-slate-300">Avg image <b className="ml-1 text-slate-900 dark:text-white">{status.avg_seconds_per_image === null ? '—' : `${status.avg_seconds_per_image.toFixed(1)}s`}</b></span></div>
    <div className="mt-2 overflow-hidden rounded-2xl bg-slate-50 px-2 pt-2 dark:bg-slate-950/60"><svg viewBox="0 0 720 180" preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Stacked bar chart of image requests and explanations in five-minute intervals over the past hour"><defs><linearGradient id="activityArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".12" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0" /></linearGradient></defs>{gridY.map((y) => <line key={y} x1="10" x2="710" y1={y} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="3 5" />)}<path d="M10 154 L710 154 L710 164 L10 164 Z" fill="url(#activityArea)" />{buckets.map((bucket, index) => { const x = 25 + index * 58; const total = bucket.images + bucket.explanations + bucket.other; const base = 154; const scale = 112 / max; const imageH = bucket.images * scale; const learnH = bucket.explanations * scale; const otherH = bucket.other * scale; return <g key={index}><rect x={x} y={base - imageH} width="24" height={imageH} rx="4" fill="#6366f1" /><rect x={x} y={base - imageH - learnH} width="24" height={learnH} rx="4" fill="#2dd4bf" /><rect x={x} y={base - imageH - learnH - otherH} width="24" height={otherH} rx="4" fill="#f59e0b" />{total > 0 && <title>{`${total} event${total === 1 ? '' : 's'} in this interval`}</title>}</g>})}</svg><div className="flex justify-between px-2 pb-2 text-[10px] font-medium text-ink-soft"><span>60 min ago</span><span>45 min</span><span>30 min</span><span>15 min</span><span>Now</span></div></div>
  </section>
}

function ResourceCard({ overview }: { overview: MentorOverview }) {
  const gpu = overview.gpu
  const percent = gpu && gpu.vram_total_mb > 0 ? Math.min(100, Math.round(gpu.vram_used_mb / gpu.vram_total_mb * 100)) : 0
  const learnPercent = overview.learn_usage.cap > 0 ? Math.min(100, overview.learn_usage.used / overview.learn_usage.cap * 100) : 0
  const used = gpu ? (gpu.vram_used_mb / 1024).toFixed(1) : '—'
  const total = gpu ? (gpu.vram_total_mb / 1024).toFixed(1) : '—'
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="resource-heading"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200"><Cpu size={17} /></span><h2 id="resource-heading" className="font-bold">Image engine</h2></div><p className="mt-1 text-xs text-ink-soft">{gpu?.name ?? t('mentor.gpuUnavailable')}</p></div><span className="rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold text-ink-soft dark:bg-slate-800">{gpu ? 'Ready' : 'Unavailable'}</span></div>
    <div className="mt-5 flex items-end justify-between"><div><p className="text-xs text-ink-soft">Video memory in use</p><p className="mt-1 text-2xl font-bold tabular-nums">{used}<span className="ml-1 text-sm font-medium text-ink-soft">/ {total} GB</span></p></div><div className={`grid h-14 w-14 place-items-center rounded-full border-[5px] text-xs font-bold tabular-nums ${percent >= 85 ? 'border-amber-400 text-amber-700 dark:text-amber-200' : 'border-indigo-300 text-indigo-700 dark:text-indigo-200'}`} style={{ background: `conic-gradient(from -90deg, ${percent >= 85 ? '#f59e0b' : '#6366f1'} ${percent}%, #e2e8f0 ${percent}%)` }}><span className="grid h-10 w-10 place-items-center rounded-full bg-white dark:bg-slate-900">{gpu ? `${percent}%` : '—'}</span></div></div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full transition-all duration-700 ${percent >= 85 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`} style={{ width: `${percent}%` }} /></div>
    <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Sparkles size={15} className="text-teal-600 dark:text-teal-300" /><h3 className="text-sm font-semibold">{t('mentor.learnUsage')}</h3></div><span className="text-xs font-semibold tabular-nums">{overview.learn_usage.used}<span className="text-ink-soft"> / {overview.learn_usage.cap}</span></span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full transition-all duration-700 ${learnPercent >= 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-teal-400 to-emerald-500'}`} style={{ width: `${learnPercent}%` }} /></div></div>
  </section>
}

export default function MentorPage() {
  const [pin, setPin] = useState(storedPin)
  const [overview, setOverview] = useState<MentorOverview | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const updateOverview = useCallback((next: MentorOverview) => { setOverview(next); setActivity((previous) => mergeActivity(previous, next.activity)); setLastUpdated(Date.now()); setError('') }, [])
  const unlock = async (candidate: string) => {
    const next = await api.mentor.overview(candidate)
    try { sessionStorage.setItem(SESSION_KEY, candidate) } catch { /* Keep the PIN in memory for this visit. */ }
    setPin(candidate); updateOverview(next)
  }
  const lock = () => { try { sessionStorage.removeItem(SESSION_KEY) } catch { /* Continue by clearing the in-memory PIN. */ } setPin(''); setOverview(null); setActivity([]) }
  useEffect(() => {
    if (!pin) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try { const next = await api.mentor.overview(pin); if (active) updateOverview(next) }
      catch (caught) { if (!active) return; if (caught instanceof ApiError && caught.code === 'UNAUTHORIZED') { lock(); return }; setError(caught instanceof Error ? caught.message : t('mentor.connectError')) }
      finally { if (active) timer = setTimeout(() => { void poll() }, 3000) }
    }
    void poll()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [pin, updateOverview])
  if (!pin) return <PinGate onUnlock={unlock} />
  if (!overview) return <main className="grid min-h-screen place-items-center bg-surface-alt dark:bg-slate-950"><p role="status" className="rounded-2xl bg-white px-6 py-5 shadow-lg dark:bg-slate-900">{error || t('mentor.loading')}</p></main>
  const status = overview.status
  const updateStatus = (next: WorkshopStatus) => setOverview((current) => current ? { ...current, status: next } : current)
  const updateClient = (client: ClientSummary) => setOverview((current) => current ? { ...current, clients: current.clients.map((item) => item.client_id === client.client_id ? client : item) } : current)
  const updatedLabel = lastUpdated ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(lastUpdated) : t('mentor.loading')

  return <main className="min-h-screen bg-[#f4f6fb] px-3 py-4 text-slate-900 dark:bg-[#0b1020] dark:text-slate-50 sm:px-6 sm:py-7">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-5 text-white shadow-xl sm:p-7"><div className="pointer-events-none absolute -right-12 -top-28 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" /><div className="relative flex flex-wrap items-center justify-between gap-4"><div><Link to="/" className="mb-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20"><ArrowLeft size={16} />Back to drawing</Link><div><Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-200"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10"><Sparkles size={15} /></span>Scribble2Real</Link><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t('mentor.dashboard')}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-blue-100"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1"><i className={`h-2 w-2 rounded-full ${status.paused ? 'bg-amber-400' : 'animate-pulse bg-emerald-400'}`} />{status.paused ? t('mentor.paused') : 'Workshop live'}</span><span>Updated {updatedLabel}</span></div></div></div><div className="relative flex flex-wrap gap-2"><ProjectorQr overview={overview} /><button type="button" onClick={lock} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold transition hover:bg-white/20"><LockKeyhole size={15} />{t('mentor.lock')}</button></div></div></header>
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
      {status.banner_message && <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm dark:border-indigo-900 dark:bg-indigo-950/50"><span className="mt-0.5 text-indigo-600 dark:text-indigo-300">✦</span><div><p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Class prompt</p><p className="mt-0.5 font-medium">{status.banner_message}</p></div></div>}

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.8fr)]" aria-label="Workshop activity and system resources">
        <ActivityPlot items={activity} status={status} />
        <ResourceCard overview={overview} />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]" aria-label="Workshop setup and devices">
        <ControlsPanel pin={pin} status={status} onStatus={updateStatus} />
        <ClientsTable pin={pin} clients={overview.clients} activity={activity} onClient={updateClient} />
      </section>
    </div>
  </main>
}
