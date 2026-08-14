'use client'

export function LogoBadge({ src }: { src?: string }) {
  if (!src) return null

  return (
    <div className="flex-shrink-0 flex items-center justify-center">
      <img
        src={src}
        alt="Logo ORBIS"
        className="h-10 md:h-12 w-auto object-contain"
        style={{
          filter: 'invert(66%) sepia(55%) saturate(3062%) hue-rotate(331deg) brightness(96%) contrast(89%)'
        }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    </div>
  )
}
