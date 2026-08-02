"use client"

import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ToastTone = "success" | "error" | "info"

type ToastInput = {
  title: string
  description?: string
  tone?: ToastTone
  duration?: number
}

type ToastMessage = Required<Pick<ToastInput, "tone">> &
  Omit<ToastInput, "tone"> & {
    id: string
  }

type ToastContextValue = {
  showToast: (toast: ToastInput) => string
  success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((toast: ToastInput) => {
    const id = `toast-${++toastId}`

    setToasts((current) => [
      ...current,
      {
        id,
        tone: toast.tone ?? "info",
        title: toast.title,
        description: toast.description,
        duration: toast.duration,
      },
    ])

    return id
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (title, description) =>
        showToast({ title, description, tone: "success" }),
      error: (title, description) =>
        showToast({ title, description, tone: "error", duration: 7000 }),
      info: (title, description) =>
        showToast({ title, description, tone: "info" }),
      dismissToast,
    }),
    [dismissToast, showToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }

  return context
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      className="fixed right-4 top-4 z-50 grid w-[calc(100%-2rem)] max-w-sm gap-3 print:hidden"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  const duration = toast.duration ?? 5000
  const Icon = toastIcons[toast.tone]

  useEffect(() => {
    if (duration <= 0) {
      return
    }

    const timeout = window.setTimeout(() => onDismiss(toast.id), duration)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [duration, onDismiss, toast.id])

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-background p-4 text-sm shadow-lg ring-1 ring-foreground/5",
        toastClasses[toast.tone]
      )}
    >
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-5">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-muted-foreground">{toast.description}</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

const toastIcons: Record<ToastTone, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const toastClasses: Record<ToastTone, string> = {
  success: "border-emerald-200 text-emerald-800",
  error: "border-destructive/30 text-destructive",
  info: "border-sky-200 text-sky-800",
}
