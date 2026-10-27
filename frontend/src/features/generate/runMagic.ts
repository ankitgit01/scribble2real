import { ApiError, api, blobToB64 } from '../../api/client'
import type { ErrorBody, GenerateRequest, HistoryItem, JobStatus, LearnResponse } from '../../api/types'
import { getCanvasApi } from '../canvas/canvasApi'
import { useSettingsStore } from '../../state/settingsStore'
import { useWorkshopStore } from '../../state/workshopStore'
import { useGenerationStore } from '../../state/generationStore'
import { addHistoryItem, clearStoredHistory } from './historyStorage'
import { clearResultImages, readResultImage, saveResultImage } from './imageStorage'

const GENERIC_PROMPT = 'A clear, colorful image based on this student drawing'
let activeController: AbortController | null = null
let lastRequest: GenerateRequest | null = null
let lastPrompt = ''

function releaseObjectUrl(url: string | null): void { if (url?.startsWith('blob:')) URL.revokeObjectURL(url) }
function randomSeed(): number { const values = new Uint32Array(1); crypto.getRandomValues(values); return values[0] & 0x7fffffff }
function errorBody(error: unknown): ErrorBody {
  if (error instanceof ApiError) return { code: error.code, message: error.message, retry_after_s: error.retryAfterS ?? null }
  return { code: 'GENERATION_FAILED', message: error instanceof Error ? error.message : 'Image generation failed.', retry_after_s: null }
}
function isTerminal(status: JobStatus['status']): boolean { return status === 'done' || status === 'error' || status === 'cancelled' }
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return }
    const timer = setTimeout(done, ms)
    function done() { clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
    signal.addEventListener('abort', done, { once: true })
  })
}
async function learnForSketch(lineB64: string, contextB64: string | null, prompt: string, mode: 'fresh' | 'refine', signal: AbortSignal): Promise<LearnResponse | null> {
  const enabled = useWorkshopStore.getState().status?.learn_enabled !== false
  if (!enabled) { useGenerationStore.setState({ learnStatus: 'disabled', learn: null }); return null }
  useGenerationStore.setState({ learnStatus: 'loading', learn: null })
  try {
    const classPrompt = useWorkshopStore.getState().status?.banner_message?.trim() ?? ''
    const response = await api.fetchLearn({ scribble_png_b64: lineB64, ...(contextB64 ? { context_png_b64: contextB64 } : {}), prompt, class_prompt: classPrompt, mode, language: useSettingsStore.getState().language })
    if (!signal.aborted) useGenerationStore.setState({ learn: response, learnStatus: 'done' })
    return response
  } catch (error) {
    if (!signal.aborted) useGenerationStore.setState({ learnStatus: error instanceof ApiError && error.code === 'LEARN_DISABLED' ? 'disabled' : 'error', learn: null })
    return null
  }
}
async function makeThumbnail(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160
    const context = canvas.getContext('2d')
    if (!context) return ''
    context.fillStyle = '#fff'; context.fillRect(0, 0, 160, 160)
    const scale = Math.min(160 / bitmap.width, 160 / bitmap.height)
    const width = bitmap.width * scale; const height = bitmap.height * scale
    context.drawImage(bitmap, (160 - width) / 2, (160 - height) / 2, width, height)
    return canvas.toDataURL('image/jpeg', 0.72)
  } finally { bitmap.close() }
}
async function startJob(request: GenerateRequest, beforeUrl: string, signal: AbortSignal): Promise<void> {
  const accepted = await api.submitGenerate(request)
  if (signal.aborted) {
    try { await api.cancelJob(accepted.job_id) } catch { /* The request may already have completed. */ }
    return
  }
  useGenerationStore.setState({ jobId: accepted.job_id, phase: accepted.status === 'queued' ? 'queued' : 'running', queuePosition: accepted.queue_position, progress: 0, error: null })
  let wait = 700
  while (!signal.aborted) {
    const status = await api.getJob(accepted.job_id)
    if (signal.aborted) return
    useGenerationStore.setState({
      jobId: status.job_id,
      phase: status.status === 'queued' ? 'queued' : status.status === 'running' ? 'running' : status.status === 'done' ? 'done' : status.status === 'cancelled' ? 'idle' : 'error',
      queuePosition: status.queue_position,
      progress: Math.max(useGenerationStore.getState().progress, status.progress),
      error: status.error
    })
    if (isTerminal(status.status)) {
      if (status.status === 'done') {
        const resultHref = status.result_url ?? api.jobResultUrl(accepted.job_id)
        const response = await fetch(resultHref, { signal })
        if (!response.ok) throw new ApiError('JOB_NOT_FOUND', 'The finished image could not be downloaded.', response.status)
        const blob = await response.blob()
        try { await saveResultImage(accepted.job_id, blob) } catch { /* The active result remains available even if browser storage is full. */ }
        const resultUrl = URL.createObjectURL(blob)
        const thumbnailUrl = await makeThumbnail(blob).catch(() => '')
        const item: HistoryItem = { id: accepted.job_id, createdAt: Date.now(), prompt: status.final_prompt ?? request.prompt ?? lastPrompt, resultUrl: api.jobResultUrl(accepted.job_id), thumbnailUrl }
        const history = addHistoryItem(item)
        if (!signal.aborted) useGenerationStore.setState({ phase: 'done', status: 'done', resultBlob: blob, resultUrl, beforeUrl, interpretedPrompt: item.prompt, history, error: null })
      } else if (status.status === 'error') {
        useGenerationStore.setState({ phase: 'error', status: 'error', error: status.error ?? { code: 'GENERATION_FAILED', message: 'Image generation failed.', retry_after_s: null } })
      } else {
        useGenerationStore.setState({ phase: 'idle', status: 'idle', error: { code: 'CANCELLED', message: 'Image request cancelled.', retry_after_s: null } })
      }
      return
    }
    await sleep(wait, signal)
    wait = Math.min(1200, wait + 100)
  }
}

export async function runMagicFlow(options: { variation?: boolean } = {}): Promise<void> {
  const current = useGenerationStore.getState()
  if (activeController || ['preparing', 'queued', 'running'].includes(current.phase)) return
  const canvas = getCanvasApi()
  const canRepeat = options.variation && lastRequest !== null
  if (!canvas || (!canRepeat && !canvas.hasLineContent())) {
    useGenerationStore.setState({ phase: 'error', status: 'error', error: { code: 'EMPTY_SKETCH', message: 'Add a few lines to your canvas first, then tap Magic.', retry_after_s: null } })
    return
  }
  const controller = new AbortController(); activeController = controller
  const { signal } = controller
  const store = useGenerationStore.getState()
  const settings = useSettingsStore.getState()
  releaseObjectUrl(store.resultUrl)
  if (!canRepeat) releaseObjectUrl(store.beforeUrl)
  useGenerationStore.setState({ phase: 'preparing', status: 'analyzing', error: null, progress: 0, jobId: null, queuePosition: null, resultUrl: null, resultBlob: null, beforeUrl: canRepeat ? store.beforeUrl : null, ...(options.variation ? {} : { learn: null, learnStatus: 'idle' }) })
  try {
    const lineBlob = await canvas.exportLineMapPNG()
    const colorBlob = canRepeat ? null : await canvas.exportColorLayerPNG()
    const referenceBlob = !canRepeat && store.mode === 'refine' ? await canvas.exportReferencePNG() : null
    if (store.mode === 'refine' && !referenceBlob && !options.variation) throw new ApiError('BAD_INPUT', 'Sketch over a result before starting a variation.')
    const beforeBlob = canRepeat && store.beforeUrl ? null : await canvas.exportCompositePNG()
    const beforeUrl = canRepeat && store.beforeUrl ? store.beforeUrl : URL.createObjectURL(beforeBlob!)
    if (beforeUrl !== store.beforeUrl) releaseObjectUrl(store.beforeUrl)
    if (store.resultUrl !== beforeUrl) releaseObjectUrl(store.resultUrl)
    const lineB64 = canRepeat && lastRequest ? lastRequest.line_map_png_b64 : await blobToB64(lineBlob)
    const contextB64 = beforeBlob ? await blobToB64(beforeBlob) : null
    const baseRequest: GenerateRequest = canRepeat && lastRequest ? { ...lastRequest, seed: randomSeed() } : {
      line_map_png_b64: lineB64,
      line_map_is_raster: !canRepeat && (canvas.hasRasterBaseline?.() ?? false),
      color_layer_png_b64: colorBlob ? await blobToB64(colorBlob) : null,
      reference_png_b64: referenceBlob ? await blobToB64(referenceBlob) : null,
      prompt: settings.prompt.trim(), style: settings.style, mode: store.mode, quality: settings.quality, fidelity: settings.fidelity, creativity: settings.creativity
    }
    const rawPrompt = options.variation ? lastPrompt.trim() : settings.prompt.trim()
    // Analyze the sketch before every generation. The learner's explanation is
    // stored for the Learn panel; only its suggested prompt is sent to imaging.
    const learn = await learnForSketch(lineB64, contextB64, rawPrompt, store.mode, signal)
    if (signal.aborted) return
    // Safety labels are no longer requested from the explanation provider.
    // Keep this fallback for cached responses created by older backend versions.
    const prompt = learn?.safety_flag === 'ok'
      ? learn.suggested_prompt.trim() || rawPrompt || GENERIC_PROMPT
      : rawPrompt || GENERIC_PROMPT
    useGenerationStore.setState({ status: 'generating', interpretedPrompt: prompt })
    let translatedPrompt = prompt
    if (settings.language === 'hi' || /[\u0900-\u097f]/u.test(prompt)) {
      try { const result = await api.translatePrompt(prompt); if (result.text_en.trim()) translatedPrompt = result.text_en.trim() } catch { /* Hindi translation stays an optional Phase 14 hook. */ }
    }
    if (signal.aborted) return
    const request: GenerateRequest = { ...baseRequest, prompt: translatedPrompt }
    if (options.variation) request.seed = randomSeed()
    lastRequest = request; lastPrompt = prompt
    await startJob(request, beforeUrl, signal)
  } catch (error) {
    if (!signal.aborted) useGenerationStore.setState({ phase: 'error', status: 'error', error: errorBody(error) })
  } finally {
    if (activeController === controller) activeController = null
  }
}

export async function cancelMagicFlow(): Promise<void> {
  const state = useGenerationStore.getState()
  const jobId = state.jobId
  activeController?.abort(); activeController = null
  if (jobId) { try { await api.cancelJob(jobId) } catch { /* A completed or expired job needs no further action. */ } }
  useGenerationStore.setState({ phase: 'idle', status: 'idle', queuePosition: null, progress: 0, jobId: null, error: null })
}
export async function variationFlow(): Promise<void> { if (lastRequest) await runMagicFlow({ variation: true }) }
export async function sketchOverFlow(): Promise<void> {
  const state = useGenerationStore.getState()
  let result = state.resultBlob
  if (!result && state.resultUrl) {
    const response = await fetch(state.resultUrl)
    if (!response.ok) return
    result = await response.blob()
    useGenerationStore.setState({ resultBlob: result })
  }
  if (!result) return
  const canvas = getCanvasApi()
  if (!canvas) return
  await canvas.setReference(result)
  canvas.clearLineLayer()
  useGenerationStore.setState({ mode: 'refine' })
  useSettingsStore.getState().setField('prompt', state.interpretedPrompt)
}
export async function acceptResultFlow(): Promise<void> {
  const state = useGenerationStore.getState()
  const canvas = getCanvasApi()
  if (!canvas || (!state.resultBlob && !state.resultUrl)) return
  let blob = state.resultBlob
  if (!blob) {
    const response = await fetch(state.resultUrl!)
    if (!response.ok) throw new Error('The generated image could not be loaded. Please generate it again.')
    blob = await response.blob()
  }
  await canvas.replaceCanvasWithImage(blob)
  releaseObjectUrl(state.resultUrl)
  releaseObjectUrl(state.beforeUrl)
  useGenerationStore.setState({ phase: 'idle', status: 'idle', jobId: null, queuePosition: null, progress: 0, beforeUrl: null, resultUrl: null, resultBlob: null, mode: 'fresh', error: null })
}
export async function openHistoryFlow(item: HistoryItem): Promise<void> {
  const current = useGenerationStore.getState()
  if (['preparing', 'queued', 'running'].includes(current.phase)) await cancelMagicFlow()
  const canvas = getCanvasApi()
  if (!canvas) throw new Error('The drawing canvas is not ready yet.')
  let blob: Blob | null = null
  try { blob = await readResultImage(item.id) } catch { /* Continue with the retained server image below. */ }
  if (!blob) try {
    const response = await fetch(item.resultUrl)
    if (!response.ok) throw new Error('The image is no longer available.')
    blob = await response.blob()
  } catch {
    const response = await fetch(item.thumbnailUrl)
    if (!response.ok) throw new Error('This saved image could not be loaded.')
    blob = await response.blob()
  }
  await canvas.replaceCanvasWithImage(blob)
  const state = useGenerationStore.getState()
  releaseObjectUrl(state.resultUrl); releaseObjectUrl(state.beforeUrl)
  useSettingsStore.getState().setField('prompt', item.prompt)
  useGenerationStore.setState({ phase: 'idle', status: 'idle', jobId: null, queuePosition: null, progress: 0, beforeUrl: null, resultUrl: null, resultBlob: null, interpretedPrompt: item.prompt, error: null, mode: 'fresh', learn: null, learnStatus: 'idle' })
}
export function clearMagicHistory(): void { clearStoredHistory(); void clearResultImages() }
export function stopMagicPolling(): void {
  const jobId = useGenerationStore.getState().jobId
  activeController?.abort()
  activeController = null
  if (jobId) void api.cancelJob(jobId).catch(() => undefined)
  const state = useGenerationStore.getState()
  if (['preparing', 'queued', 'running'].includes(state.phase)) useGenerationStore.setState({ phase: 'idle', status: 'idle', jobId: null, queuePosition: null, progress: 0 })
}
