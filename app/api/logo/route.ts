import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/** Menampilkan logo (bawaan) atau cap (?jenis=cap) untuk pratinjau di halaman Pengaturan. */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user?.role) return new Response('Tidak berwenang', { status: 401 })

  const cap = new URL(req.url).searchParams.get('jenis') === 'cap'
  const admin = createAdminClient()
  const { data: usaha } = await admin.from('business_settings').select('logo_path, stamp_path').eq('id', 1).maybeSingle()
  const lokasi = cap ? usaha?.stamp_path : usaha?.logo_path
  if (!lokasi) return new Response('Belum ada gambar', { status: 404 })

  const { data, error } = await admin.storage.from('business-assets').download(lokasi)
  if (error || !data) return new Response('Gambar tidak ditemukan', { status: 404 })

  return new Response(await data.arrayBuffer(), {
    headers: {
      'Content-Type': String(lokasi).endsWith('.png') ? 'image/png' : 'image/jpeg',
      'Cache-Control': 'private, no-cache',
    },
  })
}
