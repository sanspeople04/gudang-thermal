import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Klien dengan service role: MELEWATI RLS. Hanya boleh dipakai di server action / route handler,
 * dan hanya setelah role pemanggil diverifikasi (assertRole). Jangan pernah diimpor di komponen client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
