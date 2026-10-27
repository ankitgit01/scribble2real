import { t } from '../../i18n'
import { useCanvasStore } from './canvasStore'
const swatches = ['#111827', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899']
export default function ColorPalette() {
  const color = useCanvasStore((state) => state.color)
  const recent = useCanvasStore((state) => state.recentColors)
  const setColor = useCanvasStore((state) => state.setColor)
  return <div className="flex flex-col gap-2" aria-label={t('canvas-tools.palette')}>
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('canvas-tools.palette')}>
      {swatches.map((swatch) => <button key={swatch} type="button" title={swatch} aria-label={`${t('canvas-tools.chooseColor')} ${swatch}`} aria-pressed={color.toLowerCase() === swatch} onClick={() => setColor(swatch)} className={`h-8 w-8 rounded-full border-2 ${color.toLowerCase() === swatch ? 'border-brand ring-2 ring-brand/30' : 'border-white shadow-sm'}`} style={{ backgroundColor: swatch }} />)}
    </div>
    {recent.length > 0 && <div className="flex items-center gap-1.5" aria-label={t('canvas-tools.recentColors')}><span className="mr-1 text-xs text-ink-soft">{t('canvas-tools.recent')}</span>{recent.slice(0, 5).map((swatch, index) => <button key={`${swatch}-${index}`} type="button" title={swatch} aria-label={`${t('canvas-tools.chooseColor')} ${swatch}`} onClick={() => setColor(swatch)} className="h-6 w-6 rounded-full border border-slate-300" style={{ backgroundColor: swatch }} />)}</div>}
    <label className="flex items-center gap-2 text-sm"><span>{t('canvas-tools.customColor')}</span><input aria-label={t('canvas-tools.customColor')} type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
  </div>
}
