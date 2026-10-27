import { beforeEach, describe, expect, it } from 'vitest'
import { addHistoryItem, clearStoredHistory, HISTORY_KEY, HISTORY_LIMIT, readHistory } from '../historyStorage'

function item(id: number) { return { id: String(id), createdAt: id, prompt: `Scene ${id}`, resultUrl: `/result/${id}.png`, thumbnailUrl: `data:image/jpeg;base64,${id}` } }
describe('generation history storage', () => {
  beforeEach(() => { localStorage.clear() })
  it('keeps the newest eight records', () => {
    for (let id = 1; id <= HISTORY_LIMIT + 2; id += 1) addHistoryItem(item(id))
    expect(readHistory()).toHaveLength(HISTORY_LIMIT)
    expect(readHistory()[0].id).toBe('10')
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')).toHaveLength(HISTORY_LIMIT)
  })
  it('clears the stored records', () => { addHistoryItem(item(1)); clearStoredHistory(); expect(readHistory()).toEqual([]) })
})
