import { useEffect, useState } from 'react'
import { t } from '../../i18n'
interface Props { open?: boolean; onClose?: () => void }
const KEY = 's2r.privacyAcknowledged.v1'
export default function PrivacyNotice({ open, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { if (open !== undefined) setVisible(open); else { try { setVisible(localStorage.getItem(KEY) !== 'yes') } catch { setVisible(true) } } }, [open])
  if (!visible) return null
  const close = () => { try { localStorage.setItem(KEY, 'yes') } catch { /* The notice remains available from the footer. */ } setVisible(false); onClose?.() }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="privacy-heading" className="w-full max-w-lg rounded-2xl bg-white p-6 text-ink shadow-xl dark:bg-slate-900 dark:text-white"><h2 id="privacy-heading" className="text-xl font-bold">{t('common.privacyTitle')}</h2><p className="mt-3 leading-relaxed">{t('common.privacyNotice')}</p><button type="button" autoFocus onClick={close} className="mt-5 min-h-11 rounded-lg bg-brand px-5 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{t('common.understood')}</button></section></div>
}
