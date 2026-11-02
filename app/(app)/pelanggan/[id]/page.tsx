import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import FormPelanggan from '@/components/pelanggan/FormPelanggan'
import DiskonForm, { type DiskonRow } from '@/components/pelanggan/DiskonForm'

type UnitRow = { id: string; unit_name: string; sell_price: number; products: { name: string; is_active: boolean } | null }

export default async function UbahPelangganPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['owner', 'admin'])
  const { id } = await params
  const supabase = await createClient()

  const { data: c } = await supabase.from('customers').select('id, name, contact, address').eq('id', id).maybeSingle()
  if (!c) notFound()

  let diskonRows: DiskonRow[] = []
  if (user.role === 'owner') {
    const [unitRes, discRes] = await Promise.all([
      supabase.from('product_units').select('id, unit_name, sell_price, products(name, is_active)'),
      supabase.from('customer_product_discounts').select('product_unit_id, discount_amount').eq('customer_id', id),
    ])
    const disc = new Map(((discRes.data ?? []) as { product_unit_id: string; discount_amount: number }[]).map((d) => [d.product_unit_id, d.discount_amount]))
    diskonRows = ((unitRes.data ?? []) as unknown as UnitRow[])
      .filter((u) => u.products?.is_active)
      .map((u) => ({ unitId: u.id, label: `${u.products!.name} (${u.unit_name})`, price: u.sell_price, amount: disc.get(u.id) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="border-b border-divider pb-4">
        <Link href="/pelanggan" className="text-[12px] font-condensed uppercase tracking-wider inline-flex items-center gap-1 min-h-11 -ml-1 px-1 text-secondary hover:text-primary"><ArrowLeft size={14} /> Kembali</Link>
        <h2 className="font-condensed uppercase text-2xl tracking-wider">{c.name}</h2>
      </div>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Data pelanggan</h3>
        <FormPelanggan mode="ubah" awal={{ id: c.id, name: c.name, contact: c.contact ?? '', address: c.address ?? '' }} />
      </section>

      {user.role === 'owner' ? (
        <section className="bg-surface border border-divider p-4 md:p-6">
          <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Diskon khusus per produk</h3>
          <DiskonForm customerId={c.id} rows={diskonRows} />
        </section>
      ) : (
        <p className="text-[13px] text-secondary">Diskon khusus pelanggan hanya bisa diatur oleh owner.</p>
      )}
    </div>
  )
}
