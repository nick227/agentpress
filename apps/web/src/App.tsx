import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { PipelinesPage } from '@/pages/PipelinesPage'
import { HomePage } from '@/pages/HomePage'
import { AuthGuard } from '@/lib/AuthGuard'
import { Shell } from '@/components/layout/Shell'
import { Skeleton } from '@/components/ui/Skeleton'

const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const PipelineBuilderPage = lazy(() =>
  import('@/pages/PipelineBuilderPage').then((m) => ({ default: m.PipelineBuilderPage })),
)
const ResearchSourcePage = lazy(() =>
  import('@/pages/ResearchSourcePage').then((m) => ({ default: m.ResearchSourcePage })),
)
const ResearchNewPage = lazy(() =>
  import('@/pages/ResearchNewPage').then((m) => ({ default: m.ResearchNewPage })),
)
const ResearchPage = lazy(() =>
  import('@/pages/ResearchPage').then((m) => ({ default: m.ResearchPage })),
)
const PipelinesNewPage = lazy(() =>
  import('@/pages/PipelinesNewPage').then((m) => ({ default: m.PipelinesNewPage })),
)
const SchedulesPage = lazy(() =>
  import('@/pages/SchedulesPage').then((m) => ({ default: m.SchedulesPage })),
)
const ScheduleEditorPage = lazy(() =>
  import('@/pages/ScheduleEditorPage').then((m) => ({ default: m.ScheduleEditorPage })),
)
const DestinationEditorPage = lazy(() =>
  import('@/pages/DestinationEditorPage').then((m) => ({ default: m.DestinationEditorPage })),
)
const DestinationsPage = lazy(() =>
  import('@/pages/DestinationsPage').then((m) => ({ default: m.DestinationsPage })),
)
const RunsPage = lazy(() =>
  import('@/pages/RunsPage').then((m) => ({ default: m.RunsPage })),
)
const RunDetailPage = lazy(() =>
  import('@/pages/RunDetailPage').then((m) => ({ default: m.RunDetailPage })),
)
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const CommunityPage = lazy(() =>
  import('@/pages/CommunityPage').then((m) => ({ default: m.CommunityPage })),
)
const TeamsPage = lazy(() =>
  import('@/pages/TeamsPage').then((m) => ({ default: m.TeamsPage })),
)
const DocumentationPage = lazy(() =>
  import('@/pages/DocumentationPage').then((m) => ({ default: m.DocumentationPage })),
)
const PromptsPage = lazy(() =>
  import('@/pages/PromptsPage').then((m) => ({ default: m.PromptsPage })),
)
const PromptEditorPage = lazy(() =>
  import('@/pages/PromptEditorPage').then((m) => ({ default: m.PromptEditorPage })),
)
const AgentsPage = lazy(() => import('@/pages/AgentsPage').then((m) => ({ default: m.AgentsPage })))
const AgentEditorPage = lazy(() => import('@/pages/AgentEditorPage').then((m) => ({ default: m.AgentEditorPage })))

function PageFallback() {
  return (
    <div className="page-shell space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/register"
          element={
            <LazyPage>
              <RegisterPage />
            </LazyPage>
          }
        />

        <Route element={<AuthGuard />}>
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="/pipelines" element={<PipelinesPage />} />
            <Route path="/pipelines/new" element={<LazyPage><PipelinesNewPage /></LazyPage>} />
            <Route path="/agents" element={<LazyPage><AgentsPage /></LazyPage>} />
            <Route path="/agents/new" element={<LazyPage><AgentEditorPage /></LazyPage>} />
            <Route path="/agents/:agentId" element={<LazyPage><AgentEditorPage /></LazyPage>} />
            <Route
              path="/pipelines/:pipelineSlug"
              element={
                <LazyPage>
                  <PipelineBuilderPage />
                </LazyPage>
              }
            />
            <Route path="/schedules" element={<LazyPage><SchedulesPage /></LazyPage>} />
            <Route path="/schedules/:scheduleId" element={<LazyPage><ScheduleEditorPage /></LazyPage>} />
            <Route path="/research" element={<LazyPage><ResearchPage /></LazyPage>} />
            <Route path="/research/new" element={<LazyPage><ResearchNewPage /></LazyPage>} />
            <Route path="/research/:sourceSlug" element={<LazyPage><ResearchSourcePage /></LazyPage>} />
            <Route path="/prompts" element={<LazyPage><PromptsPage /></LazyPage>} />
            <Route path="/prompts/new" element={<LazyPage><PromptEditorPage /></LazyPage>} />
            <Route path="/prompts/:promptId" element={<LazyPage><PromptEditorPage /></LazyPage>} />
            <Route path="/destinations" element={<LazyPage><DestinationsPage /></LazyPage>} />
            <Route path="/destinations/new" element={<LazyPage><DestinationEditorPage /></LazyPage>} />
            <Route path="/destinations/:destinationId" element={<LazyPage><DestinationEditorPage /></LazyPage>} />
            <Route path="/runs" element={<LazyPage><RunsPage /></LazyPage>} />
            <Route path="/runs/:runId" element={<LazyPage><RunDetailPage /></LazyPage>} />
            <Route path="/profile" element={<LazyPage><ProfilePage /></LazyPage>} />
            <Route path="/community" element={<LazyPage><CommunityPage /></LazyPage>} />
            <Route path="/teams" element={<LazyPage><TeamsPage /></LazyPage>} />
            <Route path="/documentation" element={<LazyPage><DocumentationPage /></LazyPage>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
