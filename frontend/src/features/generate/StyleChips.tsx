import type { Style } from '../../api/types'
import { t } from '../../i18n'
import { useSettingsStore } from '../../state/settingsStore'
const styles: Style[] = ['realistic', 'cartoon', 'watercolor', 'blueprint']
export default function StyleChips() {
  const style = useSettingsStore((state) => state.style)
  const setField = useSettingsStore((state) => state.setField)
  return <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('generate.styles')}>
    {styles.map((value) => <button key={value} type="button" aria-pressed={style === value} onClick={() => setField('style', value)} className={`min-h-10 rounded-xl border px-3 text-sm font-medium transition-all duration-200 ${style === value ? 'border-brand bg-brand-soft text-brand-dark shadow-sm ring-1 ring-brand/20 dark:bg-blue-950 dark:text-blue-200' : 'border-slate-200 bg-white hover:border-brand/50 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'}`}>{t(`generate.styleNames.${value}`)}</button>)}
  </div>
}
