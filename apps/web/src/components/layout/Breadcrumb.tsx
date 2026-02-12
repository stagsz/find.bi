import { Link, useLocation, useParams } from 'react-router-dom';
import { IconChevronRight, IconHome } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { projectsService } from '../../services/projects.service';
import { analysesService } from '../../services/analyses.service';
import { NotificationDropdown } from './NotificationDropdown';

/**
 * A breadcrumb item with label and optional link.
 */
interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Route path (if navigable) */
  path?: string;
  /** Whether this is the current page (last item) */
  isCurrent?: boolean;
}

/**
 * Static route configuration for breadcrumb labels.
 */
const STATIC_ROUTES: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/admin': 'User Management',
  '/profile': 'Profile',
  '/unauthorized': 'Unauthorized',
};

/**
 * Dynamic route suffixes and their labels.
 */
const DYNAMIC_SUFFIXES: Record<string, string> = {
  'risk-dashboard': 'Risk Dashboard',
  compliance: 'Compliance',
  'compliance-dashboard': 'Compliance Dashboard',
  reports: 'Reports',
  analyses: 'Analyses',
};

/**
 * Breadcrumb navigation component.
 *
 * Features:
 * - Automatically generates breadcrumb trail from current route
 * - Fetches entity names for dynamic routes (projects, analyses)
 * - Home icon for dashboard link
 * - Clean, professional styling matching HazOp design system
 * - Last item is not clickable (current page indicator)
 * - Hidden on dashboard (root route)
 */
export function Breadcrumb() {
  const location = useLocation();
  const params = useParams<{ projectId?: string; analysisId?: string }>();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [analysisName, setAnalysisName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch project and analysis names when params change
  useEffect(() => {
    const fetchNames = async () => {
      if (params.projectId) {
        setIsLoading(true);
        try {
          const projectResult = await projectsService.getProject(params.projectId);
          if (projectResult.success && projectResult.data?.project) {
            setProjectName(projectResult.data.project.name);
          } else {
            setProjectName(null);
          }

          if (params.analysisId) {
            const analysisResult = await analysesService.getAnalysis(params.analysisId);
            if (analysisResult.success && analysisResult.data?.analysis) {
              setAnalysisName(analysisResult.data.analysis.name);
            } else {
              setAnalysisName(null);
            }
          } else {
            setAnalysisName(null);
          }
        } catch {
          // Use fallback ID-based names on error
          setProjectName(null);
          setAnalysisName(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        setProjectName(null);
        setAnalysisName(null);
      }
    };

    fetchNames();
  }, [params.projectId, params.analysisId]);

  /**
   * Build breadcrumb items from current path.
   */
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const pathname = location.pathname;
    const items: BreadcrumbItem[] = [];

    // Always start with Dashboard
    items.push({
      label: 'Dashboard',
      path: '/',
    });

    // Handle static routes
    if (pathname === '/') {
      // Don't show breadcrumb on dashboard
      return [];
    }

    if (pathname === '/profile') {
      items.push({ label: 'Profile', isCurrent: true });
      return items;
    }

    if (pathname === '/admin') {
      items.push({ label: 'User Management', isCurrent: true });
      return items;
    }

    if (pathname === '/unauthorized') {
      items.push({ label: 'Unauthorized', isCurrent: true });
      return items;
    }

    // Handle projects routes
    if (pathname.startsWith('/projects')) {
      items.push({
        label: 'Projects',
        path: '/projects',
      });

      if (params.projectId) {
        const projectLabel = projectName || `Project ${params.projectId.slice(0, 8)}...`;
        const projectPath = `/projects/${params.projectId}`;

        // Check for nested paths under project
        const pathAfterProject = pathname.replace(`/projects/${params.projectId}`, '');

        if (pathAfterProject === '' || pathAfterProject === '/') {
          // On project detail page
          items.push({ label: projectLabel, isCurrent: true });
        } else if (params.analysisId) {
          // On analysis workspace
          items.push({
            label: projectLabel,
            path: projectPath,
          });
          const analysisLabel = analysisName || `Analysis ${params.analysisId.slice(0, 8)}...`;
          items.push({ label: analysisLabel, isCurrent: true });
        } else {
          // On other project sub-pages (risk-dashboard, compliance, etc.)
          items.push({
            label: projectLabel,
            path: projectPath,
          });

          // Find the suffix label
          const suffix = pathAfterProject.replace('/', '');
          const suffixLabel = DYNAMIC_SUFFIXES[suffix] || suffix;
          items.push({ label: suffixLabel, isCurrent: true });
        }
      } else {
        // On projects list
        items[items.length - 1].isCurrent = true;
        delete items[items.length - 1].path;
      }
    }

    return items;
  };

  const breadcrumbs = buildBreadcrumbs();
  const isDashboard = breadcrumbs.length === 0;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200"
    >
      {/* Breadcrumb trail - empty on dashboard */}
      <ol className="flex items-center gap-2 text-sm">
        {isDashboard ? (
          <li className="flex items-center">
            <span className="text-slate-700 font-medium" aria-current="page">
              <IconHome size={16} stroke={1.5} className="inline-block mr-1.5 -mt-0.5" />
              Dashboard
            </span>
          </li>
        ) : (
          breadcrumbs.map((item, index) => (
            <li key={item.label + index} className="flex items-center">
              {index > 0 && (
                <IconChevronRight
                  size={14}
                  stroke={2}
                  className="text-slate-400 mx-2"
                  aria-hidden="true"
                />
              )}

              {item.isCurrent ? (
                <span
                  className="text-slate-700 font-medium"
                  aria-current="page"
                >
                  {index === 0 && (
                    <IconHome size={16} stroke={1.5} className="inline-block mr-1.5 -mt-0.5" />
                  )}
                  {isLoading && (item.label.includes('Project') || item.label.includes('Analysis')) ? (
                    <span className="inline-block w-20 h-4 bg-slate-200 rounded animate-pulse" />
                  ) : (
                    item.label
                  )}
                </span>
              ) : (
                <Link
                  to={item.path || '/'}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {index === 0 && (
                    <IconHome size={16} stroke={1.5} className="inline-block mr-1.5 -mt-0.5" />
                  )}
                  {isLoading && (item.label.includes('Project') || item.label.includes('Analysis')) ? (
                    <span className="inline-block w-20 h-4 bg-slate-200 rounded animate-pulse" />
                  ) : (
                    item.label
                  )}
                </Link>
              )}
            </li>
          ))
        )}
      </ol>

      {/* Header actions - notifications */}
      <div className="hidden lg:flex items-center">
        <NotificationDropdown />
      </div>
    </nav>
  );
}
