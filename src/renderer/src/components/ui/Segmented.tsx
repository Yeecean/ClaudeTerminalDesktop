import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label?: string
  icon?: ReactNode
  title?: string
}

interface SegmentedProps<T extends string> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div
      className={cn(
        'inline-flex h-8 items-center rounded-[9px] border border-[var(--border)] bg-[var(--segmented-bg)] p-[2px]',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-[26px] items-center justify-center gap-1.5 rounded-[7px] px-2 text-[11.5px] font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
              active
                ? 'bg-[var(--panel-raised)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(30,25,20,0.1)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              option.label ? 'min-w-14' : 'w-8 px-0'
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

