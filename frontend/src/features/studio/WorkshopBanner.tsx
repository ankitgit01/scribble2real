import { useWorkshopStore } from '../../state/workshopStore'
import { t } from '../../i18n'
export default function WorkshopBanner() {
  const status = useWorkshopStore((state) => state.status)
  const lastError = useWorkshopStore((state) => state.lastError)
  if (lastError && !status) return <div role="status" className="rounded-xl border border-warn bg-amber-50 p-3 text-amber-950">{t('common.serverUnreachable')}</div>
  if (!status) return <div role="status" className="rounded-xl bg-surface p-3 text-ink-soft dark:bg-slate-900">{t('common.connecting')}</div>
  if (status.banner_message || status.paused) return <div role="status" className={`rounded-xl p-3 font-medium ${status.paused ? 'border border-warn bg-amber-50 text-amber-950' : 'bg-brand-soft text-ink'}`}>{status.paused ? `⏸ ${t('common.workshopPaused')}` : '📣'} {status.banner_message}</div>
  return null
}
