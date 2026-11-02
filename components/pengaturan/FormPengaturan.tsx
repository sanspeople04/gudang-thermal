'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { simpanPengaturanAction } from '@/app/actions/pengaturan'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'

type Nilai = {
  name: string; address: string; phone: string; email: string; bank_name: string; bank_account: string
  account_owner: string; signer_name: string; payment_terms_days: number; doc_footer_note: string
}

export default function FormPengaturan({ awal }: { awal: Nilai }) {
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setHasil(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => setHasil(await simpanPengaturanAction(fd)))
  }

  const err = (k: string) => <GalatField msgs={hasil?.errors?.[k]} />

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}

      <p className="font-condensed uppercase text-[12px] tracking-wider text-secondary">Identitas usaha (kepala invoice)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Nama usaha</label>
          <input name="name" className={inputCls} defaultValue={awal.name} disabled={pending} />{err('name')}
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Telepon / WhatsApp</label>
          <input name="phone" className={inputCls} defaultValue={awal.phone} placeholder="+62 812 3456 7890" disabled={pending} />{err('phone')}
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={labelCls}>Alamat</label>
          <textarea name="address" rows={2} className={inputCls} defaultValue={awal.address} disabled={pending} />{err('address')}
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={labelCls}>Email (opsional)</label>
          <input name="email" type="email" className={inputCls} defaultValue={awal.email} placeholder="usaha@gmail.com" disabled={pending} />{err('email')}
        </div>
      </div>

      <p className="font-condensed uppercase text-[12px] tracking-wider text-secondary border-t border-divider pt-4">Metode pembayaran (tampil di invoice dan faktur)</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Bank</label>
          <input name="bank_name" className={inputCls} defaultValue={awal.bank_name} placeholder="BCA" disabled={pending} />{err('bank_name')}
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Nomor rekening</label>
          <input name="bank_account" className={`${inputCls} font-mono`} defaultValue={awal.bank_account} disabled={pending} />{err('bank_account')}
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Atas nama</label>
          <input name="account_owner" className={inputCls} defaultValue={awal.account_owner} disabled={pending} />{err('account_owner')}
        </div>
      </div>

      <p className="font-condensed uppercase text-[12px] tracking-wider text-secondary border-t border-divider pt-4">Penandatangan dan catatan</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={labelCls}>Nama penandatangan (di atas tulisan &quot;Hormat Kami&quot;)</label>
          <input name="signer_name" className={inputCls} defaultValue={awal.signer_name} placeholder="mis. Arya Widhiyanto D.P" disabled={pending} />{err('signer_name')}
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Jatuh tempo invoice (hari)</label>
          <input name="payment_terms_days" type="number" inputMode="numeric" min={0} max={365} className={`${inputCls} font-mono text-right`} defaultValue={awal.payment_terms_days} disabled={pending} />
          <p className="text-[12px] text-secondary">Isi 0 untuk tidak menampilkan baris Due Date.</p>{err('payment_terms_days')}
        </div>
        <div className="flex flex-col gap-1 md:col-span-3">
          <label className={labelCls}>Catatan di kaki dokumen (opsional)</label>
          <input name="doc_footer_note" className={inputCls} maxLength={300} defaultValue={awal.doc_footer_note} placeholder="Kosong = *Konfirmasi pembayaran & pemesanan ke nomor yang tertera pada invoice" disabled={pending} />{err('doc_footer_note')}
        </div>
      </div>

      <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
        {pending && <Loader2 size={16} className="animate-spin" />} Simpan pengaturan
      </button>
    </form>
  )
}
