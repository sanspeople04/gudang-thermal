import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getCurrentUser, type Role } from '@/lib/auth'
import { logoutAction } from '@/app/actions/auth'
import NavLinks, { type NavItem } from '@/components/NavLinks'
import MobileNav from '@/components/MobileNav'

const MENUS: (NavItem & { roles: Role[] })[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['owner', 'admin'] },
  { href: '/jadwal', label: 'Jadwal Kirim', icon: 'jadwal', roles: ['owner', 'admin'] },
  { href: '/stok-masuk', label: 'Stok Masuk', icon: 'masuk', roles: ['owner', 'admin'] },
  { href: '/transaksi', label: 'Stok Keluar', icon: 'keluar', roles: ['owner', 'admin'] },
  { href: '/pelanggan', label: 'Pelanggan', icon: 'pelanggan', roles: ['owner', 'admin'] },
  { href: '/produk', label: 'Produk', icon: 'produk', roles: ['owner'] },
  { href: '/arsip', label: 'Arsip', icon: 'arsip', roles: ['owner', 'admin'] },
  { href: '/laporan', label: 'Laporan', icon: 'laporan', roles: ['owner', 'admin'] },
  { href: '/biaya', label: 'Biaya', icon: 'biaya', roles: ['owner'] },
  { href: '/pengaturan', label: 'Pengaturan', icon: 'pengaturan', roles: ['owner'] },
  { href: '/pengguna', label: 'Kelola Akun', icon: 'pengguna', roles: ['owner'] },
]

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 border border-page/40 px-3 py-2 font-condensed uppercase text-[12px] tracking-wider hover:bg-secondary/30"
      >
        <LogOut size={14} /> Keluar
      </button>
    </form>
  )
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Akun ada di Supabase Auth tetapi belum punya baris di tabel profiles
  if (!user.role) {
    return (
      <div className="min-h-screen bg-page text-primary flex items-center justify-center p-4">
        <div className="bg-surface border border-divider border-l-[6px] border-l-accent p-6 max-w-md flex flex-col gap-4">
          <h1 className="font-condensed uppercase tracking-wider text-lg">Akun belum aktif</h1>
          <p className="text-[14px] text-secondary">
            Akun <span className="font-mono">{user.email}</span> belum memiliki role. Minta owner untuk mendaftarkannya,
            lalu login ulang.
          </p>
          <LogoutButton />
        </div>
      </div>
    )
  }

  const items = MENUS.filter((m) => m.roles.includes(user.role!)).map(({ href, label, icon }) => ({ href, label, icon }))

  const nama = user.fullName ?? user.email

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-page text-primary">
      <MobileNav items={items} nama={nama} role={user.role} />

      <aside className="hidden lg:flex bg-primary text-page w-64 shrink-0 flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-secondary/30">
          <h1 className="font-condensed uppercase tracking-[0.1em] text-[18px] text-accent">Gudang Thermal</h1>
          <p className="text-[12px] text-page/70 mt-1 font-mono uppercase break-words">{nama} · {user.role}</p>
        </div>
        <div className="flex-1 overflow-y-auto"><NavLinks items={items} /></div>
        <div className="p-4 border-t border-secondary/30"><LogoutButton /></div>
      </aside>

      <main className="flex-1 min-w-0 w-full max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  )
}
