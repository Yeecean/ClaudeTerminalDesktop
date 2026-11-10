import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode
} from 'react'
import { cn } from '../../lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-[15px] font-semibold tracking-[-0.01em]', className)}
      {...props}
    />
  )
})

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-[12.5px] leading-5 text-[var(--text-muted)]', className)}
      {...props}
    />
  )
})

interface DialogContentProps extends ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  side?: 'center' | 'right'
  showClose?: boolean
  children: ReactNode
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, side = 'center', showClose = true, children, ...props },
  ref
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'dialog-content fixed z-50 border border-[var(--border)] bg-[var(--panel-raised)] text-[var(--text-primary)] shadow-[0_24px_80px_rgba(25,18,12,0.22)] outline-none',
          side === 'center'
            ? 'left-1/2 top-1/2 w-[min(430px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6'
            : 'bottom-0 right-0 top-0 flex h-full w-[min(500px,calc(100vw-32px))] flex-col rounded-l-2xl',
          className
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="关闭"
          >
            <X size={16} strokeWidth={1.8} />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

