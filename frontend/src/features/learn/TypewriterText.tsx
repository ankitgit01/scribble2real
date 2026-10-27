import { useEffect, useState } from 'react'

interface Props { text: string; delay?: number; className?: string }
export default function TypewriterText({ text, delay = 0, className = '' }: Props) {
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    setVisible(0)
    let timer: ReturnType<typeof setTimeout> | undefined
    const start = setTimeout(() => {
      let index = 0
      timer = setInterval(() => {
        index = Math.min(text.length, index + Math.max(1, Math.ceil(text.length / 120)))
        setVisible(index)
        if (index >= text.length && timer) clearInterval(timer)
      }, 16)
    }, delay)
    return () => { clearTimeout(start); if (timer) clearInterval(timer) }
  }, [text, delay])
  return <span className={className}>{text.slice(0, visible)}{visible < text.length && <span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-current align-middle" />}</span>
}
