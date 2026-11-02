'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { batalJadwalAction, prosesJadwalAction } from '@/app/actions/jadwal'
import { btnPrimary, inputCls, labelCls } from '@/components/ui'

export default function AksiJadwal({ id }: { id: string }) {
  const [buka, setBuka] = useState(false)
  const [konfirmBatal, setKonfirmBatal] = useState(false)
  const [saluran, setSaluran] = useState<'online' | 'offline'>('offline')
  const [catatan, setCatatan] = useState('')
  const [pesan, setPesan] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const proses = () => {
    setPesan(null)
    startTransition(async () => {
      // sukses = server redirect ke Arsip; kode di bawah hanya jalan jika gagal
      const r = await prosesJadwalAction({ id, saluran, catatan: catatan || undefined })
      if (r && !r.ok) setPesan(r.message)
    })
  }

  const batal = () => {
    setPesan(null)
    startTransition(async () => {
      const r = await batalJadwalAction({ id })
      if (!r.ok) setPesan(r.message)
    })
  }

  const btn = 'border border-primary px-3 py-1.5 text-[11px] font-condensed uppercase tracking-wider hover:bg-primary hover:text-page disabled:opacity-60'

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex gap-2 flex-wrap">
        <button className={btn} onClick={() => { setBuka((v) => !v); setKonfirmBatal(false) }} disabled={pending}>Proses</button>
        {!konfirmBatal ? (
          <button className={`${btn} border-danger text-danger hover:bg-danger`} onClick={() => { setKonfirmBatal(true); setBuka(false) }} disabled={pending}>Batalkan</button>
        ) : (
          <>
            <button className={`${btn} border-danger text-danger hover:bg-danger`} onClick={batal} disabled={pending}>Ya, batalkan</button>
            <button className={btn} onClick={() => setKonfirmBatal(false)} disabled={pending}>Tidak</button>
          </>
        )}
      </div>

      {buka && (
        <div className="border border-divider bg-page p-3 flex flex-col gap-3 w-full max-w-md">
          <p className="text-[12px] text-secondary">Memproses akan membuat penjualan, mengurangi stok, dan membuat invoice serta faktur otomatis.</p>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Saluran</label>
            <select className={inputCls} value={saluran} onChange={(e) => setSaluran(e.target.value as 'online' | 'offline')} disabled={pending}>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </select>
          </div>
          <input className={inputCls} placeholder="Catatan saluran (opsional)" value={catatan} onChange={(e) => setCatatan(e.target.value)} disabled={pending} maxLength={200} />
          <button className={`${btnPrimary} flex items-center justify-center gap-2`} onClick={proses} disabled={pending}>
            {pending && <Loader2 size={16} className="animate-spin" />} Proses dan kurangi stok
          </button>
        </div>
      )}
      {pesan && <p className="text-[12px] text-danger max-w-md">{pesan}</p>}
    </div>
  )
}
