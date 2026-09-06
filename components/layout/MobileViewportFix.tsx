'use client'

import { useEffect } from 'react'

function isLikelyIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * iOS Safari can leave a large empty scrollable gap after the software
 * keyboard or a modal select dismisses (layout viewport stays inflated).
 * Recalculate height on focusout and clamp scroll to real content.
 */
export function MobileViewportFix() {
  useEffect(() => {
    if (!isLikelyIOS()) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const clampScrollToContent = () => {
      const root = document.documentElement
      const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight)
      if (window.scrollY > maxScroll) {
        window.scrollTo(0, maxScroll)
      }
    }

    const recalculateViewport = () => {
      const active = document.activeElement
      const tag = active?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      if (active instanceof HTMLElement && active.isContentEditable) {
        return
      }

      // Briefly pin height to the current visual viewport so Safari drops any
      // inflated layout height left over from the keyboard / scroll lock.
      const vvHeight = window.visualViewport?.height ?? window.innerHeight
      const root = document.documentElement
      const previousHeight = root.style.height
      root.style.height = `${Math.round(vvHeight)}px`
      clampScrollToContent()
      requestAnimationFrame(() => {
        root.style.height = previousHeight
        clampScrollToContent()
      })
    }

    const scheduleRecalculate = () => {
      if (timeoutId) clearTimeout(timeoutId)
      // Wait for keyboard / remove-scroll teardown to finish.
      timeoutId = setTimeout(recalculateViewport, 100)
    }

    document.addEventListener('focusout', scheduleRecalculate)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('focusout', scheduleRecalculate)
    }
  }, [])

  return null
}
