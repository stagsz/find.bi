import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TimerProvider, useTimer } from '@/components/providers/TimerContext'

// Helper component to expose timer context values for testing
function TimerTestHarness({ onRender }: { onRender: (ctx: ReturnType<typeof useTimer>) => void }) {
  const ctx = useTimer()
  onRender(ctx)
  return (
    <div>
      <span data-testid="elapsed">{ctx.elapsedSeconds}</span>
      <span data-testid="running">{ctx.isRunning ? 'yes' : 'no'}</span>
      <span data-testid="contactId">{ctx.contactId ?? 'null'}</span>
      <span data-testid="dealId">{ctx.dealId ?? 'null'}</span>
      <span data-testid="warning">{ctx.showLongRunningWarning ? 'yes' : 'no'}</span>
      <button data-testid="start" onClick={() => ctx.startTimer({ contactId: 'c-1', dealId: 'd-1' })}>Start</button>
      <button data-testid="start-empty" onClick={() => ctx.startTimer()}>Start Empty</button>
      <button data-testid="stop" onClick={() => ctx.stopTimer()}>Stop</button>
      <button data-testid="reset" onClick={() => ctx.resetTimer()}>Reset</button>
      <button data-testid="dismiss" onClick={() => ctx.dismissLongRunningWarning()}>Dismiss</button>
      <button data-testid="set-context" onClick={() => ctx.setTimerContext({ contactId: 'c-2', dealId: null })}>Set Context</button>
    </div>
  )
}

describe('TimerContext', () => {
  let mockLocalStorage: Record<string, string>

  beforeEach(() => {
    vi.useFakeTimers()
    mockLocalStorage = {}

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return mockLocalStorage[key] ?? null
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      mockLocalStorage[key] = value
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete mockLocalStorage[key]
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should throw error when useTimer is used outside provider', () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function BadComponent() {
      useTimer()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow('useTimer must be used within a TimerProvider')
    spy.mockRestore()
  })

  it('should provide default timer state', () => {
    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    expect(captured).not.toBeNull()
    expect(captured!.isRunning).toBe(false)
    expect(captured!.elapsedSeconds).toBe(0)
    expect(captured!.contactId).toBeNull()
    expect(captured!.dealId).toBeNull()
    expect(captured!.activityId).toBeNull()
    expect(captured!.showLongRunningWarning).toBe(false)
  })

  it('should start timer with context', () => {
    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    act(() => {
      screen.getByTestId('start').click()
    })

    expect(captured!.isRunning).toBe(true)
    expect(captured!.contactId).toBe('c-1')
    expect(captured!.dealId).toBe('d-1')
  })

  it('should start timer without context', () => {
    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    act(() => {
      screen.getByTestId('start-empty').click()
    })

    expect(captured!.isRunning).toBe(true)
    expect(captured!.contactId).toBeNull()
    expect(captured!.dealId).toBeNull()
  })

  it('should stop timer and return result', () => {
    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    // Start
    act(() => {
      screen.getByTestId('start').click()
    })

    expect(captured!.isRunning).toBe(true)

    // Stop
    act(() => {
      screen.getByTestId('stop').click()
    })

    expect(captured!.isRunning).toBe(false)
  })

  it('should reset timer to default state', () => {
    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    // Start then reset
    act(() => {
      screen.getByTestId('start').click()
    })

    expect(captured!.isRunning).toBe(true)
    expect(captured!.contactId).toBe('c-1')

    act(() => {
      screen.getByTestId('reset').click()
    })

    expect(captured!.isRunning).toBe(false)
    expect(captured!.elapsedSeconds).toBe(0)
    expect(captured!.contactId).toBeNull()
    expect(captured!.dealId).toBeNull()
  })

  it('should update timer context without affecting running state', () => {
    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    // Start with original context
    act(() => {
      screen.getByTestId('start').click()
    })

    expect(captured!.contactId).toBe('c-1')
    expect(captured!.dealId).toBe('d-1')

    // Update context
    act(() => {
      screen.getByTestId('set-context').click()
    })

    expect(captured!.isRunning).toBe(true)
    expect(captured!.contactId).toBe('c-2')
    expect(captured!.dealId).toBeNull()
  })

  it('should persist state to localStorage on change', () => {
    render(
      <TimerProvider>
        <TimerTestHarness onRender={() => {}} />
      </TimerProvider>
    )

    act(() => {
      screen.getByTestId('start').click()
    })

    const saved = mockLocalStorage['crm-timer-state']
    expect(saved).toBeDefined()

    const parsed = JSON.parse(saved)
    expect(parsed.isRunning).toBe(true)
    expect(parsed.contactId).toBe('c-1')
  })

  it('should load persisted state from localStorage on mount', () => {
    const savedState = {
      isRunning: false,
      startTime: null,
      elapsedSeconds: 300,
      contactId: 'saved-contact',
      dealId: null,
      activityId: null,
      longRunningWarningDismissed: false,
    }
    mockLocalStorage['crm-timer-state'] = JSON.stringify(savedState)

    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    // After mount effect runs
    act(() => {
      vi.runAllTimers()
    })

    expect(captured!.contactId).toBe('saved-contact')
    expect(captured!.elapsedSeconds).toBe(300)
  })

  it('should handle invalid localStorage data gracefully', () => {
    mockLocalStorage['crm-timer-state'] = 'invalid-json{{'

    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    // Should fall back to defaults
    expect(captured!.isRunning).toBe(false)
    expect(captured!.elapsedSeconds).toBe(0)
  })

  it('should dismiss long running warning and persist dismissed state', () => {
    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    act(() => {
      screen.getByTestId('dismiss').click()
    })

    expect(captured!.showLongRunningWarning).toBe(false)

    // Check that the dismissed state was persisted
    const saved = mockLocalStorage['crm-timer-state']
    const parsed = JSON.parse(saved)
    expect(parsed.longRunningWarningDismissed).toBe(true)
  })

  it('should reset warning state along with timer', () => {
    let captured: ReturnType<typeof useTimer> | null = null

    render(
      <TimerProvider>
        <TimerTestHarness onRender={(ctx) => { captured = ctx }} />
      </TimerProvider>
    )

    // Start, dismiss warning, then reset
    act(() => {
      screen.getByTestId('start').click()
    })
    act(() => {
      screen.getByTestId('dismiss').click()
    })
    act(() => {
      screen.getByTestId('reset').click()
    })

    expect(captured!.showLongRunningWarning).toBe(false)
    expect(captured!.isRunning).toBe(false)
  })
})
