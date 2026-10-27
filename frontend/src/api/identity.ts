const CLIENT_ID_KEY = 's2r.clientId'
const NICKNAME_KEY = 's2r.nickname'

function storage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

export function getClientId(): string {
  const store = storage()
  const existing = store?.getItem(CLIENT_ID_KEY)
  if (existing && /^[A-Za-z0-9-]{1,64}$/.test(existing)) return existing
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
  store?.setItem(CLIENT_ID_KEY, id)
  return id
}

export function getNickname(): string | null {
  const value = storage()?.getItem(NICKNAME_KEY)?.trim().slice(0, 20)
  return value || null
}

export function setNickname(value: string): void {
  const store = storage()
  const nickname = value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 20)
  if (!nickname) store?.removeItem(NICKNAME_KEY)
  else store?.setItem(NICKNAME_KEY, nickname)
}
