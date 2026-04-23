export interface ProductScreenshot {
  id: string;
  title: string;
  description: string;
  fileName: string;
  route: string;
  alt: string;
}

export interface GuideStep {
  title: string;
  description: string;
}

export interface UserGuideSection {
  id: string;
  title: string;
  summary: string;
  route: string;
  screenshotId: string;
  steps: GuideStep[];
}

export const productScreenshots: ProductScreenshot[] = [
  {
    id: 'dashboard-overview',
    title: 'Dashboard overview',
    description: 'Key usage metrics, sync actions, and recent session activity in one view.',
    fileName: 'dashboard-overview.png',
    route: '/dashboard',
    alt: 'Dashboard overview showing metrics, quick actions, and recent sessions.',
  },
  {
    id: 'sessions-list',
    title: 'Sessions list',
    description: 'Filterable session inventory with message, token, and cost summaries.',
    fileName: 'sessions-list.png',
    route: '/sessions',
    alt: 'Sessions page showing filter buttons and a table of Claude sessions.',
  },
  {
    id: 'analytics-overview',
    title: 'Analytics overview',
    description:
      'Operator dashboard with KPI cards, trend charts, tool mix, project leaderboard, and hotspots.',
    fileName: 'analytics-overview.png',
    route: '/analytics',
    alt: 'Analytics dashboard showing operator KPIs, charts, leaderboards, and hotspot panels.',
  },
  {
    id: 'session-detail',
    title: 'Session detail',
    description:
      'Deep dive into one conversation with summary, files, folders, and message history.',
    fileName: 'session-detail.png',
    route: '/sessions/demo-session-active',
    alt: 'Detailed session page with summary, metadata, and conversation timeline.',
  },
  {
    id: 'tiling-monitor',
    title: 'Tiling monitor',
    description: 'Real-time terminal-inspired monitoring for active sessions.',
    fileName: 'tiling-monitor.png',
    route: '/monitoring/sessions',
    alt: 'Tiling monitor showing an active Claude session and terminal-style history.',
  },
  {
    id: 'guides-hub',
    title: 'Guides hub',
    description: 'Built-in onboarding page that links product workflows with current screenshots.',
    fileName: 'guides-hub.png',
    route: '/guides',
    alt: 'Guides page with onboarding cards and screenshot gallery.',
  },
];

export const userGuideSections: UserGuideSection[] = [
  {
    id: 'getting-started',
    title: 'Get started quickly',
    summary:
      'Launch the dashboard, confirm that the local database is ready, and import your latest sessions.',
    route: '/dashboard',
    screenshotId: 'dashboard-overview',
    steps: [
      {
        title: 'Open the dashboard',
        description:
          'Start the app, then land on the dashboard to see overall usage metrics and recent activity.',
      },
      {
        title: 'Run a sync',
        description:
          'Use the Sync Claude Data action to refresh session metadata after new local conversations land.',
      },
      {
        title: 'Check the active ticker',
        description:
          'Use the top bar to confirm whether active sessions are already streaming into the dashboard.',
      },
    ],
  },
  {
    id: 'browse-sessions',
    title: 'Browse and filter sessions',
    summary:
      'Find the sessions that matter by filtering status and drilling into the projects with the highest activity.',
    route: '/sessions',
    screenshotId: 'sessions-list',
    steps: [
      {
        title: 'Open Sessions',
        description:
          'Use the Sessions view to inspect project names, timestamps, message counts, token totals, and cost.',
      },
      {
        title: 'Filter by status',
        description:
          'Switch between All, Active, Completed, and Error to narrow down the conversations you need.',
      },
      {
        title: 'Open a detail page',
        description:
          'Select View on any row to inspect the summary, files touched, folders accessed, and full conversation.',
      },
    ],
  },
  {
    id: 'analyze-workflow-health',
    title: 'Analyze workflow health',
    summary:
      'Use the analytics dashboard to understand completion rate, tool mix, busiest projects, and transcript hotspots.',
    route: '/analytics',
    screenshotId: 'analytics-overview',
    steps: [
      {
        title: 'Open Analytics',
        description:
          'Start on the analytics dashboard when you want a higher-signal view of recent usage than the main landing page.',
      },
      {
        title: 'Read the KPI strip first',
        description:
          'The top metrics summarize sessions, active projects, completion rate, and average session size for the selected time window.',
      },
      {
        title: 'Use charts and leaderboards to find hotspots',
        description:
          'Scan trend lines, tool mix, hourly activity, project ranking, and file or folder hotspots to see where effort is concentrating.',
      },
    ],
  },
  {
    id: 'investigate-session-detail',
    title: 'Inspect a single session',
    summary:
      'Use the detail view to understand what happened in a run before sharing results or following up.',
    route: '/sessions/demo-session-active',
    screenshotId: 'session-detail',
    steps: [
      {
        title: 'Read the summary first',
        description:
          'The summary gives you a compact explanation of the work before you scroll through messages.',
      },
      {
        title: 'Scan files and folders',
        description:
          'Check the side panels to see what changed and which directories the session traversed.',
      },
      {
        title: 'Review tool usage',
        description:
          'Use the timeline to inspect text exchanges, tool calls, and tool results in chronological order.',
      },
    ],
  },
  {
    id: 'monitor-live-work',
    title: 'Monitor live work',
    summary:
      'Watch active sessions in the tiling monitor and pull up history even before new events arrive.',
    route: '/monitoring/sessions',
    screenshotId: 'tiling-monitor',
    steps: [
      {
        title: 'Open the Tiling Monitor',
        description:
          'The monitor now preloads active sessions from the database so you can start watching immediately.',
      },
      {
        title: 'Toggle AUTO-OPEN and AUTO-CLOSE',
        description:
          'Use the toggles to control whether new sessions appear automatically and finished ones disappear.',
      },
      {
        title: 'Load older history on demand',
        description:
          'Use the history controls inside each tile to pull in more terminal-style context without leaving the page.',
      },
    ],
  },
];

export const pagesCompanionIntro =
  'GitHub Pages publishes a static companion site for this project: guides, screenshots, and automation artifacts. The live dashboard itself still requires a server runtime with Next.js routes, tRPC, SSE, and SQLite.';
