import { useState } from 'react'
import { api } from '../../api/client'
import type { ActivityItem } from '../../api/types'
import { t } from '../../i18n'
interface Props { pin: string; items: ActivityItem[]; onClientBlocked(clientId: string, blocked: boolean): void }
function timeLabel(timestamp: number): string { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp * 1000)) }
export default function ActivityFeed({ pin, items, onClientBlocked }: Props) {
  const [selected, setSelected] = useState<ActivityItem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const block = async (item: ActivityItem) => {
    setBusyId(item.client_id); setError('')
    try { const result = await api.mentor.blockClient(pin, { client_id: item.client_id, blocked: true }); onClientBlocked(result.client_id, result.blocked) }
    catch (caught) { setError(caught instanceof Error ? caught.message : t('mentor.updateFailed')) }
    finally { setBusyId(null) }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="activity-heading"><div className="flex items-center justify-between"><h2 id="activity-heading" className="font-semibold">{t('mentor.liveActivity')}</h2><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-label={t('mentor.live')} /></div>{error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    {items.length === 0 ? <p className="mt-3 text-sm text-ink-soft">{t('mentor.activityEmpty')}</p> : <ul className="mt-3 grid gap-2 sm:grid-cols-2">{items.map((item) => <li key={item.id} className={`overflow-hidden rounded-xl border ${item.kind === 'blocked_prompt' ? 'border-rose-300 bg-rose-50' : 'border-slate-200 dark:border-slate-700'}`}><button type="button" onClick={() => setSelected(item)} className="flex min-h-20 w-full items-center gap-3 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">{item.thumb_data_url ? <img src={item.thumb_data_url} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-surface-alt text-xl dark:bg-slate-800">{item.kind === 'blocked_prompt' ? '⚑' : '✦'}</span>}<span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{item.nickname || item.client_id.slice(0, 10)}</strong><time className="shrink-0 text-xs text-ink-soft">{timeLabel(item.ts)}</time></span><span className="mt-1 block truncate text-xs text-ink-soft">{item.prompt || t(`mentor.eventKinds.${item.kind}`)}</span><span className="mt-1 block text-xs font-medium">{item.status || t(`mentor.eventKinds.${item.kind}`)}</span></span></button><div className="flex justify-end border-t border-slate-200/70 px-2 dark:border-slate-700"><button type="button" disabled={busyId === item.client_id} onClick={() => void block(item)} className="min-h-9 px-2 text-xs text-rose-700 underline disabled:opacity-50">{t('mentor.blockClient')}</button></div></li>)}</ul>}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" onClick={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-label={t('mentor.activityDetails')} onClick={(event) => event.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between"><h3 className="font-semibold">{selected.nickname || selected.client_id}</h3><button type="button" onClick={() => setSelected(null)} aria-label={t('mentor.close')} className="min-h-11 min-w-11 rounded-lg border">×</button></div>{selected.thumb_data_url && <img src={selected.thumb_data_url} alt={t('mentor.activityImage')} className="mt-3 max-h-[65vh] w-full rounded-xl object-contain" />}<p className="mt-3 text-sm">{selected.prompt || t(`mentor.eventKinds.${selected.kind}`)}</p></section></div>}
  </section>
}
