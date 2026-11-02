import { getCurrentUser } from '@/lib/auth'
import { ambilLaporan, ambilRincian, hitungLaba, tanggalValid, type BarisRincian } from '@/lib/laporan'
import { hariIniJakarta, labelBulan, tanggal } from '@/lib/format'
import { buatCsv, buatXlsx, type Kolom, type Lembar, type Sel } from '@/lib/xlsx'

const BATAS_BARIS = 20_000 // pengaman: unduhan rincian dibatasi 20.000 transaksi terbaru
const PER_HALAMAN = 1000

const waktuWib = (iso: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const jenisSaluran = (s: string | null) => (s === 'online' ? 'Online' : s === 'offline' ? 'Offline' : '-')

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user?.role) return new Response('Tidak berwenang', { status: 401 })
  const isOwner = user.role === 'owner'

  const u = new URL(req.url)
  const dari = tanggalValid(u.searchParams.get('dari') ?? undefined)
  const sampai = tanggalValid(u.searchParams.get('sampai') ?? undefined)
  const tabelParam = u.searchParams.get('tabel')
  const tabel = tabelParam === 'bulanan' || tabelParam === 'produk' ? tabelParam : 'rincian'
  const format = u.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'

  const periode = dari || sampai
    ? `${dari ? tanggal(dari) : 'awal'} s/d ${sampai ? tanggal(sampai) : tanggal(hariIniJakarta())}`
    : `Sejak awal s/d ${tanggal(hariIniJakarta())}`
  const dibuat = `Dibuat: ${waktuWib(new Date().toISOString())} WIB`

  let lembar: Lembar

  if (tabel === 'rincian') {
    const semua: BarisRincian[] = []
    let jumlah = 0
    let totalHpp: number | null = null
    let totalOmzet = 0
    for (let offset = 0; offset < BATAS_BARIS; offset += PER_HALAMAN) {
      const { rincian, error } = await ambilRincian(dari, sampai, offset, PER_HALAMAN)
      if (error || !rincian) return new Response(error ?? 'Gagal mengambil data', { status: 500 })
      jumlah = rincian.jumlah
      totalOmzet = rincian.total_omzet
      totalHpp = rincian.total_hpp
      semua.push(...rincian.baris)
      if (semua.length >= jumlah || rincian.baris.length < PER_HALAMAN) break
    }

    const kolom: Kolom[] = [
      { judul: 'Waktu (WIB)', tipe: 'waktu' },
      { judul: 'Pelanggan', tipe: 'teks', lebar: 30 },
      { judul: 'Saluran', tipe: 'teks', lebar: 12 },
      { judul: 'Catatan saluran', tipe: 'teks', lebar: 20 },
      { judul: 'Barang', tipe: 'teks', lebar: 48 },
      { judul: 'Diskon (Rp)', tipe: 'rupiah' },
      { judul: 'Omzet (Rp)', tipe: 'rupiah' },
      ...(isOwner ? ([{ judul: 'HPP (Rp)', tipe: 'rupiah' }, { judul: 'Laba kotor (Rp)', tipe: 'rupiah' }] as Kolom[]) : []),
    ]
    const baris: Sel[][] = semua.map((b) => [
      b.waktu, b.pelanggan ?? '-', jenisSaluran(b.saluran), b.catatan ?? '', b.barang ?? '', b.diskon, b.omzet,
      ...(isOwner ? [b.hpp ?? 0, b.omzet - (b.hpp ?? 0)] : []),
    ])
    const total: Sel[] = [
      `TOTAL (${jumlah.toLocaleString('id-ID')} transaksi)`, '', '', '', '',
      semua.reduce((a, b) => a + b.diskon, 0), totalOmzet,
      ...(isOwner ? [totalHpp ?? 0, totalOmzet - (totalHpp ?? 0)] : []),
    ]
    const judul = ['Laporan Rincian Penjualan', `Periode: ${periode}`, dibuat]
    if (jumlah > semua.length) judul.push(`Catatan: hanya ${semua.length.toLocaleString('id-ID')} transaksi terbaru yang disertakan dari ${jumlah.toLocaleString('id-ID')}. Persempit rentang tanggal untuk data lengkap.`)
    lembar = { nama: 'Rincian Penjualan', judul, kolom, baris, total }
  } else {
    const { penjualan, keuangan, error } = await ambilLaporan(dari, sampai, isOwner)
    if (error || !penjualan) return new Response(error ?? 'Gagal mengambil laporan', { status: 500 })

    if (tabel === 'bulanan') {
      if (isOwner && keuangan) {
        lembar = {
          nama: 'Per Bulan',
          judul: ['Laporan Per Bulan', `Periode: ${periode}`, dibuat],
          kolom: [
            { judul: 'Bulan', tipe: 'teks', lebar: 14 }, { judul: 'Omzet (Rp)', tipe: 'rupiah' }, { judul: 'HPP (Rp)', tipe: 'rupiah' },
            { judul: 'Laba kotor (Rp)', tipe: 'rupiah' }, { judul: 'Biaya sampel (Rp)', tipe: 'rupiah' }, { judul: 'Kerugian rusak (Rp)', tipe: 'rupiah' },
            { judul: 'Biaya operasional (Rp)', tipe: 'rupiah' }, { judul: 'Laba bersih (Rp)', tipe: 'rupiah' }, { judul: 'Belanja stok (Rp)', tipe: 'rupiah' },
          ],
          baris: keuangan.bulanan.map((b) => {
            const h = hitungLaba(b)
            return [labelBulan(b.bulan), b.omzet, b.hpp, h.labaKotor, b.biaya_sampel, b.kerugian_rusak, b.biaya_operasional, h.labaBersih, b.belanja_stok]
          }),
        }
      } else {
        lembar = {
          nama: 'Per Bulan',
          judul: ['Laporan Per Bulan', `Periode: ${periode}`, dibuat],
          kolom: [{ judul: 'Bulan', tipe: 'teks', lebar: 14 }, { judul: 'Omzet (Rp)', tipe: 'rupiah' }, { judul: 'Jumlah transaksi', tipe: 'angka' }],
          baris: penjualan.bulanan.map((b) => [labelBulan(b.bulan), b.omzet, b.transaksi]),
        }
      }
    } else if (isOwner && keuangan) {
      lembar = {
        nama: 'Per Produk',
        judul: ['Laporan Per Produk', `Periode: ${periode}`, dibuat],
        kolom: [
          { judul: 'Produk', tipe: 'teks', lebar: 34 }, { judul: 'Terjual (satuan dasar)', tipe: 'angka', lebar: 20 }, { judul: 'Omzet (Rp)', tipe: 'rupiah' },
          { judul: 'HPP (Rp)', tipe: 'rupiah' }, { judul: 'Laba kotor (Rp)', tipe: 'rupiah' },
        ],
        baris: penjualan.produk.map((p) => {
          const k = keuangan.produk.find((x) => x.nama === p.nama)
          return [p.nama, p.qty_base, p.omzet, k?.hpp ?? 0, p.omzet - (k?.hpp ?? 0)]
        }),
      }
    } else {
      lembar = {
        nama: 'Per Produk',
        judul: ['Laporan Per Produk', `Periode: ${periode}`, dibuat],
        kolom: [{ judul: 'Produk', tipe: 'teks', lebar: 34 }, { judul: 'Terjual (satuan dasar)', tipe: 'angka', lebar: 20 }, { judul: 'Satuan dasar', tipe: 'teks', lebar: 14 }, { judul: 'Omzet (Rp)', tipe: 'rupiah' }],
        baris: penjualan.produk.map((p) => [p.nama, p.qty_base, p.satuan_dasar, p.omzet]),
      }
    }
  }

  const nama = `laporan-${tabel}_${dari ?? 'awal'}_sd_${sampai ?? hariIniJakarta()}.${format}`
  if (format === 'csv') {
    return new Response(buatCsv(lembar, waktuWib), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nama}"`, 'Cache-Control': 'private, no-store' },
    })
  }
  const berkas = buatXlsx(lembar)
  return new Response(new Uint8Array(berkas), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nama}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
