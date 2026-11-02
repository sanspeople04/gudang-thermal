import Link from 'next/link'
import { Search } from 'lucide-react'

export default function FilterBar({
  tab, q, dari, sampai, placeholder,
}: { tab: string; q: string; dari: string; sampai: string; placeholder: string }) {
  const cls = 'w-full min-w-0 bg-page border border-divider px-3 py-2 text-[14px] focus:outline-none focus:border-primary'
  const lbl = 'font-condensed uppercase text-[11px] tracking-wider'
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tab" value={tab} />
      <div className="flex flex-col gap-1 basis-full md:basis-auto md:flex-1 md:min-w-[220px]">
        <label className={lbl} htmlFor="f-q">Cari</label>
        <input id="f-q" name="q" defaultValue={q} placeholder={placeholder} className={cls} />
      </div>
      <div className="flex flex-col gap-1 flex-1 md:flex-none md:w-44">
        <label className={lbl} htmlFor="f-dari">Dari</label>
        <input id="f-dari" type="date" name="dari" defaultValue={dari} className={cls} />
      </div>
      <div className="flex flex-col gap-1 flex-1 md:flex-none md:w-44">
        <label className={lbl} htmlFor="f-sampai">Sampai</label>
        <input id="f-sampai" type="date" name="sampai" defaultValue={sampai} className={cls} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="bg-primary text-page px-4 py-2 font-condensed uppercase text-[13px] tracking-wider flex items-center gap-1">
          <Search size={14} /> Terapkan
        </button>
        <Link href={`/arsip?tab=${tab}`} className="border border-primary px-4 py-2 font-condensed uppercase text-[13px] tracking-wider">Reset</Link>
      </div>
    </form>
  )
}
