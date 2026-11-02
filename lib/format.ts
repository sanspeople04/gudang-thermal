const TZ = 'Asia/Jakarta'

export const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

export function tanggalWaktu(iso: string) {
  return new Intl.DateTimeFormat('id-ID', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

/** 'YYYY-MM-DD' (kolom DATE) -> '27 Okt 2026' tanpa bergeser zona waktu */
export function tanggal(d: string) {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(d + 'T00:00:00Z'))
}

/** Tanggal hari ini di WIB, format YYYY-MM-DD */
export function hariIniJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

/** Kunci bulan 'YYYY-MM' (WIB) dari timestamp ISO */
export function bulanKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso)).slice(0, 7)
}

export const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Tambah n hari ke tanggal 'YYYY-MM-DD' */
export function tambahHari(d: string, n: number) {
  const dt = new Date(d + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

/** '2026-10' -> 'Okt 2026' */
export function labelBulan(key: string) {
  const [y, m] = key.split('-')
  return `${NAMA_BULAN[Number(m) - 1]} ${y}`
}

/** Hapus karakter yang bisa merusak filter PostgREST pada kata kunci pencarian */
export function bersihkanCari(q: string | undefined) {
  return (q ?? '').replace(/[^\p{L}\p{N}\s\/.\-]/gu, '').trim().slice(0, 60)
}
