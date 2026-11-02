'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { tambahPelangganAction, ubahPelangganAction } from '@/app/actions/pelanggan'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'
import DiskonInputs, { susunDiskon, type DiskonRow } from '@/components/pelanggan/DiskonInputs'

export default function FormPelanggan({
  mode,
  awal,
  diskonRows,
}: {
  mode: 'tambah' | 'ubah'
  awal?: { id: string; name: string; contact: string; address: string }
  /** Hanya untuk mode tambah dan hanya diisi untuk owner. undefined = pengguna bukan owner. */
  diskonRows?: DiskonRow[]
}) {
  const [name, setName] = useState(awal?.name ?? '')
  const [contact, setContact] = useState(awal?.contact ?? '')
  const [address, setAddress] = useState(awal?.address ?? '')
  const [diskon, setDiskon] = useState<Record<string, string>>({})
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)

    let daftarDiskon: { product_unit_id: string; amount: number }[] = []
    if (mode === 'tambah' && diskonRows?.length) {
      const s = susunDiskon(diskonRows, diskon)
      if (s.error) { setHasil({ ok: false, message: s.error }); return }
      daftarDiskon = s.diskon.filter((d) => d.amount > 0)
    }

    startTransition(async () => {
      const r = mode === 'tambah'
        ? await tambahPelangganAction({ name, contact: contact || undefined, address: address || undefined, diskon: daftarDiskon })
        : await ubahPelangganAction({ id: awal!.id, name, contact: contact || undefined, address: address || undefined })
      setHasil(r)
      if (r.ok && mode === 'tambah') { setName(''); setContact(''); setAddress(''); setDiskon({}) }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Nama pelanggan</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
          <GalatField msgs={hasil?.errors?.name} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Nomor WhatsApp</label>
          <input className={`${inputCls} font-mono`} inputMode="tel" placeholder="081234567890" value={contact} onChange={(e) => setContact(e.target.value)} disabled={pending} />
          <p className="text-[12px] text-secondary">Dipakai untuk mengirim invoice/faktur. Boleh dikosongkan.</p>
          <GalatField msgs={hasil?.errors?.contact} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Alamat</label>
        <textarea className={inputCls} rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} disabled={pending} />
        <GalatField msgs={hasil?.errors?.address} />
      </div>
      {mode === 'tambah' && (
        <div className="flex flex-col gap-2 border-t border-divider pt-4">
          <p className={labelCls}>Aturan diskon pelanggan ini (opsional)</p>
          {diskonRows === undefined ? (
            <p className="text-[13px] text-secondary">Diskon khusus per produk hanya bisa diatur oleh owner. Owner dapat menambahkannya lewat tombol Ubah pada pelanggan ini.</p>
          ) : diskonRows.length === 0 ? (
            <p className="text-[13px] text-secondary">Belum ada produk aktif, jadi belum ada diskon yang bisa diatur. Diskon bisa ditambahkan nanti lewat tombol Ubah.</p>
          ) : (
            <>
              <p className="text-[13px] text-secondary">Isi nominal potongan per satuan untuk produk yang punya harga khusus bagi pelanggan ini. Kosongkan jika tidak ada diskon.</p>
              <DiskonInputs rows={diskonRows} nilai={diskon} onChange={(id, v) => setDiskon((n) => ({ ...n, [id]: v }))} disabled={pending} />
            </>
          )}
        </div>
      )}
      <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
        {pending && <Loader2 size={16} className="animate-spin" />} {mode === 'tambah' ? 'Tambah pelanggan' : 'Simpan perubahan'}
      </button>
    </form>
  )
}
