import type { HTMLAttributes } from 'react'

/** 像素风卡片容器。 */
export function PixelCard({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border-2 border-ink/10 bg-cream p-6 shadow-[4px_4px_0_0_rgba(46,42,38,0.08)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
