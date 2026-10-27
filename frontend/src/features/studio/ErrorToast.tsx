import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { t } from '../../i18n'
let publishError: ((error: ApiError | null) => void) | null = null
export function showApiError(error: ApiError | null): void { publishError?.(error) }
export default function ErrorToast() {
  const [error, setError] = useState<ApiError | null>(null)
  useEffect(() => { publishError = setError; return () => { publishError = null } }, [])
  if (!error) return null
  const message = t(`errors.${error.code}`)
  return <div role="alert" className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl bg-danger p-4 text-white shadow-lg"><p>{message === `errors.${error.code}` ? error.message : message}</p>{error.retryAfterS ? <p className="mt-1 text-sm">{t('common.retryAfter', { seconds: error.retryAfterS })}</p> : null}<button type="button" className="mt-2 underline" onClick={() => setError(null)}>{t('common.dismiss')}</button></div>
}
