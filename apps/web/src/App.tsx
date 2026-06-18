import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { AccountDetailPage } from '@/pages/AccountDetailPage'
import { PipelineBuilderPage } from '@/pages/PipelineBuilderPage'
import { ResearchSourcePage } from '@/pages/ResearchSourcePage'
import { AuthGuard } from '@/lib/AuthGuard'
import { Shell } from '@/components/layout/Shell'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<AuthGuard />}>
          {/* Pages with app shell sidebar */}
          <Route element={<Shell />}>
            <Route index element={<AccountsPage />} />
            <Route path="/accounts/:accountSlug" element={<AccountDetailPage />} />
          </Route>

          {/* Full-screen builder pages — no shell sidebar */}
          <Route
            path="/accounts/:accountSlug/pipelines/:pipelineSlug"
            element={<PipelineBuilderPage />}
          />
          <Route
            path="/accounts/:accountSlug/research/:sourceSlug"
            element={<ResearchSourcePage />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
