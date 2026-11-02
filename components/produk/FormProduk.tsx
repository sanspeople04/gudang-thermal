'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { buatProdukAction } from '@/app/actions/produk'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'

type Satuan = { key: number; unit_name: string; multiplier: string; sell_price: string }
const num = (s: string) => (s === '' ? undefined : Number(s))

export default function FormProduk() {
  const [name, setName] = useState('')
  const [type, setType] = useState<'thermal' | 'stiker' | 'sampel'>('thermal')
  const [baseUnit, setBaseUnit] = useState('roll')
  const [buyPrice, setBuyPrice] = useState('')
  const [minStock, setMinStock] = useState('0')
  const [initialStock, setInitialStock] = useState('0')
  const [units, setUnits] = useState<Satuan[]>([{ key: 1, unit_name: 'roll', multiplier: '1', sell_price: '' }])
  const [nextKey, setNextKey] = useState(2)
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const ubahSatuan = (key: number, patch: Partial<Satuan>) =>
    setUnits((us) => us.map((u) => (u.key === key ? { ...u, ...patch } : u)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)
    startTransition(async () => {
      const r = await buatProdukAction({
        name, type, base_unit: baseUnit,
        buy_price: num(buyPrice), min_stock: num(minStock), initial_stock: num(initialStock),
        units: units.map((u) => ({ unit_name: u.unit_name, multiplier: num(u.multiplier), sell_price: num(u.sell_price) })),
      })
      setHasil(r)
      if (r.ok) {
        setName(''); setBuyPrice(''); setMinStock('0'); setInitialStock('0')
        setUnits([{ key: nextKey, unit_name: baseUnit, multiplier: '1', sell_price: '' }]); setNextKey((k) => k + 1)
      }
    })
  }

  const angka = `${inputCls} font-mono text-right`

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={labelCls}>Nama produk</label>
          <input className={inputCls} placeholder="mis. Thermal 80x80" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.name} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Jenis</label>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as typeof type)} disabled={pending}>
            <option value="thermal">Thermal</option>
            <option value="stiker">Stiker</option>
            <option value="sampel">Sampel</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Satuan dasar</label>
          <input className={inputCls} value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.base_unit} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Harga beli per {baseUnit || 'satuan dasar'} (Rp)</label>
          <input type="number" inputMode="numeric" min={0} className={angka} value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.buy_price} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Stok awal ({baseUnit || 'satuan dasar'})</label>
          <input type="number" inputMode="numeric" min={0} className={angka} value={initialStock} onChange={(e) => setInitialStock(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.initial_stock} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Stok minimum (peringatan)</label>
          <input type="number" inputMode="numeric" min={0} className={angka} value={minStock} onChange={(e) => setMinStock(e.target.value)} disabled={pending} />
          <p className="text-[12px] text-secondary">0 = tanpa peringatan.</p>
        </div>
      </div>

      <div className="border border-divider">
        <div className="hidden md:flex gap-2 bg-page border-b border-divider px-3 py-2">
          <span className={`${labelCls} flex-1`}>Satuan jual</span>
          <span className={`${labelCls} w-32`}>Isi ({baseUnit || 'dasar'})</span>
          <span className={`${labelCls} w-48`}>Harga jual (Rp)</span>
          <span className="w-11" />
        </div>
        {units.map((u) => (
          <div key={u.key} className="border-b border-divider/50 p-3 flex flex-wrap md:flex-nowrap items-end md:items-start gap-2">
            <div className="basis-full md:basis-auto md:flex-1 min-w-0">
              <span className="md:hidden font-condensed uppercase text-[11px] tracking-wider text-secondary">Satuan jual</span>
              <input aria-label="Satuan jual" className={inputCls} placeholder="mis. dus" value={u.unit_name} onChange={(e) => ubahSatuan(u.key, { unit_name: e.target.value })} disabled={pending} />
            </div>
            <div className="flex-1 md:flex-none md:w-32 min-w-0">
              <span className="md:hidden font-condensed uppercase text-[11px] tracking-wider text-secondary">Isi ({baseUnit || 'dasar'})</span>
              <input aria-label="Isi per satuan" type="number" inputMode="numeric" min={1} className={angka} value={u.multiplier} onChange={(e) => ubahSatuan(u.key, { multiplier: e.target.value })} disabled={pending} />
            </div>
            <div className="flex-1 md:flex-none md:w-48 min-w-0">
              <span className="md:hidden font-condensed uppercase text-[11px] tracking-wider text-secondary">Harga jual (Rp)</span>
              <input aria-label="Harga jual" type="number" inputMode="numeric" min={0} className={angka} value={u.sell_price} onChange={(e) => ubahSatuan(u.key, { sell_price: e.target.value })} disabled={pending} />
            </div>
            {units.length > 1 ? (
              <button type="button" aria-label="Hapus satuan" className="w-11 h-11 flex items-center justify-center text-secondary hover:text-danger" onClick={() => setUnits((us) => us.filter((x) => x.key !== u.key))} disabled={pending}>
                <Trash2 size={16} />
              </button>
            ) : (
              <span className="hidden md:block w-11" />
            )}
          </div>
        ))}
        <GalatField msgs={hasil?.errors?.units} />
        <div className="p-2">
          <button type="button" className="flex items-center gap-1 text-[12px] font-condensed uppercase tracking-wider border border-primary px-3 py-1.5 hover:bg-primary hover:text-page"
            onClick={() => { setUnits((us) => [...us, { key: nextKey, unit_name: '', multiplier: '', sell_price: '' }]); setNextKey((k) => k + 1) }} disabled={pending}>
            <Plus size={14} /> Tambah satuan
          </button>
        </div>
      </div>
      <p className="text-[12px] text-secondary">Contoh thermal: satuan dasar roll, satuan jual &quot;roll&quot; isi 1 dan &quot;dus&quot; isi 100. Isi per satuan tidak bisa diubah setelah disimpan.</p>

      <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
        {pending && <Loader2 size={16} className="animate-spin" />} Tambah produk
      </button>
    </form>
  )
}
