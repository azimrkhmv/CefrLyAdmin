# Cefrly Admin

The admin console for [Cefrly](https://cefrly.vercel.app), split out of the
student app so the two deploy, and are reached, separately.

## What this is

A Vite + React + TypeScript + Tailwind SPA that talks to the **same Supabase
project** as the student app. It manages tests (Reading, Listening, single-part
drills), samples, and users/roles/plans.

## What splitting the app does and does not buy you

It **does**: give the console its own deployment, its own URL, its own login
screen, `noindex` headers, and a codebase a student-facing change cannot break.
It also means a Vercel Deployment Protection password (Project → Settings →
Deployment Protection) can sit in front of the whole console — that is a real
extra layer, and it is worth turning on.

It **does not**: add authorization. Security was already server-side and still
is. Every table is RLS'd, and every admin action goes through an edge function
(`admin-tests`, `admin-samples`, `admin-users`) that re-checks `profiles.role`
before doing anything. Moving the UI to another domain does not stop anyone
from calling those functions directly — the functions stopping them is what
matters, and that has not changed.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the same values the student app uses
npm run dev                  # http://localhost:5174
```

`VITE_SUPABASE_ANON_KEY` is safe in the browser. The `service_role` key belongs
only in Supabase edge function secrets and must never appear here.

## Access

Sign in with email + password at `/login`. There is no sign-up: accounts are
created in the student app, and a **super admin** grants the admin role from
Users → (a user) → role. Signing in with a non-admin account gets a dead end,
not the console.

If an account has no password (created via Google in the student app), set one
from the Supabase dashboard: Authentication → Users → the user → reset/set
password.

## Deploying

Vercel project pointed at this repo. Set `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` and `VITE_STUDENT_URL` in the project's environment
variables. `vercel.json` already handles the SPA rewrite and sends
`X-Robots-Tag: noindex`, `X-Frame-Options: DENY` and `Referrer-Policy:
no-referrer`.

## Layout

Routes keep the `/admin/*` prefix even though the whole app is admin. That was
deliberate: the pages moved over from the student app link with absolute paths
like `/admin/tests/:slug`, so keeping the prefix meant moving the code without
rewriting a single link. `/` redirects to `/admin/tests`.

Some files here are copies of student-app modules (`lib/auth`, `lib/supabase`,
`lib/storage`, `lib/bands`, `lib/plans`, `types/*`, a few components). That
duplication is the price of separation — if you change a shared type here,
change it there too. `lib/adminApi`, the draft/validation modules and
everything under `pages/admin` and `components/admin` live **only** here.
