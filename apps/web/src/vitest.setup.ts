import '@testing-library/jest-dom';

/**
 * Mock window.matchMedia for Mantine components in tests.
 * Mantine uses matchMedia for color scheme detection.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

/**
 * Mock ResizeObserver for Mantine ScrollArea in tests.
 * JSDOM doesn't implement ResizeObserver.
 */
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;
