import { getClientId, getNickname } from './identity'
import type { ActivityItem, ClientSummary, ErrorBody, GenerateRequest, HealthResponse, JobAccepted, JobStatus, LearnRequest, LearnResponse, MentorOverview, PreprocessResponse, WorkshopStatus } from './types'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly retryAfterS?: number
  constructor(code: string, message: string, status = 0, retryAfterS?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.retryAfterS = retryAfterS
  }
}

export interface MentorApi {
  overview(pin: string): Promise<MentorOverview>
  activity(pin: string, sinceId?: number): Promise<ActivityItem[]>
  pause(pin: string, body: { paused: boolean; banner_message?: string }): Promise<WorkshopStatus>
  clearQueue(pin: string): Promise<{ cleared: number }>
  settings(pin: string, patch: { learn_enabled?: boolean; max_jobs_per_client?: number; banner_message?: string | null }): Promise<WorkshopStatus>
  blockClient(pin: string, body: { client_id: string; blocked: boolean }): Promise<ClientSummary>
}
export interface ApiClient {
  readonly mentor: MentorApi
  getHealth(): Promise<HealthResponse>
  getWorkshopStatus(): Promise<WorkshopStatus>
  previewPreprocess(input: { imageBlob: Blob; kind: 'drawing' | 'photo' }): Promise<PreprocessResponse>
  submitGenerate(req: GenerateRequest): Promise<JobAccepted>
  getJob(id: string): Promise<JobStatus>
  jobResultUrl(id: string): string
  cancelJob(id: string): Promise<{ cancelled: boolean }>
  fetchLearn(req: LearnRequest): Promise<LearnResponse>
  translatePrompt(text: string): Promise<{ text_en: string }>
}

async function request<T>(path: string, options: RequestInit = {}, mentorPin?: string): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('X-Client-Id', getClientId())
  const nickname = getNickname()
  if (nickname) headers.set('X-Nickname', nickname)
  if (mentorPin !== undefined) headers.set('X-Mentor-Pin', mentorPin)
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const body = isErrorPayload(payload) ? payload.error : null
    throw new ApiError(body?.code ?? 'NETWORK_ERROR', body?.message ?? `Request failed (${response.status})`, response.status, body?.retry_after_s ?? undefined)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function json(method: string, value?: unknown): RequestInit {
  return { method, ...(value === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) }
}
function isErrorPayload(value: unknown): value is { error: ErrorBody } {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = value.error
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && 'message' in error && typeof error.message === 'string'
}

const realMentor: MentorApi = {
  overview: (pin) => request('/mentor/overview', {}, pin),
  activity: (pin, sinceId = 0) => request(`/mentor/activity?since_id=${encodeURIComponent(sinceId)}`, {}, pin),
  pause: (pin, body) => request('/mentor/pause', json('POST', body), pin),
  clearQueue: (pin) => request('/mentor/clear-queue', json('POST'), pin),
  settings: (pin, patch) => request('/mentor/settings', json('POST', patch), pin),
  blockClient: (pin, body) => request('/mentor/block-client', json('POST', body), pin)
}
const realApi: ApiClient = {
  mentor: realMentor,
  getHealth: () => request('/health'),
  getWorkshopStatus: () => request('/workshop/status'),
  async previewPreprocess({ imageBlob, kind }) { return request('/preprocess', json('POST', { image_b64: await blobToB64(imageBlob), kind })) },
  submitGenerate: (body) => request('/generate', json('POST', body)),
  getJob: (id) => request(`/jobs/${encodeURIComponent(id)}`),
  jobResultUrl: (id) => `/api/jobs/${encodeURIComponent(id)}/result.png`,
  cancelJob: (id) => request(`/jobs/${encodeURIComponent(id)}/cancel`, json('POST')),
  fetchLearn: (body) => request('/learn', json('POST', body)),
  translatePrompt: (text) => request('/translate_prompt', json('POST', { text }))
}

export async function blobToB64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  return btoa(binary)
}

export const api: ApiClient = realApi
