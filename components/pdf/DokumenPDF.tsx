import { Document, Page, Text, View, Image, Svg, Defs, LinearGradient, Stop, Polygon, StyleSheet } from '@react-pdf/renderer'

export type Gambar = { data: Buffer; format: 'png' | 'jpg' }
export type PilihanFont = 'poppins' | 'helvetica'

export type DokumenPdfData = {
  tipe: 'invoice' | 'faktur'
  nomor: string
  tanggal: string // YYYY-MM-DD
  jatuhTempo: string | null // YYYY-MM-DD, hanya untuk invoice (null = tidak ditampilkan)
  usaha: {
    name: string
    address: string
    phone: string
    email: string | null
    bank_name: string
    bank_account: string
    account_owner: string
    footer_note: string | null
    signer_name: string | null
  }
  logo: Gambar | null
  stamp: Gambar | null // cap + tanda tangan
  produkLabel: string // mis. "Thermal Paper"
  pelanggan: { name: string; address: string | null; contact: string | null }
  items: { nama: string; satuan: string; qty: number; harga: number; diskon: number; subtotal: number }[]
  subtotalKotor: number
  totalDiskon: number
  total: number
  font?: PilihanFont // 'poppins' bila file font tersedia (assets/fonts), selain itu 'helvetica'
}

/** File font yang didaftarkan oleh generator (lihat lib/pdf/generate.ts). */
export const FILE_FONT = [
  { family: 'Poppins-Reg', file: 'Poppins-Regular.ttf' },
  { family: 'Poppins-Med', file: 'Poppins-Medium.ttf' },
  { family: 'Poppins-Bold', file: 'Poppins-Bold.ttf' },
  { family: 'Poppins-BoldItalic', file: 'Poppins-BoldItalic.ttf' },
] as const

const FONT = {
  poppins: { reg: 'Poppins-Reg', med: 'Poppins-Med', bold: 'Poppins-Bold', boldItalic: 'Poppins-BoldItalic', skala: 1 },
  // cadangan bila file Poppins tidak ada: Helvetica lebih sempit, jadi ukuran diperkecil agar tidak janggal
  helvetica: { reg: 'Helvetica', med: 'Helvetica-Bold', bold: 'Helvetica-Bold', boldItalic: 'Helvetica-BoldOblique', skala: 0.86 },
} as const

/* Warna diukur dari template invoice perusahaan */
const C = {
  biru: '#004AAD',
  barisA: '#D5F1FD',
  barisB: '#F1F5FF',
  teks: '#000000',
  garis: '#0D0823',
  labelDiskon: '#1B456D',
  abu: '#333333',
}
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** 1500 -> "Rp.1.500,-" (format di template) */
const rp = (n: number) => 'Rp.' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',-'

/** '2026-10-06' -> "Selasa, 6 Oktober 2026" */
const tglPanjang = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day))
  return `${HARI[dt.getUTCDay()]}, ${day} ${BULAN[m - 1]} ${y}`
}

const PAGE_W = 595.28
const PAD_TOP = 46 // ruang di bawah pita atas pada setiap halaman
const KOLOM = { no: 34, desc: 190, harga: 90, qty: 65.5, total: 109.5 }
const GAP = 5.8
const MIN_BARIS = 5

function buatStyle(pf: PilihanFont) {
  const F = FONT[pf]
  const z = (n: number) => Math.round(n * F.skala * 100) / 100
  return StyleSheet.create({
    page: { paddingTop: PAD_TOP, paddingBottom: 52, paddingHorizontal: 40.5, fontFamily: F.reg, fontSize: z(11), color: C.teks, backgroundColor: '#FFFFFF' },

    header: { position: 'relative', height: 157 },
    logo: { position: 'absolute', left: 14, top: -4, width: 122, height: 122, objectFit: 'contain' },
    usahaNama: { position: 'absolute', left: 0, top: 122, width: 275, fontFamily: F.bold, fontSize: z(13.4), textTransform: 'uppercase', lineHeight: 1.25 },
    judul: { position: 'absolute', left: 286, top: 6, fontFamily: F.bold, fontSize: z(40) },
    kepadaLabel: { position: 'absolute', left: 288, top: 73, fontFamily: F.med, fontSize: z(12), letterSpacing: 0.5 },
    kepadaNama: { position: 'absolute', left: 288, top: 91, width: 226, fontFamily: F.med, fontSize: z(10.7) },
    kepadaGaris: { position: 'absolute', left: 288, top: 110, width: 226, borderBottomWidth: 0.9, borderBottomColor: '#555555' },
    kepadaAlamat: { position: 'absolute', left: 288, top: 113, width: 226, fontSize: z(10.4), lineHeight: 1.4, color: C.abu },

    info: { flexDirection: 'row', borderWidth: 1.6, borderColor: C.garis, height: 28, marginBottom: 22.5 },
    infoSel: { justifyContent: 'center', paddingHorizontal: 10 },
    infoTeks: { fontFamily: F.bold },

    thead: { flexDirection: 'row', height: 29.8 },
    th: { backgroundColor: C.biru, justifyContent: 'center', alignItems: 'center' },
    thTeks: { color: '#FFFFFF', fontFamily: F.bold, fontSize: z(10.2) },
    baris: { flexDirection: 'row', minHeight: 29.8, marginTop: 5, alignItems: 'center' },
    teksSel: { fontFamily: F.med, fontSize: z(12.2) },

    totalWrap: { alignSelf: 'flex-end', width: 193, marginTop: 16.5 },
    totalKotak: { flexDirection: 'row', alignItems: 'center', height: 29, paddingLeft: 12 },
    totalLabel: { width: 86, fontFamily: F.bold, fontSize: z(10.4) },
    totalNilai: { fontFamily: F.bold, fontSize: z(11.4) },

    bawah: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 37 },
    bayarJudul: { fontFamily: F.boldItalic, fontSize: z(11.8), marginBottom: 4.5 },
    bayarBaris: { flexDirection: 'row', marginBottom: 1.6 },
    bayarLabel: { width: 60, fontFamily: F.med, fontSize: z(9) },
    bayarTitik: { width: 11, fontSize: z(9) },
    bayarNilai: { fontSize: z(9.2), width: 175 },
    catatan: { fontFamily: F.boldItalic, fontSize: z(10.1), lineHeight: 1.3, width: 216 },
    cap: { width: 127, height: 127, objectFit: 'contain', marginTop: 16, marginBottom: 3 },
    ttdNama: { fontFamily: F.bold, fontSize: z(10.6), textAlign: 'right' },
    ttdKet: { fontFamily: F.med, fontSize: z(6.6), textAlign: 'right', marginTop: 2 },
    penerimaWrap: { width: 120, alignItems: 'center' },
    penerimaGaris: { marginTop: 70, borderTopWidth: 0.8, borderTopColor: C.teks, width: 105 },

    nomorHalaman: { position: 'absolute', bottom: 14, right: 40.5, fontSize: z(8), color: C.abu },
  })
}

function Pita() {
  return (
    <>
      {/* pita atas: navy -> merah, bentuk mengikuti template */}
      <Svg fixed width={PAGE_W} height={45} viewBox={`0 0 ${PAGE_W} 45`} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="gAtas" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#2B2867" />
            <Stop offset="0.16" stopColor="#2D0D38" />
            <Stop offset="1" stopColor="#C0322F" />
          </LinearGradient>
        </Defs>
        <Polygon
          points="0,0 595.28,0 595.28,0.8 579,15 549,41.3 537,40.5 496,37.2 289,21.5 248,18.2 207,15 165,22.3 33,31.4 0,33"
          fill="url(#gAtas)"
        />
      </Svg>
      {/* pita bawah */}
      <Svg fixed width={PAGE_W} height={40} viewBox={`0 0 ${PAGE_W} 40`} style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="gBawah" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#1D0B88" />
            <Stop offset="1" stopColor="#0E0345" />
          </LinearGradient>
        </Defs>
        <Polygon points="0,4.4 347,40 0,40" fill="url(#gBawah)" />
      </Svg>
    </>
  )
}

export default function DokumenPDF({ data }: { data: DokumenPdfData }) {
  const pf: PilihanFont = data.font ?? 'helvetica'
  const s = buatStyle(pf)
  const skala = FONT[pf].skala
  const isInvoice = data.tipe === 'invoice'
  const judul = isInvoice ? 'INVOICE' : 'FAKTUR'
  const u = data.usaha
  const kosong = Math.max(0, MIN_BARIS - data.items.length)
  const sel = (lebar: number, extra = {}) => ({ width: lebar, marginRight: GAP, ...extra })

  // kotak info: ukuran huruf mengecil otomatis bila isinya panjang agar tidak meluap
  const jumlahHuruf = `${judul} # ${data.nomor}`.length + tglPanjang(data.tanggal).length + data.produkLabel.length + 19
  const ukuranInfo = (jumlahHuruf > 82 ? 8.6 : jumlahHuruf > 72 ? 9.6 : jumlahHuruf > 64 ? 10.6 : 11.6) * skala
  const cellInfo = [
    { teks: `${judul} # ${data.nomor}`, bobot: `${judul} # ${data.nomor}`.length },
    { teks: `DATE :  ${tglPanjang(data.tanggal)}`, bobot: tglPanjang(data.tanggal).length + 8 },
    { teks: `PRODUCT :  ${data.produkLabel}`, bobot: data.produkLabel.length + 11 },
  ]
  // nama usaha panjang: kecilkan agar muat dua baris di lebar kolom kiri
  const ukuranNama = (u.name.length > 34 ? 10.6 : u.name.length > 26 ? 12 : 13.4) * skala

  return (
    <Document title={`${judul} ${data.nomor}`} author={u.name} creator="Gudang Thermal">
      <Page size="A4" style={s.page}>
        <Pita />

        {/* ===== kepala ===== */}
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- komponen Image milik react-pdf, bukan <img> HTML */}
          {data.logo && <Image src={{ data: data.logo.data, format: data.logo.format }} style={s.logo} />}
          <Text style={[s.usahaNama, { fontSize: ukuranNama }]}>{u.name}</Text>

          <Text style={s.judul}>{judul}</Text>
          <Text style={s.kepadaLabel}>{isInvoice ? 'BILL TO' : 'SOLD TO'}</Text>
          <Text style={s.kepadaNama}>{data.pelanggan.name}</Text>
          <View style={s.kepadaGaris} />
          <Text style={s.kepadaAlamat}>{data.pelanggan.address ?? ''}</Text>
        </View>

        {/* ===== kotak info ===== */}
        <View style={s.info}>
          {cellInfo.map((c, i) => (
            <View
              key={i}
              style={[s.infoSel, { flexGrow: c.bobot, flexBasis: 0 }, i > 0 ? { borderLeftWidth: 1.6, borderLeftColor: C.garis } : {}]}
            >
              <Text style={[s.infoTeks, { fontSize: ukuranInfo }]}>{c.teks}</Text>
            </View>
          ))}
        </View>

        {/* ===== tabel ===== */}
        <View style={s.thead} fixed>
          <View style={[s.th, sel(KOLOM.no)]}><Text style={s.thTeks}>NO</Text></View>
          <View style={[s.th, sel(KOLOM.desc)]}><Text style={s.thTeks}>DESCRIPTION</Text></View>
          <View style={[s.th, sel(KOLOM.harga)]}><Text style={s.thTeks}>PRICE</Text></View>
          <View style={[s.th, sel(KOLOM.qty)]}><Text style={s.thTeks}>QTY</Text></View>
          <View style={[s.th, { width: KOLOM.total }]}><Text style={s.thTeks}>TOTAL</Text></View>
        </View>

        {data.items.map((it, i) => (
          <View key={i} style={[s.baris, { backgroundColor: i % 2 === 0 ? C.barisA : C.barisB }]} wrap={false}>
            <Text style={[s.teksSel, sel(KOLOM.no, { paddingLeft: 10.5 })]}>{i + 1}.</Text>
            <Text style={[s.teksSel, sel(KOLOM.desc, { textAlign: 'center', paddingVertical: 5 })]}>
              {it.nama}{it.satuan ? ` (${it.satuan})` : ''}
            </Text>
            <Text style={[s.teksSel, sel(KOLOM.harga, { textAlign: 'center' })]}>{rp(it.harga)}</Text>
            <Text style={[s.teksSel, sel(KOLOM.qty, { textAlign: 'center' })]}>{it.qty}</Text>
            <Text style={[s.teksSel, { width: KOLOM.total, textAlign: 'center' }]}>{rp(it.harga * it.qty)}</Text>
          </View>
        ))}
        {Array.from({ length: kosong }).map((_, k) => {
          const i = data.items.length + k
          return (
            <View key={`k${k}`} style={[s.baris, { backgroundColor: i % 2 === 0 ? C.barisA : C.barisB }]} wrap={false}>
              <Text style={[s.teksSel, { paddingLeft: 10.5 }]}>{i + 1}.</Text>
            </View>
          )
        })}

        {/* ===== total ===== */}
        <View style={s.totalWrap} wrap={false}>
          <View style={[s.totalKotak, { backgroundColor: C.biru }]}>
            <Text style={[s.totalLabel, { color: '#FFFFFF' }]}>SUB TOTAL</Text>
            <Text style={[s.totalNilai, { color: '#FFFFFF' }]}>{rp(data.subtotalKotor)}</Text>
          </View>
          <View style={[s.totalKotak, { backgroundColor: C.barisA, marginTop: 5.7 }]}>
            <Text style={[s.totalLabel, { color: C.labelDiskon }]}>DISCOUNT</Text>
            <Text style={[s.totalNilai, { color: C.labelDiskon }]}>{data.totalDiskon > 0 ? rp(data.totalDiskon) : ''}</Text>
          </View>
          <View style={[s.totalKotak, { backgroundColor: C.biru, marginTop: 5.7 }]}>
            <Text style={[s.totalLabel, { color: '#FFFFFF' }]}>TOTAL</Text>
            <Text style={[s.totalNilai, { color: '#FFFFFF' }]}>{rp(data.total)}</Text>
          </View>
        </View>

        {/* ===== pembayaran + cap ===== */}
        <View style={s.bawah} wrap={false}>
          <View style={{ width: 245, justifyContent: 'space-between' }}>
            <View>
              <Text style={s.bayarJudul}>PAYMENT METHOD</Text>
              <View style={s.bayarBaris}><Text style={s.bayarLabel}>Bank</Text><Text style={s.bayarTitik}>:</Text><Text style={s.bayarNilai}>{u.bank_name}/{u.account_owner}</Text></View>
              <View style={s.bayarBaris}><Text style={s.bayarLabel}>No Bank</Text><Text style={s.bayarTitik}>:</Text><Text style={s.bayarNilai}>{u.bank_account}</Text></View>
              {u.email ? <View style={s.bayarBaris}><Text style={s.bayarLabel}>Email</Text><Text style={s.bayarTitik}>:</Text><Text style={s.bayarNilai}>{u.email}</Text></View> : null}
              <View style={s.bayarBaris}><Text style={s.bayarLabel}>Phone</Text><Text style={s.bayarTitik}>:</Text><Text style={s.bayarNilai}>{u.phone}</Text></View>
              {isInvoice && data.jatuhTempo ? (
                <View style={s.bayarBaris}><Text style={s.bayarLabel}>Due Date</Text><Text style={s.bayarTitik}>:</Text><Text style={s.bayarNilai}>{tglPanjang(data.jatuhTempo)}</Text></View>
              ) : null}
            </View>
            <Text style={[s.catatan, { marginTop: 18 }]}>
              {u.footer_note ?? `*Konfirmasi pembayaran & pemesanan ke nomor yang tertera pada ${isInvoice ? 'invoice' : 'faktur'}`}
            </Text>
          </View>

          {!isInvoice && (
            <View style={s.penerimaWrap}>
              <Text style={{ fontFamily: FONT[pf].bold, fontSize: 10.6 * skala }}>Penerima,</Text>
              <View style={s.penerimaGaris} />
              <Text style={{ fontSize: 7.5 * skala, marginTop: 3, color: C.abu }}>(nama dan tanda tangan)</Text>
            </View>
          )}

          <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            {data.stamp ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- komponen Image milik react-pdf, bukan <img> HTML
              <Image src={{ data: data.stamp.data, format: data.stamp.format }} style={s.cap} />
            ) : (
              <View style={{ height: 106 }} />
            )}
            {u.signer_name ? <Text style={s.ttdNama}>{u.signer_name}</Text> : null}
            <Text style={s.ttdKet}>Hormat Kami,</Text>
          </View>
        </View>

        <Text
          style={s.nomorHalaman}
          fixed
          render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Halaman ${pageNumber} dari ${totalPages}` : '')}
        />
      </Page>
    </Document>
  )
}
