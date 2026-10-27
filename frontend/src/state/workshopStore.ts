import { create } from 'zustand'
import { useEffect } from 'react'
import { api } from '../api/client'
import type { WorkshopStatus } from '../api/types'

interface WorkshopState { status: WorkshopStatus | null; lastError: string | null; setStatus(status: WorkshopStatus | null): void; setError(error: string | null): void }
export const useWorkshopStore = create<WorkshopState>((set) => ({ status: null, lastError: null, setStatus: (status) => set({ status, lastError: null }), setError: (lastError) => set({ lastError }) }))
export function useWorkshopPolling(): void {
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try { const status = await api.getWorkshopStatus(); if (active) useWorkshopStore.getState().setStatus(status) }
      catch (error) { if (active) useWorkshopStore.getState().setError(error instanceof Error ? error.message : 'Unable to reach the server') }
      finally { if (active) timer = setTimeout(() => { void poll() }, 5000) }
    }
    void poll()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [])
}
