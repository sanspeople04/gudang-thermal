import Link from 'next/link'
import { ChartColumn, Download } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { ambilLaporan, ambilRincian, hitungLaba, tanggalValid } from '@/lib/laporan'
import { hariIniJakarta, labelBulan, rupiah, tanggal, tanggalWaktu } from '@/lib/format'
import { labelKategori } from '@/lib/biaya'
import { Pesan } from '@/components/ui'
import { Tabel, Baris, Sel, Kosong } from '@/components/tabel'

const tombolUnduh = 'border border-primary px-3 py-1.5 font-condensed uppercase text-[12px] tracking-wider flex items-center gap-1 hover:bg-primary hover:text-page'
const TAMPIL_RINCIAN = 50
const td = 'p-3 text-[14px]'
const angka = `${td} font-mono text-right whitespace-nowrap`

function Kartu({ label, nilai, aksen, kecil }: { label: string; nilai: string; aksen?: boolean; kecil?: boolean }) {
  return (
    <div className={`bg-surface border border-divider p-4 border-l-[6px] ${aksen ? 'border-l-accent' : 'border-l-primary'}`}>
      <p className="font-condensed uppercase text-[12px] tracking-wider text-secondary">{label}</p>
      <p className={`font-mono mt-1 ${kecil ? 'text-lg' : 'text-xl md:text-2xl'}`}>{nilai}</p>
    </div>
  )
}

function Unduh({ tabel, dari, sampai }: { tabel: string; dari: string | null; sampai: string | null }) {
  const href = (format: 'xlsx' | 'csv') => {
    const sp = new URLSearchParams({ tabel, format })
    if (dari) sp.set('dari', dari)
    if (sampai) sp.set('sampai', sampai)
    return `/api/laporan/unduh?${sp.toString()}`
  }
  return (
    <div className="flex gap-2">
      <a href={href('xlsx')} className={tombolUnduh}><Download size={14} /> Excel</a>
      <a href={href('csv')} className={tombolUnduh}><Download size={14} /> CSV</a>
    </div>
  )
}

function BarisLaba({ label, nilai, tebal, minus }: { label: string; nilai: number; tebal?: boolean; minus?: boolean }) {
  return (
    <tr className={`border-b border-divider/50 ${tebal ? 'bg-accent/10 font-bold' : ''}`}>
      <td className={td}>{label}</td>
      <td className={angka}>{minus && nilai > 0 ? '- ' : ''}{rupiah(nilai)}</td>
    </tr>
  )
}

export default async function LaporanPage({ searchParams }: { searchParams: Promise<{ dari?: string; sampai?: string }> }) {
  const user = await requireRole(['owner', 'admin'])
  const isOwner = user.role === 'owner'
  const sp = await searchParams
  const dari = tanggalValid(sp.dari)
  const sampai = tanggalValid(sp.sampai)

  const hariIni = hariIniJakarta()
  const awalBulan = hariIni.slice(0, 8) + '01'
  const awalTahun = hariIni.slice(0, 5) + '01-01'

  const [{ penjualan, keuangan, error }, { rincian, error: errRincian }] = await Promise.all([
    ambilLaporan(dari, sampai, isOwner),
    ambilRincian(dari, sampai, 0, TAMPIL_RINCIAN),
  ])

  const rentang = dari || sampai
    ? `${dari ? tanggal(dari) : 'awal'} s/d ${sampai ? tanggal(sampai) : 'hari ini'}`
    : 'Sejak awal sampai hari ini'

  const preset = (label: string, d?: string, s?: string) => {
    const qs = d ? `?dari=${d}&sampai=${s ?? hariIni}` : ''
    const aktif = (d ?? '') === (dari ?? '') && (d ? (s ?? hariIni) : '') === (sampai ?? '')
    return (
      <Link key={label} href={`/laporan${qs}`}
        className={`px-3 py-1.5 font-condensed uppercase text-[12px] tracking-wider border border-primary ${aktif ? 'bg-primary text-page' : 'hover:bg-surface'}`}>
        {label}
      </Link>
    )
  }

  const k = keuangan ? hitungLaba(keuangan.total) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2"><ChartColumn size={24} /> Laporan</h2>
        <p className="text-[13px] text-secondary mt-1">{rentang}. Transaksi yang dibatalkan tidak dihitung.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          {preset('Semua')}
          {preset('Hari ini', hariIni, hariIni)}
          {preset('Bulan ini', awalBulan)}
          {preset('Tahun ini', awalTahun)}
        </div>
        <form method="get" className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="font-condensed uppercase text-[11px] tracking-wider">Dari</label>
            <input type="date" name="dari" defaultValue={dari ?? ''} className="bg-page border border-divider px-3 py-2 text-[14px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-condensed uppercase text-[11px] tracking-wider">Sampai</label>
            <input type="date" name="sampai" defaultValue={sampai ?? ''} className="bg-page border border-divider px-3 py-2 text-[14px]" />
          </div>
          <button className="bg-primary text-page px-4 py-2 font-condensed uppercase text-[13px] tracking-wider">Terapkan rentang</button>
        </form>
      </div>

      {error && <Pesan ok={false}>{error}</Pesan>}

      {penjualan && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <Kartu label="Omzet penjualan" nilai={rupiah(penjualan.ringkas.omzet)} aksen />
            <Kartu label="Jumlah transaksi" nilai={String(penjualan.ringkas.transaksi)} />
            <Kartu label="Total diskon diberikan" nilai={rupiah(penjualan.ringkas.diskon)} kecil />
            {k ? <Kartu label="Laba bersih" nilai={rupiah(k.labaBersih)} aksen kecil /> : <Kartu label="Rata-rata per transaksi" nilai={rupiah(penjualan.ringkas.transaksi ? penjualan.ringkas.omzet / penjualan.ringkas.transaksi : 0)} kecil />}
          </section>

          {keuangan && k && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface border border-divider">
                <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Laba rugi</h3>
                <table className="w-full"><tbody>
                  <BarisLaba label="Omzet penjualan" nilai={keuangan.total.omzet} />
                  <BarisLaba label="Modal barang terjual (HPP)" nilai={keuangan.total.hpp} minus />
                  <BarisLaba label="Laba kotor" nilai={k.labaKotor} tebal />
                  <BarisLaba label="Biaya sampel (modal barang sampel)" nilai={keuangan.total.biaya_sampel} minus />
                  <BarisLaba label="Kerugian barang rusak" nilai={keuangan.total.kerugian_rusak} minus />
                  <BarisLaba label="Biaya operasional" nilai={keuangan.total.biaya_operasional} minus />
                  <BarisLaba label="Laba bersih" nilai={k.labaBersih} tebal />
                </tbody></table>
              </div>

              <div className="bg-surface border border-divider">
                <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Uang keluar dan arus kas</h3>
                <table className="w-full"><tbody>
                  <BarisLaba label="Belanja stok dari supplier" nilai={keuangan.total.belanja_stok} />
                  <BarisLaba label="Biaya operasional" nilai={keuangan.total.biaya_operasional} />
                  <BarisLaba label="Total uang keluar" nilai={k.uangKeluar} tebal />
                  <BarisLaba label="Omzet" nilai={keuangan.total.omzet} />
                  <BarisLaba label="Selisih omzet dikurangi uang keluar" nilai={k.kasBersih} tebal />
                </tbody></table>
                <p className="p-4 text-[12px] text-secondary">Selisih ini versi kas sederhana: omzet dihitung penuh walau belum dibayar, dan belanja stok dihitung penuh walau barangnya belum terjual. Untuk menilai untung atau rugi gunakan Laba bersih.</p>
                {keuangan.biaya_kategori.length > 0 && (
                  <div className="border-t border-divider p-4">
                    <p className="font-condensed uppercase text-[12px] tracking-wider mb-2">Biaya operasional per kategori</p>
                    {keuangan.biaya_kategori.map((b) => (
                      <p key={b.kategori} className="flex justify-between text-[14px]"><span>{labelKategori(b.kategori)}</span><span className="font-mono">{rupiah(b.jumlah)}</span></p>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="bg-surface border border-divider">
            <div className="p-4 border-b-2 border-primary flex justify-between gap-3 flex-wrap items-center">
              <div>
                <h3 className="font-condensed uppercase text-[14px] tracking-wider">Rincian transaksi</h3>
                <p className="text-[12px] text-secondary mt-0.5">{rentang}</p>
              </div>
              <Unduh tabel="rincian" dari={dari} sampai={sampai} />
            </div>

            {errRincian && <div className="p-4"><Pesan ok={false}>{errRincian}</Pesan></div>}

            {rincian && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-divider">
                  <div><p className="font-condensed uppercase text-[11px] tracking-wider text-secondary">Transaksi</p><p className="font-mono text-[15px]">{rincian.jumlah.toLocaleString('id-ID')}</p></div>
                  <div><p className="font-condensed uppercase text-[11px] tracking-wider text-secondary">Omzet</p><p className="font-mono text-[15px]">{rupiah(rincian.total_omzet)}</p></div>
                  {rincian.total_hpp !== null && (
                    <>
                      <div><p className="font-condensed uppercase text-[11px] tracking-wider text-secondary">Modal (HPP)</p><p className="font-mono text-[15px]">{rupiah(rincian.total_hpp)}</p></div>
                      <div><p className="font-condensed uppercase text-[11px] tracking-wider text-secondary">Laba kotor</p><p className="font-mono text-[15px]">{rupiah(rincian.total_omzet - rincian.total_hpp)}</p></div>
                    </>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Tabel heads={rincian.total_hpp !== null ? ['Waktu', 'Pelanggan', 'Saluran', 'Barang', 'Diskon', 'Omzet', 'Laba kotor'] : ['Waktu', 'Pelanggan', 'Saluran', 'Barang', 'Diskon', 'Omzet']} kanan={[4, 5, 6]}>
                    {rincian.baris.length === 0 && <Kosong>Tidak ada penjualan pada rentang ini.</Kosong>}
                    {rincian.baris.map((b, i) => (
                      <Baris key={i}>
                        <Sel label="Waktu" className="lg:whitespace-nowrap">{tanggalWaktu(b.waktu)}</Sel>
                        <Sel label="Pelanggan">{b.pelanggan ?? '-'}</Sel>
                        <Sel label="Saluran" className="capitalize">{b.saluran ?? '-'}{b.catatan ? <span className="block text-[11px] text-secondary normal-case">{b.catatan}</span> : null}</Sel>
                        <Sel label="Barang" className="text-[13px]">{b.barang ?? '-'}</Sel>
                        <Sel label="Diskon" className="font-mono lg:text-right lg:whitespace-nowrap">{b.diskon > 0 ? rupiah(b.diskon) : '-'}</Sel>
                        <Sel label="Omzet" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(b.omzet)}</Sel>
                        {b.hpp !== null && <Sel label="Laba kotor" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(b.omzet - b.hpp)}</Sel>}
                      </Baris>
                    ))}
                  </Tabel>
                </div>
                <p className="p-4 text-[12px] text-secondary border-t border-divider">
                  {rincian.jumlah > rincian.baris.length
                    ? `Menampilkan ${rincian.baris.length} dari ${rincian.jumlah.toLocaleString('id-ID')} transaksi terbaru. Unduh Excel atau CSV untuk data lengkap.`
                    : `${rincian.jumlah.toLocaleString('id-ID')} transaksi pada rentang ini.`}{' '}
                  Transaksi yang dibatalkan dan pengiriman sampel tidak termasuk.
                </p>
              </>
            )}
          </section>

          <section className="bg-surface border border-divider">
            <div className="p-4 border-b-2 border-primary flex justify-between gap-3 flex-wrap items-center">
              <h3 className="font-condensed uppercase text-[14px] tracking-wider">Per bulan</h3>
              <Unduh tabel="bulanan" dari={dari} sampai={sampai} />
            </div>
            <div className="overflow-x-auto">
              {keuangan ? (
                <Tabel heads={['Bulan', 'Omzet', 'HPP', 'Laba kotor', 'Sampel + rusak', 'Biaya ops.', 'Laba bersih', 'Belanja stok']} kanan={[1, 2, 3, 4, 5, 6, 7]}>
                  {keuangan.bulanan.length === 0 && <Kosong>Belum ada data pada rentang ini.</Kosong>}
                  {keuangan.bulanan.map((b) => {
                    const h = hitungLaba(b)
                    return (
                      <Baris key={b.bulan}>
                        <Sel label="Bulan">{labelBulan(b.bulan)}</Sel>
                        <Sel label="Omzet" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(b.omzet)}</Sel>
                        <Sel label="HPP" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(b.hpp)}</Sel>
                        <Sel label="Laba kotor" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(h.labaKotor)}</Sel>
                        <Sel label="Sampel + rusak" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(b.biaya_sampel + b.kerugian_rusak)}</Sel>
                        <Sel label="Biaya ops." className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(b.biaya_operasional)}</Sel>
                        <Sel label="Laba bersih" className={`font-mono font-bold lg:text-right lg:whitespace-nowrap ${h.labaBersih < 0 ? 'text-danger' : ''}`}>{rupiah(h.labaBersih)}</Sel>
                        <Sel label="Belanja stok" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(b.belanja_stok)}</Sel>
                      </Baris>
                    )
                  })}
                </Tabel>
              ) : (
                <Tabel heads={['Bulan', 'Omzet', 'Transaksi']} kanan={[1, 2]}>
                  {penjualan.bulanan.length === 0 && <Kosong>Belum ada data pada rentang ini.</Kosong>}
                  {penjualan.bulanan.map((b) => (
                    <Baris key={b.bulan}>
                      <Sel label="Bulan">{labelBulan(b.bulan)}</Sel>
                      <Sel label="Omzet" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(b.omzet)}</Sel>
                      <Sel label="Transaksi" className="font-mono lg:text-right">{b.transaksi}</Sel>
                    </Baris>
                  ))}
                </Tabel>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-surface border border-divider">
              <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Per saluran</h3>
              <table className="w-full text-left"><tbody>
                {penjualan.saluran.length === 0 && <tr><td className={`${td} text-secondary`}>Belum ada data.</td></tr>}
                {penjualan.saluran.map((s, i) => (
                  <tr key={i} className="border-b border-divider/50">
                    <td className={`${td} capitalize`}>{s.saluran ?? '-'}<p className="text-[12px] text-secondary normal-case">{s.transaksi} transaksi</p></td>
                    <td className={angka}>{rupiah(s.omzet)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>

            <div className="bg-surface border border-divider lg:col-span-2">
              <div className="p-4 border-b-2 border-primary flex justify-between gap-3 flex-wrap items-center">
                <h3 className="font-condensed uppercase text-[14px] tracking-wider">Per produk</h3>
                <Unduh tabel="produk" dari={dari} sampai={sampai} />
              </div>
              <div className="overflow-x-auto">
                <Tabel heads={keuangan ? ['Produk', 'Terjual', 'Omzet', 'Laba kotor'] : ['Produk', 'Terjual', 'Omzet']} kanan={[1, 2, 3]}>
                  {penjualan.produk.length === 0 && <Kosong>Belum ada data.</Kosong>}
                  {penjualan.produk.map((p) => {
                    const kp = keuangan?.produk.find((x) => x.nama === p.nama)
                    return (
                      <Baris key={p.nama}>
                        <Sel label="Produk">{p.nama}</Sel>
                        <Sel label="Terjual" className="font-mono lg:text-right lg:whitespace-nowrap">{p.qty_base.toLocaleString('id-ID')} {p.satuan_dasar}</Sel>
                        <Sel label="Omzet" className="font-mono lg:text-right lg:whitespace-nowrap">{rupiah(p.omzet)}</Sel>
                        {keuangan && <Sel label="Laba kotor" className="font-mono lg:text-right lg:whitespace-nowrap">{kp ? rupiah(kp.omzet - kp.hpp) : '-'}</Sel>}
                      </Baris>
                    )
                  })}
                </Tabel>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
