'use client'

import { useEffect } from 'react'

export function isLikelyIOS(
  nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> = navigator
): boolean {
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  )
}

function isEditableFocused(): boolean {
  const active = document.activeElement
  const tag = active?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }
  if (active instanceof HTMLElement && active.isContentEditable) {
    return true
  }
  // Radix Select keeps focus inside a portaled listbox while open.
  if (document.querySelector('[data-radix-select-viewport]')) {
    return true
  }
  return false
}

/** Bottom edge of in-flow body content (ignores position:fixed overlays). */
export function measureInFlowContentBottom(
  root: ParentNode = document.body
): number {
  let bottom = 0
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue
    const position = window.getComputedStyle(child).position
    if (position === 'fixed') continue
    const rect = child.getBoundingClientRect()
    bottom = Math.max(bottom, rect.bottom + window.scrollY)
  }
  return bottom
}

/**
 * True when the document is substantially taller than the in-flow content —
 * the hallmark of an iOS Safari inflated layout viewport after keyboard /
 * Select dismiss.
 */
export function hasInflatedScrollGap(
  scrollHeight: number,
  contentBottom: number,
  viewportHeight: number
): boolean {
  const gap = scrollHeight - contentBottom
  return gap > Math.max(120, viewportHeight * 0.35)
}

/**
 * iOS Safari can leave a large empty scrollable gap after the software
 * keyboard or a modal select dismisses (layout viewport stays inflated).
 * Recalculate height on focusout / select dismiss / visualViewport resize
 * and clamp scroll to real content.
 */
export function MobileViewportFix() {
  useEffect(() => {
    if (!isLikelyIOS()) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let secondTimeoutId: ReturnType<typeof setTimeout> | null = null

    const clampScrollToContent = () => {
      const root = document.documentElement
      const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight)
      if (window.scrollY > maxScroll) {
        window.scrollTo(0, maxScroll)
      }
    }

    const pinViewportHeight = () => {
      // Briefly pin height to the current visual viewport so Safari drops any
      // inflated layout height left over from the keyboard / scroll lock.
      const vvHeight = window.visualViewport?.height ?? window.innerHeight
      const root = document.documentElement
      const previousHeight = root.style.height
      const previousMinHeight = root.style.minHeight
      const pinned = `${Math.round(vvHeight)}px`
      root.style.height = pinned
      root.style.minHeight = pinned
      clampScrollToContent()
      requestAnimationFrame(() => {
        root.style.height = previousHeight
        root.style.minHeight = previousMinHeight
        clampScrollToContent()
      })
    }

    const recalculateViewport = (opts?: { onlyIfInflated?: boolean }) => {
      if (isEditableFocused()) return

      if (opts?.onlyIfInflated) {
        const vvHeight = window.visualViewport?.height ?? window.innerHeight
        if (
          !hasInflatedScrollGap(
            document.documentElement.scrollHeight,
            measureInFlowContentBottom(),
            vvHeight
          )
        ) {
          return
        }
      }

      pinViewportHeight()
    }

    const scheduleRecalculate = (opts?: { onlyIfInflated?: boolean }) => {
      if (timeoutId) clearTimeout(timeoutId)
      if (secondTimeoutId) clearTimeout(secondTimeoutId)
      // Wait for keyboard / remove-scroll teardown; retry once for stubborn Safari.
      timeoutId = setTimeout(() => {
        recalculateViewport(opts)
        secondTimeoutId = setTimeout(() => recalculateViewport(opts), 250)
      }, 120)
    }

    const onFocusOut = () => scheduleRecalculate()
    // Radix Select / sheet dismiss often ends with pointerup without a useful focusout.
    const onPointerUp = () => scheduleRecalculate({ onlyIfInflated: true })
    const onVisualViewportResize = () =>
      scheduleRecalculate({ onlyIfInflated: true })

    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('pointerup', onPointerUp)
    window.visualViewport?.addEventListener('resize', onVisualViewportResize)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (secondTimeoutId) clearTimeout(secondTimeoutId)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerup', onPointerUp)
      window.visualViewport?.removeEventListener(
        'resize',
        onVisualViewportResize
      )
    }
  }, [])

  return null
}
