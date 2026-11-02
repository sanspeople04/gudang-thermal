/** Normalisasi nomor WhatsApp Indonesia ke format 62xxxxxxxxxx. null jika tidak valid. */
export function normalisasiWa(input: string | null | undefined): string | null {
  if (!input) return null
  let n = input.replace(/\D/g, '')
  if (!n) return null
  if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (n.startsWith('8')) n = '62' + n
  if (!n.startsWith('62')) return null
  if (n.length < 10 || n.length > 15) return null
  return n
}

export const tampilWa = (n: string | null | undefined) => (n ? '+' + n : '-')
