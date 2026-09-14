import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminListGradeAlerts,
  adminResolveGradeAlert,
  type AdminGradeAlertRow,
} from '../../lib/adminApi'
import { TabStrip } from '../../components/TabStrip'
import { BandPill, formatDateTime } from '../../components/admin/userDisplay'

/**
 * The speaking anomaly queue (migration 0025), which until now nothing read.
 *
 * Every wrong-mark defect in docs/SPEAKING-DEFECTS.md was found because a
 * student wrote in. The database could see all of them: a block scoring zero on
 * two hundred words of speech is not a judgement call, it is arithmetic that
 * cannot be right. The sweep has been writing these rows nightly and there was
 * no screen, so the only way to read them was SQL.
 *
 * This page NEVER changes a mark. Resolving a row records that a human looked.
 */

const KIND_LABEL: Record<string, string> = {
  zero_with_speech: 'Scored zero on real speech',
  band_swing: 'Band swung between the student’s own attempts',
  no_profile: 'Marked with no language profile',
  stuck_grading: 'Stuck checking, never finished',
}

const KIND_BLURB: Record<string, string> = {
  zero_with_speech:
    'A block scored 0 while the transcript shows the student answered. This is the shape of defects #24, #27 and #28 — a mark erased by missing evidence rather than contradicted by it.',
  band_swing:
    'Two attempts by the same student landed more than 15 rating points apart. One of them is probably wrong.',
  no_profile:
    'The grade carries no language profile, which zeroes every block by design. It should never actually happen.',
  stuck_grading: 'The check never finished and never failed. It is dead, not working.',
}

type AlertTab = 'open' | 'resolved'

const TABS: { key: AlertTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
]

export function AdminAlertsPage() {
  const [tab, setTab] = useState<AlertTab>('open')
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-grade-alerts', tab],
    queryFn: () => adminListGradeAlerts(tab === 'resolved'),
  })

  const alerts = data?.alerts ?? []
  const unswept = data?.unswept ?? []
  const shown = tab === 'resolved' ? alerts.filter((a) => a.resolved_at) : alerts

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading">Grade alerts</h1>
        <p className="text-sm text-ink-soft">
          Speaking grades the nightly sweep could not believe. This is a detector, not a gate —
          nothing here has changed a student’s mark. Resolving a row only records that you looked.
        </p>
      </header>

      <TabStrip tabs={TABS} value={tab} onChange={setTab} ariaLabel="Filter alerts" />

      {isLoading && <p className="text-sm text-ink-soft">Loading…</p>}
      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error instanceof Error ? error.message : 'Could not load the queue.'}
        </p>
      )}

      {/* The sweep runs at 02:15 UTC, so a grade that went wrong this morning is
          not a stored alert yet. Without this panel the queue is up to a day
          behind the thing it exists to catch. */}
      {!isLoading && unswept.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold text-heading">
            Not swept yet{' '}
            <span className="font-bold text-ink-soft">
              · seen live, tonight’s 02:15 UTC sweep will record them
            </span>
          </h2>
          {unswept.map((a) => (
            <AlertCard key={`${a.attempt_id}:${a.kind}`} alert={a} />
          ))}
        </section>
      )}

      {!isLoading && !error && shown.length === 0 && unswept.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-12 text-center text-sm text-ink-soft shadow-card">
          {tab === 'open'
            ? 'Nothing open. Every grade the sweep looked at was believable.'
            : 'Nothing resolved yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <AlertCard key={a.id ?? `${a.attempt_id}:${a.kind}`} alert={a} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertCard({ alert }: { alert: AdminGradeAlertRow }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState(alert.note ?? '')
  const resolved = Boolean(alert.resolved_at)

  const mutate = useMutation({
    mutationFn: () => adminResolveGradeAlert(alert.id!, !resolved, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-grade-alerts'] }),
  })

  const when = alert.detected_at ?? alert.created_at

  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{KIND_LABEL[alert.kind] ?? alert.kind}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {alert.user_id ? (
              <Link to={`/admin/users/${alert.user_id}`} className="font-bold text-brand hover:underline">
                {alert.user_name ?? 'this student'}
              </Link>
            ) : (
              'unknown student'
            )}
            {alert.test_title ? ` · ${alert.test_title}` : ''}
            {when ? ` · ${formatDateTime(when)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alert.rating != null && (
            <span className="tabular-nums text-sm font-bold text-ink">{alert.rating}/75</span>
          )}
          {alert.band && <BandPill band={alert.band} />}
        </div>
      </div>

      <p className="mt-2 text-sm text-ink-soft">{KIND_BLURB[alert.kind] ?? ''}</p>

      {/* The detector's own numbers, verbatim — whatever 0025 put in `detail`. */}
      <dl className="mt-3 flex flex-wrap gap-2">
        {Object.entries(alert.detail ?? {}).map(([key, value]) => (
          <span
            key={key}
            className="tabular-nums rounded-full bg-page px-3 py-1 text-xs text-ink-soft"
          >
            <span className="font-bold text-ink">{key}</span> {String(value ?? '—')}
          </span>
        ))}
      </dl>

      {/* `unswept` rows are the live view, not stored alerts, so there is
          nothing to resolve until tonight's sweep records them. */}
      {alert.id ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you find?"
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => mutate.mutate()}
            disabled={mutate.isPending}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60 ${
              resolved
                ? 'border border-line bg-white text-ink hover:border-ink-faint'
                : 'bg-brand text-white hover:bg-brand-deep'
            }`}
          >
            {mutate.isPending ? 'Saving…' : resolved ? 'Reopen' : 'Mark looked at'}
          </button>
          {resolved && alert.resolved_at && (
            <span className="text-xs text-ink-soft">Resolved {formatDateTime(alert.resolved_at)}</span>
          )}
          {mutate.error && (
            <span className="text-xs font-bold text-rose-700">
              {mutate.error instanceof Error ? mutate.error.message : 'Could not save.'}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
          Not recorded yet — tonight’s sweep will file this one.
        </p>
      )}
    </article>
  )
}
