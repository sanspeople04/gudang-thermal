export const KATEGORI_BIAYA = [
  { value: 'ongkir', label: 'Ongkos kirim' },
  { value: 'listrik_air', label: 'Listrik dan air' },
  { value: 'gaji', label: 'Gaji / upah' },
  { value: 'sewa', label: 'Sewa' },
  { value: 'perawatan', label: 'Perawatan / peralatan' },
  { value: 'pemasaran', label: 'Pemasaran' },
  { value: 'lainnya', label: 'Lainnya' },
] as const

export type KategoriBiaya = (typeof KATEGORI_BIAYA)[number]['value']
export const labelKategori = (v: string) => KATEGORI_BIAYA.find((k) => k.value === v)?.label ?? v
