import { toast } from "sonner"

const DEFAULT_CLEAR_TIMEOUT_MS = 15000
let clearTimer: ReturnType<typeof setTimeout> | null = null
let lastCopied = ""
let pendingClear = false
let listenersAttached = false

function attachDeferredClearListeners() {
  if (listenersAttached || typeof document === "undefined") return
  listenersAttached = true

  const tryDeferredClear = async () => {
    if (!pendingClear) return
    try {
      await navigator.clipboard.writeText("")
      lastCopied = ""
      pendingClear = false
      toast.info("Clipboard cleared")
    } catch {
      // Still blocked; keep pending
    }
  }

  document.addEventListener("click", tryDeferredClear, { capture: true })
  document.addEventListener("keydown", tryDeferredClear, { capture: true })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void tryDeferredClear()
    }
  })
}

export async function copyWithAutoClear(text: string, timeoutMs = DEFAULT_CLEAR_TIMEOUT_MS): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.error("Clipboard unavailable")
    return false
  }

  attachDeferredClearListeners()

  try {
    await navigator.clipboard.writeText(text)
    lastCopied = text
    toast.info("Copied to clipboard")
  } catch {
    toast.error("Failed to copy")
    return false
  }

  if (clearTimer) {
    clearTimeout(clearTimer)
  }

  clearTimer = setTimeout(async () => {
    try {
      await navigator.clipboard.writeText("")
      lastCopied = ""
      toast.info("Clipboard cleared")
    } catch {
      pendingClear = true
      toast.warning("Clipboard clear blocked. Will clear on next interaction.", {
        action: {
          label: "Clear now",
          onClick: async () => {
            try {
              await navigator.clipboard.writeText("")
              lastCopied = ""
              pendingClear = false
              toast.info("Clipboard cleared")
            } catch {
              toast.error("Failed to clear clipboard")
            }
          },
        },
      })
    } finally {
      clearTimer = null
    }
  }, timeoutMs)

  return true
}
