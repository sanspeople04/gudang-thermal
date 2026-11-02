'use client'

import { useState, useTransition } from 'react'
import { Download, Eye, MessageCircle, RefreshCw } from 'lucide-react'
import { buatUlangPdfAction, ubahStatusDokumenAction } from '@/app/actions/dokumen'
import KirimWaPanel from '@/components/arsip/KirimWaPanel'

type Status = 'draft' | 'terkirim' | 'lunas' | 'dibatalkan' | 'gagal_dibuat'

export type DokumenAksiProps = {
  id: string
  status: Status
  isOwner: boolean
  hasFile: boolean
  tipe: 'invoice' | 'faktur'
  nomor: string
  total: number
  pelangganNama: string
  pelangganId: string | null
  phone: string | null
  usahaName: string
}

const btn = 'inline-flex items-center gap-1 border border-primary px-2 py-1 text-[11px] font-condensed uppercase tracking-wider hover:bg-primary hover:text-page disabled:opacity-60'

export default function DokumenAksi(p: DokumenAksiProps) {
  const [pending, startTransition] = useTransition()
  const [pesan, setPesan] = useState<string | null>(null)
  const [batal, setBatal] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [waBuka, setWaBuka] = useState(false)

  const dibatalkan = p.status === 'dibatalkan'
  const final = p.status === 'lunas' || dibatalkan

  const ubahStatus = (s: 'terkirim' | 'lunas' | 'dibatalkan', reason?: string) => {
    setPesan(null)
    startTransition(async () => {
      const r = await ubahStatusDokumenAction({ id: p.id, status: s, reason })
      if (!r.ok) setPesan(r.message)
      else setBatal(false)
    })
  }

  const buatUlang = () => {
    setPesan(null)
    startTransition(async () => {
      const r = await buatUlangPdfAction({ id: p.id })
      if (!r.ok) setPesan(r.message)
    })
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
      <div className="flex flex-wrap gap-1">
        {p.hasFile && (
          <>
            <a className={btn} href={`/api/dokumen/${p.id}/pdf`}><Download size={12} /> Unduh</a>
            <a className={btn} href={`/api/dokumen/${p.id}/pdf?inline=1`} target="_blank" rel="noreferrer"><Eye size={12} /> Lihat</a>
          </>
        )}
        {!dibatalkan && (
          <button className={btn} disabled={pending} onClick={buatUlang}>
            <RefreshCw size={12} className={pending ? 'animate-spin' : ''} /> {p.hasFile ? 'Buat ulang' : 'Buat PDF'}
          </button>
        )}
        {p.hasFile && !dibatalkan && (
          <button className={btn} onClick={() => setWaBuka((v) => !v)}><MessageCircle size={12} /> Kirim WA</button>
        )}
      </div>

      {!final && (
        <div className="flex flex-wrap gap-1">
          {p.status === 'draft' && <button className={btn} disabled={pending} onClick={() => ubahStatus('terkirim')}>Tandai terkirim</button>}
          {p.isOwner && <button className={btn} disabled={pending} onClick={() => ubahStatus('lunas')}>Lunas</button>}
          {p.isOwner && (
            <button className={`${btn} !border-danger !text-danger hover:!bg-danger hover:!text-page`} disabled={pending} onClick={() => setBatal((v) => !v)}>Batalkan</button>
          )}
        </div>
      )}

      {batal && (
        <div className="flex gap-1 items-center">
          <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan pembatalan" maxLength={200}
            className="border border-divider bg-page px-2 py-1 text-[12px] w-40" />
          <button className={btn} disabled={pending || !alasan.trim()} onClick={() => ubahStatus('dibatalkan', alasan.trim())}>Ya</button>
        </div>
      )}

      {waBuka && (
        <KirimWaPanel id={p.id} tipe={p.tipe} nomor={p.nomor} total={p.total} pelangganNama={p.pelangganNama}
          pelangganId={p.pelangganId} phone={p.phone} usahaName={p.usahaName} onTutup={() => setWaBuka(false)} />
      )}
      {pesan && <p className="text-[11px] text-danger max-w-[240px]">{pesan}</p>}
    </div>
  )
}
