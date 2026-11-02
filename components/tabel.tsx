import type { ReactNode } from 'react'

/**
 * Tabel responsif satu markup:
 *  - di bawah 768px   : tiap baris menjadi kartu (satu kolom), label kolom tampil di atas nilainya
 *  - 768px sampai 1023: kartu dua kolom
 *  - 1024px ke atas   : tabel biasa
 * Setiap <Sel> wajib punya prop `label` (dipakai sebagai label kartu).
 */
export function Tabel({ heads, kanan = [], children }: { heads: string[]; kanan?: number[]; children: ReactNode }) {
  return (
    <table className="w-full text-left block lg:table">
      <thead className="hidden lg:table-header-group">
        <tr className="border-b border-divider">
          {heads.map((h, i) => (
            <th key={i} className={`font-condensed uppercase text-[12px] p-3 whitespace-nowrap ${kanan.includes(i) ? 'text-right' : ''}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="block md:grid md:grid-cols-2 md:gap-3 lg:table-row-group p-3 lg:p-0">{children}</tbody>
    </table>
  )
}

export function Baris({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={`block lg:table-row border border-divider bg-page mb-3 md:mb-0 py-1 lg:py-0 lg:border-0 lg:border-b lg:border-divider/50 lg:bg-transparent ${className}`}
    >
      {children}
    </tr>
  )
}

export function Sel({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <td
      data-label={label}
      className={`block lg:table-cell px-3 py-1.5 lg:p-3 text-[14px] lg:align-top break-words before:content-[attr(data-label)] before:block lg:before:hidden before:font-condensed before:uppercase before:text-[11px] before:tracking-wider before:text-secondary before:mb-0.5 ${className}`}
    >
      {children}
    </td>
  )
}

export function Kosong({ children }: { children: ReactNode }) {
  return (
    <tr className="block lg:table-row md:col-span-2">
      <td colSpan={99} className="block lg:table-cell p-3 text-[14px] text-secondary">{children}</td>
    </tr>
  )
}
