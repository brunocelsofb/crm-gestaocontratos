'use client'

import { useState } from 'react'

export function LogoBadge({ src }: { src?: string }) {
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) return null

  return (
    <div className="flex-shrink-0 flex items-center justify-center">
      <img
        src={src}
        alt="Logo ORBIS"
        className="h-12 md:h-16 w-auto object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  )
}
