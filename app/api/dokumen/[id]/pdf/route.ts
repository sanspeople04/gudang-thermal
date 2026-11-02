import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user?.role) return new Response('Tidak berwenang', { status: 401 })

  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('documents').select('doc_number, file_path').eq('id', id).maybeSingle()
  if (!doc) return new Response('Dokumen tidak ditemukan', { status: 404 })
  if (!doc.file_path) return new Response('PDF belum tersedia. Klik "Buat ulang" di Arsip.', { status: 404 })

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('documents').download(doc.file_path)
  if (error || !data) return new Response('File PDF tidak ditemukan di penyimpanan', { status: 404 })

  const inline = new URL(req.url).searchParams.get('inline') === '1'
  const nama = String(doc.doc_number).replace(/\//g, '-') + '.pdf'
  return new Response(await data.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${nama}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
