# Cefrly Admin — Project Context

## What this is
The admin console for Cefrly, split out of the student app on 2026-08-28.
Separate repo (`azimrkhmv/CefrLyAdmin`), separate Vercel project, separate URL,
its own sign-in screen — but the **same Supabase project**. The student app
lives at `../cefrly` (`azimrkhmv/CefrLy`, cefrly.vercel.app); read its CLAUDE.md
for the data model, edge functions, exam schemas and design system, all of which
still apply here.

## Stack (same as the student app)
Vite + React + TypeScript + Tailwind v4 + React Router + TanStack Query,
`@supabase/supabase-js`. Dev server runs on **5174** (the student app uses 5173,
so both can run at once).

## Security — read before "hardening" anything
Splitting the frontend added **no authorization**. It never did and it cannot.
- Every table is RLS'd. The browser never reads `tests`/`test_content` directly.
- Every admin action goes through an edge function (`admin-tests`,
  `admin-samples`, `admin-users`) that re-checks `profiles.role` server-side.
- `profiles.role` has no UPDATE grant, so nobody can promote themselves.
- The `service_role` key lives ONLY in edge function secrets. Never here.
`AdminRoute` is a **rendering** gate, not a security boundary. Do not "improve"
security by adding client-side checks; add them in the edge functions.
What the split DID buy: separate deploy, separate URL, `noindex` +
`X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` (vercel.json), and a
place to enable Vercel Deployment Protection — that last one is the only real
added layer, so keep it on.

## Routing
Routes keep the `/admin/*` prefix even though the entire app is admin. The
pages moved over from the student app link with absolute paths like
`/admin/tests/:slug`, so keeping the prefix meant moving the code without
rewriting a single link. `/` and `/admin` redirect to `/admin/tests`; unknown
paths inside the shell redirect there too.

## Auth (differs from the student app on purpose)
`/login` is PHONE (+998) + password ONLY — no sign-up (owner's call). Since
2026-09-14 every Cefrly account is created in the student app through the
Telegram bot (@CefrLy_bot); email accounts no longer exist and public sign-up is
disabled in Supabase. The login maps the phone to the account's synthetic auth
address `<998XXXXXXXXX>@phone.cefrly.app` in `src/lib/phone.ts` — keep that in
lockstep with `../cefrly/src/lib/phoneAuth.ts` and the telegram-auth function.
Admins are promoted by a super admin (the only one on 2026-09-14:
+998 90 508 39 95). Forgot password → @CefrLy_bot, 📱 Send my number,
🔑 Get a new password. The user list/detail show phone, father's name and whether
Telegram is linked (admin-users returns phone, father_name, telegram_linked).
A signed-in NON-admin gets an explicit dead end (`NotAuthorized` in
AdminRoute.tsx) with a sign-out button. The student app redirected these users
to `/`, which here IS the admin area — that would loop. Never reintroduce it.

## What is duplicated from the student app
`lib/auth`, `lib/supabase`, `lib/storage`, `lib/bands`, `lib/plans`,
`lib/sessionExpiry`, `types/*`, `components/{Cat,EmptyState,RouteFallback,
Skeleton,TabStrip,icons}`, `index.css`, `fonts.css`, `public/fonts/*`.
**Change one of these here and you must change it in `../cefrly` too.** Run
`npm run check:shared` after touching any of them — it diffs this repo's copies
against the student app (normalising line endings, since git rewrites those) and
exits non-zero on drift. Add any new shared file to the SHARED list in
scripts/check-shared.mjs.
Drift is NOT silent: the admin-* edge functions re-validate every payload and
write nothing on failure, so a stale type surfaces as a visible validation error
rather than corrupt data. The check exists to catch it before that.

Owned solely by this repo: `pages/admin/*`, `components/admin/*`,
`lib/adminApi`, `lib/testDraft`, `lib/listeningDraft`, `lib/sampleDraft`,
`lib/testValidation`, `lib/listeningValidation`, `pages/LoginPage`.

## Conventions
- TypeScript strict. `npx tsc -p tsconfig.app.json --noEmit` (the root tsconfig
  is a solution file with `files: []` and checks nothing).
- Never Lighthouse the dev server — it measures Vite's transform pipeline, not
  the app. Use `npm run build && npm run preview`.
- Admin pages still use native `window.confirm`. Acceptable here; the student
  app's ConfirmDialog rule applies to student surfaces only.

## ⚠️ LISTENING AUDIO: THE TWO-LISTEN RULE (added 2026-09-10)
The exam plays every recording TWICE, and `playLimit` alone cannot say so — the
official papers ship each part ALREADY RECORDED TWICE, so those tests are
`playLimit 1`. `AudioAsset.repeatsIncluded` (types/test.ts, mirrored from the
student repo) declares that, and the rule is
`playLimit * (repeatsIncluded ? 2 : 1) === 2`. Enforced in
`src/lib/listeningValidation.ts` AND in the student repo's
`supabase/functions/admin-tests/validate-listening.ts`, which is the source of
truth and where the tests live (`node --test .../validate-listening.test.ts`
over there). CHANGE BOTH OR THE FORM AND THE SERVER DISAGREE — note that
listeningValidation.ts is NOT on the check:shared list, so nothing warns you.
`listeningDraft.ts` defaults changed: a single section recording now starts at
`playLimit 1 + repeatsIncluded` (what every real Cefrly paper is — the old
`playLimit 2` default would have given FOUR listens), a per-part recording at
`playLimit 2`. AudioUploadField carries the checkbox (ticking it forces
playLimit 1, unticking it forces 2) plus a live readout of how many times each
question would be heard, so a wrong pairing is visible while authoring.
