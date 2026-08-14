'use client'

export function LogoBadge({ src }: { src: string }) {
  return (
    <div className="flex-shrink-0 bg-[#E98C5F] p-3 rounded-lg shadow-sm">
      <img
        src={src}
        alt="Logo ORBIS"
        className="h-10 w-auto object-contain"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    </div>
  )
}
