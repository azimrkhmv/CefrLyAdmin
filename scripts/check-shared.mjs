#!/usr/bin/env node
/**
 * Drift check for the files this repo duplicates from the student app.
 *
 * When the admin console was split out of Cefrly (2026-08-28) a handful of
 * modules were copied rather than shared through a package — the right call for
 * two repos and one developer, but it means the copies can drift apart.
 *
 * Drift is not silent: the admin-* edge functions re-validate every payload and
 * write nothing on failure, so a stale type shows up as a visible validation
 * error, not corrupt data. This script exists to catch it before that happens.
 *
 *   npm run check:shared                    # compares against ../cefrly
 *   npm run check:shared -- ../some/path    # or wherever the student app is
 *   CEFRLY_STUDENT_PATH=... npm run check:shared
 *
 * Exit codes: 0 = in sync, 1 = drift found, 2 = could not run the check.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Paths are identical in both repos, which is why the copies work at all. */
const SHARED = [
  'src/lib/auth.tsx',
  'src/lib/supabase.ts',
  'src/lib/storage.ts',
  'src/lib/bands.ts',
  'src/lib/plans.ts',
  'src/lib/sessionExpiry.ts',
  'src/types/test.ts',
  'src/types/sample.ts',
  'src/types/plan.ts',
  'src/types/profile.ts',
  'src/types/attempt.ts',
  'src/components/Cat.tsx',
  'src/components/EmptyState.tsx',
  'src/components/RouteFallback.tsx',
  'src/components/Skeleton.tsx',
  'src/components/TabStrip.tsx',
  'src/components/icons.tsx',
  'src/fonts.css',
  'src/index.css',
]

/**
 * Git normalises line endings on checkout, so the same file can be LF here and
 * CRLF there. Comparing raw bytes would report every file as drifted.
 */
const normalise = (s) => s.replace(/\r\n/g, '\n').replace(/\s+$/, '')

function findStudentRepo() {
  const explicit = process.argv[2] ?? process.env.CEFRLY_STUDENT_PATH
  const candidates = explicit
    ? [resolve(explicit)]
    : [resolve(HERE, '..', 'cefrly'), resolve(HERE, '..', 'CefrLy')]

  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory() && existsSync(join(dir, 'src'))) {
      return dir
    }
  }
  return null
}

/** First few differing lines — enough to see what changed without a diff lib. */
function firstDifferences(a, b, limit = 3) {
  const left = a.split('\n')
  const right = b.split('\n')
  const out = []
  for (let i = 0; i < Math.max(left.length, right.length) && out.length < limit; i++) {
    if (left[i] !== right[i]) {
      out.push({
        line: i + 1,
        admin: left[i] ?? '(end of file)',
        student: right[i] ?? '(end of file)',
      })
    }
  }
  return out
}

const studentRepo = findStudentRepo()
if (!studentRepo) {
  console.error('Could not find the student app (looked for ../cefrly and ../CefrLy).')
  console.error('Pass the path: npm run check:shared -- ../path/to/cefrly')
  process.exit(2)
}

console.log(`Comparing shared files against ${studentRepo}\n`)

const drifted = []
const missing = []
let inSync = 0

for (const rel of SHARED) {
  const mine = join(HERE, rel)
  const theirs = join(studentRepo, rel)

  if (!existsSync(mine) || !existsSync(theirs)) {
    missing.push({ rel, here: existsSync(mine), there: existsSync(theirs) })
    continue
  }

  const a = normalise(readFileSync(mine, 'utf8'))
  const b = normalise(readFileSync(theirs, 'utf8'))
  if (a === b) {
    inSync++
  } else {
    drifted.push({ rel, diffs: firstDifferences(a, b) })
  }
}

for (const { rel, here, there } of missing) {
  const where = !here ? 'missing HERE' : 'missing in the STUDENT app'
  console.log(`?  ${rel} — ${where}`)
}

for (const { rel, diffs } of drifted) {
  console.log(`\nX  ${rel}`)
  for (const d of diffs) {
    console.log(`     line ${d.line}`)
    console.log(`       admin:   ${d.admin.trim().slice(0, 100)}`)
    console.log(`       student: ${d.student.trim().slice(0, 100)}`)
  }
}

console.log(
  `\n${inSync}/${SHARED.length} in sync` +
    (drifted.length ? `, ${drifted.length} drifted` : '') +
    (missing.length ? `, ${missing.length} missing` : ''),
)

if (drifted.length || missing.length) {
  console.log('\nDecide which copy is right, then make the other match.')
  console.log('index.css and fonts.css may legitimately differ — the admin app')
  console.log('does not use every student token. Everything else should match.')
  process.exit(1)
}

console.log('No drift.')
