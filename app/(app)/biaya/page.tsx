import { Wallet } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hariIniJakarta, rupiah, tanggal } from '@/lib/format'
import { labelKategori } from '@/lib/biaya'
import FormBiaya from '@/components/biaya/FormBiaya'
import HapusBiaya from '@/components/biaya/HapusBiaya'
import { Tabel, Baris, Sel, Kosong } from '@/components/tabel'

type Row = { id: string; tanggal: string; kategori: string; keterangan: string | null; jumlah: number }

export default async function BiayaPage() {
  await requireRole(['owner'])
  const supabase = await createClient()
  const { data } = await supabase
    .from('expenses').select('id, tanggal, kategori, keterangan, jumlah')
    .order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(100)
  const rows = (data ?? []) as Row[]
  const total = rows.reduce((a, r) => a + r.jumlah, 0)

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2"><Wallet size={24} /> Biaya Operasional</h2>
        <p className="text-[13px] text-secondary mt-1">Hanya owner. Belanja stok dari supplier tidak dicatat di sini, cukup lewat Stok Masuk. Biaya ini ikut dihitung di Laporan.</p>
      </div>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Catat biaya</h3>
        <FormBiaya hariIni={hariIniJakarta()} />
      </section>

      <section className="bg-surface border border-divider">
        <div className="p-4 border-b-2 border-primary flex justify-between gap-3 flex-wrap">
          <h3 className="font-condensed uppercase text-[14px] tracking-wider">100 biaya terakhir</h3>
          <p className="font-mono text-[14px]">Total ditampilkan: {rupiah(total)}</p>
        </div>
        <div className="overflow-x-auto">
          <Tabel heads={['Tanggal', 'Kategori', 'Keterangan', 'Jumlah', '']}>
            {rows.length === 0 && <Kosong>Belum ada biaya tercatat.</Kosong>}
            {rows.map((r) => (
              <Baris key={r.id}>
                <Sel label="Tanggal" className="lg:whitespace-nowrap">{tanggal(r.tanggal)}</Sel>
                <Sel label="Kategori">{labelKategori(r.kategori)}</Sel>
                <Sel label="Keterangan" className="text-secondary">{r.keterangan ?? '-'}</Sel>
                <Sel label="Jumlah" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(r.jumlah)}</Sel>
                <Sel label="Aksi"><HapusBiaya id={r.id} /></Sel>
              </Baris>
            ))}
          </Tabel>
        </div>
      </section>
    </div>
  )
}
