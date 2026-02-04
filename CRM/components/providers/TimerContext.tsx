'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

const TIMER_STORAGE_KEY = 'crm-timer-state'

// 8 hours in seconds
const LONG_RUNNING_THRESHOLD_SECONDS = 8 * 60 * 60

interface TimerState {
  isRunning: boolean
  startTime: number | null // Unix timestamp when timer started
  elapsedSeconds: number // Elapsed time before last start (for resume)
  contactId: string | null
  dealId: string | null
  activityId: string | null
  longRunningWarningDismissed: boolean // Track if user dismissed the 8h warning for this session
}

interface TimerContextType {
  isRunning: boolean
  elapsedSeconds: number
  contactId: string | null
  dealId: string | null
  activityId: string | null
  showLongRunningWarning: boolean
  startTimer: (options?: { contactId?: string; dealId?: string; activityId?: string }) => void
  stopTimer: () => { elapsedSeconds: number; contactId: string | null; dealId: string | null; activityId: string | null }
  resetTimer: () => void
  setTimerContext: (options: { contactId?: string | null; dealId?: string | null; activityId?: string | null }) => void
  dismissLongRunningWarning: () => void
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

const defaultState: TimerState = {
  isRunning: false,
  startTime: null,
  elapsedSeconds: 0,
  contactId: null,
  dealId: null,
  activityId: null,
  longRunningWarningDismissed: false,
}

function loadTimerState(): TimerState {
  if (typeof window === 'undefined') return defaultState

  try {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as TimerState
      return {
        ...defaultState,
        ...parsed,
      }
    }
  } catch {
    // Invalid JSON, return default
  }
  return defaultState
}

function saveTimerState(state: TimerState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable, ignore
  }
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TimerState>(defaultState)
  const [currentElapsed, setCurrentElapsed] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [showLongRunningWarning, setShowLongRunningWarning] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)

  // Load state from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const loaded = loadTimerState()
    setState(loaded)

    // Calculate current elapsed time if timer was running
    if (loaded.isRunning && loaded.startTime) {
      const now = Date.now()
      const elapsed = loaded.elapsedSeconds + Math.floor((now - loaded.startTime) / 1000)
      setCurrentElapsed(elapsed)
    } else {
      setCurrentElapsed(loaded.elapsedSeconds)
    }
  }, [])

  // Timer tick interval
  useEffect(() => {
    if (!mounted) return

    if (state.isRunning && state.startTime) {
      // Update every second
      intervalRef.current = setInterval(() => {
        const now = Date.now()
        const elapsed = state.elapsedSeconds + Math.floor((now - state.startTime!) / 1000)
        setCurrentElapsed(elapsed)

        // Check if timer has exceeded 8 hours and warning hasn't been dismissed
        if (elapsed >= LONG_RUNNING_THRESHOLD_SECONDS && !state.longRunningWarningDismissed) {
          setShowLongRunningWarning(true)
        }
      }, 1000)

      // Auto-save every 60 seconds
      autoSaveRef.current = setInterval(() => {
        saveTimerState(state)
      }, 60000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current)
        autoSaveRef.current = null
      }
    }
  }, [mounted, state.isRunning, state.startTime, state.elapsedSeconds])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (mounted) {
      saveTimerState(state)
    }
  }, [mounted, state])

  const startTimer = useCallback((options?: { contactId?: string; dealId?: string; activityId?: string }) => {
    const now = Date.now()
    setState((prev) => ({
      ...prev,
      isRunning: true,
      startTime: now,
      contactId: options?.contactId ?? prev.contactId,
      dealId: options?.dealId ?? prev.dealId,
      activityId: options?.activityId ?? prev.activityId,
    }))
  }, [])

  const stopTimer = useCallback(() => {
    let result = {
      elapsedSeconds: currentElapsed,
      contactId: state.contactId,
      dealId: state.dealId,
      activityId: state.activityId,
    }

    setState((prev) => {
      // Calculate final elapsed time
      const finalElapsed = prev.startTime
        ? prev.elapsedSeconds + Math.floor((Date.now() - prev.startTime) / 1000)
        : prev.elapsedSeconds

      result = {
        elapsedSeconds: finalElapsed,
        contactId: prev.contactId,
        dealId: prev.dealId,
        activityId: prev.activityId,
      }

      return {
        ...prev,
        isRunning: false,
        startTime: null,
        elapsedSeconds: finalElapsed,
      }
    })

    return result
  }, [currentElapsed, state.contactId, state.dealId, state.activityId])

  const resetTimer = useCallback(() => {
    setState(defaultState)
    setCurrentElapsed(0)
    setShowLongRunningWarning(false)
  }, [])

  const dismissLongRunningWarning = useCallback(() => {
    setShowLongRunningWarning(false)
    setState((prev) => ({
      ...prev,
      longRunningWarningDismissed: true,
    }))
  }, [])

  const setTimerContext = useCallback((options: { contactId?: string | null; dealId?: string | null; activityId?: string | null }) => {
    setState((prev) => ({
      ...prev,
      contactId: options.contactId !== undefined ? options.contactId : prev.contactId,
      dealId: options.dealId !== undefined ? options.dealId : prev.dealId,
      activityId: options.activityId !== undefined ? options.activityId : prev.activityId,
    }))
  }, [])

  return (
    <TimerContext.Provider
      value={{
        isRunning: state.isRunning,
        elapsedSeconds: currentElapsed,
        contactId: state.contactId,
        dealId: state.dealId,
        activityId: state.activityId,
        showLongRunningWarning,
        startTimer,
        stopTimer,
        resetTimer,
        setTimerContext,
        dismissLongRunningWarning,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return context
}
