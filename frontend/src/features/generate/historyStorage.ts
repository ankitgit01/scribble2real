import type { HistoryItem } from '../../api/types'
export const HISTORY_KEY = 's2r.history.v1'
export const HISTORY_LIMIT = 8
function storage(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }
export function readHistory(): HistoryItem[] {
  const store = storage()
  if (!store) return []
  try {
    const raw: unknown = JSON.parse(store.getItem(HISTORY_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(isHistoryItem).slice(0, HISTORY_LIMIT)
  } catch { return [] }
}
export function saveHistory(items: HistoryItem[]): HistoryItem[] {
  const next = items.filter(isHistoryItem).slice(0, HISTORY_LIMIT)
  const store = storage()
  if (!store) return next
  try { store.setItem(HISTORY_KEY, JSON.stringify(next)); return next }
  catch {
    // Browser storage quotas differ. Keep the newest records and retry with a shorter history.
    for (let count = Math.min(next.length - 1, HISTORY_LIMIT - 1); count >= 0; count -= 1) {
      try { store.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, count))); return next.slice(0, count) } catch { /* Continue trimming until storage accepts the value. */ }
    }
    return []
  }
}
export function addHistoryItem(item: HistoryItem): HistoryItem[] { return saveHistory([item, ...readHistory()]) }
export function clearStoredHistory(): void { try { storage()?.removeItem(HISTORY_KEY) } catch { /* Storage may be disabled by the browser. */ } }
function isHistoryItem(value: unknown): value is HistoryItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<HistoryItem>
  return typeof item.id === 'string' && typeof item.createdAt === 'number' && typeof item.prompt === 'string' && typeof item.resultUrl === 'string' && typeof item.thumbnailUrl === 'string'
}
