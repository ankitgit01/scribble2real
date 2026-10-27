import type { Language } from '../api/types'

interface Dictionary { [key: string]: string | Dictionary }
type LocaleModule = { default: Dictionary }
const modules = import.meta.glob<LocaleModule>('./locales/*/*.json', { eager: true })
const dictionaries = new Map<string, Dictionary>()
for (const [path, module] of Object.entries(modules)) {
  const match = path.match(/\/locales\/([^/]+)\/([^/]+)\.json$/)
  if (match) dictionaries.set(`${match[1]}.${match[2]}`, module.default)
}
let activeLanguage: Language = 'en'
export function setLanguage(language: Language): void { activeLanguage = language }
export function getLanguage(): Language { return activeLanguage }
function lookup(dictionary: Dictionary | undefined, key: string): string | undefined {
  let current: string | Dictionary | undefined = dictionary
  for (const part of key.split('.')) {
    if (!current || typeof current === 'string') return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const separator = key.indexOf('.')
  const namespace = separator < 0 ? 'common' : key.slice(0, separator)
  const localKey = separator < 0 ? key : key.slice(separator + 1)
  const value = lookup(dictionaries.get(`${activeLanguage}.${namespace}`), localKey)
    ?? lookup(dictionaries.get(`en.${namespace}`), localKey)
  if (!value) return key
  return value.replace(/\{([A-Za-z0-9_]+)\}/g, (token, name: string) => String(vars[name] ?? token))
}
