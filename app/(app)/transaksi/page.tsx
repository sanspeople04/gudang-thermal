import { ShoppingCart } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import TransaksiForm, { type CustomerOpt, type DiscountOpt, type UnitOpt } from '@/components/transaksi/TransaksiForm'
import StokForm, { type UnitOption } from '@/components/stok/StokForm'

type UnitRow = {
  id: string
  unit_name: string
  base_qty_multiplier: number
  sell_price: number
  products: { id: string; name: string; base_unit: string; current_stock: number; is_active: boolean } | null
}

export default async function TransaksiPage() {
  await requireRole(['owner', 'admin'])
  const supabase = await createClient()

  const [custRes, unitRes, discRes] = await Promise.all([
    supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
    supabase.from('product_units').select('id, unit_name, base_qty_multiplier, sell_price, products(id, name, base_unit, current_stock, is_active)'),
    supabase.from('customer_product_discounts').select('customer_id, product_unit_id, discount_amount'),
  ])

  const customers = (custRes.data ?? []) as CustomerOpt[]
  const unitRows = (unitRes.data ?? []) as unknown as UnitRow[]

  const units: UnitOpt[] = unitRows
    .filter((u) => u.products?.is_active)
    .map((u) => ({
      id: u.id,
      productId: u.products!.id,
      productName: u.products!.name,
      unitName: u.unit_name,
      multiplier: u.base_qty_multiplier,
      price: u.sell_price,
      stock: u.products!.current_stock,
      baseUnit: u.products!.base_unit,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName))

  const discounts: DiscountOpt[] = ((discRes.data ?? []) as { customer_id: string; product_unit_id: string; discount_amount: number }[]).map(
    (d) => ({ customer_id: d.customer_id, product_unit_id: d.product_unit_id, amount: d.discount_amount })
  )

  const rusakUnits: UnitOption[] = units.map((u) => ({ id: u.id, label: `${u.productName} — ${u.unitName}`, baseUnit: u.baseUnit }))

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2">
          <ShoppingCart size={24} /> Stok Keluar
        </h2>
        <p className="text-[13px] text-secondary mt-1">Penjualan (offline dan online) dan pengiriman sampel. Stok berkurang otomatis.</p>
      </div>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Input transaksi keluar</h3>
        {customers.length === 0 || units.length === 0 ? (
          <p className="text-[14px] text-secondary">Data pelanggan atau produk belum tersedia di database.</p>
        ) : (
          <TransaksiForm customers={customers} units={units} discounts={discounts} />
        )}
      </section>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Catat barang rusak</h3>
        {rusakUnits.length === 0 ? (
          <p className="text-[14px] text-secondary">Belum ada produk.</p>
        ) : (
          <StokForm units={rusakUnits} reasons={[{ value: 'rusak', label: 'Rusak' }]} submitLabel="Simpan barang rusak" noteLabel="Keterangan (opsional)" />
        )}
      </section>
    </div>
  )
}
