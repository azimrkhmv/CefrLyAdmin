import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminGetUser,
  adminSetUserPlan,
  adminSetUserRole,
  type AdminAttemptRow,
  adminResolveRecheck,
  adminGetWritingAttempt,
  type AdminRecheckRow,
  type AdminSpeakingAttemptRow,
  type AdminWritingAttemptRow,
} from '../../lib/adminApi'
import { useAuth } from '../../lib/auth'
import { accountLabel } from '../../lib/phone'
import type { PlanId } from '../../types/plan'
import {
  BandPill,
  DAILY_MINUTES_LABEL,
  FIRST_EXAM_LABEL,
  HEARD_FROM_LABEL,
  PlanChip,
  RoleChip,
  SELF_LEVEL_LABEL,
  TIMEFRAME_LABEL,
  WEAK_AREA_LABEL,
  formatDateTime,
  formatDay,
  labelFor,
  relativeDay,
} from '../../components/admin/userDisplay'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-ink">{value}</dd>
    </div>
  )
}

/** Reading Mock 2 · Part 3 practice — what the student actually sat. */
function attemptLabel(a: AdminAttemptRow) {
  const title = a.test_title ?? 'Deleted test'
  return a.scope === 'part' && a.part_number !== null ? `${title} · Part ${a.part_number}` : title
}

/** Today + N months as a local yyyy-mm-dd (for the expiry date input). */
function plusMonthsDate(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const { session, role: myRole } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminGetUser(id),
    enabled: Boolean(id),
  })

  const roleMutation = useMutation({
    mutationFn: (role: 'student' | 'admin') => adminSetUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  // Plan grant form (super_admin only). Drafts re-sync whenever the loaded user
  // changes (incl. after a save's refetch), so the inputs always show the
  // stored plan/expiry.
  const [planDraft, setPlanDraft] = useState<PlanId>('free')
  const [expiryDraft, setExpiryDraft] = useState('') // yyyy-mm-dd, '' = no expiry
  useEffect(() => {
    if (!data) return
    setPlanDraft(data.user.plan)
    setExpiryDraft(data.user.plan_expires_at ? data.user.plan_expires_at.slice(0, 10) : '')
  }, [data?.user.plan, data?.user.plan_expires_at, id])

  const planMutation = useMutation({
    mutationFn: () =>
      adminSetUserPlan(
        id,
        planDraft,
        planDraft === 'free' || !expiryDraft
          ? null
          : // End of the chosen day, UTC — the grant lasts through that date.
            new Date(`${expiryDraft}T23:59:59Z`).toISOString(),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  if (isLoading) return <p className="text-ink-soft">Loading profile…</p>
  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users" className="text-sm font-bold text-brand hover:underline">
          ← Users
        </Link>
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {error instanceof Error ? error.message : 'Could not load this user.'}
        </p>
      </div>
    )
  }
  if (!data) return null

  const { user, onboarding, attempts } = data
  const speakingAttempts = data.speakingAttempts ?? []
  const rechecks = data.rechecks ?? []
  const name = user.name ?? [user.first_name, user.last_name].filter(Boolean).join(' ')
  // The API refuses to touch super admins or your own row; hide the controls to match.
  const canChangeRole =
    myRole === 'super_admin' && user.role !== 'super_admin' && user.id !== session?.user.id

  return (
    <div className="space-y-6">
      <Link to="/admin/users" className="inline-block text-sm font-bold text-brand hover:underline">
        ← Users
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-heading">{name || accountLabel(user.phone, user.email)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <span className="tabular-nums">{accountLabel(user.phone, user.email)}</span>
            <RoleChip role={user.role} />
            {user.id === session?.user.id && <span className="text-xs">(you)</span>}
          </p>
        </div>
        {canChangeRole && (
          <div className="flex items-center gap-2">
            {user.role === 'student' ? (
              <button
                onClick={() => roleMutation.mutate('admin')}
                disabled={roleMutation.isPending}
                className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint disabled:opacity-50"
              >
                Promote to admin
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm(`Remove admin access for ${name || accountLabel(user.phone, user.email)}?`)) {
                    roleMutation.mutate('student')
                  }
                }}
                disabled={roleMutation.isPending}
                className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-rose-700 transition-colors hover:border-rose-300 disabled:opacity-50"
              >
                Demote to student
              </button>
            )}
          </div>
        )}
      </header>

      {roleMutation.error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          {(roleMutation.error as Error).message}
        </p>
      )}

      {/* Subscription: read-only chip for admins; super_admins can grant a plan.
          No checkout is wired yet, so this manual grant is how a paying student
          gets Pro/Premium (they pay off-platform, then a super_admin flips it). */}
      <Card title="Plan">
        {myRole === 'super_admin' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-ink-soft">Current:</span>
              <PlanChip plan={user.plan} expiresAt={user.plan_expires_at} />
              {user.plan !== 'free' && user.plan_expires_at && (
                <span className="text-xs text-ink-soft">
                  until {formatDay(user.plan_expires_at)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-bold text-ink-soft">Plan</span>
                <select
                  value={planDraft}
                  onChange={(e) => {
                    const next = e.target.value as PlanId
                    setPlanDraft(next)
                    // Paid plans are monthly → default the expiry to 1 month from
                    // today so a grant lapses automatically (admin can override).
                    if (next !== 'free' && !expiryDraft) setExpiryDraft(plusMonthsDate(1))
                  }}
                  className="rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink outline-none focus:border-brand"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <div className="text-sm">
                <span className="mb-1 block text-xs font-bold text-ink-soft">
                  Expires {planDraft === 'free' ? '(n/a)' : ''}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={expiryDraft}
                    disabled={planDraft === 'free'}
                    onChange={(e) => setExpiryDraft(e.target.value)}
                    className="rounded-xl border border-line bg-white px-3.5 py-2 text-sm text-ink outline-none focus:border-brand disabled:opacity-50"
                  />
                  {planDraft !== 'free' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpiryDraft(plusMonthsDate(1))}
                        className="rounded-lg border border-line bg-white px-2 py-2 text-xs font-bold text-ink-soft transition-colors hover:border-brand hover:text-brand"
                      >
                        +1 mo
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpiryDraft(plusMonthsDate(3))}
                        className="rounded-lg border border-line bg-white px-2 py-2 text-xs font-bold text-ink-soft transition-colors hover:border-brand hover:text-brand"
                      >
                        +3 mo
                      </button>
                      {expiryDraft && (
                        <button
                          type="button"
                          onClick={() => setExpiryDraft('')}
                          className="rounded-lg border border-line bg-white px-2 py-2 text-xs font-bold text-ink-soft transition-colors hover:border-rose-300 hover:text-rose-700"
                        >
                          No expiry
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => planMutation.mutate()}
                disabled={planMutation.isPending}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
              >
                {planMutation.isPending ? 'Saving…' : 'Save plan'}
              </button>
              {planMutation.isSuccess && !planMutation.isPending && (
                <span className="text-sm font-bold text-ok">Saved ✓</span>
              )}
            </div>
            <p className="text-xs text-ink-faint">
              Paid plans default to <span className="font-bold text-ink-soft">1 month from today</span> and
              drop back to Free automatically when the date passes. Use +1 mo / +3 mo, or clear the date
              for an open-ended grant.
            </p>
            {planMutation.error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm text-rose-800">
                {(planMutation.error as Error).message}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <PlanChip plan={user.plan} expiresAt={user.plan_expires_at} />
            {user.plan !== 'free' && user.plan_expires_at && (
              <span className="text-xs text-ink-soft">until {formatDay(user.plan_expires_at)}</span>
            )}
            <span className="text-xs text-ink-faint">Only a super admin can change plans.</span>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Level">
          {user.best_band ? (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-bold text-ink-soft">Best mock</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <BandPill band={user.best_band} />
                  <span className="text-lg font-extrabold tabular-nums text-heading">
                    {user.best_score}/{user.best_total}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-ink-soft">Latest mock</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  {user.last_band && <BandPill band={user.last_band} />}
                  <span className="text-sm font-bold tabular-nums text-ink">
                    {user.last_score}/{user.last_total}
                  </span>
                  <span className="text-xs text-ink-soft">{relativeDay(user.last_mock_at)}</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-soft">
              No banded mock yet.{' '}
              {user.attempts_count > 0 && `${user.attempts_count} part drill(s) only.`}
            </p>
          )}
        </Card>

        <Card title="Activity">
          <dl className="space-y-3">
            <Field label="Attempts" value={<span className="tabular-nums">{user.attempts_count}</span>} />
            <Field
              label="Full mocks"
              value={<span className="tabular-nums">{user.mocks_count}</span>}
            />
            <Field label="Last attempt" value={relativeDay(user.last_attempt_at)} />
          </dl>
        </Card>

        <Card title="Account">
          <dl className="space-y-3">
            <Field label="Phone" value={<span className="tabular-nums">{user.phone ? accountLabel(user.phone, null) : '—'}</span>} />
            <Field label="Father's name" value={user.father_name ?? '—'} />
            <Field label="Telegram" value={user.telegram_linked ? 'Linked (@CefrLy_bot)' : 'Not linked'} />
            <Field label="Joined" value={formatDay(user.created_at)} />
            <Field label="Last sign-in" value={relativeDay(user.last_sign_in_at)} />
            <Field
              label="Onboarding"
              value={user.onboarded_at ? `Done ${formatDay(user.onboarded_at)}` : 'Not finished'}
            />
          </dl>
        </Card>
      </div>

      <Card title="Onboarding answers">
        {user.onboarded_at === null && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
            This student hasn’t finished the welcome wizard — answers may be incomplete.
          </p>
        )}
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Exam experience" value={labelFor(FIRST_EXAM_LABEL, onboarding.first_exam)} />
          <Field label="Self-assessed level" value={labelFor(SELF_LEVEL_LABEL, onboarding.self_level)} />
          <Field label="Goal band" value={onboarding.target_band ?? '—'} />
          <Field label="Exam timeframe" value={labelFor(TIMEFRAME_LABEL, onboarding.study_timeframe)} />
          <Field
            label="Study time"
            value={
              onboarding.daily_minutes ? DAILY_MINUTES_LABEL[onboarding.daily_minutes] ?? '—' : '—'
            }
          />
          <Field
            label="Heard from"
            value={
              <>
                {labelFor(HEARD_FROM_LABEL, onboarding.heard_from)}
                {onboarding.heard_from_note && (
                  <span className="block text-xs font-normal text-ink-soft">
                    “{onboarding.heard_from_note}”
                  </span>
                )}
              </>
            }
          />
          <Field label="Signup source" value={onboarding.source ?? '—'} />
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold text-ink-soft">Weak areas</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {onboarding.weak_areas && onboarding.weak_areas.length > 0 ? (
                onboarding.weak_areas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand"
                  >
                    {WEAK_AREA_LABEL[area] ?? area}
                  </span>
                ))
              ) : (
                <span className="text-sm font-bold text-ink">—</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold text-heading">
          Attempts <span className="font-bold text-ink-soft">· newest first</span>
        </h2>
        {attempts.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm text-ink-soft shadow-card">
            No attempts yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3">Skill</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3">Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-bold text-ink">{attemptLabel(a)}</td>
                    <td className="px-4 py-3 capitalize text-ink-soft">{a.skill ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-ink">
                      {a.raw_score}/{a.total}
                    </td>
                    <td className="px-4 py-3">
                      {a.band ? (
                        <BandPill band={a.band} />
                      ) : (
                        <span className="text-xs text-ink-faint">drill</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatDateTime(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SpeakingHistory attempts={speakingAttempts} rechecks={rechecks} />
      <WritingHistory attempts={data.writingAttempts ?? []} />
    </div>
  )
}

const WRITING_TASK_LABEL: Record<string, string> = {
  task_1_1: 'Task 1.1 · informal email',
  task_1_2: 'Task 1.2 · formal email',
  part_2: 'Part 2 · forum post',
}

const WRITING_CRITERION_LABEL: Record<string, string> = {
  task_achievement: 'Task',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  coherence: 'Coherence',
}

/** Writing history. Like speaking it is not an `attempts` row and is marked out
 *  of 75 — but unlike speaking WE STILL HAVE WHAT WAS MARKED, so opening one
 *  shows the student's own script beside the corrections.
 *
 *  The row is fetched on expand: the list deliberately carries no `result` or
 *  `answers`, because a marked paper holds every correction and every essay and
 *  nobody needs all of them to read a date. */
function WritingHistory({ attempts }: { attempts: AdminWritingAttemptRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-extrabold text-heading">
        Writing checks <span className="font-bold text-ink-soft">· newest first</span>
      </h2>
      {attempts.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm text-ink-soft shadow-card">
          No writing checks yet.
        </p>
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => (
            <div key={a.id} className="rounded-2xl border border-line bg-white shadow-card">
              <button
                type="button"
                onClick={() => setOpenId(openId === a.id ? null : a.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">{a.test_title}</span>
                  <span className="text-xs text-ink-soft">
                    {a.scope === 'full'
                      ? 'Full paper'
                      : (a.task_type && WRITING_TASK_LABEL[a.task_type]) || 'Task practice'}
                    {' · '}
                    {formatDateTime(a.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2.5">
                  {a.status === 'done' ? (
                    <>
                      <span className="tabular-nums text-sm font-bold text-ink">{a.rating}/75</span>
                      {a.band ? (
                        <BandPill band={a.band} />
                      ) : (
                        <span className="text-xs text-ink-faint">estimate</span>
                      )}
                    </>
                  ) : a.status === 'grading' ? (
                    <span className="text-xs font-bold text-brand">checking…</span>
                  ) : (
                    <span className="text-xs font-bold text-rose-700">failed</span>
                  )}
                  <span className="text-xs font-bold text-brand">
                    {openId === a.id ? 'Hide' : 'View'}
                  </span>
                </span>
              </button>

              {openId === a.id && <WritingAttemptDetail attempt={a} />}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function WritingAttemptDetail({ attempt }: { attempt: AdminWritingAttemptRow }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-writing-attempt', attempt.id],
    queryFn: () => adminGetWritingAttempt(attempt.id),
    staleTime: 60_000,
  })

  if (attempt.status !== 'done') {
    return (
      <div className="border-t border-line px-4 py-4 text-sm text-ink-soft">
        {attempt.error_message ?? 'This check has not finished.'}
      </div>
    )
  }
  if (isLoading) {
    return <div className="border-t border-line px-4 py-4 text-sm text-ink-soft">Loading the paper…</div>
  }
  if (error || !data) {
    return (
      <div className="border-t border-line px-4 py-4 text-sm text-rose-700">
        {error instanceof Error ? error.message : 'Could not load this paper.'}
      </div>
    )
  }

  // deno-style loose shapes: the row comes back as stored, so read defensively.
  const result = (data.attempt.result ?? {}) as {
    summary?: string
    fixFirst?: string
    model?: string
    tasks?: {
      taskId: string
      taskLabel: string
      band: number
      wordCount: number
      targetWords: number
      underlengthCapped?: boolean
      zeroMark?: string | null
      comment?: string
      criteria?: Record<string, number>
      corrections?: { quote: string; suggestion: string; type: string; note?: string }[]
    }[]
  }
  const answers = data.attempt.answers ?? []
  const textFor = (taskId: string) => answers.find((x) => x.taskId === taskId)?.text ?? ''

  return (
    <div className="space-y-4 border-t border-line px-4 py-4">
      {result.fixFirst && (
        <p className="rounded-xl bg-sun-soft px-4 py-3 text-sm font-bold text-heading">
          Fix first: {result.fixFirst}
        </p>
      )}
      {result.summary && <p className="text-sm text-ink">{result.summary}</p>}

      {result.tasks?.map((t) => (
        <div key={t.taskId} className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">{t.taskLabel}</p>
            <span className="tabular-nums text-sm font-bold text-brand">{t.band}/9</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(t.criteria ?? {}).map(([key, value]) => (
              <span
                key={key}
                className="tabular-nums rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand"
              >
                {WRITING_CRITERION_LABEL[key] ?? key} {value}
              </span>
            ))}
            <span className="tabular-nums rounded-full bg-page px-3 py-1 text-xs font-bold text-ink-soft">
              {t.wordCount} words / {t.targetWords} asked
            </span>
            {t.underlengthCapped && (
              <span className="rounded-full bg-sun-soft px-3 py-1 text-xs font-bold text-sun-ink">
                capped for length
              </span>
            )}
            {t.zeroMark && (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800">
                zeroed: {t.zeroMark}
              </span>
            )}
          </div>

          {t.comment && <p className="mt-3 text-sm text-ink-soft">{t.comment}</p>}

          {textFor(t.taskId) && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-bold text-brand">
                What the student wrote
              </summary>
              <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-page p-3 text-sm text-ink">
                {textFor(t.taskId)}
              </p>
            </details>
          )}

          {!!t.corrections?.length && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-bold text-brand">
                {t.corrections.length} correction{t.corrections.length > 1 ? 's' : ''}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {t.corrections.map((c, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-rose-700 line-through">{c.quote}</span>
                    {' → '}
                    <span className="font-bold text-ink">{c.suggestion}</span>
                    {c.note && <span className="text-ink-soft"> — {c.note}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}

      {result.model && (
        <p className="text-xs text-ink-soft">Marked by {result.model}.</p>
      )}
    </div>
  )
}

/** The student's complaint, and your reply. Reading the transcript above is the
 *  whole job — this is just where you write back. */
function RecheckPanel({ recheck }: { recheck: AdminRecheckRow }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState(recheck.admin_note ?? '')
  const resolve = useMutation({
    mutationFn: (status: 'reviewed' | 'rejected') =>
      adminResolveRecheck(recheck.id, status, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-user'] }),
  })

  return (
    <div className="rounded-xl border border-sun bg-sun-soft/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-sun-ink">
        Recheck requested · {formatDateTime(recheck.created_at)}
      </p>
      <p className="mt-1.5 text-sm text-ink">“{recheck.reason}”</p>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Your reply to the student…"
        className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => resolve.mutate('reviewed')}
          disabled={resolve.isPending}
          className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          Send reply
        </button>
        <button
          type="button"
          onClick={() => resolve.mutate('rejected')}
          disabled={resolve.isPending}
          className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink hover:border-ink-faint disabled:opacity-60"
        >
          Close without change
        </button>
        <span className="text-xs text-ink-soft">Status: {recheck.status}</span>
      </div>
      {resolve.isError && (
        <p className="mt-2 text-xs text-rose-700">{(resolve.error as Error).message}</p>
      )}
    </div>
  )
}

const PART_LABEL: Record<string, string> = {
  part_1_1: 'Part 1.1',
  part_1_2: 'Part 1.2',
  part_2: 'Part 2',
  part_3: 'Part 3',
}

/** Speaking history. Separate from the table above because speaking is not an
 *  `attempts` row: it is marked out of 75 by the official rating table, and its
 *  value to you is the FEEDBACK — the transcript of what the student actually
 *  said and what the AI told them — not just a number. */
function SpeakingHistory({
  attempts,
  rechecks,
}: {
  attempts: AdminSpeakingAttemptRow[]
  rechecks: AdminRecheckRow[]
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const recheckFor = (attemptId: string) => rechecks.find((r) => r.attempt_id === attemptId)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-extrabold text-heading">
        Speaking checks <span className="font-bold text-ink-soft">· newest first</span>
      </h2>
      {attempts.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm text-ink-soft shadow-card">
          No speaking checks yet.
        </p>
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => (
            <div key={a.id} className="rounded-2xl border border-line bg-white shadow-card">
              <button
                type="button"
                onClick={() => setOpenId(openId === a.id ? null : a.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">{a.test_title}</span>
                  <span className="text-xs text-ink-soft">
                    {a.scope === 'full' ? 'Full mock' : (a.part_type && PART_LABEL[a.part_type]) || 'Part practice'}
                    {' · '}
                    {formatDateTime(a.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2.5">
                  {a.status === 'done' ? (
                    <>
                      <span className="tabular-nums text-sm font-bold text-ink">{a.rating}/75</span>
                      {a.band ? (
                        <BandPill band={a.band} />
                      ) : (
                        <span className="text-xs text-ink-faint">estimate</span>
                      )}
                    </>
                  ) : a.status === 'grading' ? (
                    <span className="text-xs font-bold text-brand">checking…</span>
                  ) : (
                    <span className="text-xs font-bold text-rose-700">failed</span>
                  )}
                  {recheckFor(a.id)?.status === 'open' && (
                    <span className="rounded-full bg-sun-soft px-2.5 py-0.5 text-xs font-bold text-sun-ink">
                      recheck asked
                    </span>
                  )}
                  <span className="text-xs font-bold text-brand">
                    {openId === a.id ? 'Hide' : 'View'}
                  </span>
                </span>
              </button>

              {openId === a.id && (
                <div className="space-y-4 border-t border-line px-4 py-4">
                  {a.status !== 'done' && (
                    <p className="text-sm text-ink-soft">
                      {a.error_message ?? 'This check has not finished.'}
                    </p>
                  )}

                  {a.result?.fixFirst && (
                    <p className="rounded-xl bg-sun-soft px-4 py-3 text-sm font-bold text-heading">
                      Fix first: {a.result.fixFirst}
                    </p>
                  )}

                  {!!a.result?.blocks?.length && (
                    <div className="flex flex-wrap gap-2">
                      {a.result.blocks.map((b) => (
                        <span
                          key={b.key}
                          className="tabular-nums rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand"
                        >
                          {b.label} {b.score}/{b.max}
                        </span>
                      ))}
                    </div>
                  )}

                  {a.result?.summary && <p className="text-sm text-ink">{a.result.summary}</p>}

                  {a.result?.answers?.map((ans, i) => (
                    <div key={ans.questionIndex} className="rounded-xl border border-line p-4">
                      <p className="text-sm font-bold text-ink">
                        Q{i + 1}. {ans.questionText}
                      </p>
                      <p className="tabular-nums mt-1 text-xs text-ink-soft">
                        {Math.round(ans.durationSec)}s · {ans.wordsPerMinute} wpm ·{' '}
                        {ans.fillerCount} fillers
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">
                        {ans.transcript || <em>Nothing recorded.</em>}
                      </p>
                      {ans.errors.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-rose-800">
                          {ans.errors.map((e, k) => (
                            <li key={k}>
                              <span className="line-through">{e.quote}</span> → {e.fix}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {recheckFor(a.id) && <RecheckPanel recheck={recheckFor(a.id)!} />}

                  <p className="text-xs text-ink-faint">
                    The recording itself was deleted after grading — the transcript is the record.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
