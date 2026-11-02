'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalisasiWa } from '@/lib/phone'
import type { AksiHasil } from '@/lib/types'

type DocRow = {
  doc_number: string; status: string; file_path: string | null
  customers: { name: string; contact: string | null } | null
}

/**
 * Mengirim PDF dokumen ke WhatsApp pelanggan lewat Fonnte (POST https://api.fonnte.com/send).
 * Token hanya dibaca di server (FONNTE_TOKEN). Nomor tujuan SELALU diambil dari database,
 * bukan dari kiriman browser.
 */
export async function kirimWhatsAppAction(input: unknown): Promise<AksiHasil> {
  const user = await assertRole(['owner', 'admin'])
  if (!user) return { ok: false, message: 'Sesi berakhir atau akun tidak punya akses.' }

  const p = z.object({ id: z.guid(), message: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(1000, 'Pesan maksimal 1000 karakter') }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Pesan wajib diisi (maksimal 1000 karakter).' }

  const token = process.env.FONNTE_TOKEN
  if (!token) return { ok: false, message: 'FONNTE_TOKEN belum diisi di .env.local. Isi lalu restart server.' }

  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('doc_number, status, file_path, customers(name, contact)')
    .eq('id', p.data.id)
    .maybeSingle()
  const doc = data as unknown as DocRow | null
  if (!doc) return { ok: false, message: 'Dokumen tidak ditemukan.' }
  if (doc.status === 'dibatalkan') return { ok: false, message: 'Dokumen yang dibatalkan tidak boleh dikirim.' }
  if (!doc.file_path) return { ok: false, message: 'PDF belum tersedia. Klik "Buat ulang" dulu.' }

  const target = normalisasiWa(doc.customers?.contact)
  if (!target) return { ok: false, message: 'Pelanggan belum punya nomor WhatsApp yang valid. Lengkapi di menu Pelanggan.' }

  const admin = createAdminClient()
  const { data: blob, error: dlErr } = await admin.storage.from('documents').download(doc.file_path)
  if (dlErr || !blob) return { ok: false, message: 'File PDF tidak ditemukan di penyimpanan. Klik "Buat ulang".' }

  const filename = doc.doc_number.replace(/\//g, '-') + '.pdf'
  const form = new FormData()
  form.append('target', target)
  form.append('message', p.data.message)
  form.append('file', new Blob([await blob.arrayBuffer()], { type: 'application/pdf' }), filename)

  let sukses = false
  let respons = ''
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: form,
      signal: AbortSignal.timeout(30_000),
    })
    respons = (await res.text()).slice(0, 500)
    try {
      const json = JSON.parse(respons) as { status?: boolean; reason?: string; detail?: string }
      sukses = res.ok && json.status === true
      if (!sukses) respons = json.reason ?? json.detail ?? respons
    } catch {
      sukses = false
    }
  } catch (e) {
    respons = e instanceof Error ? e.message : 'Tidak bisa menghubungi Fonnte.'
  }

  // catat riwayat (gagal mencatat tidak membatalkan hasil pengiriman)
  await supabase.from('wa_logs').insert({
    document_id: p.data.id, target, message: p.data.message, success: sukses, response: respons || null, created_by: user.id,
  })

  if (!sukses) return { ok: false, message: 'Gagal mengirim WhatsApp: ' + (respons || 'tidak ada respons dari Fonnte.') }

  if (doc.status === 'draft') {
    await supabase.rpc('set_document_status', { p_id: p.data.id, p_status: 'terkirim', p_reason: null })
  }

  revalidatePath('/arsip')
  return { ok: true, message: `Terkirim ke +${target}.` }
}
