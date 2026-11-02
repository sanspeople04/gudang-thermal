'use client'

import { useState, useTransition } from 'react'
import { batalkanTransaksiAction } from '@/app/actions/transaksi'

export default function BatalTransaksi({ id }: { id: string }) {
  const [buka, setBuka] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [pesan, setPesan] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const btn = 'border px-2 py-1 text-[11px] font-condensed uppercase tracking-wider disabled:opacity-60'

  return (
    <div className="flex flex-col gap-1 items-start">
      <button className={`${btn} border-danger text-danger hover:bg-danger hover:text-page`} onClick={() => setBuka((v) => !v)}>Batalkan</button>
      {buka && (
        <div className="flex gap-1 items-center">
          <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan (wajib)" maxLength={200}
            className="border border-divider bg-page px-2 py-1 text-[12px] w-40" />
          <button className={`${btn} border-primary hover:bg-primary hover:text-page`} disabled={pending || alasan.trim().length < 3}
            onClick={() => startTransition(async () => {
              const r = await batalkanTransaksiAction({ id, reason: alasan })
              if (!r.ok) setPesan(r.message); else setBuka(false)
            })}>
            Ya
          </button>
        </div>
      )}
      {pesan && <p className="text-[11px] text-danger max-w-[220px]">{pesan}</p>}
    </div>
  )
}
