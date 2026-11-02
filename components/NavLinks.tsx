'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, PackagePlus, ShoppingCart, Archive, Users, Contact, Package, ChartColumn, Wallet, Settings } from 'lucide-react'

const ICONS = {
  dashboard: LayoutDashboard,
  jadwal: Calendar,
  masuk: PackagePlus,
  keluar: ShoppingCart,
  arsip: Archive,
  pengguna: Users,
  pelanggan: Contact,
  produk: Package,
  laporan: ChartColumn,
  biaya: Wallet,
  pengaturan: Settings,
} as const

export type NavIcon = keyof typeof ICONS
export type NavItem = { href: string; label: string; icon: NavIcon }

/** Daftar menu vertikal. Dipakai di sidebar (layar besar) dan di drawer (HP dan tablet). */
export default function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col py-2 lg:py-4" aria-label="Menu utama">
      {items.map((item) => {
        const Icon = ICONS[item.icon]
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`w-full px-6 py-3.5 lg:py-3 flex items-center gap-3 font-condensed uppercase text-[14px] lg:text-[13px] tracking-wider ${
              active ? 'bg-accent text-primary' : 'hover:bg-secondary/20'
            }`}
          >
            <Icon size={18} strokeWidth={1.75} /> {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
