import { NavLink, useLocation } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconFolders,
  IconShieldCheck,
  IconFileReport,
  IconUsers,
  IconUser,
  IconLogout,
  IconAlertTriangle,
  IconX,
} from '@tabler/icons-react';
import { useAuthStore, selectUser } from '../../store/auth.store';
import { authService } from '../../services/auth.service';
import { useNavigate } from 'react-router-dom';

/**
 * Sidebar props for responsive behavior.
 */
interface SidebarProps {
  /** Callback to close the sidebar (mobile/tablet) */
  onClose?: () => void;
  /** Whether to show the close button (mobile/tablet) */
  showCloseButton?: boolean;
}

/**
 * Navigation item configuration.
 */
interface NavItem {
  /** Display label */
  label: string;
  /** Route path */
  path: string;
  /** Icon component */
  icon: React.ComponentType<{ size?: number; stroke?: number; className?: string }>;
  /** Minimum role required to see this item */
  minRole?: 'viewer' | 'analyst' | 'lead_analyst' | 'administrator';
  /** Whether this is an exact match route */
  exact?: boolean;
}

/**
 * Role hierarchy for permission checks.
 */
const ROLE_HIERARCHY = ['viewer', 'analyst', 'lead_analyst', 'administrator'] as const;

/**
 * Check if a user role meets the minimum required role.
 */
function hasMinRole(
  userRole: string,
  minRole: 'viewer' | 'analyst' | 'lead_analyst' | 'administrator'
): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole as (typeof ROLE_HIERARCHY)[number]);
  const minIndex = ROLE_HIERARCHY.indexOf(minRole);
  return userIndex >= minIndex;
}

/**
 * Main navigation items.
 */
const MAIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: IconLayoutDashboard,
    exact: true,
  },
  {
    label: 'Projects',
    path: '/projects',
    icon: IconFolders,
  },
];

/**
 * Admin navigation items.
 */
const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'User Management',
    path: '/admin',
    icon: IconUsers,
    minRole: 'administrator',
  },
];

/**
 * Main navigation sidebar component.
 *
 * Features:
 * - Logo/brand at top
 * - Main navigation links with icons
 * - Admin section (visible to administrators only)
 * - User menu at bottom with profile link and logout
 * - Active route highlighting
 * - Clean, professional design matching HazOp industrial aesthetic
 * - Responsive: Close button on mobile/tablet
 */
export function Sidebar({ onClose, showCloseButton = false }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  /**
   * Handle user logout.
   */
  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  /**
   * Check if a route is active.
   */
  const isActiveRoute = (path: string, exact?: boolean): boolean => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  /**
   * Filter navigation items based on user role.
   */
  const filterByRole = (items: NavItem[]): NavItem[] => {
    if (!user) return [];
    return items.filter((item) => {
      if (!item.minRole) return true;
      return hasMinRole(user.role, item.minRole);
    });
  };

  /**
   * Format user role for display.
   */
  const formatRole = (role: string): string => {
    return role
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const visibleMainItems = filterByRole(MAIN_NAV_ITEMS);
  const visibleAdminItems = filterByRole(ADMIN_NAV_ITEMS);

  return (
    <aside className="flex flex-col h-screen w-64 bg-slate-900 text-white">
      {/* Logo/Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700">
        <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded">
          <IconAlertTriangle size={20} stroke={2} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-white">HazOp Assistant</div>
          <div className="text-xs text-slate-400">Process Safety</div>
        </div>
        {/* Close button - mobile/tablet only */}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded text-slate-400 hover:bg-slate-800 hover:text-white transition-colors lg:hidden"
            aria-label="Close navigation menu"
          >
            <IconX size={20} stroke={1.5} />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Main
          </div>
          <ul className="space-y-1">
            {visibleMainItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.path, item.exact);
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={20} stroke={1.5} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Admin Section */}
        {visibleAdminItems.length > 0 && (
          <div className="px-3 mt-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Administration
            </div>
            <ul className="space-y-1">
              {visibleAdminItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.path, item.exact);
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon size={20} stroke={1.5} />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Quick Links */}
        <div className="px-3 mt-6">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Tools
          </div>
          <ul className="space-y-1">
            <li>
              <div className="flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-400">
                <IconShieldCheck size={20} stroke={1.5} />
                <span>Compliance</span>
                <span className="ml-auto text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                  Project
                </span>
              </div>
            </li>
            <li>
              <div className="flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-400">
                <IconFileReport size={20} stroke={1.5} />
                <span>Reports</span>
                <span className="ml-auto text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                  Project
                </span>
              </div>
            </li>
          </ul>
        </div>
      </nav>

      {/* User Menu */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-9 h-9 bg-slate-700 rounded-full text-sm font-medium">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.name}</div>
            <div className="text-xs text-slate-400 truncate">{user && formatRole(user.role)}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <NavLink
            to="/profile"
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs transition-colors ${
              location.pathname === '/profile'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <IconUser size={16} stroke={1.5} />
            <span>Profile</span>
          </NavLink>
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
          >
            <IconLogout size={16} stroke={1.5} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
