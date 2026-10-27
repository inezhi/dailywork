import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { AppShell } from './components/AppShell'
import { TodayPage } from './pages/TodayPage'
import { TasksPage } from './pages/TasksPage'
import { BoardPage } from './pages/BoardPage'
import { CalendarPage } from './pages/CalendarPage'
import { TimelinePage } from './pages/TimelinePage'
import { FocusPage } from './pages/FocusPage'
import { DocsPage } from './pages/DocsPage'
import { MemosPage } from './pages/MemosPage'
import { DashboardPage } from './pages/DashboardPage'
import { InboxPage } from './pages/InboxPage'
import { ProjectPage } from './pages/ProjectPage'
import { SettingsPage } from './pages/SettingsPage'
import { DesignPage } from './pages/DesignPage'

const rootRoute = createRootRoute({ component: AppShell })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today' })
  },
  component: () => null,
})

const todayRoute = createRoute({ getParentRoute: () => rootRoute, path: '/today', component: TodayPage })

const inboxRoute = createRoute({ getParentRoute: () => rootRoute, path: '/inbox', component: InboxPage })

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  validateSearch: (search: Record<string, unknown>): { space?: string; project?: string } => {
    const out: { space?: string; project?: string } = {}
    if (typeof search.space === 'string') out.space = search.space
    if (typeof search.project === 'string') out.project = search.project
    return out
  },
  component: TasksPage,
})

const boardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/board', component: BoardPage })
const calendarRoute = createRoute({ getParentRoute: () => rootRoute, path: '/calendar', component: CalendarPage })
const timelineRoute = createRoute({ getParentRoute: () => rootRoute, path: '/timeline', component: TimelinePage })
const focusRoute = createRoute({ getParentRoute: () => rootRoute, path: '/focus', component: FocusPage })
const docsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/docs', component: DocsPage })
const docRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/$docId',
  component: DocsPage,
})
const memosRoute = createRoute({ getParentRoute: () => rootRoute, path: '/memos', component: MemosPage })
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectPage,
})
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage })
const designRoute = createRoute({ getParentRoute: () => rootRoute, path: '/design', component: DesignPage })

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  inboxRoute,
  tasksRoute,
  boardRoute,
  calendarRoute,
  timelineRoute,
  focusRoute,
  docsRoute,
  docRoute,
  memosRoute,
  dashboardRoute,
  projectRoute,
  settingsRoute,
  designRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 10_000,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
