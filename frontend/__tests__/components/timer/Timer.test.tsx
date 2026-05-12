import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Timer from '@/components/timer/Timer'

// Mock the useTimer hook
const mockStartTimer = vi.fn()
const mockStopTimer = vi.fn()
const mockResetTimer = vi.fn()
const mockDismissLongRunningWarning = vi.fn()

let mockTimerState = {
  isRunning: false,
  elapsedSeconds: 0,
  contactId: null as string | null,
  dealId: null as string | null,
  activityId: null as string | null,
  showLongRunningWarning: false,
  startTimer: mockStartTimer,
  stopTimer: mockStopTimer,
  resetTimer: mockResetTimer,
  setTimerContext: vi.fn(),
  dismissLongRunningWarning: mockDismissLongRunningWarning,
}

vi.mock('@/components/providers/TimerContext', () => ({
  useTimer: () => mockTimerState,
}))

describe('Timer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTimerState = {
      isRunning: false,
      elapsedSeconds: 0,
      contactId: null,
      dealId: null,
      activityId: null,
      showLongRunningWarning: false,
      startTimer: mockStartTimer,
      stopTimer: mockStopTimer,
      resetTimer: mockResetTimer,
      setTimerContext: vi.fn(),
      dismissLongRunningWarning: mockDismissLongRunningWarning,
    }
    mockStopTimer.mockReturnValue({ elapsedSeconds: 0, contactId: null, dealId: null, activityId: null })
  })

  describe('Full mode (default)', () => {
    it('should render with 00:00:00 when not running', () => {
      render(<Timer />)

      expect(screen.getByText('00:00:00')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start timer/i })).toBeInTheDocument()
    })

    it('should display label when provided', () => {
      render(<Timer label="Track Time" />)

      expect(screen.getByText('Track Time')).toBeInTheDocument()
    })

    it('should not display label when not provided', () => {
      render(<Timer />)

      expect(screen.queryByText('Track Time')).not.toBeInTheDocument()
    })

    it('should format elapsed time correctly', () => {
      mockTimerState.elapsedSeconds = 3661 // 1h 1m 1s

      render(<Timer />)

      expect(screen.getByText('01:01:01')).toBeInTheDocument()
    })

    it('should format zero-padded time correctly', () => {
      mockTimerState.elapsedSeconds = 5 // 0h 0m 5s

      render(<Timer />)

      expect(screen.getByText('00:00:05')).toBeInTheDocument()
    })

    it('should call startTimer with context when start button is clicked', () => {
      render(<Timer contactId="c-1" dealId="d-1" activityId="a-1" />)

      fireEvent.click(screen.getByRole('button', { name: /start timer/i }))

      expect(mockStartTimer).toHaveBeenCalledWith({
        contactId: 'c-1',
        dealId: 'd-1',
        activityId: 'a-1',
      })
    })

    it('should show Stop button when timer is running here', () => {
      mockTimerState.isRunning = true
      mockTimerState.contactId = 'c-1'

      render(<Timer contactId="c-1" />)

      expect(screen.getByRole('button', { name: /stop timer/i })).toBeInTheDocument()
      expect(screen.getByText('Timer running...')).toBeInTheDocument()
    })

    it('should call stopTimer and onStop when stop button is clicked', () => {
      mockTimerState.isRunning = true
      mockTimerState.contactId = 'c-1'
      mockStopTimer.mockReturnValue({ elapsedSeconds: 120, contactId: 'c-1', dealId: null, activityId: null })
      const onStop = vi.fn()

      render(<Timer contactId="c-1" onStop={onStop} />)

      fireEvent.click(screen.getByRole('button', { name: /stop timer/i }))

      expect(mockStopTimer).toHaveBeenCalled()
      expect(onStop).toHaveBeenCalledWith(120)
    })

    it('should show Switch Here button when timer runs elsewhere', () => {
      mockTimerState.isRunning = true
      mockTimerState.contactId = 'other-contact'

      render(<Timer contactId="c-1" />)

      expect(screen.getByRole('button', { name: /switch timer to here/i })).toBeInTheDocument()
      expect(screen.getByText(/timer running on another/i)).toBeInTheDocument()
    })

    it('should stop, reset, and restart timer when switch button is clicked', () => {
      mockTimerState.isRunning = true
      mockTimerState.contactId = 'other-contact'
      mockStopTimer.mockReturnValue({ elapsedSeconds: 60, contactId: 'other-contact', dealId: null, activityId: null })

      render(<Timer contactId="c-1" />)

      fireEvent.click(screen.getByRole('button', { name: /switch timer to here/i }))

      expect(mockStopTimer).toHaveBeenCalled()
      expect(mockResetTimer).toHaveBeenCalled()
      expect(mockStartTimer).toHaveBeenCalledWith({
        contactId: 'c-1',
        dealId: undefined,
        activityId: undefined,
      })
    })

    it('should show Reset button when timer is stopped but has elapsed time', () => {
      mockTimerState.elapsedSeconds = 300

      render(<Timer />)

      expect(screen.getByRole('button', { name: /reset timer/i })).toBeInTheDocument()
    })

    it('should not show Reset button when elapsed time is 0', () => {
      render(<Timer />)

      expect(screen.queryByRole('button', { name: /reset timer/i })).not.toBeInTheDocument()
    })

    it('should call resetTimer when reset button is clicked', () => {
      mockTimerState.elapsedSeconds = 300

      render(<Timer />)

      fireEvent.click(screen.getByRole('button', { name: /reset timer/i }))

      expect(mockResetTimer).toHaveBeenCalled()
    })

    it('should show long running warning when enabled and running here', () => {
      mockTimerState.isRunning = true
      mockTimerState.showLongRunningWarning = true

      render(<Timer />)

      expect(screen.getByText('Timer running for 8+ hours')).toBeInTheDocument()
      expect(screen.getByText('Did you forget to stop the timer?')).toBeInTheDocument()
    })

    it('should not show long running warning when timer runs elsewhere', () => {
      mockTimerState.isRunning = true
      mockTimerState.contactId = 'other-contact'
      mockTimerState.showLongRunningWarning = true

      render(<Timer contactId="c-1" />)

      expect(screen.queryByText('Timer running for 8+ hours')).not.toBeInTheDocument()
    })

    it('should call dismissLongRunningWarning when dismiss button is clicked', () => {
      mockTimerState.isRunning = true
      mockTimerState.showLongRunningWarning = true

      render(<Timer />)

      fireEvent.click(screen.getByRole('button', { name: /dismiss warning/i }))

      expect(mockDismissLongRunningWarning).toHaveBeenCalled()
    })

    it('should detect running here for deal-based timer', () => {
      mockTimerState.isRunning = true
      mockTimerState.dealId = 'd-1'

      render(<Timer dealId="d-1" />)

      expect(screen.getByRole('button', { name: /stop timer/i })).toBeInTheDocument()
      expect(screen.getByText('Timer running...')).toBeInTheDocument()
    })

    it('should detect running elsewhere for deal-based timer', () => {
      mockTimerState.isRunning = true
      mockTimerState.dealId = 'other-deal'

      render(<Timer dealId="d-1" />)

      expect(screen.getByRole('button', { name: /switch timer to here/i })).toBeInTheDocument()
    })
  })

  describe('Compact mode', () => {
    it('should render compact timer display', () => {
      render(<Timer compact />)

      expect(screen.getByText('00:00:00')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start timer/i })).toBeInTheDocument()
    })

    it('should show stop button in compact mode when running here', () => {
      mockTimerState.isRunning = true

      render(<Timer compact />)

      expect(screen.getByRole('button', { name: /stop timer/i })).toBeInTheDocument()
    })

    it('should show switch button in compact mode when running elsewhere', () => {
      mockTimerState.isRunning = true
      mockTimerState.contactId = 'other-contact'

      render(<Timer compact contactId="c-1" />)

      expect(screen.getByRole('button', { name: /switch timer to here/i })).toBeInTheDocument()
    })

    it('should show long running warning indicator in compact mode', () => {
      mockTimerState.isRunning = true
      mockTimerState.showLongRunningWarning = true

      render(<Timer compact />)

      expect(screen.getByRole('button', { name: /timer running for 8\+ hours/i })).toBeInTheDocument()
    })

    it('should call dismissLongRunningWarning when compact warning is clicked', () => {
      mockTimerState.isRunning = true
      mockTimerState.showLongRunningWarning = true

      render(<Timer compact />)

      fireEvent.click(screen.getByRole('button', { name: /timer running for 8\+ hours/i }))

      expect(mockDismissLongRunningWarning).toHaveBeenCalled()
    })

    it('should not show running indicator text in compact mode', () => {
      mockTimerState.isRunning = true

      render(<Timer compact />)

      // Compact mode doesn't show text indicators
      expect(screen.queryByText('Timer running...')).not.toBeInTheDocument()
    })
  })
})
