import { t } from '../../i18n'
interface Props { facts: string[] }
export default function KeyFacts({ facts }: Props) { if (facts.length === 0) return null; return <section aria-labelledby="learn-facts-heading"><h3 id="learn-facts-heading" className="font-semibold">{t('learn.keyFacts')}</h3><ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">{facts.map((fact, index) => <li key={`${index}-${fact}`}>{fact}</li>)}</ul></section> }
