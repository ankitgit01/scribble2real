import { describe, expect, it } from 'vitest'
import { mergeActivity } from '../MentorPage'
import type { ActivityItem } from '../../../api/types'

function activity(id: number): ActivityItem { return { id, ts: id, client_id: 'student', nickname: null, kind: 'generate', prompt: `Picture ${id}`, status: 'done', thumb_data_url: null } }
describe('mentor activity feed data', () => {
  it('deduplicates updates and keeps the newest twenty items', () => {
    const merged = mergeActivity([activity(1), activity(25)], [activity(25), ...Array.from({ length: 24 }, (_, index) => activity(index + 3))])
    expect(merged).toHaveLength(20)
    expect(merged[0].id).toBe(26)
    expect(merged.filter((item) => item.id === 25)).toHaveLength(1)
  })
})
