import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme, MantineColorScheme } from '@mantine/core';
import App from './App';
import { useThemeStore, selectColorScheme } from './store';
import { ErrorBoundary } from './components/errors';
import './index.css';
import '@mantine/core/styles.css';

/**
 * Custom Mantine theme for HazOp Assistant.
 * Professional, regulatory-document aesthetic with clean typography.
 */
const theme = createTheme({
  primaryColor: 'blue',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'sm',
});

/**
 * Theme-aware provider component that syncs Zustand state with Mantine.
 */
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const colorScheme = useThemeStore(selectColorScheme);

  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme={colorScheme as MantineColorScheme}
      forceColorScheme={colorScheme as MantineColorScheme}
    >
      {children}
    </MantineProvider>
  );
}

/**
 * Global error handler for logging unhandled errors.
 * In production, this would send errors to a monitoring service.
 */
function handleGlobalError(error: Error): void {
  if (import.meta.env.DEV) {
    console.error('[Global Error Boundary] Unhandled error:', error);
  }
  // In production, send to error monitoring service (e.g., Sentry)
  // errorMonitoringService.captureException(error);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallbackVariant="page"
      fallbackTitle="Application Error"
      fallbackDescription="The application encountered an unexpected error. Please refresh the page to try again."
      onError={handleGlobalError}
    >
      <ThemeWrapper>
        <App />
      </ThemeWrapper>
    </ErrorBoundary>
  </React.StrictMode>
);
