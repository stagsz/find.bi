import { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { IconMenu2, IconAlertTriangle } from '@tabler/icons-react';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';

/**
 * AppLayout component that wraps authenticated pages with navigation sidebar.
 *
 * Features:
 * - Fixed sidebar on the left (w-64 / 256px) on desktop (lg+)
 * - Collapsible sidebar with overlay on tablet/mobile (<lg)
 * - Mobile header with hamburger menu
 * - Breadcrumb navigation below header area
 * - Main content area fills remaining space
 * - Responsive scrolling in main content
 * - Clean separation between navigation and content
 *
 * Responsive breakpoints:
 * - Desktop (lg / 1024px+): Sidebar always visible
 * - Tablet/Mobile (<1024px): Sidebar hidden, toggle with hamburger
 */
export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  /**
   * Close sidebar when route changes (mobile navigation).
   */
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  /**
   * Handle opening the sidebar.
   */
  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  /**
   * Handle closing the sidebar.
   */
  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile/Tablet Header - hidden on desktop */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-16 px-4 bg-slate-900 border-b border-slate-700">
        <button
          onClick={handleOpenSidebar}
          className="flex items-center justify-center w-10 h-10 rounded text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Open navigation menu"
        >
          <IconMenu2 size={24} stroke={1.5} />
        </button>
        <div className="flex items-center gap-3 ml-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded">
            <IconAlertTriangle size={18} stroke={2} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm text-white">HazOp Assistant</div>
            <div className="text-xs text-slate-400">Process Safety</div>
          </div>
        </div>
      </header>

      {/* Sidebar Overlay - mobile/tablet only */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
          onClick={handleCloseSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - responsive behavior */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <Sidebar onClose={handleCloseSidebar} showCloseButton={isSidebarOpen} />
      </div>

      {/* Main content area with breadcrumb */}
      <div className="flex-1 flex flex-col overflow-hidden pt-16 lg:pt-0">
        {/* Breadcrumb navigation */}
        <Breadcrumb />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
