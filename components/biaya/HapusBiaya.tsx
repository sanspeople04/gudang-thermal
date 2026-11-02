'use client'

import { useState, useTransition } from 'react'
import { hapusBiayaAction } from '@/app/actions/biaya'

export default function HapusBiaya({ id }: { id: string }) {
  const [yakin, setYakin] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const btn = 'border border-danger text-danger px-2 py-1 text-[11px] font-condensed uppercase tracking-wider hover:bg-danger hover:text-page disabled:opacity-60'

  return (
    <div>
      {!yakin ? (
        <button className={btn} onClick={() => setYakin(true)}>Hapus</button>
      ) : (
        <div className="flex gap-1">
          <button className={btn} disabled={pending}
            onClick={() => startTransition(async () => { const r = await hapusBiayaAction({ id }); if (!r.ok) setPesan(r.message) })}>
            Ya, hapus
          </button>
          <button className="border border-primary px-2 py-1 text-[11px] font-condensed uppercase" onClick={() => setYakin(false)}>Tidak</button>
        </div>
      )}
      {pesan && <p className="text-[11px] text-danger mt-1">{pesan}</p>}
    </div>
  )
}
