'use client'

import { useRef, useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { hapusGambarAction, unggahGambarAction } from '@/app/actions/pengaturan'
import type { AksiHasil } from '@/lib/types'
import { Pesan, labelCls } from '@/components/ui'

/** Unggah satu gambar (logo atau cap). Setiap gambar dikirim lewat permintaannya sendiri. */
export default function UnggahGambar({
  jenis, judul, petunjuk, ada,
}: { jenis: 'logo' | 'cap'; judul: string; petunjuk: string; ada: boolean }) {
  const [punya, setPunya] = useState(ada)
  const [versi, setVersi] = useState(0)
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const unggah = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setHasil(null)
    const fd = new FormData(e.currentTarget)
    fd.set('jenis', jenis)
    startTransition(async () => {
      const r = await unggahGambarAction(fd)
      setHasil(r)
      if (r.ok) { setPunya(true); setVersi((v) => v + 1); if (fileRef.current) fileRef.current.value = '' }
    })
  }

  const hapus = () => {
    setHasil(null)
    startTransition(async () => {
      const r = await hapusGambarAction({ jenis })
      setHasil(r)
      if (r.ok) setPunya(false)
    })
  }

  return (
    <div className="flex flex-col gap-2 border border-divider bg-page p-3">
      <p className={labelCls}>{judul}</p>
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}
      <div className="flex items-start gap-3 flex-wrap">
        {punya ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/logo?jenis=${jenis}&v=${versi}`} alt={judul} className="h-24 w-24 object-contain border border-divider bg-white" />
        ) : (
          <div className="h-24 w-24 border border-dashed border-divider flex items-center justify-center text-[11px] text-secondary text-center p-1">Belum ada</div>
        )}
        <form onSubmit={unggah} className="flex flex-col gap-2 flex-1 min-w-[220px]">
          <input
            ref={fileRef} name="file" type="file" accept="image/png,image/jpeg" disabled={pending}
            className="block w-full text-[13px] file:mr-3 file:min-h-11 file:border file:border-primary file:bg-surface file:px-4 file:font-condensed file:uppercase file:tracking-wider file:text-[12px] hover:file:bg-primary hover:file:text-page"
          />
          <p className="text-[12px] text-secondary">{petunjuk}</p>
          <div className="flex gap-2 flex-wrap">
            <button type="submit" disabled={pending} className="bg-primary text-page px-4 py-2 font-condensed uppercase text-[12px] tracking-wider flex items-center gap-2 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />} Unggah
            </button>
            {punya && (
              <button type="button" onClick={hapus} disabled={pending} aria-label={`Hapus ${judul}`}
                className="border border-danger text-danger px-3 py-2 font-condensed uppercase text-[12px] tracking-wider flex items-center gap-1 disabled:opacity-60">
                <Trash2 size={14} /> Hapus
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
