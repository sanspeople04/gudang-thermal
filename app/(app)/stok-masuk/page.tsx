import { PackagePlus } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { rupiah, tanggalWaktu } from '@/lib/format'
import StokForm, { type UnitOption } from '@/components/stok/StokForm'
import { Tabel, Baris, Sel, Kosong } from '@/components/tabel'

type UnitRow = {
  id: string
  unit_name: string
  base_qty_multiplier: number
  products: { name: string; base_unit: string; is_active: boolean } | null
}
type MasukRow = {
  id: string
  reason: string
  qty_change: number
  unit_cost: number | null
  note: string | null
  created_at: string
  products: { name: string; base_unit: string } | null
  profiles: { full_name: string } | null
}

export default async function StokMasukPage() {
  await requireRole(['owner', 'admin'])
  const supabase = await createClient()

  const [unitRes, riwayatRes] = await Promise.all([
    supabase.from('product_units').select('id, unit_name, base_qty_multiplier, products(name, base_unit, is_active)'),
    supabase
      .from('stock_movements')
      .select('id, reason, qty_change, unit_cost, note, created_at, products(name, base_unit), profiles:created_by(full_name)')
      .in('reason', ['supplier', 'retur'])
      .eq('is_opening', false)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const units: UnitOption[] = ((unitRes.data ?? []) as unknown as UnitRow[])
    .filter((u) => u.products?.is_active)
    .map((u) => ({
      id: u.id,
      baseUnit: u.products?.base_unit ?? 'satuan',
      label: `${u.products?.name ?? '?'} — ${u.unit_name}${u.base_qty_multiplier > 1 ? ` (isi ${u.base_qty_multiplier} ${u.products?.base_unit})` : ''}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const riwayat = (riwayatRes.data ?? []) as unknown as MasukRow[]

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2">
          <PackagePlus size={24} /> Stok Masuk
        </h2>
        <p className="text-[13px] text-secondary mt-1">Catat barang yang datang dari supplier atau retur dari pelanggan. Stok bertambah otomatis, dan harga beli dicatat untuk menghitung modal.</p>
      </div>

      <section className="bg-surface border border-divider p-4 md:p-6">
        {units.length === 0 ? (
          <p className="text-[14px] text-secondary">Belum ada produk aktif. Owner dapat menambahkannya di menu Produk.</p>
        ) : (
          <StokForm
            units={units}
            reasons={[
              { value: 'supplier', label: 'Dari supplier' },
              { value: 'retur', label: 'Retur dari pelanggan' },
            ]}
            submitLabel="Simpan stok masuk"
            noteLabel="Supplier / catatan (opsional)"
          />
        )}
      </section>

      <section className="bg-surface border border-divider">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Stok masuk terakhir</h3>
        <div className="overflow-x-auto">
          <Tabel heads={['Waktu', 'Produk', 'Jumlah', 'Harga beli', 'Jenis', 'Dicatat oleh']}>
              {riwayat.length === 0 && <Kosong>Belum ada stok masuk.</Kosong>}
              {riwayat.map((r) => (
                <Baris key={r.id}>
                  <Sel label="Waktu" className="lg:whitespace-nowrap">{tanggalWaktu(r.created_at)}</Sel>
                  <Sel label="Produk">{r.products?.name}</Sel>
                  <Sel label="Jumlah" className="font-mono lg:whitespace-nowrap">+{r.qty_change.toLocaleString('id-ID')} {r.products?.base_unit}</Sel>
                  <Sel label="Harga beli" className="font-mono lg:whitespace-nowrap">{r.reason === 'supplier' && r.unit_cost ? `${rupiah(r.unit_cost)}/${r.products?.base_unit}` : '-'}</Sel>
                  <Sel label="Jenis">{r.reason === 'supplier' ? 'Supplier' : 'Retur'}{r.note ? ` · ${r.note}` : ''}</Sel>
                  <Sel label="Dicatat oleh">{r.profiles?.full_name ?? '-'}</Sel>
                </Baris>
              ))}
            </Tabel>
        </div>
      </section>
    </div>
  )
}
