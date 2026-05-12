'use client'

import { useTimer } from '@/components/providers/TimerContext'

/**
 * Format seconds into HH:MM:SS display format
 */
function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

interface TimerProps {
  /** Optional label to display above the timer */
  label?: string
  /** Contact ID to associate with this timer session */
  contactId?: string
  /** Deal ID to associate with this timer session */
  dealId?: string
  /** Activity ID to associate with this timer session */
  activityId?: string
  /** Callback when timer is stopped, receives elapsed seconds */
  onStop?: (elapsedSeconds: number) => void
  /** Show compact version (smaller, no label) */
  compact?: boolean
}

export default function Timer({
  label,
  contactId,
  dealId,
  activityId,
  onStop,
  compact = false,
}: TimerProps) {
  const {
    isRunning,
    elapsedSeconds,
    contactId: runningContactId,
    dealId: runningDealId,
    showLongRunningWarning,
    startTimer,
    stopTimer,
    resetTimer,
    dismissLongRunningWarning,
  } = useTimer()

  // Check if timer is running for a different entity than this component
  const isRunningElsewhere = isRunning && (
    (contactId && runningContactId !== contactId) ||
    (dealId && runningDealId !== dealId) ||
    (!contactId && !dealId && (runningContactId || runningDealId))
  )

  // Check if timer is running for this specific entity
  const isRunningHere = isRunning && (
    (contactId && runningContactId === contactId && !dealId) ||
    (dealId && runningDealId === dealId) ||
    (!contactId && !dealId && !runningContactId && !runningDealId)
  )

  const handleStart = () => {
    startTimer({ contactId, dealId, activityId })
  }

  const handleStop = () => {
    const result = stopTimer()
    onStop?.(result.elapsedSeconds)
  }

  const handleReset = () => {
    resetTimer()
  }

  const handleSwitchTimer = () => {
    // Stop the existing timer (loses time for the previous entity)
    stopTimer()
    // Reset and start fresh for this entity
    resetTimer()
    startTimer({ contactId, dealId, activityId })
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        {/* Long running warning indicator for compact mode */}
        {showLongRunningWarning && isRunningHere && (
          <button
            onClick={dismissLongRunningWarning}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition"
            title="Timer running for 8+ hours - click to dismiss"
            aria-label="Timer running for 8+ hours - click to dismiss"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          </button>
        )}
        <span
          className={`font-mono text-sm ${
            showLongRunningWarning && isRunningHere
              ? 'text-amber-600 dark:text-amber-400'
              : isRunningHere
              ? 'text-green-600 dark:text-green-400'
              : isRunningElsewhere
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {formatElapsedTime(elapsedSeconds)}
        </span>
        {isRunningHere ? (
          <button
            onClick={handleStop}
            className="p-1.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
            aria-label="Stop timer"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : isRunningElsewhere ? (
          <button
            onClick={handleSwitchTimer}
            className="p-1.5 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition"
            aria-label="Switch timer to here"
            title="Timer running elsewhere - click to switch"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition"
            aria-label="Start timer"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {label && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </div>
      )}

      <div className="flex items-center justify-between">
        {/* Timer Display */}
        <div
          className={`font-mono text-2xl font-semibold ${
            isRunningHere
              ? 'text-green-600 dark:text-green-400'
              : isRunningElsewhere
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {formatElapsedTime(elapsedSeconds)}
        </div>

        {/* Timer Controls */}
        <div className="flex items-center gap-2">
          {isRunningHere ? (
            <button
              onClick={handleStop}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-500 rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition flex items-center gap-2"
              aria-label="Stop timer"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </button>
          ) : isRunningElsewhere ? (
            <button
              onClick={handleSwitchTimer}
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 dark:bg-yellow-500 rounded-md hover:bg-yellow-700 dark:hover:bg-yellow-600 transition flex items-center gap-2"
              aria-label="Switch timer to here"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
              </svg>
              Switch Here
            </button>
          ) : (
            <>
              <button
                onClick={handleStart}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 dark:bg-green-500 rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition flex items-center gap-2"
                aria-label="Start timer"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start
              </button>
              {elapsedSeconds > 0 && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                  aria-label="Reset timer"
                >
                  Reset
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Running indicator */}
      {isRunningHere && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Timer running...
        </div>
      )}

      {/* Running elsewhere indicator */}
      {isRunningElsewhere && (
        <div className="mt-3 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          Timer running on another {runningDealId ? 'deal' : 'contact'}
        </div>
      )}

      {/* Long running timer warning (8+ hours) */}
      {showLongRunningWarning && isRunningHere && (
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Timer running for 8+ hours
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Did you forget to stop the timer?
                </p>
              </div>
            </div>
            <button
              onClick={dismissLongRunningWarning}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition"
              aria-label="Dismiss warning"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
