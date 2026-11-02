import { getCurrentUser } from '@/lib/auth'
import { ambilLaporan, hitungLaba, tanggalValid } from '@/lib/laporan'
import { labelBulan } from '@/lib/format'

const esc = (v: string | number) => {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const baris = (cols: (string | number)[]) => cols.map(esc).join(',')

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user?.role) return new Response('Tidak berwenang', { status: 401 })

  const u = new URL(req.url)
  const dari = tanggalValid(u.searchParams.get('dari') ?? undefined)
  const sampai = tanggalValid(u.searchParams.get('sampai') ?? undefined)
  const tabel = u.searchParams.get('tabel') === 'produk' ? 'produk' : 'bulanan'
  const isOwner = user.role === 'owner'

  const { penjualan, keuangan, error } = await ambilLaporan(dari, sampai, isOwner)
  if (error || !penjualan) return new Response(error ?? 'Gagal mengambil laporan', { status: 500 })

  const lines: string[] = []
  if (tabel === 'bulanan') {
    if (isOwner && keuangan) {
      lines.push(baris(['Bulan', 'Omzet', 'HPP', 'Laba kotor', 'Biaya sampel', 'Kerugian rusak', 'Biaya operasional', 'Laba bersih', 'Belanja stok']))
      for (const b of keuangan.bulanan) {
        const h = hitungLaba(b)
        lines.push(baris([labelBulan(b.bulan), b.omzet, b.hpp, h.labaKotor, b.biaya_sampel, b.kerugian_rusak, b.biaya_operasional, h.labaBersih, b.belanja_stok]))
      }
    } else {
      lines.push(baris(['Bulan', 'Omzet', 'Jumlah transaksi']))
      for (const b of penjualan.bulanan) lines.push(baris([labelBulan(b.bulan), b.omzet, b.transaksi]))
    }
  } else if (isOwner && keuangan) {
    lines.push(baris(['Produk', 'Omzet', 'HPP', 'Laba kotor']))
    for (const p of keuangan.produk) lines.push(baris([p.nama, p.omzet, p.hpp, p.omzet - p.hpp]))
  } else {
    lines.push(baris(['Produk', 'Jumlah terjual (satuan dasar)', 'Satuan dasar', 'Omzet']))
    for (const p of penjualan.produk) lines.push(baris([p.nama, p.qty_base, p.satuan_dasar, p.omzet]))
  }

  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="laporan-${tabel}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
