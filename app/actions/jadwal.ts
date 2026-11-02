'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { buatPdfDokumen } from '@/lib/pdf/generate'
import type { AksiHasil } from '@/lib/types'

const buatSchema = z.object({
  customer_id: z.guid('Pilih pelanggan'),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal kirim wajib diisi'),
  items: z.array(z.object({
    product_unit_id: z.guid('Pilih produk'),
    qty: z.number({ error: 'Jumlah wajib diisi' }).int().min(1, 'Jumlah minimal 1'),
  })).min(1, 'Minimal 1 produk'),
})

export async function buatJadwalAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner', 'admin']))) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }
  const p = buatSchema.safeParse(input)
  if (!p.success) return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(p.error).fieldErrors }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_scheduled_order', {
    p_customer_id: p.data.customer_id, p_delivery_date: p.data.delivery_date, p_items: p.data.items,
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Pesanan terjadwal disimpan.' }
}

const prosesSchema = z.object({
  id: z.guid(),
  saluran: z.enum(['online', 'offline'], { error: 'Pilih saluran' }),
  catatan: z.string().trim().max(200).optional(),
})

/** Proses jadwal = membuat penjualan (stok berkurang), status 'dikirim', invoice + faktur dibuat otomatis beserta PDF-nya. */
export async function prosesJadwalAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner', 'admin']))) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }
  const p = prosesSchema.safeParse(input)
  if (!p.success) return { ok: false, message: 'Periksa kembali isian.', errors: z.flattenError(p.error).fieldErrors }

  const supabase = await createClient()
  const { data: saleId, error } = await supabase.rpc('process_scheduled_order', {
    p_order_id: p.data.id, p_saluran: p.data.saluran, p_catatan: p.data.catatan || null,
  })
  if (error) return { ok: false, message: error.message }

  if (saleId) {
    const { data: docs } = await supabase.from('documents').select('id').eq('sale_id', saleId)
    for (const doc of docs ?? []) await buatPdfDokumen(doc.id) // jika gagal, Arsip menampilkan tombol "Buat ulang"
  }

  revalidatePath('/', 'layout')
  redirect('/arsip?tab=dokumen&sukses=1')
}

export async function batalJadwalAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner', 'admin']))) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }
  const p = z.object({ id: z.guid() }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Data tidak valid.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_scheduled_order', { p_order_id: p.data.id })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Pesanan dibatalkan.' }
}
