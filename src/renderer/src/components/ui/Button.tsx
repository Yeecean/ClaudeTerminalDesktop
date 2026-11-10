import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accentSoft'
type ButtonSize = 'sm' | 'md' | 'icon' | 'iconSm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-white shadow-[0_1px_2px_rgba(70,35,20,0.16)] hover:bg-[var(--accent-hover)]',
  secondary:
    'border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text-primary)] shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:bg-[var(--hover)]',
  ghost: 'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]',
  danger: 'bg-[var(--danger)] text-white hover:brightness-[0.94]',
  accentSoft:
    'bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:bg-[var(--accent-soft-hover)]'
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-[12px]',
  md: 'h-9 gap-2 rounded-[10px] px-3.5 text-[13px]',
  icon: 'size-9 rounded-[10px]',
  iconSm: 'size-8 rounded-lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium outline-none transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-45 active:translate-y-px',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
})

