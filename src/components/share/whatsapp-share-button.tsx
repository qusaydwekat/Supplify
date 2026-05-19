'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

type Variant = 'primary' | 'secondary' | 'ghost'

type Props = {
  /** Free-form text body. The originating URL (if any) will be appended. */
  message: string
  /** Optional canonical link added on its own line at the end. */
  url?: string | null
  /** Recipient phone (international format, no leading +). When omitted, opens contact-picker chat. */
  phone?: string | null
  variant?: Variant
  className?: string
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const stripped = raw.replace(/[^\d+]/g, '')
  if (!stripped) return null
  if (stripped.startsWith('+')) return stripped.slice(1)
  // Map Palestinian local prefix 05x / 09x to +9705x / +9709x.
  if (/^0(5|9)/.test(stripped)) return `970${stripped.slice(1)}`
  return stripped
}

export function WhatsAppShareButton({
  message,
  url,
  phone,
  variant = 'secondary',
  className,
}: Props) {
  const t = useTranslations('WhatsAppShare')
  const [copied, setCopied] = useState(false)

  const fullMessage = useMemo(() => {
    const parts = [message.trim()]
    if (url) parts.push('', url)
    return parts.filter(Boolean).join('\n')
  }, [message, url])

  const target = useMemo(() => {
    const normalized = normalizePhone(phone)
    const text = encodeURIComponent(fullMessage)
    return normalized
      ? `https://wa.me/${normalized}?text=${text}`
      : `https://wa.me/?text=${text}`
  }, [fullMessage, phone])

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(fullMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore: clipboard not available
    }
  }

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      <a href={target} target="_blank" rel="noopener noreferrer">
        <Button type="button" variant={variant} className="min-h-9 px-3 py-1.5 text-sm">
          <span className="me-2 inline-block" aria-hidden>
            {/* Minimal inline WhatsApp glyph (no external icon library). */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M16.003 3C9.376 3 4 8.376 4 15.003c0 2.32.62 4.578 1.802 6.575L4 29l7.594-1.74a11.96 11.96 0 0 0 4.41.83h.001c6.626 0 12.002-5.376 12.002-12.003C28.007 8.376 22.63 3 16.003 3Zm0 21.808a9.79 9.79 0 0 1-4.972-1.36l-.357-.212-4.51 1.034 1.07-4.39-.232-.37a9.787 9.787 0 0 1-1.495-5.21c0-5.405 4.398-9.804 9.804-9.804 5.404 0 9.802 4.4 9.802 9.804s-4.398 9.804-9.802 9.804Zm5.36-7.31c-.292-.146-1.73-.852-2-.95-.268-.097-.463-.146-.658.146-.194.292-.755.951-.925 1.146-.17.195-.342.22-.634.073-.292-.146-1.235-.456-2.353-1.454-.87-.776-1.46-1.736-1.63-2.028-.17-.292-.018-.45.129-.595.132-.131.292-.342.438-.512.146-.171.194-.293.292-.487.097-.195.049-.366-.024-.512-.073-.146-.658-1.587-.901-2.176-.237-.57-.479-.493-.658-.502l-.561-.01a1.08 1.08 0 0 0-.78.366c-.268.292-1.025 1.002-1.025 2.444 0 1.442 1.049 2.834 1.196 3.029.146.195 2.064 3.15 5 4.42.7.302 1.246.482 1.671.617.702.224 1.34.193 1.846.117.564-.084 1.73-.707 1.975-1.39.244-.683.244-1.27.17-1.39-.073-.122-.268-.195-.56-.341Z" />
            </svg>
          </span>
          {t('shareLabel')}
        </Button>
      </a>
      <Button type="button" variant="ghost" className="min-h-9 px-3 py-1.5 text-sm" onClick={copyToClipboard}>
        {copied ? t('copied') : t('copy')}
      </Button>
    </div>
  )
}
