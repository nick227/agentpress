import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { AuthGuard } from '@/lib/AuthGuard'
import { Shell } from '@/components/layout/Shell'
import { Skeleton } from '@/components/ui/Skeleton'

const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const AccountDetailPage = lazy(() =>
  import('@/pages/AccountDetailPage').then((m) => ({ default: m.AccountDetailPage })),
)
const PipelineBuilderPage = lazy(() =>
  import('@/pages/PipelineBuilderPage').then((m) => ({ default: m.PipelineBuilderPage })),
)
const ResearchSourcePage = lazy(() =>
  import('@/pages/ResearchSourcePage').then((m) => ({ default: m.ResearchSourcePage })),
)
const SchedulesPage = lazy(() =>
  import('@/pages/SchedulesPage').then((m) => ({ default: m.SchedulesPage })),
)
const ScheduleEditorPage = lazy(() =>
  import('@/pages/ScheduleEditorPage').then((m) => ({ default: m.ScheduleEditorPage })),
)

function PageFallback() {
  return (
    <div className="p-6 space-y-4">
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
            <Route index element={<AccountsPage />} />
            <Route
              path="/accounts/:accountSlug"
              element={
                <LazyPage>
                  <AccountDetailPage />
                </LazyPage>
              }
            />
            <Route
              path="/accounts/:accountSlug/pipelines/:pipelineSlug"
              element={
                <LazyPage>
                  <PipelineBuilderPage />
                </LazyPage>
              }
            />
            <Route
              path="/accounts/:accountSlug/research/:sourceSlug"
              element={
                <LazyPage>
                  <ResearchSourcePage />
                </LazyPage>
              }
            />
            <Route path="/accounts/:accountSlug/schedules" element={<LazyPage><SchedulesPage /></LazyPage>} />
            <Route path="/accounts/:accountSlug/schedules/:scheduleId" element={<LazyPage><ScheduleEditorPage /></LazyPage>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
