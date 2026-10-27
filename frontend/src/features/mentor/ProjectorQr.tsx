import { useEffect, useMemo, useState } from 'react'
import { toDataURL } from 'qrcode'
import type { MentorOverview } from '../../api/types'
import { t } from '../../i18n'
interface Props { overview: MentorOverview }
export default function ProjectorQr({ overview }: Props) {
  const urls = useMemo(() => [...new Set([...(overview.public_url ? [overview.public_url] : []), ...overview.lan_urls])], [overview.public_url, overview.lan_urls])
  const [index, setIndex] = useState(0); const [open, setOpen] = useState(false); const [qr, setQr] = useState('')
  const url = urls[index] ?? window.location.origin
  useEffect(() => { let active = true; void toDataURL(url, { width: 460, margin: 2, color: { dark: '#111827', light: '#ffffff' }, errorCorrectionLevel: 'H' }).then((data) => { if (active) setQr(data) }).catch(() => { if (active) setQr('') }); return () => { active = false } }, [url])
  return <><button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium dark:border-slate-700">{t('mentor.showJoinQr')}</button>{open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950 p-5 text-white"><button type="button" onClick={() => setOpen(false)} aria-label={t('mentor.close')} className="absolute right-4 top-4 min-h-12 min-w-12 rounded-full border border-white/40 text-2xl">×</button><section className="flex w-full max-w-xl flex-col items-center text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">{t('mentor.joinWorkshop')}</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t('mentor.scanToJoin')}</h2>{qr ? <img src={qr} alt={t('mentor.qrAlt')} className="mt-6 h-auto w-full max-w-sm rounded-2xl bg-white p-4" /> : <p className="mt-6 rounded-xl bg-white/10 p-6">{t('mentor.qrUnavailable')}</p>}<p className="mt-5 break-all rounded-xl bg-white/10 px-5 py-3 font-mono text-lg">{url}</p>{urls.length > 1 && <label className="mt-4 flex items-center gap-2 text-sm"><span>{t('mentor.joinAddress')}</span><select value={index} onChange={(event) => setIndex(Number(event.target.value))} className="min-h-11 rounded-lg bg-white px-3 text-ink">{urls.map((value, i) => <option key={value} value={i}>{i === 0 && overview.public_url ? t('mentor.publicAddress') : t('mentor.localAddress')} · {value}</option>)}</select></label>}</section></div>}</>
}
