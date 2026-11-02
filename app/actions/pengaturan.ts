'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AksiHasil } from '@/lib/types'

const MAKS_GAMBAR = 800 * 1024 // 800 KB (batas bawaan Next untuk satu server action adalah 1 MB)

const emailOpsional = z
  .string()
  .trim()
  .max(120, 'Email maksimal 120 karakter')
  .refine((v) => v === '' || z.email().safeParse(v).success, 'Format email tidak valid')

const schema = z.object({
  name: z.string().trim().min(2, 'Nama usaha wajib diisi').max(100),
  address: z.string().trim().min(5, 'Alamat wajib diisi').max(300),
  phone: z.string().trim().min(5, 'Telepon wajib diisi').max(30),
  email: emailOpsional.optional(),
  bank_name: z.string().trim().min(2, 'Nama bank wajib diisi').max(40),
  bank_account: z.string().trim().min(3, 'Nomor rekening wajib diisi').max(40),
  account_owner: z.string().trim().min(2, 'Nama pemilik rekening wajib diisi').max(100),
  signer_name: z.string().trim().max(100, 'Nama penandatangan maksimal 100 karakter').optional(),
  payment_terms_days: z.coerce.number().int('Harus bilangan bulat').min(0, 'Minimal 0').max(365, 'Maksimal 365'),
  doc_footer_note: z.string().trim().max(300, 'Catatan maksimal 300 karakter').optional(),
})

/** Menyimpan data teks pengaturan usaha. Gambar (logo dan cap) diunggah lewat unggahGambarAction. */
export async function simpanPengaturanAction(formData: FormData): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh mengubah pengaturan.' }

  const p = schema.safeParse(Object.fromEntries(formData))
  if (!p.success) return { ok: false, message: 'Periksa kembali isian form.', errors: z.flattenError(p.error).fieldErrors }

  const patch = {
    ...p.data,
    email: p.data.email || null,
    signer_name: p.data.signer_name || null,
    doc_footer_note: p.data.doc_footer_note || null,
  }

  const supabase = await createClient()
  const { error } = await supabase.from('business_settings').update(patch).eq('id', 1)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/pengaturan')
  return { ok: true, message: 'Pengaturan disimpan. Berlaku untuk dokumen yang dibuat setelah ini.' }
}

/** Unggah logo atau cap + tanda tangan (PNG/JPG, maksimal 800 KB). Disimpan di bucket privat business-assets. */
export async function unggahGambarAction(formData: FormData): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh mengubah pengaturan.' }

  const jenis = formData.get('jenis')
  if (jenis !== 'logo' && jenis !== 'cap') return { ok: false, message: 'Jenis gambar tidak dikenal.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Pilih file gambar terlebih dahulu.' }
  if (!['image/png', 'image/jpeg'].includes(file.type)) return { ok: false, message: 'Gambar harus berformat PNG atau JPG.' }
  if (file.size > MAKS_GAMBAR) return { ok: false, message: 'Ukuran gambar maksimal 800 KB.' }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const folder = jenis === 'logo' ? 'logo' : 'cap'
  const lokasi = `${folder}/${folder}.${ext}`

  const admin = createAdminClient()
  // hapus versi dengan ekstensi lain agar tidak menumpuk
  await admin.storage.from('business-assets').remove([`${folder}/${folder}.${ext === 'png' ? 'jpg' : 'png'}`])
  const { error: upErr } = await admin.storage
    .from('business-assets')
    .upload(lokasi, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true })
  if (upErr) return { ok: false, message: 'Gagal mengunggah gambar: ' + upErr.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('business_settings')
    .update(jenis === 'logo' ? { logo_path: lokasi } : { stamp_path: lokasi })
    .eq('id', 1)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/pengaturan')
  return { ok: true, message: jenis === 'logo' ? 'Logo diperbarui.' : 'Cap dan tanda tangan diperbarui.' }
}

/** Menghapus logo atau cap dari pengaturan (dokumen berikutnya dibuat tanpa gambar itu). */
export async function hapusGambarAction(input: unknown): Promise<AksiHasil> {
  if (!(await assertRole(['owner']))) return { ok: false, message: 'Hanya owner yang boleh mengubah pengaturan.' }
  const p = z.object({ jenis: z.enum(['logo', 'cap']) }).safeParse(input)
  if (!p.success) return { ok: false, message: 'Jenis gambar tidak dikenal.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('business_settings')
    .update(p.data.jenis === 'logo' ? { logo_path: null } : { stamp_path: null })
    .eq('id', 1)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/pengaturan')
  return { ok: true, message: p.data.jenis === 'logo' ? 'Logo dihapus.' : 'Cap dihapus.' }
}
