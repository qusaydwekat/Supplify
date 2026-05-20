'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  deleteProductGalleryImage,
  setPrimaryGalleryImage,
  uploadProductGalleryImage,
} from '@/lib/actions/products-catalog'
import type { ProductImageRow } from '@/lib/data/products/gallery'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  productId: string
  initialImages: ProductImageRow[]
}

export function ProductGalleryPanel({ productId, initialImages }: Props) {
  const t = useTranslations('ProductCatalog')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)

  async function onUpload(file: File) {
    setPending(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadProductGalleryImage(productId, fd)
    setPending(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('galleryUploaded'))
    router.refresh()
  }

  async function onDelete(imageId: string) {
    if (!window.confirm(t('galleryDeleteConfirm'))) return
    const res = await deleteProductGalleryImage(productId, imageId)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('galleryDeleted'))
    router.refresh()
  }

  async function onSetPrimary(imageId: string) {
    const res = await setPrimaryGalleryImage(productId, imageId)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('galleryPrimarySet'))
    router.refresh()
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('galleryTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('galleryHint')}</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onUpload(file)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            className="h-8 min-h-8 px-3 text-xs"
            variant="secondary"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? t('galleryUploading') : t('galleryAdd')}
          </Button>
        </div>
      </div>

      {initialImages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t('galleryEmpty')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {initialImages.map((img, index) => (
            <div
              key={img.id}
              className={cn(
                'group relative overflow-hidden rounded-lg border border-border bg-muted/30',
                index === 0 && 'ring-2 ring-primary/40',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="aspect-square w-full object-cover" />
              {index === 0 ? (
                <span className="absolute start-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {t('galleryPrimary')}
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/55 p-1.5 opacity-0 transition group-hover:opacity-100">
                {index !== 0 ? (
                  <button
                    type="button"
                    className="flex-1 rounded px-1 py-0.5 text-[10px] font-medium text-white hover:bg-white/20"
                    onClick={() => void onSetPrimary(img.id)}
                  >
                    {t('galleryMakePrimary')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded px-1 py-0.5 text-[10px] font-medium text-red-200 hover:bg-white/20"
                  onClick={() => void onDelete(img.id)}
                >
                  {t('galleryDelete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
