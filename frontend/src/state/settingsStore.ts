import { create } from 'zustand'
import type { Language, Style } from '../api/types'
import { setLanguage } from '../i18n'

export interface SettingsState {
  prompt: string; style: Style; quality: 'fast' | 'better'; fidelity: number; creativity: number; autoGenerate: boolean; language: Language
  setField<K extends keyof Omit<SettingsState, 'setField'>>(field: K, value: SettingsState[K]): void
}
const storedLanguage: Language = typeof localStorage !== 'undefined' && localStorage.getItem('s2r.language') === 'hi' ? 'hi' : 'en'
setLanguage(storedLanguage)
export const useSettingsStore = create<SettingsState>((set) => ({
  prompt: '', style: 'realistic', quality: 'fast', fidelity: 0.8, creativity: 0.5, autoGenerate: false, language: storedLanguage,
  setField: (field, value) => {
    if (field === 'language') {
      const language = value as Language
      setLanguage(language)
      try { localStorage.setItem('s2r.language', language) } catch { /* Storage can be unavailable in private contexts. */ }
    }
    set({ [field]: value } as Pick<SettingsState, typeof field>)
  }
}))
