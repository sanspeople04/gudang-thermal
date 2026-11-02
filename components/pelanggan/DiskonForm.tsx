'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { simpanDiskonAction } from '@/app/actions/pelanggan'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, Pesan } from '@/components/ui'
import DiskonInputs, { susunDiskon, type DiskonRow } from '@/components/pelanggan/DiskonInputs'

export type { DiskonRow }

export default function DiskonForm({ customerId, rows }: { customerId: string; rows: DiskonRow[] }) {
  const [nilai, setNilai] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.unitId, r.amount ? String(r.amount) : '']))
  )
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)
    const { diskon, error } = susunDiskon(rows, nilai)
    if (error) { setHasil({ ok: false, message: error }); return }
    startTransition(async () => setHasil(await simpanDiskonAction({ customer_id: customerId, diskon })))
  }

  if (rows.length === 0) return <p className="text-[14px] text-secondary">Belum ada produk.</p>

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}
      <DiskonInputs rows={rows} nilai={nilai} onChange={(id, v) => setNilai((n) => ({ ...n, [id]: v }))} disabled={pending} />
      <p className="text-[12px] text-secondary">Kosongkan atau isi 0 untuk menghapus diskon. Diskon otomatis berlaku di form Stok Keluar dan Jadwal.</p>
      <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
        {pending && <Loader2 size={16} className="animate-spin" />} Simpan diskon
      </button>
    </form>
  )
}
