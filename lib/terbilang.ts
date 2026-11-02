const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']

function kata(n: number): string {
  if (n < 12) return SATUAN[n]
  if (n < 20) return kata(n - 10) + ' belas'
  if (n < 100) return kata(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + kata(n % 10) : '')
  if (n < 200) return 'seratus' + (n > 100 ? ' ' + kata(n - 100) : '')
  if (n < 1000) return kata(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + kata(n % 100) : '')
  if (n < 2000) return 'seribu' + (n > 1000 ? ' ' + kata(n - 1000) : '')
  if (n < 1e6) return kata(Math.floor(n / 1e3)) + ' ribu' + (n % 1e3 ? ' ' + kata(n % 1e3) : '')
  if (n < 1e9) return kata(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + kata(n % 1e6) : '')
  if (n < 1e12) return kata(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + kata(n % 1e9) : '')
  return kata(Math.floor(n / 1e12)) + ' triliun' + (n % 1e12 ? ' ' + kata(n % 1e12) : '')
}

/** 330000 -> "Tiga ratus tiga puluh ribu rupiah" */
export function terbilangRupiah(n: number): string {
  const v = Math.max(0, Math.floor(n))
  if (v === 0) return 'Nol rupiah'
  const s = kata(v) + ' rupiah'
  return s.charAt(0).toUpperCase() + s.slice(1)
}
