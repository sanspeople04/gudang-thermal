import { Users } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { tanggalWaktu } from '@/lib/format'
import FormPengguna from '@/components/pengguna/FormPengguna'
import RoleSelect from '@/components/pengguna/RoleSelect'
import { Tabel, Baris, Sel } from '@/components/tabel'

type ProfileRow = { id: string; role: 'owner' | 'admin'; full_name: string }

export default async function PenggunaPage() {
  const me = await requireRole(['owner']) // admin yang mencoba membuka halaman ini dialihkan ke /dashboard

  // Email ada di auth.users, tidak terjangkau lewat tabel profiles, jadi dibaca dengan service role.
  const admin = createAdminClient()
  const [{ data: profiles }, { data: authData }] = await Promise.all([
    admin.from('profiles').select('id, role, full_name').order('created_at'),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ])

  const users = authData?.users ?? []
  const profileMap = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]))
  const rows = users
    .map((u) => ({ u, p: profileMap.get(u.id) }))
    .sort((a, b) => (a.u.created_at ?? '').localeCompare(b.u.created_at ?? ''))

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2"><Users size={24} /> Kelola Akun</h2>
        <p className="text-[13px] text-secondary mt-1">Hanya owner. Admin tidak melihat halaman ini.</p>
      </div>

      <section className="bg-surface border border-divider">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary p-4">Daftar akun</h3>
        <div className="overflow-x-auto">
          <Tabel heads={['Nama', 'Email', 'Role', 'Login terakhir']}>
              {rows.map(({ u, p }) => (
                <Baris key={u.id}>
                  <Sel label="Nama">{p?.full_name ?? <span className="text-danger">belum ada profil</span>}{u.id === me.id && <span className="text-secondary"> (Anda)</span>}</Sel>
                  <Sel label="Email" className="font-mono text-[13px]">{u.email}</Sel>
                  <Sel label="Role">{p ? <RoleSelect id={u.id} role={p.role} disabled={u.id === me.id} /> : '-'}</Sel>
                  <Sel label="Login terakhir" className="lg:whitespace-nowrap">{u.last_sign_in_at ? tanggalWaktu(u.last_sign_in_at) : 'belum pernah'}</Sel>
                </Baris>
              ))}
            </Tabel>
        </div>
      </section>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Tambah akun baru</h3>
        <FormPengguna />
      </section>
    </div>
  )
}
