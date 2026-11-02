'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { catatStokAction } from '@/app/actions/stok'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'

export type UnitOption = { id: string; label: string; baseUnit: string }
export type ReasonOption = { value: 'supplier' | 'retur' | 'rusak'; label: string }

export default function StokForm({
  units,
  reasons,
  submitLabel,
  noteLabel = 'Catatan (opsional)',
}: {
  units: UnitOption[]
  reasons: ReasonOption[]
  submitLabel: string
  noteLabel?: string
}) {
  const [unitId, setUnitId] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<ReasonOption['value']>(reasons[0].value)
  const [unitCost, setUnitCost] = useState('')
  const [note, setNote] = useState('')
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const unit = units.find((u) => u.id === unitId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)
    startTransition(async () => {
      const r = await catatStokAction({
        product_unit_id: unitId,
        qty: qty === '' ? undefined : Number(qty),
        reason,
        note: note || undefined,
        unit_cost: reason === 'supplier' && unitCost !== '' ? Number(unitCost) : undefined,
      })
      setHasil(r)
      if (r.ok) {
        setQty('')
        setNote('')
        setUnitCost('')
      }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}

      <div className="flex flex-col gap-1">
        <label className={labelCls}>Produk dan satuan</label>
        <select className={inputCls} value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={pending}>
          <option value="">Pilih produk…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
        <GalatField msgs={hasil?.errors?.product_unit_id} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Jumlah</label>
          <input
            type="number" inputMode="numeric" min={1} step={1}
            className={`${inputCls} font-mono text-right`}
            value={qty} onChange={(e) => setQty(e.target.value)} disabled={pending}
          />
          <GalatField msgs={hasil?.errors?.qty} />
        </div>
        {reasons.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Jenis</label>
            <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as ReasonOption['value'])} disabled={pending}>
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {reason === 'supplier' && (
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Harga beli per {unit?.baseUnit ?? 'satuan dasar'} (Rp)</label>
          <input
            type="number" inputMode="numeric" min={1} step={1} placeholder="mis. 2500"
            className={`${inputCls} font-mono text-right`}
            value={unitCost} onChange={(e) => setUnitCost(e.target.value)} disabled={pending}
          />
          <p className="text-[12px] text-secondary">Harga per {unit?.baseUnit ?? 'satuan dasar'}, bukan per dus. Dipakai untuk menghitung modal dan laba.</p>
          <GalatField msgs={hasil?.errors?.unit_cost} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={labelCls}>{noteLabel}</label>
        <input type="text" maxLength={200} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending} />
        <GalatField msgs={hasil?.errors?.note} />
      </div>

      <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2`}>
        {pending && <Loader2 size={16} className="animate-spin" />} {submitLabel}
      </button>
    </form>
  )
}
