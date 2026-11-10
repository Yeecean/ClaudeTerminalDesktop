import { cn } from '../../lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: string
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label
}: SwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-40',
        checked
          ? 'border-[var(--accent)] bg-[var(--accent)]'
          : 'border-[var(--border-strong)] bg-[var(--switch-off)]'
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-150',
          checked ? 'left-[18px]' : 'left-[3px]'
        )}
      />
    </button>
  )
}

