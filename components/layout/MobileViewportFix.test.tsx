import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MobileViewportFix,
  hasInflatedScrollGap,
  isLikelyIOS,
  measureInFlowContentBottom,
} from './MobileViewportFix'

describe('isLikelyIOS', () => {
  it('detects iPhone user agents', () => {
    expect(
      isLikelyIOS({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      })
    ).toBe(true)
  })

  it('detects iPadOS desktop-class UA', () => {
    expect(
      isLikelyIOS({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
    ).toBe(true)
  })

  it('rejects desktop Chrome', () => {
    expect(
      isLikelyIOS({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0',
        platform: 'Linux x86_64',
        maxTouchPoints: 0,
      })
    ).toBe(false)
  })
})

describe('hasInflatedScrollGap', () => {
  it('is true when empty space below content is a large fraction of the viewport', () => {
    expect(hasInflatedScrollGap(2000, 1014, 844)).toBe(true)
  })

  it('is false for normal pages with only a few pixels of padding', () => {
    expect(hasInflatedScrollGap(1022, 1014, 844)).toBe(false)
  })

  it('uses a 120px floor so short viewports still detect real gaps', () => {
    expect(hasInflatedScrollGap(400, 200, 200)).toBe(true)
    expect(hasInflatedScrollGap(300, 250, 200)).toBe(false)
  })
})

describe('measureInFlowContentBottom', () => {
  it('ignores position:fixed children', () => {
    const root = document.createElement('div')
    const flow = document.createElement('div')
    flow.style.height = '200px'
    const fixed = document.createElement('div')
    fixed.style.position = 'fixed'
    fixed.style.height = '800px'
    root.append(flow, fixed)
    document.body.append(root)

    // jsdom getBoundingClientRect is often 0; stub bottoms.
    vi.spyOn(flow, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      top: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    vi.spyOn(fixed, 'getBoundingClientRect').mockReturnValue({
      bottom: 800,
      top: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation(el => {
      if (el === fixed) {
        return { position: 'fixed' } as CSSStyleDeclaration
      }
      return { position: 'static' } as CSSStyleDeclaration
    })

    expect(measureInFlowContentBottom(root)).toBe(200)
    root.remove()
  })
})

describe('MobileViewportFix', () => {
  const originalUA = navigator.userAgent
  const originalPlatform = navigator.platform
  const originalMaxTouch = navigator.maxTouchPoints

  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'iPhone',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUA,
    })
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: originalPlatform,
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: originalMaxTouch,
    })
    document.documentElement.style.height = ''
    document.documentElement.style.minHeight = ''
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('pins html height on focusout so an inflated layout viewport can collapse', async () => {
    render(<MobileViewportFix />)

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => 2000,
    })
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844)

    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(cb => {
        cb(0)
        return 1
      })

    document.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(120)

    // After the pin + rAF restore, inline height should be cleared again.
    expect(document.documentElement.style.height).toBe('')
    expect(raf).toHaveBeenCalled()
  })
})
