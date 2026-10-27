import { t } from '../../i18n'
import { useGenerationStore } from '../../state/generationStore'
import AnswerCard from './AnswerCard'
import KeyFacts from './KeyFacts'
import LearnSkeleton from './LearnSkeleton'
import SafetyNotice from './SafetyNotice'
import TypewriterText from './TypewriterText'
export default function LearnPanel() {
  const learn = useGenerationStore((state) => state.learn)
  const status = useGenerationStore((state) => state.learnStatus)
  return <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="learn-heading">
    <h2 id="learn-heading" className="mb-3 font-semibold">{t('learn.heading')}</h2>
    {status === 'idle' && <p className="rounded-xl bg-surface-alt p-4 text-sm leading-relaxed text-ink-soft dark:bg-slate-800">{t('learn.idleHint')}</p>}
    {status === 'loading' && <LearnSkeleton />}
    {status === 'error' && <p role="status" className="rounded-xl bg-surface-alt p-4 text-sm leading-relaxed dark:bg-slate-800">{t('learn.error')}</p>}
    {status === 'disabled' && <p role="status" className="rounded-xl bg-surface-alt p-4 text-sm leading-relaxed dark:bg-slate-800">{t('learn.disabled')}</p>}
    {status === 'done' && learn && <div className="space-y-4">
        {learn.question_detected && <AnswerCard question={learn.question_text} answer={learn.answer} />}
      {learn.safety_flag !== 'ok' ? <><SafetyNotice flag={learn.safety_flag} /><p className="leading-relaxed"><TypewriterText text={learn.what_it_is} delay={80} /></p></> : <>
        {learn.confidence === 'low' && <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-950">{t('learn.lowConfidence')}</p>}
        <section><h3 className="text-lg font-semibold"><TypewriterText text={learn.title} delay={80} /></h3><p className="mt-1 leading-relaxed"><TypewriterText text={learn.what_it_is} delay={250} /></p></section>
        {learn.confidence === 'low' && <p className="text-sm text-ink-soft">{t('learn.addDetail')}</p>}
        <KeyFacts facts={learn.key_facts} />
        {learn.how_it_works_or_design_notes && <section><h3 className="font-semibold">{t('learn.howItWorks')}</h3><p className="mt-1 leading-relaxed"><TypewriterText text={learn.how_it_works_or_design_notes} delay={500} /></p></section>}
        {learn.related_topics.length > 0 && <section><h3 className="text-sm font-semibold">{t('learn.relatedTopics')}</h3><ul className="mt-2 flex flex-wrap gap-2">{learn.related_topics.map((topic, index) => <li key={`${index}-${topic}`} className="rounded-full bg-surface-alt px-3 py-1 text-sm dark:bg-slate-800">{topic}</li>)}</ul></section>}
      </>}
      <p className="border-t border-slate-100 pt-3 text-xs text-ink-soft dark:border-slate-800">{t('learn.aiNote')}</p>
    </div>}
  </aside>
}
