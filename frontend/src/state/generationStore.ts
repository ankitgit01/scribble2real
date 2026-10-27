import { create } from 'zustand'
import type { ErrorBody, HistoryItem, LearnResponse } from '../api/types'
import { acceptResultFlow, cancelMagicFlow, clearMagicHistory, openHistoryFlow, runMagicFlow, sketchOverFlow, variationFlow } from '../features/generate/runMagic'
import { readHistory } from '../features/generate/historyStorage'
export type GenerationPhase = 'idle' | 'preparing' | 'queued' | 'running' | 'done' | 'error'
export type GenerationStatus = 'idle' | 'analyzing' | 'generating' | 'done' | 'error'
export type LearnStatus = 'idle' | 'loading' | 'done' | 'error' | 'disabled'
export interface GenerationState {
  phase: GenerationPhase; status: GenerationStatus; jobId: string | null; queuePosition: number | null; progress: number; beforeUrl: string | null; resultUrl: string | null; resultBlob: Blob | null; interpretedPrompt: string; learn: LearnResponse | null; learnStatus: LearnStatus; error: ErrorBody | null; history: HistoryItem[]; mode: 'fresh' | 'refine'
  runMagic(): void; cancel(): void; variation(): void; sketchOver(): Promise<void>; acceptResult(): Promise<void>; dismissResult(): void; clearHistory(): void; setPhase(phase: GenerationPhase): void; setInterpretedPrompt(prompt: string): void; openHistory(item: HistoryItem): Promise<void>
}
export const useGenerationStore = create<GenerationState>((set) => ({
  phase: 'idle', status: 'idle', jobId: null, queuePosition: null, progress: 0, beforeUrl: null, resultUrl: null, resultBlob: null, interpretedPrompt: '', learn: null, learnStatus: 'idle', error: null, history: readHistory(), mode: 'fresh',
  runMagic: () => { void runMagicFlow() },
  cancel: () => { void cancelMagicFlow() },
  variation: () => { void variationFlow() },
  sketchOver: () => sketchOverFlow(),
  acceptResult: async () => {
    try { await acceptResultFlow() }
    catch (error) { set({ error: { code: 'ACCEPT_FAILED', message: error instanceof Error ? error.message : 'Could not accept this image.', retry_after_s: null } }) }
  },
  dismissResult: () => set({ phase: 'idle', status: 'idle', jobId: null, queuePosition: null, progress: 0, beforeUrl: null, resultUrl: null, resultBlob: null, error: null, mode: 'fresh' }),
  clearHistory: () => { clearMagicHistory(); set({ history: [] }) },
  setPhase: (phase) => set({ phase }),
  setInterpretedPrompt: (interpretedPrompt) => set({ interpretedPrompt }),
  openHistory: async (item) => {
    try { await openHistoryFlow(item) }
    catch (error) { set({ phase: 'error', error: { code: 'HISTORY_LOAD_FAILED', message: error instanceof Error ? error.message : 'Could not load this creation.', retry_after_s: null } }) }
  }
}))
