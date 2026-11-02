import Link from 'next/link'
import { Package } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { rupiah } from '@/lib/format'
import FormProduk from '@/components/produk/FormProduk'
import { Tabel, Baris, Sel, Kosong } from '@/components/tabel'

type Row = {
  id: string; name: string; type: string; base_unit: string; buy_price: number
  current_stock: number; min_stock: number; is_active: boolean
  product_units: { unit_name: string; base_qty_multiplier: number; sell_price: number }[]
}

export default async function ProdukPage() {
  await requireRole(['owner'])
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, type, base_unit, buy_price, current_stock, min_stock, is_active, product_units(unit_name, base_qty_multiplier, sell_price)')
    .order('name')
  const rows = (data ?? []) as unknown as Row[]

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2"><Package size={24} /> Produk</h2>
        <p className="text-[13px] text-secondary mt-1">Hanya owner. Harga jual dan satuan diatur di sini.</p>
      </div>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Tambah produk baru</h3>
        <FormProduk />
      </section>

      <section className="bg-surface border border-divider">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Daftar produk</h3>
        <div className="overflow-x-auto">
          <Tabel heads={['Produk', 'Stok', 'Harga beli', 'Satuan jual', 'Aksi']}>
            {rows.length === 0 && <Kosong>Belum ada produk.</Kosong>}
            {rows.map((p) => {
              const menipis = p.min_stock > 0 && p.current_stock <= p.min_stock
              return (
                <Baris key={p.id}>
                  <Sel label="Produk">
                    {p.name}
                    <p className="text-[12px] text-secondary capitalize">{p.type}</p>
                    {!p.is_active && <span className="text-[11px] border border-divider px-1.5 py-0.5 text-secondary uppercase">nonaktif</span>}
                  </Sel>
                  <Sel label="Stok" className={`font-mono lg:whitespace-nowrap ${menipis ? 'text-danger' : ''}`}>
                    {p.current_stock.toLocaleString('id-ID')} {p.base_unit}
                    {menipis && <p className="text-[11px] font-sans">menipis (min. {p.min_stock.toLocaleString('id-ID')})</p>}
                  </Sel>
                  <Sel label="Harga beli" className="font-mono lg:whitespace-nowrap">{rupiah(p.buy_price)}/{p.base_unit}</Sel>
                  <Sel label="Satuan jual">
                    {p.product_units.map((u, i) => (
                      <p key={i} className="text-[13px]">{u.unit_name}{u.base_qty_multiplier > 1 ? ` (isi ${u.base_qty_multiplier})` : ''} · <span className="font-mono">{rupiah(u.sell_price)}</span></p>
                    ))}
                  </Sel>
                  <Sel label="Aksi">
                    <Link href={`/produk/${p.id}`} className="border border-primary px-2 py-1 text-[11px] font-condensed uppercase tracking-wider hover:bg-primary hover:text-page">Ubah</Link>
                  </Sel>
                </Baris>
              )
            })}
          </Tabel>
        </div>
      </section>
    </div>
  )
}
