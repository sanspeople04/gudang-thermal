'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { AksiHasil } from '@/lib/types'

const angka = (label: string) => z.number({ error: `${label} wajib diisi` }).int(`${label} harus bilangan bulat`).min(0, `${label} tidak boleh negatif`)

const satuanSchema = z.object({
  unit_name: z.string().trim().min(1, 'Nama satuan wajib diisi').max(30),
  multiplier: z.number({ error: 'Isi per satuan wajib diisi' }).int().min(1, 'Isi per satuan minimal 1'),
  sell_price: angka('Harga jual'),
})

const buatSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  type: z.enum(['thermal', 'stiker', 'sampel'], { error: 'Pilih jenis produk' }),
  base_unit: z.string().trim().min(1, 'Satuan dasar wajib diisi').max(20),
  buy_price: angka('Harga beli'),
  min_stock: angka('Stok minimum'),
  initial_stock: angka('Stok awal'),
  units: z.array(satuanSchema).min(1, 'Minimal 1 satuan jual').max(8),
}).refine((d) => new Set(d.units.map((u) => u.unit_name.toLowerCase())).size === d.units.length,
  { message: 'Nama satuan tidak boleh kembar', path: ['units'] })

export async function buatProdukAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh menambah produk.' }
  const p = buatSchema.safeParse(input)
  if (!p.success) return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(p.error).fieldErrors }
  const d = p.data

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_product', {
    p_name: d.name, p_type: d.type, p_base_unit: d.base_unit, p_buy_price: d.buy_price,
    p_min_stock: d.min_stock, p_initial_stock: d.initial_stock,
    p_units: d.units.map((u) => ({ unit_name: u.unit_name, multiplier: u.multiplier, sell_price: u.sell_price })),
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: `Produk "${d.name}" ditambahkan.` }
}

const ubahSchema = z.object({
  id: z.guid(),
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  type: z.enum(['thermal', 'stiker', 'sampel']),
  buy_price: angka('Harga beli'),
  min_stock: angka('Stok minimum'),
  is_active: z.boolean(),
})

export async function ubahProdukAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh mengubah produk.' }
  const p = ubahSchema.safeParse(input)
  if (!p.success) return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(p.error).fieldErrors }

  const supabase = await createClient()
  const { id, ...nilai } = p.data
  const { error } = await supabase.from('products').update(nilai).eq('id', id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Produk diperbarui.' }
}

export async function tambahSatuanAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh mengubah produk.' }
  const p = satuanSchema.extend({ product_id: z.guid() }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Periksa kembali isian satuan.', errors: z.flattenError(p.error).fieldErrors }

  const supabase = await createClient()
  const { error } = await supabase.from('product_units').insert({
    product_id: p.data.product_id, unit_name: p.data.unit_name, base_qty_multiplier: p.data.multiplier, sell_price: p.data.sell_price,
  })
  if (error) {
    const kembar = error.message.includes('duplicate') || error.code === '23505'
    return { ok: false, message: kembar ? 'Satuan dengan nama itu sudah ada.' : error.message }
  }
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Satuan ditambahkan.' }
}

/** Isi per satuan tidak bisa diubah (riwayat transaksi memakainya). Hanya harga jual. */
export async function ubahHargaSatuanAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh mengubah harga.' }
  const p = z.object({ id: z.guid(), sell_price: angka('Harga jual') }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Harga jual harus angka bulat, minimal 0.' }

  const supabase = await createClient()
  const { error } = await supabase.from('product_units').update({ sell_price: p.data.sell_price }).eq('id', p.data.id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Harga jual diperbarui.' }
}
