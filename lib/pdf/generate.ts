import 'server-only'
import fs from 'fs'
import path from 'path'
import type { ReactElement } from 'react'
import { renderToBuffer, Font, type DocumentProps } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { tambahHari } from '@/lib/format'
import DokumenPDF, { FILE_FONT, type DokumenPdfData, type Gambar, type PilihanFont } from '@/components/pdf/DokumenPDF'

type Hasil = { ok: true } | { ok: false; message: string }

type DocRow = {
  id: string; type: 'invoice' | 'faktur'; doc_number: string; date: string; total: number
  status: string; sale_id: string | null
  customers: { name: string; address: string | null; contact: string | null } | null
}
type ItemRow = {
  qty: number; unit_price: number; discount_unit: number; subtotal: number
  product_units: { unit_name: string; products: { name: string; type: string } | null } | null
}

const LABEL_JENIS: Record<string, string> = { thermal: 'Thermal Paper', stiker: 'Stiker', sampel: 'Sampel' }

let fontPdf: PilihanFont | null = null
/** Mendaftarkan font Poppins dari assets/fonts (sekali). Jika file tidak lengkap, memakai Helvetica bawaan PDF. */
function siapkanFont(): PilihanFont {
  if (fontPdf) return fontPdf
  Font.registerHyphenationCallback((kata) => [kata]) // jangan potong kata di akhir baris
  try {
    const dir = path.join(process.cwd(), 'assets', 'fonts')
    if (FILE_FONT.every((f) => fs.existsSync(path.join(dir, f.file)))) {
      for (const f of FILE_FONT) Font.register({ family: f.family, src: path.join(dir, f.file) })
      fontPdf = 'poppins'
    } else {
      fontPdf = 'helvetica'
    }
  } catch {
    fontPdf = 'helvetica'
  }
  return fontPdf
}

async function muatGambar(admin: ReturnType<typeof createAdminClient>, lokasi: string | null | undefined): Promise<Gambar | null> {
  if (!lokasi) return null
  const { data: blob } = await admin.storage.from('business-assets').download(lokasi)
  if (!blob) return null
  return { data: Buffer.from(await blob.arrayBuffer()), format: String(lokasi).toLowerCase().endsWith('.png') ? 'png' : 'jpg' }
}

/**
 * Membuat PDF invoice/faktur sesuai template perusahaan, menyimpannya di Storage (bucket 'documents'),
 * dan mengisi documents.file_path. Memakai service role: PEMANGGIL WAJIB sudah memverifikasi login dan role.
 */
export async function buatPdfDokumen(documentId: string): Promise<Hasil> {
  const admin = createAdminClient()
  let statusAwal: string | null = null

  try {
    const { data: docRaw, error: dErr } = await admin
      .from('documents')
      .select('id, type, doc_number, date, total, status, sale_id, customers(name, address, contact)')
      .eq('id', documentId)
      .maybeSingle()
    if (dErr || !docRaw) return { ok: false, message: 'Dokumen tidak ditemukan.' }
    const doc = docRaw as unknown as DocRow
    statusAwal = doc.status
    if (!doc.sale_id) return { ok: false, message: 'Dokumen tidak terhubung ke transaksi.' }
    if (!doc.customers) return { ok: false, message: 'Pelanggan dokumen tidak ditemukan.' }

    const { data: usaha } = await admin.from('business_settings').select('*').eq('id', 1).maybeSingle()
    if (!usaha) return { ok: false, message: 'Pengaturan usaha belum diisi.' }

    const { data: itemsRaw, error: iErr } = await admin
      .from('sale_items')
      .select('qty, unit_price, discount_unit, subtotal, product_units(unit_name, products(name, type))')
      .eq('sale_id', doc.sale_id)
    if (iErr || !itemsRaw?.length) return { ok: false, message: 'Barang transaksi tidak ditemukan.' }
    const items = itemsRaw as unknown as ItemRow[]

    // logo dan cap bersifat opsional: gagal membacanya tidak membatalkan PDF
    const [logo, stamp] = await Promise.all([muatGambar(admin, usaha.logo_path), muatGambar(admin, usaha.stamp_path)])

    // jenis produk di dokumen, mis. "Thermal Paper" atau "Thermal Paper, Stiker"
    const jenis = [...new Set(items.map((i) => LABEL_JENIS[i.product_units?.products?.type ?? ''] ?? '').filter(Boolean))]

    const tempo = usaha.payment_terms_days ?? 7
    const data: DokumenPdfData = {
      tipe: doc.type,
      nomor: doc.doc_number,
      tanggal: doc.date,
      jatuhTempo: doc.type === 'invoice' && tempo > 0 ? tambahHari(doc.date, tempo) : null,
      usaha: {
        name: usaha.name, address: usaha.address, phone: usaha.phone, email: usaha.email ?? null,
        bank_name: usaha.bank_name, bank_account: usaha.bank_account, account_owner: usaha.account_owner,
        footer_note: usaha.doc_footer_note ?? null, signer_name: usaha.signer_name ?? null,
      },
      logo,
      stamp,
      produkLabel: jenis.length ? jenis.join(', ') : 'Thermal Paper',
      pelanggan: doc.customers,
      items: items.map((i) => ({
        nama: i.product_units?.products?.name ?? '-',
        satuan: i.product_units?.unit_name ?? '',
        qty: i.qty, harga: i.unit_price, diskon: i.discount_unit, subtotal: i.subtotal,
      })),
      subtotalKotor: items.reduce((a, i) => a + i.unit_price * i.qty, 0),
      totalDiskon: items.reduce((a, i) => a + i.discount_unit * i.qty, 0),
      total: doc.total,
      font: siapkanFont(),
    }

    const buffer = await renderToBuffer(DokumenPDF({ data }) as ReactElement<DocumentProps>)

    const lokasi = `${doc.date.slice(0, 4)}/${doc.doc_number.replace(/\//g, '-')}.pdf`
    const { error: upErr } = await admin.storage
      .from('documents')
      .upload(lokasi, buffer, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw new Error('Gagal menyimpan file: ' + upErr.message)

    const patch: { file_path: string; status?: string } = { file_path: lokasi }
    if (doc.status === 'gagal_dibuat') patch.status = 'draft'
    const { error: uErr } = await admin.from('documents').update(patch).eq('id', doc.id)
    if (uErr) throw new Error(uErr.message)

    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gagal membuat PDF.'
    if (statusAwal === 'draft') {
      await admin.from('documents').update({ status: 'gagal_dibuat' }).eq('id', documentId)
    }
    return { ok: false, message }
  }
}
