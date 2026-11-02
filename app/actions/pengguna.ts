'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AksiHasil } from '@/lib/types'

const buatSchema = z.object({
  full_name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80, 'Nama maksimal 80 karakter'),
  email: z.email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter').max(72, 'Password maksimal 72 karakter'),
  role: z.enum(['owner', 'admin'], { error: 'Pilih role' }),
})

const ubahSchema = z.object({
  id: z.guid(),
  role: z.enum(['owner', 'admin']),
})

/** Hanya owner. Membuat akun Supabase Auth + baris profiles dengan role yang dipilih. */
export async function buatPenggunaAction(input: unknown): Promise<AksiHasil> {
  const me = await assertRole(['owner'])
  if (!me) return { ok: false, message: 'Hanya owner yang boleh menambah akun.' }

  const parsed = buatSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(parsed.error).fieldErrors }
  }
  const d = parsed.data

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name: d.full_name },
  })
  if (error || !data.user) {
    const already = error?.message.toLowerCase().includes('already')
    return { ok: false, message: already ? 'Email sudah terdaftar.' : (error?.message ?? 'Gagal membuat akun.') }
  }

  // upsert: aman walaupun trigger handle_new_user sudah membuat baris profil lebih dulu
  const { error: pErr } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: d.role, full_name: d.full_name })
  if (pErr) return { ok: false, message: 'Akun dibuat, tetapi profil gagal disimpan: ' + pErr.message }

  revalidatePath('/pengguna')
  return { ok: true, message: `Akun ${d.email} berhasil dibuat sebagai ${d.role}.` }
}

/** Hanya owner. Tidak boleh mengubah role akun sendiri, dan harus tersisa minimal satu owner. */
export async function ubahRoleAction(input: unknown): Promise<AksiHasil> {
  const me = await assertRole(['owner'])
  if (!me) return { ok: false, message: 'Hanya owner yang boleh mengubah role.' }

  const parsed = ubahSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Data tidak valid.' }
  const { id, role } = parsed.data

  if (id === me.id) return { ok: false, message: 'Role akun Anda sendiri tidak bisa diubah.' }

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('role').eq('id', id).maybeSingle()
  if (!target) return { ok: false, message: 'Profil pengguna tidak ditemukan.' }

  if (target.role === 'owner' && role === 'admin') {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner')
    if ((count ?? 0) <= 1) return { ok: false, message: 'Minimal harus ada satu owner.' }
  }

  const { error } = await admin.from('profiles').update({ role }).eq('id', id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/pengguna')
  return { ok: true, message: 'Role diperbarui.' }
}
