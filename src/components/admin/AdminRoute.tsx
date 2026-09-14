import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { accountLabel } from '../../lib/phone'

// The UI-side gate for the whole app. The real enforcement is server-side:
// every admin action goes through edge functions that re-check profiles.role,
// and the tables themselves are RLS'd. This gate only decides what to render.
export function AdminRoute() {
  const { session, loading, role, roleLoading } = useAuth()
  const location = useLocation()

  // role === null while signed in means the profile fetch hasn't landed yet —
  // deciding before it lands would wrongly bounce admins on a full page load.
  if (loading || (session && (roleLoading || role === null))) {
    return <p className="py-24 text-center text-ink-soft">Loading…</p>
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (role !== 'admin' && role !== 'super_admin') {
    // In the student app this redirected to "/". Here "/" IS the admin area, so
    // redirecting would loop. Signed-in non-admins get a dead end instead.
    return <NotAuthorized email={accountLabel(null, session.user.email)} />
  }
  return <Outlet />
}

function NotAuthorized({ email }: { email: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-page px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        <img src="/cat-surprised.png" alt="" aria-hidden className="mx-auto h-32 w-auto" />
        <h1 className="mt-4 text-xl font-extrabold text-heading">This account isn’t an admin</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {email ? <span className="font-bold text-ink">{email}</span> : 'This account'} can sign in,
          but it has no admin role. Ask a super admin to grant one, then sign in again.
        </p>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

// Nested inside AdminRoute: only the super admin may manage admins.
export function SuperAdminRoute() {
  const { role } = useAuth()
  if (role !== 'super_admin') {
    return <Navigate to="/admin/tests" replace />
  }
  return <Outlet />
}
