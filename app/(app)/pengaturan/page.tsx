import { Settings } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import FormPengaturan from '@/components/pengaturan/FormPengaturan'
import UnggahGambar from '@/components/pengaturan/UnggahGambar'

export default async function PengaturanPage() {
  await requireRole(['owner'])
  const supabase = await createClient()
  const { data: u } = await supabase.from('business_settings').select('*').eq('id', 1).maybeSingle()

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="border-b border-divider pb-4">
        <h2 className="font-condensed uppercase text-2xl tracking-wider flex items-center gap-2"><Settings size={24} /> Pengaturan Usaha</h2>
        <p className="text-[13px] text-secondary mt-1">Data ini tercetak di setiap invoice dan faktur. Perubahan berlaku untuk dokumen yang dibuat atau dibuat ulang setelahnya.</p>
      </div>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <FormPengaturan
          awal={{
            name: u?.name ?? '', address: u?.address ?? '', phone: u?.phone ?? '', email: u?.email ?? '',
            bank_name: u?.bank_name ?? '', bank_account: u?.bank_account ?? '', account_owner: u?.account_owner ?? '',
            signer_name: u?.signer_name ?? '', payment_terms_days: u?.payment_terms_days ?? 7, doc_footer_note: u?.doc_footer_note ?? '',
          }}
        />
      </section>

      <section className="bg-surface border border-divider p-4 md:p-6 flex flex-col gap-4">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2">Gambar untuk dokumen</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UnggahGambar jenis="logo" judul="Logo usaha" ada={Boolean(u?.logo_path)}
            petunjuk="PNG atau JPG, maksimal 800 KB. Disarankan berbentuk persegi dengan latar putih atau transparan." />
          <UnggahGambar jenis="cap" judul="Cap dan tanda tangan" ada={Boolean(u?.stamp_path)}
            petunjuk="PNG dengan latar transparan paling bagus (cap menumpuk di atas tanda tangan). Maksimal 800 KB." />
        </div>
      </section>
    </div>
  )
}
