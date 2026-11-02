import Link from 'next/link'
import { Archive } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { bersihkanCari, rupiah, tanggal, tanggalWaktu } from '@/lib/format'
import { normalisasiWa } from '@/lib/phone'
import { tanggalValid } from '@/lib/laporan'
import { Pesan } from '@/components/ui'
import DokumenAksi from '@/components/arsip/DokumenAksi'
import BatalTransaksi from '@/components/arsip/BatalTransaksi'
import FilterBar from '@/components/arsip/FilterBar'
import Pager from '@/components/arsip/Pager'
import { Tabel, Baris, Sel, Kosong } from '@/components/tabel'

type DokRow = {
  id: string; type: 'invoice' | 'faktur'; doc_number: string; date: string; total: number
  status: 'draft' | 'terkirim' | 'lunas' | 'dibatalkan' | 'gagal_dibuat'; cancel_reason: string | null
  file_path: string | null; customer_id: string | null
  customers: { name: string; contact: string | null } | null
  wa_logs: { success: boolean; created_at: string }[]
}
type SaleRow = {
  id: string; jenis_transaksi: 'penjualan' | 'sampel'; saluran: 'online' | 'offline' | null
  catatan_saluran: string | null; total_amount: number; created_at: string
  voided_at: string | null; void_reason: string | null
  customers: { name: string } | null
  profiles: { full_name: string } | null
  sale_items: { qty: number; product_units: { unit_name: string; products: { name: string } | null } | null }[]
}
type MoveRow = {
  id: string; reason: string; qty_change: number; unit_cost: number | null; note: string | null; created_at: string
  products: { name: string; base_unit: string } | null
  profiles: { full_name: string } | null
}

const TABS = [
  { key: 'dokumen', label: 'Dokumen' },
  { key: 'transaksi', label: 'Transaksi' },
  { key: 'stok', label: 'Riwayat Stok' },
] as const
type Tab = (typeof TABS)[number]['key']

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-page border-divider',
  terkirim: 'bg-accent/20 border-accent',
  lunas: 'bg-safe border-primary/40',
  dibatalkan: 'bg-danger/10 border-danger text-danger',
  gagal_dibuat: 'bg-danger/10 border-danger text-danger',
}
const ALASAN: Record<string, string> = {
  supplier: 'Supplier', penjualan: 'Penjualan', sampel: 'Sampel', rusak: 'Rusak', retur: 'Retur',
}
const UKURAN = 20
const KOSONG = '00000000-0000-0000-0000-000000000000'


export default async function ArsipPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string; sukses?: string; q?: string; dari?: string; sampai?: string; page?: string }> }) {
  const user = await requireRole(['owner', 'admin'])
  const sp = await searchParams
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'dokumen'
  const q = bersihkanCari(sp.q)
  const dari = tanggalValid(sp.dari) ?? ''
  const sampai = tanggalValid(sp.sampai) ?? ''
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1)
  const from = (page - 1) * UKURAN
  const to = from + UKURAN - 1
  const supabase = await createClient()

  const awalWib = dari ? `${dari}T00:00:00+07:00` : null
  const akhirWib = sampai ? `${sampai}T23:59:59.999+07:00` : null

  const idPelanggan = async () => {
    const { data } = await supabase.from('customers').select('id').ilike('name', `%${q}%`).limit(50)
    return (data ?? []).map((c) => c.id as string)
  }

  const { data: usaha } = await supabase.from('business_settings').select('name').eq('id', 1).maybeSingle()
  const usahaName = usaha?.name ?? 'Kami'

  let konten: React.ReactNode
  let total = 0

  if (tab === 'dokumen') {
    let qb = supabase
      .from('documents')
      .select('id, type, doc_number, date, total, status, cancel_reason, file_path, customer_id, customers(name, contact), wa_logs(success, created_at)', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (dari) qb = qb.gte('date', dari)
    if (sampai) qb = qb.lte('date', sampai)
    if (q) {
      const ids = await idPelanggan()
      qb = ids.length ? qb.or(`doc_number.ilike.%${q}%,customer_id.in.(${ids.join(',')})`) : qb.ilike('doc_number', `%${q}%`)
    }
    const { data, count } = await qb.range(from, to)
    total = count ?? 0
    const rows = (data ?? []) as unknown as DokRow[]
    konten = (
      <Tabel heads={['Nomor', 'Tanggal', 'Pelanggan', 'Total', 'Status', 'Aksi']}>
        {rows.length === 0 && <Kosong>Tidak ada dokumen. Dokumen dibuat dari form Stok Keluar atau Jadwal.</Kosong>}
        {rows.map((d) => {
          const wa = [...d.wa_logs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          return (
            <Baris key={d.id}>
              <Sel label="Nomor" className="font-mono lg:whitespace-nowrap">{d.doc_number}<p className="text-[11px] text-secondary font-sans capitalize">{d.type}</p></Sel>
              <Sel label="Tanggal" className="lg:whitespace-nowrap">{tanggal(d.date)}</Sel>
              <Sel label="Pelanggan">{d.customers?.name ?? '-'}</Sel>
              <Sel label="Total" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(d.total)}</Sel>
              <Sel label="Status">
                <span className={`inline-block border px-2 py-0.5 text-[11px] font-condensed uppercase tracking-wider ${STATUS_CLS[d.status]}`}>{d.status.replace('_', ' ')}</span>
                {d.cancel_reason && <p className="text-[11px] text-secondary mt-1 max-w-[220px]">{d.cancel_reason}</p>}
                {wa && <p className={`text-[11px] mt-1 ${wa.success ? 'text-primary' : 'text-danger'}`}>WA {wa.success ? 'terkirim' : 'gagal'} · {tanggalWaktu(wa.created_at)}</p>}
              </Sel>
              <Sel label="Aksi">
                <DokumenAksi
                  id={d.id} status={d.status} isOwner={user.role === 'owner'} hasFile={Boolean(d.file_path)}
                  tipe={d.type} nomor={d.doc_number} total={d.total}
                  pelangganNama={d.customers?.name ?? 'Pelanggan'} pelangganId={d.customer_id}
                  phone={normalisasiWa(d.customers?.contact)} usahaName={usahaName}
                />
              </Sel>
            </Baris>
          )
        })}
      </Tabel>
    )
  } else if (tab === 'transaksi') {
    let qb = supabase
      .from('sales')
      .select('id, jenis_transaksi, saluran, catatan_saluran, total_amount, created_at, voided_at, void_reason, customers(name), profiles:created_by(full_name), sale_items(qty, product_units(unit_name, products(name)))', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (awalWib) qb = qb.gte('created_at', awalWib)
    if (akhirWib) qb = qb.lte('created_at', akhirWib)
    if (q) {
      const ids = await idPelanggan()
      qb = qb.in('customer_id', ids.length ? ids : [KOSONG])
    }
    const { data, count } = await qb.range(from, to)
    total = count ?? 0
    const rows = (data ?? []) as unknown as SaleRow[]
    konten = (
      <Tabel heads={['Waktu', 'Pelanggan', 'Jenis', 'Barang', 'Total', 'Dicatat oleh', 'Aksi']}>
        {rows.length === 0 && <Kosong>Tidak ada transaksi.</Kosong>}
        {rows.map((s) => (
          <Baris key={s.id} className={s.voided_at ? 'opacity-60' : ''}>
            <Sel label="Waktu" className="lg:whitespace-nowrap">{tanggalWaktu(s.created_at)}</Sel>
            <Sel label="Pelanggan">{s.customers?.name ?? '-'}</Sel>
            <Sel label="Jenis">
              {s.jenis_transaksi === 'sampel' ? 'Sampel' : `Penjualan ${s.saluran ?? ''}`}
              {s.catatan_saluran && <p className="text-[11px] text-secondary">{s.catatan_saluran}</p>}
              {s.voided_at && <p className="text-[11px] text-danger">Dibatalkan: {s.void_reason}</p>}
            </Sel>
            <Sel label="Barang">
              {s.sale_items.map((it, i) => (
                <p key={i} className="text-[13px]">{it.product_units?.products?.name} · {it.qty} {it.product_units?.unit_name}</p>
              ))}
            </Sel>
            <Sel label="Total" className={`font-mono lg:text-right lg:whitespace-nowrap ${s.voided_at ? 'line-through' : ''}`}>{rupiah(s.total_amount)}</Sel>
            <Sel label="Dicatat oleh">{s.profiles?.full_name ?? '-'}</Sel>
            <Sel label="Aksi">{user.role === 'owner' && !s.voided_at ? <BatalTransaksi id={s.id} /> : <span className="text-secondary text-[12px]">—</span>}</Sel>
          </Baris>
        ))}
      </Tabel>
    )
  } else {
    let qb = supabase
      .from('stock_movements')
      .select('id, reason, qty_change, unit_cost, note, created_at, products(name, base_unit), profiles:created_by(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (awalWib) qb = qb.gte('created_at', awalWib)
    if (akhirWib) qb = qb.lte('created_at', akhirWib)
    if (q) {
      const { data: pr } = await supabase.from('products').select('id').ilike('name', `%${q}%`).limit(50)
      const ids = (pr ?? []).map((p) => p.id as string)
      qb = qb.in('product_id', ids.length ? ids : [KOSONG])
    }
    const { data, count } = await qb.range(from, to)
    total = count ?? 0
    const rows = (data ?? []) as unknown as MoveRow[]
    konten = (
      <Tabel heads={['Waktu', 'Produk', 'Perubahan', 'Harga beli', 'Alasan', 'Catatan', 'Dicatat oleh']}>
        {rows.length === 0 && <Kosong>Tidak ada riwayat stok.</Kosong>}
        {rows.map((m) => (
          <Baris key={m.id}>
            <Sel label="Waktu" className="lg:whitespace-nowrap">{tanggalWaktu(m.created_at)}</Sel>
            <Sel label="Produk">{m.products?.name}</Sel>
            <Sel label="Perubahan" className={`font-mono lg:whitespace-nowrap ${m.qty_change < 0 ? 'text-danger' : ''}`}>
              {m.qty_change > 0 ? '+' : ''}{m.qty_change.toLocaleString('id-ID')} {m.products?.base_unit}
            </Sel>
            <Sel label="Harga beli" className="font-mono lg:whitespace-nowrap">{m.unit_cost ? `${rupiah(m.unit_cost)}/${m.products?.base_unit}` : '-'}</Sel>
            <Sel label="Alasan">{ALASAN[m.reason] ?? m.reason}</Sel>
            <Sel label="Catatan">{m.note ?? '-'}</Sel>
            <Sel label="Dicatat oleh">{m.profiles?.full_name ?? '-'}</Sel>
          </Baris>
        ))}
      </Tabel>
    )
  }

  const paramsPager: Record<string, string> = { tab }
  if (q) paramsPager.q = q
  if (dari) paramsPager.dari = dari
  if (sampai) paramsPager.sampai = sampai

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2"><Archive size={24} /> Arsip</h2>
      </div>

      {sp.sukses && (
        <Pesan ok>
          {tab === 'dokumen'
            ? 'Transaksi disimpan, stok sudah diperbarui, dan invoice serta faktur sudah dibuat.'
            : 'Transaksi berhasil disimpan, stok sudah diperbarui.'}
        </Pesan>
      )}

      <div className="flex gap-1 border-b border-divider overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={`/arsip?tab=${t.key}`}
            className={`px-4 min-h-11 inline-flex items-center font-condensed uppercase text-[13px] tracking-wider whitespace-nowrap ${tab === t.key ? 'bg-primary text-page' : 'hover:bg-surface'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <FilterBar tab={tab} q={q} dari={dari} sampai={sampai}
        placeholder={tab === 'dokumen' ? 'Nomor dokumen atau nama pelanggan' : tab === 'transaksi' ? 'Nama pelanggan' : 'Nama produk'} />

      <div className="bg-surface border border-divider overflow-x-auto">{konten}</div>
      <Pager page={page} total={total} size={UKURAN} params={paramsPager} />
    </div>
  )
}
