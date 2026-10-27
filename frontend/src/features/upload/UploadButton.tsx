import { useState } from 'react'
import { t } from '../../i18n'
import UploadDialog from './UploadDialog'
export default function UploadButton() {
  const [open, setOpen] = useState(false)
  return <><button type="button" onClick={() => setOpen(true)} className="min-h-11 self-start rounded-xl border border-brand/30 bg-white px-4 py-2 text-sm font-medium text-brand shadow-sm hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand dark:bg-slate-900">＋ {t('upload.addSketch')}</button>{open && <UploadDialog onClose={() => setOpen(false)} />}</>
}
