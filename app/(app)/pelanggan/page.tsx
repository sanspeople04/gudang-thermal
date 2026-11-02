import Link from 'next/link'
import { Contact } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { bersihkanCari } from '@/lib/format'
import { tampilWa } from '@/lib/phone'
import FormPelanggan from '@/components/pelanggan/FormPelanggan'
import ToggleAktif from '@/components/pelanggan/ToggleAktif'
import type { DiskonRow } from '@/components/pelanggan/DiskonInputs'
import { Tabel, Baris, Sel, Kosong } from '@/components/tabel'

type Row = { id: string; name: string; contact: string | null; address: string | null; is_active: boolean }
type UnitRow = { id: string; unit_name: string; sell_price: number; products: { name: string; is_active: boolean } | null }

export default async function PelangganPage({ searchParams }: { searchParams: Promise<{ q?: string; nonaktif?: string }> }) {
  const user = await requireRole(['owner', 'admin'])
  const sp = await searchParams
  const q = bersihkanCari(sp.q)
  const tampilNonaktif = sp.nonaktif === '1'

  const supabase = await createClient()
  let query = supabase.from('customers').select('id, name, contact, address, is_active').order('name').limit(200)
  if (!tampilNonaktif) query = query.eq('is_active', true)
  if (q) query = query.ilike('name', `%${q}%`)
  const { data } = await query
  const rows = (data ?? []) as Row[]

  // Aturan diskon hanya untuk owner: daftar satuan produk aktif beserta harga jualnya
  let diskonRows: DiskonRow[] | undefined
  if (user.role === 'owner') {
    const { data: u } = await supabase.from('product_units').select('id, unit_name, sell_price, products(name, is_active)')
    diskonRows = ((u ?? []) as unknown as UnitRow[])
      .filter((x) => x.products?.is_active)
      .map((x) => ({ unitId: x.id, label: `${x.products!.name} (${x.unit_name})`, price: x.sell_price, amount: 0 }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2"><Contact size={24} /> Pelanggan</h2>
        <p className="text-[13px] text-secondary mt-1">Nomor WhatsApp dipakai untuk mengirim invoice dan faktur.</p>
      </div>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Tambah pelanggan</h3>
        <FormPelanggan mode="tambah" diskonRows={diskonRows} />
      </section>

      <section className="bg-surface border border-divider">
        <div className="p-4 border-b-2 border-primary flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <h3 className="font-condensed uppercase text-[14px] tracking-wider">Daftar pelanggan</h3>
          <form method="get" className="flex gap-2 items-center flex-wrap">
            <input name="q" defaultValue={q} placeholder="Cari nama…" className="bg-page border border-divider px-3 py-1.5 text-[14px]" />
            <label className="text-[13px] flex items-center gap-1">
              <input type="checkbox" name="nonaktif" value="1" defaultChecked={tampilNonaktif} /> tampilkan nonaktif
            </label>
            <button className="bg-primary text-page px-3 py-1.5 font-condensed uppercase text-[12px] tracking-wider">Terapkan</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <Tabel heads={['Nama', 'WhatsApp', 'Alamat', 'Aksi']}>
            {rows.length === 0 && <Kosong>Tidak ada pelanggan.</Kosong>}
            {rows.map((c) => (
              <Baris key={c.id}>
                <Sel label="Nama">
                  {c.name}
                  {!c.is_active && <span className="ml-2 text-[11px] border border-divider px-1.5 py-0.5 text-secondary uppercase">nonaktif</span>}
                </Sel>
                <Sel label="WhatsApp" className="font-mono text-[13px] lg:whitespace-nowrap">{tampilWa(c.contact)}</Sel>
                <Sel label="Alamat" className="text-secondary lg:max-w-[260px]">{c.address ?? '-'}</Sel>
                <Sel label="Aksi">
                  <div className="flex gap-2 items-start flex-wrap">
                    <Link href={`/pelanggan/${c.id}`} className="border border-primary px-2 py-1 text-[11px] font-condensed uppercase tracking-wider hover:bg-primary hover:text-page">Ubah</Link>
                    <ToggleAktif id={c.id} aktif={c.is_active} />
                  </div>
                </Sel>
              </Baris>
            ))}
          </Tabel>
        </div>
      </section>
    </div>
  )
}
