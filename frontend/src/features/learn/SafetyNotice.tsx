import { t } from '../../i18n'
interface Props { flag: 'unsafe' | 'off_topic' }
export default function SafetyNotice({ flag }: Props) { return <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><h3 className="font-semibold">{t('learn.safetyTitle')}</h3><p className="mt-1 leading-relaxed">{t(flag === 'unsafe' ? 'learn.safetyRedirect' : 'learn.offTopicRedirect')}</p></div> }
