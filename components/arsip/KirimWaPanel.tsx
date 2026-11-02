'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { kirimWhatsAppAction } from '@/app/actions/whatsapp'
import { rupiah } from '@/lib/format'
import { tampilWa } from '@/lib/phone'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, Pesan } from '@/components/ui'

export default function KirimWaPanel({
  id, tipe, nomor, total, pelangganNama, pelangganId, phone, usahaName, onTutup,
}: {
  id: string; tipe: 'invoice' | 'faktur'; nomor: string; total: number
  pelangganNama: string; pelangganId: string | null; phone: string | null; usahaName: string
  onTutup: () => void
}) {
  const [pesan, setPesan] = useState(
    `Halo ${pelangganNama},\n\nBerikut kami kirimkan ${tipe === 'invoice' ? 'invoice' : 'faktur'} nomor ${nomor} sebesar ${rupiah(total)}.\nSilakan cek lampiran PDF. Terima kasih.\n\n${usahaName}`
  )
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  if (!phone) {
    return (
      <div className="border border-divider bg-page p-3 max-w-sm text-[13px] flex flex-col gap-2">
        <p>Pelanggan ini belum punya nomor WhatsApp yang valid.</p>
        {pelangganId && <Link href={`/pelanggan/${pelangganId}`} className="underline font-condensed uppercase text-[12px]">Lengkapi di menu Pelanggan</Link>}
        <button className="self-start text-[12px] underline" onClick={onTutup}>Tutup</button>
      </div>
    )
  }

  return (
    <div className="border border-divider bg-page p-3 flex flex-col gap-2 w-full max-w-sm">
      <p className="text-[12px]">Tujuan: <span className="font-mono">{tampilWa(phone)}</span> ({pelangganNama})</p>
      <textarea className="w-full bg-surface border border-divider px-2 py-1.5 text-[13px]" rows={6} maxLength={1000}
        value={pesan} onChange={(e) => setPesan(e.target.value)} disabled={pending} />
      <p className="text-[11px] text-secondary">PDF {nomor} dilampirkan otomatis. Periksa nomor dan pesan sebelum mengirim.</p>
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}
      <div className="flex gap-2">
        <button className={`${btnPrimary} flex items-center gap-2 !py-2 !text-[12px]`} disabled={pending || hasil?.ok === true}
          onClick={() => { setHasil(null); startTransition(async () => setHasil(await kirimWhatsAppAction({ id, message: pesan }))) }}>
          {pending && <Loader2 size={14} className="animate-spin" />} Kirim sekarang
        </button>
        <button className="text-[12px] underline" onClick={onTutup} disabled={pending}>Tutup</button>
      </div>
    </div>
  )
}
