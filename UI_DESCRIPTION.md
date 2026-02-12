# HazOp Assistant - UI Description

## UI Overview

**"A professional, enterprise-grade industrial safety analysis platform with a clean 'regulatory document aesthetic'. The interface uses minimal design with subtle borders (1px slate-200), very small border radii (4px), and a strict slate/blue color palette. It features split-pane workspace layouts for technical analysis, card-based displays for project management, and semantic safety color coding (green/amber/red) for risk visualization. Built with Tailwind CSS utility classes and Mantine UI components, the design prioritizes clarity, data density, and professional presentation over decorative elements."**

## Key UI Characteristics

### 1. Color Palette
- **Base Colors**: Slate grays (50-900) for backgrounds, borders, and text
- **Accent Colors**: Blue (700-800) for interactive elements and links
- **Semantic Safety Colors**:
  - Green (50/800) for low risk / safe conditions
  - Amber (50/800) for medium risk / caution
  - Red (50/800) for high risk / danger

### 2. Typography
- System font stack for optimal readability
- Clear hierarchy with font weights:
  - Regular (400) for body text
  - Medium (500) for labels and secondary headings
  - Semibold (600) for primary headings
  - Bold (700) for emphasis
- Consistent sizing: xs (12px), sm (14px), base (16px), lg (18px), xl (20px), 2xl (24px)

### 3. Layout Patterns

#### Split-Pane Workspace
- Resizable divider between P&ID viewer (left) and analysis panel (right)
- Minimum left pane width: 300px
- Maximum left pane width: 75% of container
- Default split: 50/50

#### Card-Based Project Listings
- White background with slate-200 borders
- Hover state: slate-300 border
- Structured sections: header, body, footer
- Status badges prominently displayed

#### Data-Dense Tables
- Compact information display
- Grid layouts (2-column for metadata)
- Uppercase tracking-wide labels (xs size, slate-400)
- Truncation for long text with title tooltips

#### Modal Forms
- Centered overlays for data entry
- Clear action buttons (primary/secondary)
- Validation feedback inline with fields

### 4. Components

#### Badges
- Minimal style: 2-2.5px horizontal padding, 0.5-1px vertical padding
- Border + background + text color coordination
- Semantic colors for status indication
- Small border radius (4px)

#### Buttons
- Subtle variant preferred (no heavy backgrounds)
- Blue color scheme for primary actions
- Gray for secondary actions
- Small (xs, sm) sizes common
- 4px border radius

#### Form Inputs
- Mantine UI components with custom styling
- 4px border radius
- Blue focus ring (1e40af)
- Medium font weight labels (500)
- 6px label bottom margin

#### Interactive P&ID Viewer
- Zoom/pan controls (scroll to zoom, drag to pan)
- Node overlay markers (clickable)
- Toolbar with zoom percentage display
- Keyboard shortcuts (+/-/0/F)

### 5. Design Philosophy

**"Technical-Professional" over "Modern-Consumer"**

This UI is optimized for:
- Engineers conducting safety analysis
- Long-form work sessions (hours, not minutes)
- Data accuracy and clarity over visual appeal
- Professional documentation and regulatory compliance
- Multi-stakeholder review and approval workflows

**NOT optimized for:**
- Consumer marketing aesthetics
- Trend-following design patterns
- Decorative elements or illustrations
- Gamification or engagement tricks
- Mobile-first responsive design

## Technology Stack

- **Styling**: Tailwind CSS 4.1.18 (utility-first)
- **Components**: Mantine UI 8.3.14 (minimal configuration)
- **Framework**: React 18 + TypeScript 5.3+
- **Build Tool**: Vite 7.3.1
- **State Management**: Zustand 5.0 (auth store)
- **Routing**: React Router 6.22

## Design System Origin

### Was a Skill Used?

**No, the frontend-design skill was NOT used to build this UI.**

The entire application was built using the **Ralph autonomous AI methodology** with sequential task completion. Each feature was implemented following standard development practices:

- **SETUP-05**: Configured Tailwind CSS and Mantine UI (commit 8ffe440)
- **Individual Features**: Built task-by-task following the implementation plan
  - AUTH-10: Login page (commit bf0aa75)
  - PROJ-09: Project card component (commit 8ec4869)
  - HAZOP-*: Analysis workspace components
  - RISK-*: Risk assessment UI components
  - COMP-*: Compliance validation screens

The consistent design language came from:
1. **Explicit design decisions** documented in code comments (e.g., "Design follows regulatory document aesthetic")
2. **Manual design system** crafted with a clear vision for an industrial safety tool
3. **Iterative development** following established patterns across components

## Example Component Styles

### Project Card
```tsx
<div className="bg-white rounded border border-slate-200 hover:border-slate-300 transition-colors">
  {/* Header with title and status badge */}
  <div className="px-4 py-3 border-b border-slate-100">
    <StatusBadge status={project.status} />
  </div>

  {/* Body with metadata grid */}
  <div className="px-4 py-3">
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-slate-400 text-xs uppercase tracking-wide">Label</dt>
      <dd className="text-slate-700">Value</dd>
    </dl>
  </div>

  {/* Footer with actions */}
  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
    <Button variant="subtle" size="xs" color="blue">View</Button>
  </div>
</div>
```

### Risk Score Badge
```tsx
<span className="inline-flex items-center gap-1.5 rounded font-medium border
              bg-red-50 text-red-800 border-red-200 text-xs px-2 py-0.5">
  <span className="font-semibold">85</span>
  <span>High Risk</span>
</span>
```

### Analysis Workspace Header
```tsx
<header className="flex-shrink-0 bg-white border-b border-slate-200">
  <div className="px-4 sm:px-6">
    <div className="flex justify-between items-center h-14">
      {/* Breadcrumb and analysis info */}
      <div className="flex items-center gap-4">
        <Link className="text-lg font-semibold text-slate-900">HazOp</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-900">Analysis Name</span>
        <StatusBadge status="draft" />
      </div>

      {/* User and actions */}
      <div className="flex items-center gap-4">
        <Link className="text-sm text-slate-600">User Name</Link>
        <Button variant="subtle" color="gray" size="xs">Sign out</Button>
      </div>
    </div>
  </div>
</header>
```

## Prompt for Agent

If you wanted to give an agent a prompt to recreate this UI style, you would say:

> "Build a professional industrial safety analysis interface with a 'regulatory document aesthetic'. Use Tailwind CSS with strict constraints: slate color palette (50-900), minimal 4px border radii, 1px borders (slate-200), and semantic safety colors (green/amber/red for risk levels). Design for engineers, not consumers - prioritize data density, clarity, and professional presentation. No decorative elements, gradients, or shadows. Use Mantine UI components with subtle styling. Create split-pane layouts for technical workspaces, card-based layouts for lists, and compact badge/button components. All text should be highly readable with clear hierarchy using system fonts at weights 400-700."
