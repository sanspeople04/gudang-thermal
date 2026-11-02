import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { NAMA_BULAN, bulanKey, hariIniJakarta, rupiah, tambahHari, tanggal } from '@/lib/format'
import TrenChart, { type TrenRow } from '@/components/dashboard/TrenChart'

type SaleRow = { created_at: string; saluran: 'online' | 'offline' | null; total_amount: number }
type ProductRow = { id: string; name: string; base_unit: string; current_stock: number; min_stock: number }
type ScheduledRow = {
  id: string
  delivery_date: string
  customers: { name: string } | null
  scheduled_order_items: { qty: number; product_units: { unit_name: string; products: { name: string } | null } | null }[]
}

const JUMLAH_BULAN = 5

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ akses?: string }> }) {
  await requireRole(['owner', 'admin'])
  const { akses } = await searchParams
  const supabase = await createClient()

  const hariIni = hariIniJakarta() // YYYY-MM-DD (WIB)
  const [tahun, bulan] = hariIni.split('-').map(Number)

  // Daftar bulan: JUMLAH_BULAN terakhir, berakhir di bulan ini
  const bulanList: { key: string; label: string }[] = []
  for (let i = JUMLAH_BULAN - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(tahun, bulan - 1 - i, 1))
    bulanList.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: NAMA_BULAN[d.getUTCMonth()] })
  }
  const mulai = `${bulanList[0].key}-01T00:00:00+07:00`

  const [produkRes, salesRes, jadwalRes] = await Promise.all([
    supabase.from('products').select('id, name, base_unit, current_stock, min_stock').eq('is_active', true).order('name'),
    supabase.from('sales').select('created_at, saluran, total_amount').eq('jenis_transaksi', 'penjualan').is('voided_at', null).gte('created_at', mulai),
    supabase
      .from('scheduled_orders')
      .select('id, delivery_date, customers(name), scheduled_order_items(qty, product_units(unit_name, products(name)))')
      .lte('delivery_date', tambahHari(hariIni, 7))
      .eq('status', 'terjadwal')
      .order('delivery_date'),
  ])

  const produk = (produkRes.data ?? []) as ProductRow[]
  const sales = (salesRes.data ?? []) as SaleRow[]
  const jadwal = (jadwalRes.data ?? []) as unknown as ScheduledRow[]

  // Agregasi per bulan dan saluran (rupiah)
  const total = new Map<string, { online: number; offline: number }>()
  bulanList.forEach((b) => total.set(b.key, { online: 0, offline: 0 }))
  sales.forEach((s) => {
    const row = total.get(bulanKey(s.created_at))
    if (row) row[s.saluran === 'online' ? 'online' : 'offline'] += s.total_amount
  })

  const data: TrenRow[] = bulanList.map((b) => ({ bulan: b.label, ...total.get(b.key)!, perkiraan: 0 }))

  // Perkiraan sederhana: rata-rata 3 bulan terakhir yang SUDAH lengkap (tidak termasuk bulan berjalan)
  const lengkap = bulanList.slice(0, -1).slice(-3).map((b) => total.get(b.key)!)
  const adaData = lengkap.some((r) => r.online + r.offline > 0)
  if (adaData) {
    const rata = lengkap.reduce((a, r) => a + r.online + r.offline, 0) / lengkap.length
    const next = new Date(Date.UTC(tahun, bulan, 1))
    data.push({ bulan: NAMA_BULAN[next.getUTCMonth()] + '*', online: 0, offline: 0, perkiraan: Math.round(rata) })
  }

  const bulanIni = total.get(bulanList[bulanList.length - 1].key)!
  const menipis = produk.filter((p) => p.min_stock > 0 && p.current_stock <= p.min_stock)
  const jumlahTransaksiBulanIni = sales.filter((s) => bulanKey(s.created_at) === bulanList[bulanList.length - 1].key).length

  return (
    <div className="flex flex-col gap-6">
      {akses === 'ditolak' && (
        <div className="bg-danger/10 border-l-4 border-danger p-3 flex items-start gap-2 text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="text-[13px] font-medium">Akun Anda tidak punya akses ke halaman tersebut.</p>
        </div>
      )}

      {menipis.length > 0 && (
        <div className="bg-danger/10 border-l-4 border-danger p-3 flex items-start gap-2 text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="text-[13px]">
            <p className="font-medium">Stok menipis:</p>
            {menipis.map((p) => (
              <p key={p.id}>{p.name}: sisa {p.current_stock.toLocaleString('id-ID')} {p.base_unit} (minimum {p.min_stock.toLocaleString('id-ID')})</p>
            ))}
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:gap-6">
        <div className="bg-surface border border-divider p-4 border-l-[6px] border-l-accent">
          <p className="font-condensed uppercase text-[12px] tracking-wider text-secondary">Penjualan bulan ini</p>
          <p className="font-mono text-lg md:text-2xl mt-1">{rupiah(bulanIni.online + bulanIni.offline)}</p>
        </div>
        <div className="bg-surface border border-divider p-4 border-l-[6px] border-l-primary">
          <p className="font-condensed uppercase text-[12px] tracking-wider text-secondary">Transaksi bulan ini</p>
          <p className="font-mono text-lg md:text-2xl mt-1">{jumlahTransaksiBulanIni}</p>
        </div>
      </section>

      <section className="bg-surface border border-divider">
        <div className="bg-accent/10 border-b border-divider p-4 flex justify-between items-center">
          <h2 className="font-condensed uppercase text-[16px] tracking-wider">Pesanan Terjadwal (7 hari ke depan)</h2>
          <Link href="/jadwal" className="text-[12px] font-condensed uppercase underline inline-flex items-center min-h-11 pl-2">Kelola jadwal</Link>
        </div>
        {jadwal.length === 0 ? (
          <p className="p-4 text-[14px] text-secondary">Tidak ada pesanan terjadwal dalam 7 hari ke depan.</p>
        ) : (
          jadwal.map((j) => {
            const telat = j.delivery_date < hariIni
            const hariItu = j.delivery_date === hariIni
            return (
              <div key={j.id} className={`p-4 border-l-[6px] m-4 bg-page ${telat ? 'border-danger' : hariItu ? 'border-accent' : 'border-primary'}`}>
                <div className="flex justify-between gap-3 flex-wrap">
                  <p className="font-bold text-[15px]">{j.customers?.name ?? '-'}</p>
                  <p className={`font-condensed uppercase text-[12px] tracking-wider ${telat ? 'text-danger' : ''}`}>
                    {telat ? 'Terlambat · ' : hariItu ? 'Hari ini · ' : ''}{tanggal(j.delivery_date)}
                  </p>
                </div>
                {j.scheduled_order_items.map((it, idx) => (
                  <p key={idx} className="text-secondary text-[13px]">
                    {it.product_units?.products?.name} ({it.qty} {it.product_units?.unit_name})
                  </p>
                ))}
              </div>
            )
          })
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-divider p-4 h-[320px] md:h-[350px] flex flex-col">
          <div className="mb-4 border-b-2 border-primary pb-2">
            <h3 className="font-condensed uppercase text-[14px] tracking-wider">Tren Penjualan (Rp)</h3>
            <p className="text-[12px] text-secondary mt-0.5">* Perkiraan = rata-rata 3 bulan lengkap terakhir</p>
          </div>
          <div className="flex-1 min-h-0">
            <TrenChart data={data} />
          </div>
        </div>

        <div className="bg-surface border border-divider flex flex-col">
          <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Stok Tersedia</h3>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="font-condensed uppercase text-[12px] border-b border-divider py-2">Produk</th>
                  <th className="font-condensed uppercase text-[12px] border-b border-divider py-2 text-right">Sisa Stok</th>
                </tr>
              </thead>
              <tbody>
                {produk.length === 0 && (
                  <tr><td colSpan={2} className="py-3 text-[14px] text-secondary">Belum ada produk.</td></tr>
                )}
                {produk.map((p) => (
                  <tr key={p.id} className="border-b border-divider/50">
                    <td className="py-3 text-[14px]">{p.name}</td>
                    <td className={`py-3 text-[14px] text-right font-mono ${p.current_stock === 0 ? 'text-danger' : ''}`}>
                      {p.current_stock.toLocaleString('id-ID')} {p.base_unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
