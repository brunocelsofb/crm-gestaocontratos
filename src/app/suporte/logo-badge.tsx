'use client'

export function LogoBadge({ src }: { src?: string }) {
  if (!src) return null

  return (
    <div className="flex-shrink-0 flex items-center justify-center">
      <div
        className="h-12 w-40 bg-[#E98C5F]"
        style={{
          WebkitMaskImage: `url('${src}')`,
          WebkitMaskSize: 'contain',
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          maskImage: `url('${src}')`,
          maskSize: 'contain',
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
        }}
      />
    </div>
  )
}
