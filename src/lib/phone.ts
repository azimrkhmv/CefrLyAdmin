// Phone accounts (Telegram sign-up, 2026-09-14). Every Cefrly account now logs
// in with its +998 number. Supabase's phone provider is off, so the student
// app's telegram-auth function gives each account a synthetic login address
// derived from the number; nothing is ever mailed to it.
// Keep loginEmailForPhone in lockstep with ../cefrly/src/lib/phoneAuth.ts and
// the telegram-auth edge function.

export function loginEmailForPhone(phone: string): string {
  return `${phone}@phone.cefrly.app`
}

export function isPhoneLoginEmail(email: string | undefined | null): boolean {
  return !!email && email.endsWith('@phone.cefrly.app')
}

/** The 9 local digits typed after the fixed +998 → "998XXXXXXXXX". */
export function fullPhone(localDigits: string): string | null {
  const d = localDigits.replace(/\D/g, '')
  return d.length === 9 ? `998${d}` : null
}

/** "901234567" → "90 123 45 67" */
export function formatLocalPhone(localDigits: string): string {
  const d = localDigits.replace(/\D/g, '').slice(0, 9)
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}

/** "998901234567" → "+998 90 123 45 67" */
export function formatPhone(phone: string): string {
  return `+998 ${formatLocalPhone(phone.slice(3))}`
}

/** What to show for an account: its phone, or the login address as a fallback. */
export function accountLabel(phone: string | null | undefined, email: string | null | undefined): string {
  if (phone) return formatPhone(phone)
  if (isPhoneLoginEmail(email)) return formatPhone(email!.split('@')[0])
  return email ?? ''
}
