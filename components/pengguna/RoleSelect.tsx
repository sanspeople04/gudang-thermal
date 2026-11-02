'use client'

import { useState, useTransition } from 'react'
import { ubahRoleAction } from '@/app/actions/pengguna'

export default function RoleSelect({ id, role, disabled }: { id: string; role: 'owner' | 'admin'; disabled?: boolean }) {
  const [nilai, setNilai] = useState(role)
  const [pesan, setPesan] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const ubah = (baru: 'owner' | 'admin') => {
    const lama = nilai
    setNilai(baru)
    setPesan(null)
    startTransition(async () => {
      const r = await ubahRoleAction({ id, role: baru })
      if (!r.ok) { setNilai(lama); setPesan(r.message) }
    })
  }

  return (
    <div>
      <select value={nilai} onChange={(e) => ubah(e.target.value as 'owner' | 'admin')} disabled={disabled || pending}
        className="border border-divider bg-page px-2 py-1 text-[13px] disabled:opacity-60">
        <option value="admin">admin</option>
        <option value="owner">owner</option>
      </select>
      {pesan && <p className="text-[11px] text-danger mt-1">{pesan}</p>}
    </div>
  )
}
