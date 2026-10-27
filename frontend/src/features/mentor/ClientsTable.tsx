import { useState } from 'react'
import { ChevronDown, Clock3, ShieldCheck, ShieldOff } from 'lucide-react'
import { api } from '../../api/client'
import type { ActivityItem, ClientSummary } from '../../api/types'
import { t } from '../../i18n'

interface Props {
  pin: string
  clients: ClientSummary[]
  activity: ActivityItem[]
  onClient(client: ClientSummary): void
}

function timeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp * 1000))
}

export default function ClientsTable({ pin, clients, activity, onClient }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const toggle = async (client: ClientSummary) => {
    setBusyId(client.client_id)
    setError('')
    try {
      onClient(await api.mentor.blockClient(pin, { client_id: client.client_id, blocked: !client.blocked }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('mentor.updateFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const orderedClients = [...clients].sort((a, b) => a.last_seen_s_ago - b.last_seen_s_ago)

  return <section aria-label="Devices and their activity" className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
      <h2 className="font-semibold">{t('mentor.students')}</h2>
      <span className="text-xs tabular-nums text-ink-soft">{clients.filter((client) => !client.blocked).length} active · {clients.length} total</span>
    </div>
    {error && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
    {orderedClients.length === 0 ? <p className="px-4 py-5 text-sm text-ink-soft">{t('mentor.noStudents')}</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {orderedClients.map((client) => {
        const clientActivity = activity.filter((item) => item.client_id === client.client_id).sort((a, b) => b.ts - a.ts)
        return <details key={client.client_id} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand dark:hover:bg-slate-800/60 sm:px-4">
            <ChevronDown size={15} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{client.nickname || client.client_id.slice(0, 12)}</span>
              <span className="mt-0.5 block text-[11px] text-ink-soft">{client.jobs_total} images · seen {t('mentor.secondsAgo', { seconds: client.last_seen_s_ago })}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${client.blocked ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>{client.blocked ? 'Paused' : 'Active'}</span>
          </summary>
          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Recent activity</h3>
              <button type="button" disabled={busyId === client.client_id} onClick={() => void toggle(client)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                {client.blocked ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}{client.blocked ? t('mentor.unblock') : t('mentor.block')}
              </button>
            </div>
            {clientActivity.length ? <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-slate-800">
              {clientActivity.map((item) => <li key={item.id} className="flex min-w-0 items-start gap-2 py-2">
                {item.thumb_data_url ? <img src={item.thumb_data_url} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-md object-cover" /> : <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-semibold"><span>{t(`mentor.eventKinds.${item.kind}`)}</span>{item.status && <span className="font-normal text-ink-soft">{item.status}</span>}</span>
                  {item.prompt && <span className="mt-0.5 block break-words text-xs text-ink-soft">{item.prompt}</span>}
                </span>
                <time className="shrink-0 text-[10px] text-ink-soft"><Clock3 size={11} className="mr-1 inline" />{timeLabel(item.ts)}</time>
              </li>)}
            </ul> : <p className="mt-2 text-xs text-ink-soft">No recent activity.</p>}
          </div>
        </details>
      })}
    </div>}
  </section>
}
