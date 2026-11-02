'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { tambahBiayaAction } from '@/app/actions/biaya'
import { KATEGORI_BIAYA } from '@/lib/biaya'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'

export default function FormBiaya({ hariIni }: { hariIni: string }) {
  const [tanggal, setTanggal] = useState(hariIni)
  const [kategori, setKategori] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)
    startTransition(async () => {
      const r = await tambahBiayaAction({
        tanggal, kategori: kategori || undefined, keterangan: keterangan || undefined,
        jumlah: jumlah === '' ? undefined : Number(jumlah),
      })
      setHasil(r)
      if (r.ok) { setJumlah(''); setKeterangan('') }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Tanggal</label>
          <input type="date" max={hariIni} className={inputCls} value={tanggal} onChange={(e) => setTanggal(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.tanggal} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Kategori</label>
          <select className={inputCls} value={kategori} onChange={(e) => setKategori(e.target.value)} disabled={pending}>
            <option value="">Pilih kategori…</option>
            {KATEGORI_BIAYA.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <GalatField msgs={hasil?.errors?.kategori} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Jumlah (Rp)</label>
          <input type="number" inputMode="numeric" min={1} className={`${inputCls} font-mono text-right`} value={jumlah} onChange={(e) => setJumlah(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.jumlah} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Keterangan (opsional)</label>
        <input className={inputCls} maxLength={200} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} disabled={pending} />
        <GalatField msgs={hasil?.errors?.keterangan} />
      </div>
      <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
        {pending && <Loader2 size={16} className="animate-spin" />} Catat biaya
      </button>
    </form>
  )
}
