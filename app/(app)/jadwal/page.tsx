import { Calendar } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hariIniJakarta, tanggal } from '@/lib/format'
import FormJadwal from '@/components/jadwal/FormJadwal'
import AksiJadwal from '@/components/jadwal/AksiJadwal'
import { Tabel, Baris, Sel, Kosong } from '@/components/tabel'

type Order = {
  id: string
  delivery_date: string
  status: 'terjadwal' | 'dikirim' | 'dibatalkan'
  customers: { name: string } | null
  scheduled_order_items: { qty: number; product_units: { unit_name: string; products: { name: string } | null } | null }[]
}
type UnitRow = { id: string; unit_name: string; products: { name: string; is_active: boolean } | null }

const SELECT = 'id, delivery_date, status, customers(name), scheduled_order_items(qty, product_units(unit_name, products(name)))'

function Items({ o }: { o: Order }) {
  return (
    <>
      {o.scheduled_order_items.map((it, i) => (
        <p key={i} className="text-[13px] text-secondary">{it.product_units?.products?.name} · {it.qty} {it.product_units?.unit_name}</p>
      ))}
    </>
  )
}

export default async function JadwalPage() {
  await requireRole(['owner', 'admin'])
  const supabase = await createClient()
  const hariIni = hariIniJakarta()

  const [custRes, unitRes, aktifRes, riwayatRes] = await Promise.all([
    supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
    supabase.from('product_units').select('id, unit_name, products(name, is_active)'),
    supabase.from('scheduled_orders').select(SELECT).eq('status', 'terjadwal').order('delivery_date'),
    supabase.from('scheduled_orders').select(SELECT).neq('status', 'terjadwal').order('delivery_date', { ascending: false }).limit(15),
  ])

  const customers = (custRes.data ?? []) as { id: string; name: string }[]
  const units = ((unitRes.data ?? []) as unknown as UnitRow[])
    .filter((u) => u.products?.is_active)
    .map((u) => ({ id: u.id, label: `${u.products!.name} (${u.unit_name})` }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const aktif = (aktifRes.data ?? []) as unknown as Order[]
  const riwayat = (riwayatRes.data ?? []) as unknown as Order[]

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2"><Calendar size={24} /> Jadwal Kirim</h2>
        <p className="text-[13px] text-secondary mt-1">Pesanan yang akan dikirim. Tombol Proses mengubahnya menjadi penjualan dan mengurangi stok.</p>
      </div>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Tambah jadwal</h3>
        {customers.length === 0 || units.length === 0
          ? <p className="text-[14px] text-secondary">Data pelanggan atau produk aktif belum tersedia.</p>
          : <FormJadwal customers={customers} units={units} hariIni={hariIni} />}
      </section>

      <section className="bg-surface border border-divider">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Menunggu dikirim ({aktif.length})</h3>
        {aktif.length === 0 && <p className="p-4 text-[14px] text-secondary">Tidak ada pesanan terjadwal.</p>}
        {aktif.map((o) => {
          const telat = o.delivery_date < hariIni
          const hariIniItu = o.delivery_date === hariIni
          return (
            <div key={o.id} className={`m-4 p-4 bg-page border-l-[6px] ${telat ? 'border-danger' : hariIniItu ? 'border-accent' : 'border-primary'}`}>
              <div className="flex justify-between gap-3 flex-wrap mb-2">
                <p className="font-bold text-[15px]">{o.customers?.name ?? '-'}</p>
                <p className={`font-condensed uppercase text-[12px] tracking-wider ${telat ? 'text-danger' : ''}`}>
                  {telat ? 'Terlambat · ' : hariIniItu ? 'Hari ini · ' : ''}{tanggal(o.delivery_date)}
                </p>
              </div>
              <Items o={o} />
              <div className="mt-3"><AksiJadwal id={o.id} /></div>
            </div>
          )
        })}
      </section>

      <section className="bg-surface border border-divider">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Riwayat terakhir</h3>
        <div className="overflow-x-auto">
          <Tabel heads={['Tanggal', 'Pelanggan', 'Status']}>
              {riwayat.length === 0 && <Kosong>Belum ada riwayat.</Kosong>}
              {riwayat.map((o) => (
                <Baris key={o.id}>
                  <Sel label="Tanggal" className="lg:whitespace-nowrap">{tanggal(o.delivery_date)}</Sel>
                  <Sel label="Pelanggan">{o.customers?.name ?? '-'}<Items o={o} /></Sel>
                  <Sel label="Status" className="capitalize">{o.status}</Sel>
                </Baris>
              ))}
            </Tabel>
        </div>
      </section>
    </div>
  )
}
