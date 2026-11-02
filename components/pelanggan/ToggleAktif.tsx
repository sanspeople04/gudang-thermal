'use client'

import { useState, useTransition } from 'react'
import { ubahStatusPelangganAction } from '@/app/actions/pelanggan'

export default function ToggleAktif({ id, aktif }: { id: string; aktif: boolean }) {
  const [pending, startTransition] = useTransition()
  const [pesan, setPesan] = useState<string | null>(null)

  return (
    <div>
      <button
        disabled={pending}
        onClick={() => startTransition(async () => {
          const r = await ubahStatusPelangganAction({ id, aktif: !aktif })
          setPesan(r.ok ? null : r.message)
        })}
        className="border border-primary px-2 py-1 text-[11px] font-condensed uppercase tracking-wider hover:bg-primary hover:text-page disabled:opacity-60"
      >
        {aktif ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      {pesan && <p className="text-[11px] text-danger mt-1">{pesan}</p>}
    </div>
  )
}
