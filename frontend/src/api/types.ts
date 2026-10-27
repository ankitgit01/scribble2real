export type Language = 'en' | 'hi'
export type Style = 'realistic' | 'cartoon' | 'watercolor' | 'blueprint'
export type JobState = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export interface ErrorBody { code: string; message: string; retry_after_s: number | null }
export interface WorkshopStatus {
  paused: boolean
  banner_message: string | null
  learn_enabled: boolean
  queue_length: number
  running: number
  avg_seconds_per_image: number | null
  supported_languages: Language[]
  max_jobs_per_client: number
  server_version: string
}
export interface GenerateRequest {
  line_map_png_b64: string
  line_map_is_raster?: boolean
  color_layer_png_b64?: string | null
  reference_png_b64?: string | null
  prompt?: string
  style: Style
  mode: 'fresh' | 'refine'
  quality: 'fast' | 'better'
  fidelity: number
  creativity: number
  seed?: number | null
}
export interface JobAccepted { job_id: string; status: JobState; queue_position: number }
export interface JobStatus {
  job_id: string
  status: JobState
  queue_position: number | null
  progress: number
  result_url: string | null
  seed_used: number | null
  elapsed_ms: number | null
  final_prompt: string | null
  color_words: string[]
  error: ErrorBody | null
}
export interface LearnRequest {
  scribble_png_b64: string
  context_png_b64?: string
  generated_png_b64?: string
  prompt?: string
  class_prompt?: string
  mode: 'fresh' | 'refine'
  language: Language
}
export interface LearnResponse {
  title: string
  what_it_is: string
  key_facts: string[]
  how_it_works_or_design_notes: string
  question_detected: boolean
  question_text: string | null
  answer: string | null
  related_topics: string[]
  confidence: 'high' | 'low'
  safety_flag: 'ok' | 'unsafe' | 'off_topic'
  suggested_prompt: string
  provider_used: string
  cached: boolean
}
export interface PreprocessResponse { cleaned_png_b64: string; width: number; height: number; notes: string[] }
export interface GpuStatus { name: string; vram_total_mb: number; vram_used_mb: number }
export interface HealthResponse { ok: boolean; model_loaded: boolean; gpu: GpuStatus | null; version: string }
export interface ActivityItem {
  id: number
  ts: number
  client_id: string
  nickname: string | null
  kind: 'generate' | 'learn' | 'blocked_prompt' | 'error'
  prompt: string | null
  status: string | null
  thumb_data_url: string | null
}
export interface LearnUsage { used: number; cap: number; last_provider: string | null }
export interface ClientSummary { client_id: string; nickname: string | null; jobs_total: number; blocked: boolean; last_seen_s_ago: number }
export interface MentorOverview {
  status: WorkshopStatus
  learn_usage: LearnUsage
  clients: ClientSummary[]
  lan_urls: string[]
  public_url: string | null
  gpu: GpuStatus | null
  activity: ActivityItem[]
}
export interface HistoryItem { id: string; createdAt: number; prompt: string; resultUrl: string; thumbnailUrl: string }
