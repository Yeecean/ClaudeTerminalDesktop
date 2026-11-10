import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '../lib/utils'

export interface ToastMessage {
  text: string
  tone: 'success' | 'error' | 'warning'
}

interface ToastProps {
  toast: ToastMessage | null
}

export function Toast({ toast }: ToastProps): React.JSX.Element | null {
  if (!toast) return null
  const StatusIcon =
    toast.tone === 'error'
      ? AlertCircle
      : toast.tone === 'warning'
        ? AlertTriangle
        : CheckCircle2

  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-5 right-5 z-[100] flex max-w-[390px] items-start gap-2.5 rounded-xl border bg-[var(--panel-raised)] px-3.5 py-3 shadow-[0_12px_40px_rgba(28,22,16,0.16)]',
        toast.tone === 'error'
          ? 'border-[var(--danger-border)]'
          : toast.tone === 'warning'
            ? 'border-[var(--warning-border)]'
            : 'border-[var(--border)]'
      )}
    >
      <StatusIcon
        size={15}
        strokeWidth={1.9}
        className={cn(
          'mt-0.5 shrink-0',
          toast.tone === 'error'
            ? 'text-[var(--danger)]'
            : toast.tone === 'warning'
              ? 'text-[var(--warning-strong)]'
              : 'text-[var(--success-strong)]'
        )}
      />
      <p className="text-[11.5px] leading-5 text-[var(--text-secondary)]">{toast.text}</p>
    </div>
  )
}

