import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ProdukEditor from '@/components/produk/ProdukEditor'

type P = {
  id: string; name: string; type: 'thermal' | 'stiker' | 'sampel'; base_unit: string
  buy_price: number; min_stock: number; is_active: boolean; current_stock: number
}
type U = { id: string; unit_name: string; base_qty_multiplier: number; sell_price: number }

export default async function UbahProdukPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['owner'])
  const { id } = await params
  const supabase = await createClient()

  const [pRes, uRes] = await Promise.all([
    supabase.from('products').select('id, name, type, base_unit, buy_price, min_stock, is_active, current_stock').eq('id', id).maybeSingle(),
    supabase.from('product_units').select('id, unit_name, base_qty_multiplier, sell_price').eq('product_id', id).order('base_qty_multiplier'),
  ])
  const p = pRes.data as P | null
  if (!p) notFound()
  const satuan = ((uRes.data ?? []) as U[]).map((u) => ({ id: u.id, unit_name: u.unit_name, multiplier: u.base_qty_multiplier, sell_price: u.sell_price }))

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="border-b border-divider pb-4">
        <Link href="/produk" className="text-[12px] font-condensed uppercase tracking-wider inline-flex items-center gap-1 min-h-11 -ml-1 px-1 text-secondary hover:text-primary"><ArrowLeft size={14} /> Kembali</Link>
        <h2 className="font-condensed uppercase text-2xl tracking-wider">{p.name}</h2>
      </div>
      <ProdukEditor produk={p} satuan={satuan} />
    </div>
  )
}
