import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'owner' | 'admin'

export type CurrentUser = {
  id: string
  email: string
  role: Role | null // null = akun ada di Supabase Auth tetapi belum punya baris di tabel profiles
  fullName: string | null
}

/** Pengguna yang sedang login (di-cache per request). null jika belum login. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? '',
    role: (profile?.role as Role | undefined) ?? null,
    fullName: profile?.full_name ?? null,
  }
})

/** Untuk halaman: wajib login dan punya salah satu role. Jika tidak, dialihkan. */
export async function requireRole(allowed: Role[]) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.role || !allowed.includes(user.role)) redirect('/dashboard?akses=ditolak')
  return user as CurrentUser & { role: Role }
}

/** Untuk server action: kembalikan user jika diizinkan, selain itu null (tanpa redirect). */
export async function assertRole(allowed: Role[]) {
  const user = await getCurrentUser()
  if (!user || !user.role || !allowed.includes(user.role)) return null
  return user as CurrentUser & { role: Role }
}
