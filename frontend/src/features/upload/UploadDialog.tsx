import { Camera, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ApiError, api } from '../../api/client'
import { getCanvasApi } from '../canvas/canvasApi'
import { t } from '../../i18n'
import type { PreprocessResponse } from '../../api/types'
import { ImageFileError, prepareImageFile } from './imageFile'

interface Props { onClose(): void }
type ImageKind = 'photo' | 'drawing'
function decodeBase64(value: string): Blob {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: 'image/png' })
}
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) { const translated = t(`errors.${error.code}`); return translated === `errors.${error.code}` ? error.message : translated }
  return error instanceof Error ? error.message : t('upload.genericError')
}

export default function UploadDialog({ onClose }: Props) {
  const [kind, setKind] = useState<ImageKind>('photo')
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null)
  const [cleanedBlob, setCleanedBlob] = useState<Blob | null>(null)
  const [preprocess, setPreprocess] = useState<PreprocessResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chooseRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const originalUrlRef = useRef<string | null>(null)
  const cleanedUrlRef = useRef<string | null>(null)
  const preparedFileRef = useRef<Blob | null>(null)
  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
    if (cleanedUrlRef.current) URL.revokeObjectURL(cleanedUrlRef.current)
  }, [])
  useEffect(() => {
    if (!cameraOpen) return
    let cancelled = false
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.getUserMedia) {
      setCameraOpen(false)
      setError('Camera access is not supported by this browser. You can choose an image file instead.')
      return
    }
    void mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
      cameraStreamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    }).catch((caught: unknown) => {
      if (!cancelled) { setCameraOpen(false); setError(caught instanceof Error && caught.name === 'NotAllowedError' ? 'Camera access was denied. Allow camera access in your browser settings and try again.' : 'A camera is not available. You can choose an image file instead.') }
    })
    return () => { cancelled = true; cameraStreamRef.current?.getTracks().forEach((track) => track.stop()); cameraStreamRef.current = null }
  }, [cameraOpen])

  const resetPreview = () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
    if (cleanedUrlRef.current) URL.revokeObjectURL(cleanedUrlRef.current)
    originalUrlRef.current = null; cleanedUrlRef.current = null
    preparedFileRef.current = null
    setOriginalUrl(null); setCleanedUrl(null); setCleanedBlob(null); setPreprocess(null)
  }
  const previewPrepared = async (prepared: Blob, imageKind: ImageKind) => {
    const response = await api.previewPreprocess({ imageBlob: prepared, kind: imageKind })
    const resultBlob = decodeBase64(response.cleaned_png_b64)
    const resultUrl = URL.createObjectURL(resultBlob)
    if (cleanedUrlRef.current) URL.revokeObjectURL(cleanedUrlRef.current)
    cleanedUrlRef.current = resultUrl; setCleanedUrl(resultUrl); setCleanedBlob(resultBlob); setPreprocess(response)
  }
  const processFile = async (file: File | undefined) => {
    if (!file) return
    setError(null); setBusy(true); resetPreview()
    try {
      const prepared = await prepareImageFile(file)
      preparedFileRef.current = prepared
      const sourceUrl = URL.createObjectURL(prepared)
      originalUrlRef.current = sourceUrl; setOriginalUrl(sourceUrl)
      await previewPrepared(prepared, kind)
    } catch (caught) {
      setError(caught instanceof ImageFileError ? caught.message : errorMessage(caught))
    } finally { setBusy(false) }
  }
  const changeKind = async (nextKind: ImageKind) => {
    setKind(nextKind)
    const prepared = preparedFileRef.current
    if (!prepared) return
    setBusy(true); setError(null)
    try { await previewPrepared(prepared, nextKind) }
    catch (caught) { setError(errorMessage(caught)) }
    finally { setBusy(false) }
  }
  const useSketch = async () => {
    if (!cleanedBlob) return
    const canvas = getCanvasApi()
    if (!canvas) { setError(t('upload.canvasUnavailable')); return }
    if (canvas.hasLineContent() && !window.confirm(t('upload.replaceConfirm'))) return
    setBusy(true); setError(null)
    try { await canvas.importSketch(cleanedBlob); onClose() }
    catch (caught) { setError(errorMessage(caught)) }
    finally { setBusy(false) }
  }
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { void processFile(event.target.files?.[0]); event.target.value = '' }
  const takePhoto = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) { setError('Camera capture is unavailable in this browser.'); return }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!photo) { setError('The photo could not be captured. Please try again.'); return }
    setCameraOpen(false)
    await processFile(new File([photo], `scribble-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
  }
  const inputActions = <div className="flex flex-wrap gap-2">
    <button type="button" onClick={() => { setError(null); setCameraReady(false); setCameraOpen(true) }} className="flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"><Camera size={17} />{t('upload.takePhoto')}</button>
    <button type="button" onClick={() => chooseRef.current?.click()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600">{t('upload.chooseFile')}</button>
    <input ref={chooseRef} className="sr-only" type="file" accept="image/*" onChange={onFileChange} />
  </div>

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-3 sm:p-6" onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void processFile(event.dataTransfer.files[0]) }}>
    <section role="dialog" aria-modal="true" aria-labelledby="upload-title" className={`max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 sm:p-6 ${dragging ? 'ring-4 ring-brand' : ''}`}>
      <header className="flex items-start justify-between gap-4"><div><h2 id="upload-title" className="text-xl font-bold">{t('upload.title')}</h2>
      {/* <p className="mt-1 text-sm text-ink-soft dark:text-slate-300">{t('upload.subtitle')}</p> */}
      </div><button type="button" onClick={onClose} aria-label={t('upload.close')} className="min-h-11 min-w-11 rounded-lg border text-xl">×</button></header>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl bg-surface-alt p-1 dark:bg-slate-800" role="group" aria-label={t('upload.imageKind')}>
          {(['photo', 'drawing'] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => void changeKind(value)} className={`min-h-10 rounded-lg px-3 text-sm ${kind === value ? 'bg-white font-medium shadow-sm dark:bg-slate-700' : ''}`}>{t(value === 'photo' ? 'upload.photoKind' : 'upload.digitalKind')}</button>)}
        </div>{inputActions}
      </div>
      {!originalUrl && !busy && <button type="button" onClick={() => chooseRef.current?.click()} className="mt-4 grid min-h-40 w-full place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-surface-alt p-6 text-center hover:border-brand dark:border-slate-700 dark:bg-slate-800"><span><span className="block text-3xl">↥</span><span className="mt-2 block font-medium">{t('upload.dropHere')}</span><span className="mt-1 block text-sm text-ink-soft">{t('upload.acceptedTypes')}</span></span></button>}
      {busy && <div role="status" className="mt-6 flex min-h-32 items-center justify-center gap-3 text-ink-soft"><span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none" />{t('upload.preparing')}</div>}
      {error && <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}<p className="mt-1">{t('upload.lightHint')}</p></div>}
      {cameraOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4"><section role="dialog" aria-modal="true" aria-label="Take a photo" className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-3 shadow-2xl dark:bg-slate-900"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Take a photo</h3><button type="button" aria-label="Close camera" onClick={() => setCameraOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button></div><video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setCameraReady(true)} className="max-h-[65vh] w-full rounded-xl bg-slate-950 object-contain" /><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setCameraOpen(false)} className="min-h-11 rounded-xl border px-4">Cancel</button><button type="button" disabled={!cameraReady} onClick={() => void takePhoto()} className="min-h-11 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-50">Capture photo</button></div></section></div>}
      {originalUrl && cleanedUrl && !busy && <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><figure className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"><figcaption className="mb-2 text-sm font-medium">{t('upload.original')}</figcaption><img src={originalUrl} alt={t('upload.originalAlt')} className="max-h-72 w-full rounded-lg bg-slate-50 object-contain" /></figure><figure className="rounded-xl border border-brand/30 bg-brand-soft/30 p-2 dark:border-slate-700 dark:bg-slate-800"><figcaption className="mb-2 text-sm font-medium">{t('upload.cleaned')}</figcaption><img src={cleanedUrl} alt={t('upload.cleanedAlt')} className="max-h-72 w-full rounded-lg bg-white object-contain" /></figure></div>
        {preprocess?.notes.length ? <ul className="mt-3 flex flex-wrap gap-2">{preprocess.notes.map((note, index) => <li key={`${note}-${index}`} className="rounded-full bg-surface-alt px-3 py-1 text-xs text-ink-soft dark:bg-slate-800">{note}</li>)}</ul> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { resetPreview(); setError(null) }} className="min-h-11 rounded-xl border px-4">{t('upload.tryAgain')}</button><button type="button" onClick={() => void useSketch()} disabled={busy} className="min-h-11 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60">{t('upload.useSketch')}</button></div>
      </>}
      {!originalUrl && !busy && <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm text-ink-soft">{t('upload.cancel')}</button></div>}
    </section>
  </div>
}
