import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline'
  /** 提供 to 时渲染为路由链接按钮 */
  to?: string
  children: ReactNode
}

/** 像素风按钮：实心/描边两态，支持 disabled 与路由跳转。 */
export function PixelButton({ variant = 'solid', to, className = '', children, ...rest }: PixelButtonProps) {
  const base =
    'inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded border-2 px-4 py-2 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark disabled:cursor-not-allowed disabled:opacity-50'
  const styles =
    variant === 'solid'
      ? 'border-wbrown bg-wbrown text-cream hover:bg-wbrown-dark active:bg-wbrown-dark'
      : 'border-wbrown/40 bg-transparent text-wbrown hover:border-wbrown hover:bg-cream-deep active:bg-cream-deep'
  const cls = `${base} ${styles} ${className}`

  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
