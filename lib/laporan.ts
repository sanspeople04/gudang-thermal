import { createClient } from '@/lib/supabase/server'

export type Penjualan = {
  ringkas: { omzet: number; transaksi: number; diskon: number }
  bulanan: { bulan: string; omzet: number; transaksi: number }[]
  saluran: { saluran: 'online' | 'offline' | null; omzet: number; transaksi: number }[]
  produk: { nama: string; satuan_dasar: string; qty_base: number; omzet: number }[]
}

export type KeuanganMentah = {
  total: {
    omzet: number; hpp: number; biaya_sampel: number
    kerugian_rusak: number; biaya_operasional: number; belanja_stok: number
  }
  bulanan: {
    bulan: string; omzet: number; hpp: number; biaya_sampel: number
    kerugian_rusak: number; biaya_operasional: number; belanja_stok: number
  }[]
  biaya_kategori: { kategori: string; jumlah: number }[]
  produk: { nama: string; omzet: number; hpp: number }[]
}

/** Rumus laba (Opsi B) dan arus kas, dihitung dari angka mentah database. */
export function hitungLaba(t: {
  omzet: number; hpp: number; biaya_sampel: number
  kerugian_rusak: number; biaya_operasional: number; belanja_stok: number
}) {
  const labaKotor = t.omzet - t.hpp
  const labaBersih = labaKotor - t.biaya_sampel - t.kerugian_rusak - t.biaya_operasional
  const uangKeluar = t.belanja_stok + t.biaya_operasional
  return { labaKotor, labaBersih, uangKeluar, kasBersih: t.omzet - uangKeluar }
}

export type BarisRincian = {
  waktu: string
  pelanggan: string | null
  saluran: 'online' | 'offline' | null
  catatan: string | null
  barang: string | null
  diskon: number
  omzet: number
  hpp: number | null // null untuk admin
}
export type Rincian = { jumlah: number; total_omzet: number; total_hpp: number | null; baris: BarisRincian[] }

const TGL = /^\d{4}-\d{2}-\d{2}$/
export const tanggalValid = (s: string | undefined) => (s && TGL.test(s) ? s : null)

export async function ambilLaporan(dari: string | null, sampai: string | null, isOwner: boolean) {
  const supabase = await createClient()
  const args = { p_from: dari, p_to: sampai }
  const [pj, kn] = await Promise.all([
    supabase.rpc('laporan_penjualan', args),
    isOwner ? supabase.rpc('laporan_keuangan', args) : Promise.resolve(null),
  ])
  return {
    penjualan: (pj.data as Penjualan | null) ?? null,
    keuangan: (kn?.data as KeuanganMentah | null) ?? null,
    error: pj.error?.message ?? kn?.error?.message ?? null,
  }
}

/** Satu halaman rincian transaksi penjualan pada rentang tanggal (WIB), terbaru dulu. */
export async function ambilRincian(dari: string | null, sampai: string | null, offset = 0, limit = 50) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('laporan_rincian', { p_from: dari, p_to: sampai, p_offset: offset, p_limit: limit })
  return { rincian: (data as Rincian | null) ?? null, error: error?.message ?? null }
}
