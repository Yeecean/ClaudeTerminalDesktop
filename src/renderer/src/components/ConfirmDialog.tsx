import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorMessage } from '../lib/utils'
import { Button } from './ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from './ui/Dialog'

export interface ConfirmRequest {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  action: () => Promise<void>
}

interface ConfirmDialogProps {
  request: ConfirmRequest | null
  onOpenChange: (open: boolean) => void
  onConfirmed: () => void
}

export function ConfirmDialog({
  request,
  onOpenChange,
  onConfirmed
}: ConfirmDialogProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (request) {
      setBusy(false)
      setError(null)
    }
  }, [request])

  const confirm = async (): Promise<void> => {
    if (!request || busy) return
    setBusy(true)
    setError(null)
    try {
      await request.action()
      onOpenChange(false)
      onConfirmed()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent showClose={false}>
        {request ? (
          <>
            <div className="flex items-start gap-3.5">
              <div
                className={
                  request.danger
                    ? 'flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]'
                    : 'flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                }
              >
                <AlertTriangle size={17} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle>{request.title}</DialogTitle>
                <DialogDescription className="mt-1.5">
                  {request.description}
                </DialogDescription>
              </div>
            </div>
            {error ? (
              <p className="mt-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--danger)]">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                variant={request.danger ? 'danger' : 'primary'}
                size="sm"
                disabled={busy}
                onClick={() => void confirm()}
              >
                {busy ? (
                  <LoaderCircle size={13} className="animate-spin" />
                ) : null}
                {request.confirmLabel}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

