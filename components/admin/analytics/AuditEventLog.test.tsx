import { Children, type ReactNode, isValidElement } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditEventLog } from './AuditEventLog'
import { listAuditLogsAPI } from '@/lib/api/client'
import type { AuditLog } from '@/types/auditLog'

vi.mock('@/lib/api/client', () => ({
  listAuditLogsAPI: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/ui/select', () => {
  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange: (value: string) => void
    children: ReactNode
  }) {
    const options: { value: string; label: string }[] = []
    let triggerId: string | undefined

    Children.forEach(children, child => {
      if (!isValidElement(child)) return
      const childType = child.type as { displayName?: string }
      if (childType.displayName === 'SelectTrigger') {
        triggerId = (child.props as { id?: string }).id
      }
      if (childType.displayName === 'SelectContent') {
        Children.forEach(
          (child.props as { children?: ReactNode }).children,
          option => {
            if (!isValidElement(option)) return
            const optionType = option.type as { displayName?: string }
            if (optionType.displayName === 'SelectItem') {
              const props = option.props as {
                value: string
                children?: ReactNode
              }
              options.push({
                value: props.value,
                label: String(props.children),
              })
            }
          }
        )
      }
    })

    return (
      <select
        id={triggerId}
        aria-label={triggerId}
        value={value}
        onChange={e => onValueChange(e.target.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }
  Select.displayName = 'Select'

  function passthrough({
    children,
    ...props
  }: {
    children?: ReactNode
    id?: string
  }) {
    return <div {...props}>{children}</div>
  }
  passthrough.displayName = 'SelectTrigger'

  function SelectContent({ children }: { children?: ReactNode }) {
    return <>{children}</>
  }
  SelectContent.displayName = 'SelectContent'

  function SelectItem({ children }: { value: string; children?: ReactNode }) {
    return <>{children}</>
  }
  SelectItem.displayName = 'SelectItem'

  function SelectValue() {
    return null
  }
  SelectValue.displayName = 'SelectValue'

  return {
    Select,
    SelectTrigger: Object.assign(passthrough, { displayName: 'SelectTrigger' }),
    SelectContent,
    SelectItem,
    SelectValue,
  }
})

function makeLog(id: string, action: AuditLog['action']): AuditLog {
  return {
    id,
    action,
    actorUid: 'user1',
    actorDisplayName: 'Ada',
    source: 'api',
    createdAt: new Date().toISOString(),
  }
}

describe('AuditEventLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores stale unfiltered responses after filters are applied', async () => {
    const user = userEvent.setup()

    let resolveUnfiltered: (value: unknown) => void = () => {}
    const unfilteredPromise = new Promise(resolve => {
      resolveUnfiltered = resolve
    })

    vi.mocked(listAuditLogsAPI).mockImplementation(async params => {
      if (!params.action) {
        await unfilteredPromise
        return {
          success: true,
          logs: [
            makeLog('1', 'rsvp.confirmed'),
            makeLog('2', 'auth.login'),
          ],
          nextCursor: null,
          totalCount: 40,
        }
      }

      return {
        success: true,
        logs: [makeLog('2', 'auth.login')],
        nextCursor: null,
        totalCount: 3,
      }
    })

    render(<AuditEventLog />)

    await waitFor(() => {
      expect(listAuditLogsAPI).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /filter events/i }))
    await user.selectOptions(screen.getByLabelText('analytics-action'), 'auth.login')
    await user.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() => {
      expect(listAuditLogsAPI).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login', includeCount: true })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/showing 1–3 of 3 events/i)).toBeInTheDocument()
    })

    await act(async () => {
      resolveUnfiltered({})
      await Promise.resolve()
    })

    expect(screen.getByText(/showing 1–3 of 3 events/i)).toBeInTheDocument()
    expect(screen.queryByText(/ada confirmed rsvp/i)).not.toBeInTheDocument()
    expect(screen.getByText(/ada signed in/i)).toBeInTheDocument()
  })

  it('updates pagination totals when filters change', async () => {
    const user = userEvent.setup()

    vi.mocked(listAuditLogsAPI)
      .mockResolvedValueOnce({
        success: true,
        logs: Array.from({ length: 15 }, (_, i) =>
          makeLog(`u${i}`, 'rsvp.confirmed')
        ),
        nextCursor: 'cursor-1',
        totalCount: 40,
      })
      .mockResolvedValueOnce({
        success: true,
        logs: [makeLog('login1', 'auth.login')],
        nextCursor: null,
        totalCount: 1,
      })

    render(<AuditEventLog />)

    await waitFor(() => {
      expect(screen.getByText(/showing 1–15 of 40 events/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /filter events/i }))
    await user.selectOptions(screen.getByLabelText('analytics-action'), 'auth.login')
    await user.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() => {
      expect(screen.getByText(/showing 1–1 of 1 events/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument()
  })

  it('loads the next page with the stored cursor', async () => {
    const user = userEvent.setup()

    vi.mocked(listAuditLogsAPI)
      .mockResolvedValueOnce({
        success: true,
        logs: Array.from({ length: 15 }, (_, i) =>
          makeLog(`p1-${i}`, 'rsvp.confirmed')
        ),
        nextCursor: '2024-06-01T12:00:00.000Z',
        totalCount: 20,
      })
      .mockResolvedValueOnce({
        success: true,
        logs: Array.from({ length: 5 }, (_, i) =>
          makeLog(`p2-${i}`, 'auth.login')
        ),
        nextCursor: null,
      })

    render(<AuditEventLog />)

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(listAuditLogsAPI).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cursor: '2024-06-01T12:00:00.000Z',
          includeCount: false,
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument()
      expect(screen.getByText(/showing 16–20 of 20 events/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/ada signed in/i).length).toBe(5)
  })
})
