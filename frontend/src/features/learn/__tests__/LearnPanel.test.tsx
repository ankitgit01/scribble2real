import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import LearnPanel from '../LearnPanel'
import { useGenerationStore } from '../../../state/generationStore'
import type { LearnResponse } from '../../../api/types'

const learn: LearnResponse = {
  title: 'A paper kite', what_it_is: 'A kite catches moving air.', key_facts: ['Air provides lift.'],
  how_it_works_or_design_notes: 'Its tail helps it stay steady.', question_detected: true,
  question_text: 'How does it fly?', answer: 'Air moving over the kite creates lift.', related_topics: ['Wind'],
  confidence: 'high', safety_flag: 'ok', suggested_prompt: 'A bright paper kite', provider_used: 'mock', cached: false
}
describe('LearnPanel', () => {
  it('shows the hint, answer and facts in the matching states', () => {
    useGenerationStore.setState({ learnStatus: 'idle', learn: null })
    const view = render(<LearnPanel />)
    expect(screen.getByText(/spark a question/i)).toBeTruthy()
    view.rerender(<LearnPanel />)
    useGenerationStore.setState({ learnStatus: 'done', learn })
    view.rerender(<LearnPanel />)
    expect(screen.getByText(/How does it fly\?/)).toBeTruthy()
    expect(screen.getByText('Air provides lift.')).toBeTruthy()
    useGenerationStore.setState({ learnStatus: 'disabled', learn: null })
    view.rerender(<LearnPanel />)
    expect(screen.getByText(/mentor turned explanations off/i)).toBeTruthy()
  })
  it('hides facts for unsafe content', () => {
    useGenerationStore.setState({ learnStatus: 'done', learn: { ...learn, safety_flag: 'unsafe' } })
    render(<LearnPanel />)
    expect(screen.queryByText('Air provides lift.')).toBeNull()
  })
})
