import type { InputHTMLAttributes } from 'react'
import { useId, useState } from 'react'

interface PixelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

/** 像素风输入框，带校验错误提示。 */
export function PixelInput({ label, className = '', onInvalid, ...rest }: PixelInputProps) {
  const id = useId()
  const [error, setError] = useState('')
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink/80">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`min-h-[44px] rounded border-2 bg-cream px-3 py-2 text-base outline-none transition-colors focus:border-sage-dark disabled:opacity-50 ${
          error ? 'border-pink-dark' : 'border-ink/15'
        } ${className}`}
        onInvalid={(e) => {
          setError(e.currentTarget.validationMessage)
          onInvalid?.(e)
        }}
        onInput={(e) => {
          if (error && e.currentTarget.validity.valid) setError('')
        }}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-pink-dark">
          {error}
        </p>
      )}
    </div>
  )
}
