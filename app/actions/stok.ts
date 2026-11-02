'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { AksiHasil } from '@/lib/types'

const stokSchema = z.object({
  product_unit_id: z.guid('Pilih produk dan satuan'),
  qty: z.number({ error: 'Jumlah wajib diisi' }).int('Jumlah harus bilangan bulat').min(1, 'Jumlah minimal 1'),
  reason: z.enum(['supplier', 'retur', 'rusak'], { error: 'Pilih jenis pencatatan' }),
  note: z.string().trim().max(200, 'Catatan maksimal 200 karakter').optional(),
  // harga beli per SATUAN DASAR (mis. per roll); wajib bila dari supplier
  unit_cost: z.number().int('Harga beli harus bilangan bulat').min(1, 'Harga beli minimal Rp 1').optional(),
}).refine((d) => d.reason !== 'supplier' || d.unit_cost !== undefined,
  { message: 'Harga beli wajib diisi untuk stok dari supplier', path: ['unit_cost'] })

/** Stok masuk (supplier/retur) dan barang rusak. Semua lewat fungsi database record_stock_movement. */
export async function catatStokAction(input: unknown): Promise<AksiHasil> {
  const user = await assertRole(['owner', 'admin'])
  if (!user) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }

  const parsed = stokSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_stock_movement', {
    p_product_unit_id: parsed.data.product_unit_id,
    p_qty: parsed.data.qty,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note || null,
    p_unit_cost: parsed.data.reason === 'supplier' ? parsed.data.unit_cost : null,
  })

  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Tersimpan. Stok sudah diperbarui.' }
}
