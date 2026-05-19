'use client'

import { Toaster } from 'sonner'

export function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border border-border shadow-lg',
        },
      }}
    />
  )
}
