'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { KATEGORI_BIAYA } from '@/lib/biaya'
import type { AksiHasil } from '@/lib/types'

const schema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib diisi'),
  kategori: z.enum(KATEGORI_BIAYA.map((k) => k.value) as [string, ...string[]], { error: 'Pilih kategori' }),
  keterangan: z.string().trim().max(200, 'Keterangan maksimal 200 karakter').optional(),
  jumlah: z.number({ error: 'Jumlah wajib diisi' }).int('Jumlah harus bilangan bulat').min(1, 'Jumlah minimal Rp 1'),
})

export async function tambahBiayaAction(input: unknown): Promise<AksiHasil> {
  const user = await assertRole(['owner'])
  if (!user) return { ok: false, message: 'Hanya owner yang boleh mencatat biaya.' }
  const p = schema.safeParse(input)
  if (!p.success) return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(p.error).fieldErrors }

  const supabase = await createClient()
  const { error } = await supabase.from('expenses').insert({
    tanggal: p.data.tanggal, kategori: p.data.kategori, keterangan: p.data.keterangan || null,
    jumlah: p.data.jumlah, created_by: user.id,
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/biaya')
  revalidatePath('/laporan')
  return { ok: true, message: 'Biaya dicatat.' }
}

export async function hapusBiayaAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh menghapus biaya.' }
  const p = z.object({ id: z.guid() }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Data tidak valid.' }

  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', p.data.id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/biaya')
  revalidatePath('/laporan')
  return { ok: true, message: 'Biaya dihapus.' }
}
