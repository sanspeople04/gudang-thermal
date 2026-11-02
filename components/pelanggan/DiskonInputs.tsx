'use client'

import { rupiah } from '@/lib/format'
import { inputCls } from '@/components/ui'

export type DiskonRow = { unitId: string; label: string; price: number; amount: number }

/** Daftar input diskon per satuan produk (nominal rupiah per satuan). Dipakai di form tambah dan ubah pelanggan. */
export default function DiskonInputs({
  rows, nilai, onChange, disabled,
}: {
  rows: DiskonRow[]
  nilai: Record<string, string>
  onChange: (unitId: string, v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="border border-divider">
      {rows.map((r) => (
        <div key={r.unitId} className="border-b border-divider/50 last:border-b-0 p-3 flex flex-wrap md:flex-nowrap items-center gap-2 text-[14px]">
          <div className="basis-full md:basis-auto md:flex-1 min-w-0">
            <p>{r.label}</p>
            <p className="text-[12px] text-secondary">Harga jual <span className="font-mono">{rupiah(r.price)}</span></p>
          </div>
          <div className="flex-1 md:flex-none md:w-52 min-w-0">
            <span className="md:hidden font-condensed uppercase text-[11px] tracking-wider text-secondary">Diskon per satuan (Rp)</span>
            <input
              aria-label={`Diskon ${r.label}`} type="number" inputMode="numeric" min={0} step={1} placeholder="0"
              className={`${inputCls} font-mono text-right`}
              value={nilai[r.unitId] ?? ''} disabled={disabled}
              onChange={(e) => onChange(r.unitId, e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Mengubah isian form menjadi daftar diskon; mengembalikan pesan kesalahan jika ada yang melebihi harga jual. */
export function susunDiskon(rows: DiskonRow[], nilai: Record<string, string>) {
  const diskon = rows.map((r) => ({ product_unit_id: r.unitId, amount: (nilai[r.unitId] ?? '') === '' ? 0 : Number(nilai[r.unitId]) }))
  const bermasalah = rows.find((r, i) => !Number.isInteger(diskon[i].amount) || diskon[i].amount < 0 || diskon[i].amount > r.price)
  return {
    diskon,
    error: bermasalah
      ? `Diskon "${bermasalah.label}" harus angka bulat antara 0 dan harga jualnya (${rupiah(bermasalah.price)}).`
      : null,
  }
}
