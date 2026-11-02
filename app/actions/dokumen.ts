'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { buatPdfDokumen } from '@/lib/pdf/generate'
import type { AksiHasil } from '@/lib/types'

const schema = z.object({
  id: z.guid(),
  status: z.enum(['terkirim', 'lunas', 'dibatalkan']),
  reason: z.string().trim().max(200).optional(),
})

/** Aturan role ditegakkan di database (set_document_status). Di sini hanya validasi awal. */
export async function ubahStatusDokumenAction(input: unknown): Promise<AksiHasil> {
  const user = await assertRole(['owner', 'admin'])
  if (!user) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Data tidak valid.' }
  if (parsed.data.status === 'dibatalkan' && !parsed.data.reason) {
    return { ok: false, message: 'Alasan pembatalan wajib diisi.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_document_status', {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/arsip')
  return { ok: true, message: 'Status dokumen diperbarui.' }
}

/** Membuat ulang file PDF (untuk dokumen yang gagal dibuat, atau setelah pengaturan usaha diubah). */
export async function buatUlangPdfAction(input: unknown): Promise<AksiHasil> {
  const user = await assertRole(['owner', 'admin'])
  if (!user) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }

  const p = z.object({ id: z.guid() }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Data tidak valid.' }

  // cek lewat klien pengguna (RLS) bahwa dokumen memang ada dan belum final
  const supabase = await createClient()
  const { data: doc } = await supabase.from('documents').select('status').eq('id', p.data.id).maybeSingle()
  if (!doc) return { ok: false, message: 'Dokumen tidak ditemukan.' }
  if (doc.status === 'dibatalkan') return { ok: false, message: 'Dokumen yang dibatalkan tidak bisa dibuat ulang.' }

  const r = await buatPdfDokumen(p.data.id)
  if (!r.ok) return { ok: false, message: 'Gagal membuat PDF: ' + r.message }

  revalidatePath('/arsip')
  return { ok: true, message: 'PDF berhasil dibuat.' }
}
