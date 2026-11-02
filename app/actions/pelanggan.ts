'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { normalisasiWa } from '@/lib/phone'
import type { AksiHasil } from '@/lib/types'

const dasar = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  contact: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300, 'Alamat maksimal 300 karakter').optional(),
})
const tambahSchema = dasar.extend({
  // aturan diskon awal (nominal rupiah per satuan jual); hanya boleh diisi owner
  diskon: z.array(z.object({
    product_unit_id: z.guid(),
    amount: z.number().int('Diskon harus bilangan bulat').min(0, 'Diskon tidak boleh negatif'),
  })).optional(),
})
const ubahSchema = dasar.extend({ id: z.guid() })

function siapkan(d: { contact?: string; address?: string }) {
  const wa = d.contact ? normalisasiWa(d.contact) : null
  if (d.contact && !wa) return { error: 'Nomor WhatsApp tidak valid. Contoh: 081234567890' as const }
  return { wa, alamat: d.address || null }
}

/** Pelanggan baru + aturan diskonnya dibuat dalam satu transaksi database (fungsi create_customer). */
export async function tambahPelangganAction(input: unknown): Promise<AksiHasil> {
  const user = await assertRole(['owner', 'admin'])
  if (!user) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }
  const p = tambahSchema.safeParse(input)
  if (!p.success) return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(p.error).fieldErrors }
  const s = siapkan(p.data)
  if (s.error) return { ok: false, message: s.error, errors: { contact: [s.error] } }

  const diskon = (p.data.diskon ?? []).filter((d) => d.amount > 0)
  if (diskon.length > 0 && user.role !== 'owner') {
    return { ok: false, message: 'Hanya owner yang boleh mengatur diskon pelanggan.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_customer', {
    p_name: p.data.name, p_contact: s.wa, p_address: s.alamat, p_discounts: diskon,
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  const info = diskon.length > 0 ? ` dengan ${diskon.length} aturan diskon` : ''
  return { ok: true, message: `Pelanggan "${p.data.name}" ditambahkan${info}.` }
}

export async function ubahPelangganAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner', 'admin']))) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }
  const p = ubahSchema.safeParse(input)
  if (!p.success) return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(p.error).fieldErrors }
  const s = siapkan(p.data)
  if (s.error) return { ok: false, message: s.error, errors: { contact: [s.error] } }

  const supabase = await createClient()
  const { error } = await supabase.from('customers')
    .update({ name: p.data.name, contact: s.wa, address: s.alamat }).eq('id', p.data.id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Data pelanggan diperbarui.' }
}

export async function ubahStatusPelangganAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner', 'admin']))) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }
  const p = z.object({ id: z.guid(), aktif: z.boolean() }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Data tidak valid.' }

  const supabase = await createClient()
  const { error } = await supabase.from('customers').update({ is_active: p.data.aktif }).eq('id', p.data.id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: p.data.aktif ? 'Pelanggan diaktifkan.' : 'Pelanggan dinonaktifkan.' }
}

/** Diskon khusus per satuan produk: hanya owner. Nilai 0 = hapus diskon. */
export async function simpanDiskonAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh mengatur diskon.' }
  const p = z.object({
    customer_id: z.guid(),
    diskon: z.array(z.object({ product_unit_id: z.guid(), amount: z.number().int().min(0, 'Diskon tidak boleh negatif') })),
  }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Isian diskon tidak valid (harus angka bulat, minimal 0).' }

  const supabase = await createClient()
  const aktif = p.data.diskon.filter((d) => d.amount > 0)
  const hapus = p.data.diskon.filter((d) => d.amount === 0).map((d) => d.product_unit_id)

  if (aktif.length) {
    const { error } = await supabase.from('customer_product_discounts').upsert(
      aktif.map((d) => ({ customer_id: p.data.customer_id, product_unit_id: d.product_unit_id, discount_amount: d.amount })),
      { onConflict: 'customer_id,product_unit_id' }
    )
    if (error) return { ok: false, message: error.message }
  }
  if (hapus.length) {
    const { error } = await supabase.from('customer_product_discounts')
      .delete().eq('customer_id', p.data.customer_id).in('product_unit_id', hapus)
    if (error) return { ok: false, message: error.message }
  }

  revalidatePath('/pelanggan', 'layout')
  return { ok: true, message: 'Diskon pelanggan disimpan.' }
}
