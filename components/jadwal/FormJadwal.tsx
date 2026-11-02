'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { buatJadwalAction } from '@/app/actions/jadwal'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'

type Row = { key: number; unitId: string; qty: string }

export default function FormJadwal({
  customers, units, hariIni,
}: {
  customers: { id: string; name: string }[]
  units: { id: string; label: string }[]
  hariIni: string
}) {
  const [customerId, setCustomerId] = useState('')
  const [tanggal, setTanggal] = useState(hariIni)
  const [rows, setRows] = useState<Row[]>([{ key: 1, unitId: '', qty: '1' }])
  const [nextKey, setNextKey] = useState(2)
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)
    startTransition(async () => {
      const r = await buatJadwalAction({
        customer_id: customerId,
        delivery_date: tanggal,
        items: rows.filter((x) => x.unitId).map((x) => ({ product_unit_id: x.unitId, qty: x.qty === '' ? undefined : Number(x.qty) })),
      })
      setHasil(r)
      if (r.ok) { setCustomerId(''); setRows([{ key: nextKey, unitId: '', qty: '1' }]); setNextKey((k) => k + 1) }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Pelanggan</label>
          <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={pending}>
            <option value="">Pilih pelanggan…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <GalatField msgs={hasil?.errors?.customer_id} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Tanggal kirim</label>
          <input type="date" min={hariIni} className={inputCls} value={tanggal} onChange={(e) => setTanggal(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.delivery_date} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.key} className="flex gap-2 items-start">
            <select className={`${inputCls} flex-1`} value={r.unitId} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, unitId: e.target.value } : x)))} disabled={pending}>
              <option value="">Pilih produk…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
            <input type="number" inputMode="numeric" min={1} className={`${inputCls} w-24! font-mono text-right`} value={r.qty}
              onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))} disabled={pending} />
            {rows.length > 1 && (
              <button type="button" aria-label="Hapus baris" className="p-2 text-secondary hover:text-danger" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} disabled={pending}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
        <GalatField msgs={hasil?.errors?.items} />
        <button type="button" className="self-start flex items-center gap-1 text-[12px] font-condensed uppercase tracking-wider border border-primary px-3 py-1.5 hover:bg-primary hover:text-page"
          onClick={() => { setRows((rs) => [...rs, { key: nextKey, unitId: '', qty: '1' }]); setNextKey((k) => k + 1) }} disabled={pending}>
          <Plus size={14} /> Tambah produk
        </button>
      </div>

      <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
        {pending && <Loader2 size={16} className="animate-spin" />} Simpan jadwal
      </button>
    </form>
  )
}
