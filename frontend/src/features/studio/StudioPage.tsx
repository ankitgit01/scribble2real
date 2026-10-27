import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock3, Keyboard, Moon, ShieldCheck, Sun, WandSparkles, X } from 'lucide-react'
import { getNickname, setNickname } from '../../api/identity'
import { useWorkshopPolling } from '../../state/workshopStore'
import { useGenerationStore } from '../../state/generationStore'
import CanvasPanel from '../canvas/CanvasPanel'
import UploadButton from '../upload/UploadButton'
import PromptBar from '../generate/PromptBar'
import LearnPanel from '../learn/LearnPanel'
import WorkshopBanner from './WorkshopBanner'
import PrivacyNotice from './PrivacyNotice'
import ErrorToast from './ErrorToast'
import LanguageToggle from './LanguageToggle'
import { t } from '../../i18n'
import { useCanvasShortcuts } from '../canvas/useCanvasShortcuts'

export default function StudioPage() {
  useWorkshopPolling()
  const [nickname, updateNickname] = useState(getNickname() ?? '')
  const [dark, setDark] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [learnOpen, setLearnOpen] = useState(false)
  const { helpOpen, setHelpOpen } = useCanvasShortcuts()
  const phase = useGenerationStore((state) => state.phase)
  const resultUrl = useGenerationStore((state) => state.resultUrl)
  const history = useGenerationStore((state) => state.history)
  const openHistory = useGenerationStore((state) => state.openHistory)
  const clearHistory = useGenerationStore((state) => state.clearHistory)
  const learn = useGenerationStore((state) => state.learn)
  const learnStatus = useGenerationStore((state) => state.learnStatus)
  const toggleAvailable = phase === 'done' && Boolean(resultUrl)

  useEffect(() => { if (toggleAvailable && (learn || learnStatus === 'done')) setLearnOpen(true) }, [toggleAvailable, learn, learnStatus])

  return <div className={`${dark ? 'dark' : ''} flex h-dvh min-h-[520px] flex-col overflow-hidden bg-amber-100 text-ink transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50`}>
    <header className="z-40 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur-lg sm:px-5 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-center gap-2"><Link to="/" className="group flex min-h-10 items-center gap-2 rounded-xl pr-1 text-lg font-bold tracking-tight text-ink transition-all duration-300 hover:text-brand dark:text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white shadow-sm transition-transform duration-300 group-hover:-rotate-6 dark:bg-brand"><WandSparkles size={18} /></span><span className="hidden sm:inline">Scribble<span className="text-brand">2</span>Real</span></Link><div className="relative"><button type="button" aria-expanded={helpOpen} aria-label={t('canvas-tools.shortcutHelp')} onClick={() => setHelpOpen(!helpOpen)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition-all duration-300 hover:bg-slate-100 hover:text-brand dark:text-slate-300 dark:hover:bg-slate-800"><Keyboard size={17} /></button>{helpOpen && <div role="dialog" aria-label={t('canvas-tools.shortcutHelp')} className="absolute left-0 top-11 z-50 w-72 rounded-2xl border border-white/70 bg-white/95 p-4 text-sm shadow-xl backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/95"><h3 className="font-semibold">{t('canvas-tools.keyboardShortcuts')}</h3><p className="mt-2 leading-relaxed">{t('canvas-tools.shortcutList')}</p><button type="button" onClick={() => setHelpOpen(false)} className="mt-3 min-h-9 text-brand underline">{t('canvas-tools.close')}</button></div>}</div></div>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {/* <button type="button" role="switch" aria-checked={autoGenerate} onClick={() => setField('autoGenerate', !autoGenerate)} title="Update after I pause drawing" className={`flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-medium transition-all duration-300 sm:px-3 sm:text-sm ${autoGenerate ? 'bg-brand-soft text-brand-dark dark:bg-blue-950 dark:text-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}><Sparkles size={15} /><span className="hidden md:inline">Auto update</span><span aria-hidden="true" className={`relative h-4 w-7 rounded-full transition-colors ${autoGenerate ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'}`}><span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${autoGenerate ? 'translate-x-3' : ''}`} /></span></button> */}
        <label className="sr-only" htmlFor="nickname">{t('common.nickname')}</label>
        <input id="nickname" value={nickname} maxLength={20} placeholder={t('common.nicknameOptional')} onChange={(event) => { const next = event.target.value.slice(0, 20); updateNickname(next); setNickname(next) }} className="hidden h-9 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-all duration-300 focus:border-brand focus:ring-2 focus:ring-brand/15 sm:block dark:border-slate-700 dark:bg-slate-800" />
        <LanguageToggle />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition-all duration-300 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setDark((value) => !value)} aria-label={dark ? t('common.lightTheme') : t('common.darkTheme')} title={dark ? t('common.lightTheme') : t('common.darkTheme')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button type="button" onClick={() => setPrivacyOpen(true)} className="hidden h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-slate-600 transition-all duration-300 hover:bg-slate-100 sm:flex dark:text-slate-300 dark:hover:bg-slate-800"><ShieldCheck size={16} />{t('common.privacyLink')}</button>
        <Link to="/mentor" className="flex h-9 items-center rounded-xl bg-ink px-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-brand dark:bg-brand">{t('common.mentor')}</Link>
      </div>
    </header>
    <div className="z-30 shrink-0"><WorkshopBanner /></div>
    <main className="relative flex min-h-0 flex-1 overflow-hidden" aria-label={t('common.drawingWorkspace')}>
      <aside className={`absolute inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/70 bg-white/95 shadow-xl backdrop-blur-xl transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900/95 ${historyOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Recent creations">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800"><div className="flex items-center gap-2 font-semibold"><Clock3 size={17} className="text-brand" />Recent creations</div><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close recent creations" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17} /></button></div>
        {history.length ? <><div className="flex-1 space-y-2 overflow-y-auto p-3">{history.map((item) => <button key={item.id} type="button" onClick={() => { void openHistory(item); setHistoryOpen(false) }} title={item.prompt || 'Open creation'} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-300 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand dark:hover:bg-slate-800"><img src={item.thumbnailUrl || item.resultUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-slate-100 object-cover" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.prompt || 'Untitled creation'}</span><span className="mt-1 block text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</span></span></button>)}</div><button type="button" onClick={clearHistory} className="m-3 min-h-10 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Clear history</button></> : <p className="p-5 text-sm leading-relaxed text-slate-500">Your creations will appear here after you make one.</p>}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 transition-all duration-300">
        <section className="flex min-h-0 min-w-0 flex-1" aria-label={t('common.drawingWorkspace')}><CanvasPanel historyOpen={historyOpen} onToggleHistory={() => setHistoryOpen((open) => !open)} /></section>
        <aside className={`relative min-h-0 shrink-0 overflow-hidden border-l border-amber-200/80 bg-amber-50/95 transition-[width] duration-300 ease-out dark:border-slate-800 dark:bg-slate-900 ${toggleAvailable && learnOpen ? 'w-80 xl:w-[22rem]' : toggleAvailable ? 'w-7' : 'w-0 border-l-0'}`} aria-label={t('learn.heading')}>
          {toggleAvailable && <><button type="button" onClick={() => setLearnOpen(false)} aria-label="Collapse Learn panel" className="absolute left-0 top-1/2 z-10 grid h-16 w-7 -translate-x-full -translate-y-1/2 place-items-center rounded-l-xl border border-r-0 border-amber-200 bg-white/90 text-brand shadow-lg dark:border-slate-700 dark:bg-slate-900"><ChevronRight size={18} /></button><div className="h-full w-80 overflow-y-auto p-3 xl:w-[22rem]"><div className="mb-3 flex items-center justify-between px-1"><h2 className="font-semibold">Learn from your sketch</h2><button type="button" onClick={() => setLearnOpen(false)} aria-label="Close Learn panel" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-amber-100 dark:hover:bg-slate-800"><X size={16} /></button></div><LearnPanel /></div></>}
          {toggleAvailable && !learnOpen && <button type="button" onClick={() => setLearnOpen(true)} aria-label="Expand Learn panel" className="absolute inset-y-0 left-0 z-10 grid w-7 place-items-center border-l border-amber-200 bg-white/90 text-brand shadow-lg dark:border-slate-700 dark:bg-slate-900"><ChevronLeft size={18} /><span className="sr-only">Learn</span></button>}
        </aside>
      </div>
      <aside className="z-20 flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-amber-200/80 bg-white/90 p-3 transition-all duration-300 lg:w-80 dark:border-slate-800 dark:bg-slate-900/70" aria-label="Make it yours">
        <div className="rounded-2xl border border-white/80 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><UploadButton /></div>
        <PromptBar />
      </aside>
    </main>
    <PrivacyNotice open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    <ErrorToast />
  </div>
}
