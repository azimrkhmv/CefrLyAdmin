/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Where the header's "Student site" link points. Optional; has a default. */
  readonly VITE_STUDENT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
