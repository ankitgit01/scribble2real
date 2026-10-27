import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { t } from '../../i18n'
interface Props { onUnlock(pin: string): Promise<void> }
export default function PinGate({ onUnlock }: Props) {
  const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await onUnlock(pin) }
    catch (caught) { setError(caught instanceof ApiError && caught.code === 'UNAUTHORIZED' ? t('mentor.wrongPin') : caught instanceof Error ? caught.message : t('mentor.connectError')) }
    finally { setBusy(false) }
  }
  return <main className="grid min-h-screen place-items-center bg-surface-alt p-4 dark:bg-slate-950"><form onSubmit={(event) => void submit(event)} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="text-center"><span className="text-3xl" aria-hidden="true">✦</span><h1 className="mt-2 text-xl font-bold">{t('mentor.dashboard')}</h1><p className="mt-1 text-sm text-ink-soft">{t('mentor.pinPrompt')}</p></div><label htmlFor="mentor-pin" className="mt-5 block text-sm font-medium">{t('mentor.pin')}</label><input id="mentor-pin" type="password" inputMode="numeric" autoComplete="current-password" required value={pin} onChange={(event) => setPin(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-lg tracking-widest dark:border-slate-600 dark:bg-slate-950" />{error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}<button type="submit" disabled={busy} className="mt-4 min-h-12 w-full rounded-xl bg-brand font-semibold text-white disabled:opacity-60">{busy ? t('mentor.checking') : t('mentor.openDashboard')}</button></form></main>
}
