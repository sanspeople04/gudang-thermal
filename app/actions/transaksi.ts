'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createSaleSchema } from '@/lib/validations/sales'
import { buatPdfDokumen } from '@/lib/pdf/generate'
import type { AksiHasil } from '@/lib/types'

/**
 * Menyimpan penjualan/sampel. Harga, diskon, total, pemotongan stok, dan nomor dokumen
 * dihitung di database (fungsi create_sale) dalam SATU transaksi: gagal satu, gagal semua.
 * Untuk PENJUALAN, database membuat INVOICE dan FAKTUR sekaligus, lalu PDF keduanya dibuat di sini.
 * Kegagalan PDF tidak membatalkan transaksi: dokumen berstatus "gagal dibuat" dan bisa dibuat ulang dari Arsip.
 * Sampel tidak menghasilkan dokumen.
 */
export async function buatTransaksiAction(input: unknown): Promise<AksiHasil> {
  const user = await assertRole(['owner', 'admin'])
  if (!user) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }

  const parsed = createSaleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(parsed.error).fieldErrors }
  }
  const d = parsed.data
  const penjualan = d.jenis_transaksi === 'penjualan'

  const supabase = await createClient()
  const { data: saleId, error } = await supabase.rpc('create_sale', {
    p_customer_id: d.customer_id,
    p_jenis: d.jenis_transaksi,
    p_saluran: d.jenis_transaksi === 'sampel' ? null : d.saluran,
    p_catatan: d.catatan_saluran?.trim() || null,
    p_items: d.items.map((i) => ({ product_unit_id: i.product_unit_id, qty: i.qty })),
  })

  if (error) return { ok: false, message: error.message }

  if (penjualan && saleId) {
    const { data: docs } = await supabase.from('documents').select('id').eq('sale_id', saleId)
    for (const doc of docs ?? []) await buatPdfDokumen(doc.id)
  }

  revalidatePath('/', 'layout')
  redirect(`/arsip?tab=${penjualan ? 'dokumen' : 'transaksi'}&sukses=1`)
}

/** Hanya owner. Stok dikembalikan, dokumen terkait dibatalkan, transaksi keluar dari laporan. */
export async function batalkanTransaksiAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh membatalkan transaksi.' }
  const p = z.object({ id: z.guid(), reason: z.string().trim().min(3, 'Alasan minimal 3 karakter').max(200) }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Alasan pembatalan wajib diisi (minimal 3 karakter).' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('void_sale', { p_sale_id: p.data.id, p_reason: p.data.reason })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Transaksi dibatalkan dan stok dikembalikan.' }
}
