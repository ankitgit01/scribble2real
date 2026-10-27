import { t } from '../../i18n'
interface Props { question: string | null; answer: string | null }
export default function AnswerCard({ question, answer }: Props) { return <section className="rounded-xl border border-brand/20 bg-brand-soft/60 p-4" aria-labelledby="learn-answer-heading"><h3 id="learn-answer-heading" className="text-sm font-semibold text-brand-dark">{t('learn.yourQuestion')}</h3>{question && <p className="mt-2 text-sm italic">“{question}”</p>}{answer && <p className="mt-2 leading-relaxed">{answer}</p>}</section> }
