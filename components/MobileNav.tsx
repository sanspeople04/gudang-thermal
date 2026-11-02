'use client'

import { useEffect, useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import NavLinks, { type NavItem } from '@/components/NavLinks'

/**
 * Top bar + drawer menu untuk HP dan tablet (di bawah 1024px).
 * Mengembalikan fragment agar header menjadi anak langsung dari container layout dan bisa sticky.
 */
export default function MobileNav({ items, nama, role, defaultOpen = false }: { items: NavItem[]; nama: string; role: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!open) return
    const kunci = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const mq = window.matchMedia('(min-width: 1024px)')
    const onResize = () => { if (mq.matches) setOpen(false) } // layar membesar: sidebar tampil, tutup drawer
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onResize)
    return () => {
      document.body.style.overflow = kunci
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onResize)
    }
  }, [open])

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 bg-primary text-page pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between gap-3 px-4 h-14">
          <button
            type="button"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
            aria-controls="menu-mobile"
            onClick={() => setOpen((o) => !o)}
            className="-ml-2 w-11 h-11 flex items-center justify-center hover:bg-secondary/30"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="font-condensed uppercase tracking-[0.1em] text-[18px] text-accent">Gudang Thermal</span>
          <span className="text-[11px] font-mono uppercase text-page/70 w-11 text-right">{role}</span>
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30 pt-[calc(3.5rem+env(safe-area-inset-top))]">
          <div className="absolute inset-0 bg-primary/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="menu-mobile" className="relative bg-primary text-page max-h-full overflow-y-auto pb-[env(safe-area-inset-bottom)] shadow-lg">
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
            <div className="p-4 border-t border-secondary/30 flex flex-col gap-3">
              <p className="text-[12px] text-page/70 font-mono uppercase">{nama} · {role}</p>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full min-h-11 flex items-center justify-center gap-2 border border-page/40 px-3 py-2 font-condensed uppercase text-[13px] tracking-wider hover:bg-secondary/30"
                >
                  <LogOut size={16} /> Keluar
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
