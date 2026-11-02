'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { buatPenggunaAction } from '@/app/actions/pengguna'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'

export default function FormPengguna() {
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'owner'>('admin')
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)
    startTransition(async () => {
      const r = await buatPenggunaAction({ full_name: nama, email, password, role })
      setHasil(r)
      if (r.ok) { setNama(''); setEmail(''); setPassword(''); setRole('admin') }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Nama lengkap</label>
          <input className={inputCls} value={nama} onChange={(e) => setNama(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.full_name} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Role</label>
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'owner')} disabled={pending}>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Email</label>
          <input type="email" autoComplete="off" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.email} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Password awal</label>
          <input type="password" autoComplete="new-password" className={`${inputCls} font-mono`} value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.password} />
        </div>
      </div>
      <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
        {pending && <Loader2 size={16} className="animate-spin" />} Buat akun
      </button>
    </form>
  )
}
