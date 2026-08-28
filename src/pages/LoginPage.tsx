import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

/**
 * The admin app's own sign-in screen. Deliberately minimal and deliberately
 * NOT the student AuthPage: no mascot, no sign-up, no OAuth — email and
 * password only (owner's call). There is no "create account" path here at all;
 * admin accounts are made in the student app and promoted by a super admin.
 *
 * Signing in only proves identity. Whether the account may DO anything is
 * decided by profiles.role, checked again server-side on every admin action.
 */
export function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/admin/tests'
  if (!loading && session) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    // AdminRoute takes it from here: it waits for profiles.role and shows the
    // not-an-admin dead end if the account has no admin role.
  }

  return (
    <div className="grid min-h-screen place-items-center bg-page px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5">
          <img src="/logo-cat.webp" alt="" aria-hidden width={40} height={40} className="h-10 w-10" />
          <span className="text-xl font-extrabold tracking-tight text-heading">
            Cefrly <span className="text-brand">Admin</span>
          </span>
        </div>

        <main className="mt-6 rounded-2xl border border-line bg-white p-7 shadow-card">
          <h1 className="text-lg font-extrabold text-heading">Sign in</h1>
          <p className="mt-1 text-sm text-ink-soft">Admin accounts only.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-soft focus:border-brand"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-bold text-ink">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 pr-20 text-sm text-ink outline-none placeholder:text-ink-soft focus:border-brand"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand hover:underline"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-soft">
            No password? A super admin can set one from the Supabase dashboard under
            Authentication → Users.
          </p>
        </main>
      </div>
    </div>
  )
}
