'use client'

import { useState } from 'react'

export function LogoBadge({ src }: { src?: string }) {
  const fallback = '/drone.png'
  const [imgSrc, setImgSrc] = useState(src || fallback)
  const [failed, setFailed] = useState(false)

  if (!src && failed) return null

  return (
    <div className="flex-shrink-0 flex items-center justify-center">
      <img
        src={imgSrc}
        alt="Logo"
        className="h-8 md:h-10 w-auto object-contain"
        onError={() => {
          if (imgSrc !== fallback) {
            setImgSrc(fallback)
          } else {
            setFailed(true)
          }
        }}
      />
    </div>
  )
}
