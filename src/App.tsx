import { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/admin/AdminRoute'
import { AdminLayout } from './components/admin/AdminLayout'
import { FullScreenFallback } from './components/RouteFallback'
import { LoginPage } from './pages/LoginPage'

/**
 * Routes keep the /admin/* prefix even though this app is nothing but admin.
 * That is on purpose: every page copied over from the student app links with
 * absolute paths like `/admin/tests/:slug`, so keeping the prefix meant moving
 * the code without touching a single link. "/" just redirects into it.
 *
 * Pages use named exports, hence the tiny `page()` adapter — React.lazy wants
 * a module with a `default`.
 */
function page<T extends string, C extends ComponentType<Record<string, never>>>(
  loader: () => Promise<Record<T, C>>,
  name: T,
) {
  return lazy(async () => ({ default: (await loader())[name] }))
}

const AdminTestsPage = page(() => import('./pages/admin/AdminTestsPage'), 'AdminTestsPage')
const TestFormPage = page(() => import('./pages/admin/TestFormPage'), 'TestFormPage')
const ListeningTestFormPage = page(
  () => import('./pages/admin/ListeningTestFormPage'),
  'ListeningTestFormPage',
)
const PartTestFormPage = page(() => import('./pages/admin/PartTestFormPage'), 'PartTestFormPage')
const TestFormRouter = page(() => import('./pages/admin/TestFormRouter'), 'TestFormRouter')
const AdminSamplesPage = page(() => import('./pages/admin/AdminSamplesPage'), 'AdminSamplesPage')
const SampleFormPage = page(() => import('./pages/admin/SampleFormPage'), 'SampleFormPage')
const AdminUsersPage = page(() => import('./pages/admin/AdminUsersPage'), 'AdminUsersPage')
const AdminAlertsPage = page(() => import('./pages/admin/AdminAlertsPage'), 'AdminAlertsPage')
const AdminUserDetailPage = page(
  () => import('./pages/admin/AdminUserDetailPage'),
  'AdminUserDetailPage',
)

export default function App() {
  return (
    <Suspense fallback={<FullScreenFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Navigate to="/admin/tests" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/tests" replace />} />
            <Route path="/admin/tests" element={<AdminTestsPage />} />
            <Route path="/admin/tests/new" element={<TestFormPage />} />
            <Route path="/admin/tests/new/listening" element={<ListeningTestFormPage />} />
            <Route path="/admin/tests/new/part" element={<PartTestFormPage />} />
            <Route path="/admin/tests/:slug" element={<TestFormRouter />} />
            <Route path="/admin/samples" element={<AdminSamplesPage />} />
            <Route path="/admin/samples/new" element={<SampleFormPage />} />
            <Route path="/admin/samples/:slug" element={<SampleFormPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/alerts" element={<AdminAlertsPage />} />
            <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
            {/* The directory absorbed the old admins-only page; keep the link alive. */}
            <Route path="/admin/admins" element={<Navigate to="/admin/users" replace />} />
            <Route path="*" element={<Navigate to="/admin/tests" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
