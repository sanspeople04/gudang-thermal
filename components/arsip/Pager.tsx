import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pager({
  page, total, size, params,
}: { page: number; total: number; size: number; params: Record<string, string> }) {
  const totalHalaman = Math.max(1, Math.ceil(total / size))
  const href = (p: number) => {
    const sp = new URLSearchParams({ ...params, page: String(p) })
    return `/arsip?${sp.toString()}`
  }
  const cls = 'border border-primary px-3 py-1.5 font-condensed uppercase text-[12px] tracking-wider flex items-center gap-1'
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-[13px] text-secondary">{total.toLocaleString('id-ID')} data · halaman {page} dari {totalHalaman}</p>
      <div className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={cls}><ChevronLeft size={14} /> Sebelumnya</Link> : <span className={`${cls} opacity-40`}><ChevronLeft size={14} /> Sebelumnya</span>}
        {page < totalHalaman ? <Link href={href(page + 1)} className={cls}>Berikutnya <ChevronRight size={14} /></Link> : <span className={`${cls} opacity-40`}>Berikutnya <ChevronRight size={14} /></span>}
      </div>
    </div>
  )
}
