import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ hasLineContent: vi.fn(), exportLineMapPNG: vi.fn(), exportColorLayerPNG: vi.fn(), exportCompositePNG: vi.fn(), onContentChange: vi.fn(), submitGenerate: vi.fn(), fetchLearn: vi.fn(), getJob: vi.fn(), jobResultUrl: vi.fn(), getCanvasApi: vi.fn() }))
vi.mock('../../canvas/canvasApi', () => ({ getCanvasApi: mocks.getCanvasApi }))
vi.mock('../../../api/client', () => ({ api: { submitGenerate: mocks.submitGenerate, fetchLearn: mocks.fetchLearn, getJob: mocks.getJob, jobResultUrl: mocks.jobResultUrl, translatePrompt: vi.fn() }, ApiError: class ApiError extends Error { code = 'GENERATION_FAILED'; retryAfterS?: number } , blobToB64: async () => 'aW1hZ2U=' }))
import { runMagicFlow } from '../runMagic'
import { useGenerationStore } from '../../../state/generationStore'
import { useSettingsStore } from '../../../state/settingsStore'

describe('Magic flow guards and learn fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGenerationStore.setState({ phase: 'idle', status: 'idle', jobId: null, queuePosition: null, progress: 0, beforeUrl: null, resultUrl: null, resultBlob: null, interpretedPrompt: '', learn: null, learnStatus: 'idle', error: null, history: [], mode: 'fresh' })
    useSettingsStore.setState({ prompt: '', style: 'cartoon', quality: 'fast', fidelity: 0.8, creativity: 0.5, language: 'en', autoGenerate: false } as never)
    mocks.getCanvasApi.mockReturnValue({ hasLineContent: mocks.hasLineContent, exportLineMapPNG: mocks.exportLineMapPNG, exportColorLayerPNG: mocks.exportColorLayerPNG, exportCompositePNG: mocks.exportCompositePNG })
    mocks.hasLineContent.mockReturnValue(false)
  })
  it('shows a friendly empty-sketch error without sending a request', async () => {
    await runMagicFlow()
    expect(mocks.submitGenerate).not.toHaveBeenCalled()
    expect(useGenerationStore.getState().error?.code).toBe('EMPTY_SKETCH')
  })
  it('uses Learn suggestions and polls until the job is cancelled', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:before'), revokeObjectURL: vi.fn() })
    mocks.hasLineContent.mockReturnValue(true)
    mocks.exportLineMapPNG.mockResolvedValue(new Blob(['line']))
    mocks.exportColorLayerPNG.mockResolvedValue(new Blob(['color']))
    mocks.exportCompositePNG.mockResolvedValue(new Blob(['before']))
    mocks.fetchLearn.mockResolvedValue({ question_detected: false, question_text: null, answer: null, what_it_is: 'A kite sketch', improvements: [], related_topics: [], how_it_works: null, key_facts: [], sketch_suggestions: [], tags: [], safety_flag: 'ok', suggested_prompt: 'A bright kite in the sky', interpreted_prompt: 'A bright kite in the sky' })
    mocks.submitGenerate.mockResolvedValue({ job_id: 'job-1', status: 'queued', queue_position: 1 })
    mocks.getJob.mockResolvedValue({ job_id: 'job-1', status: 'cancelled', progress: 0 })
    await runMagicFlow()
    expect(mocks.submitGenerate).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'A bright kite in the sky' }))
    expect(useGenerationStore.getState().learnStatus).toBe('done')
    expect(useGenerationStore.getState().phase).toBe('idle')
    vi.unstubAllGlobals()
  })
})
