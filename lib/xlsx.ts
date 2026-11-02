import { deflateRawSync } from 'zlib'

/**
 * Penulis file Excel (.xlsx) sederhana tanpa dependensi tambahan.
 * Satu lembar: judul, tabel dengan header berwarna, filter, panel beku, baris total opsional.
 */
export type TipeKolom = 'teks' | 'angka' | 'rupiah' | 'waktu'
export type Kolom = { judul: string; tipe: TipeKolom; lebar?: number }
export type Sel = string | number | null
export type Lembar = {
  nama: string
  judul?: string[] // baris di atas tabel (baris pertama dicetak besar)
  kolom: Kolom[]
  baris: Sel[][]
  total?: Sel[]
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(files: { nama: string; isi: Buffer }[]): Buffer {
  const lokal: Buffer[] = []
  const pusat: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const nama = Buffer.from(f.nama, 'utf8')
    const crc = crc32(f.isi)
    const komp = deflateRawSync(f.isi)

    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8)
    h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14)
    h.writeUInt32LE(komp.length, 18); h.writeUInt32LE(f.isi.length, 22); h.writeUInt16LE(nama.length, 26); h.writeUInt16LE(0, 28)
    lokal.push(h, nama, komp)

    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10)
    c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16)
    c.writeUInt32LE(komp.length, 20); c.writeUInt32LE(f.isi.length, 24); c.writeUInt16LE(nama.length, 28)
    c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34); c.writeUInt16LE(0, 36); c.writeUInt32LE(0, 38); c.writeUInt32LE(offset, 42)
    pusat.push(c, nama)
    offset += 30 + nama.length + komp.length
  }
  const pusatBuf = Buffer.concat(pusat)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(pusatBuf.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...lokal, pusatBuf, eocd])
}

const esc = (s: string) =>
  s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function huruf(i: number) {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** Waktu ISO -> nomor seri Excel pada zona WIB (UTC+7) */
export function serialWaktu(iso: string) {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  const menit = Math.round(ms / 60_000) * 60_000 // bulatkan ke menit agar tampil tepat (mis. 10:10, bukan 10:09:59)
  return (menit + 7 * 3600_000) / 86_400_000 + 25569
}

// indeks gaya (cellXfs) di styles.xml
const G = { judul: 1, header: 2, teks: 3, angka: 4, rupiah: 5, waktu: 6, totTeks: 7, totRupiah: 8, tebal: 9, totAngka: 10 }
const GAYA_DATA: Record<TipeKolom, number> = { teks: G.teks, angka: G.angka, rupiah: G.rupiah, waktu: G.waktu }
const GAYA_TOTAL: Record<TipeKolom, number> = { teks: G.totTeks, angka: G.totAngka, rupiah: G.totRupiah, waktu: G.totTeks }
const LEBAR: Record<TipeKolom, number> = { teks: 28, angka: 12, rupiah: 18, waktu: 18 }

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;Rp&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF004AAD"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD5F1FD"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFC9CFC6"/></left><right style="thin"><color rgb="FFC9CFC6"/></right><top style="thin"><color rgb="FFC9CFC6"/></top><bottom style="thin"><color rgb="FFC9CFC6"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="3" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

export function buatXlsx(l: Lembar): Buffer {
  const namaLembar = (l.nama.replace(/[\[\]:*?/\\]/g, ' ').trim() || 'Laporan').slice(0, 31)
  const rows: string[] = []
  let r = 0

  const teks = (ref: string, v: string, s: number) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
  const sel = (ci: number, rr: number, v: Sel, s: number, tipe?: TipeKolom) => {
    const ref = `${huruf(ci)}${rr}`
    let nilai = v
    if (tipe === 'waktu' && typeof nilai === 'string') nilai = serialWaktu(nilai)
    if (nilai === null || nilai === undefined || nilai === '') return `<c r="${ref}" s="${s}"/>`
    if (typeof nilai === 'number' && Number.isFinite(nilai)) return `<c r="${ref}" s="${s}"><v>${nilai}</v></c>`
    return teks(ref, String(nilai), s)
  }

  for (const [i, j] of (l.judul ?? []).entries()) {
    r++
    rows.push(`<row r="${r}"${i === 0 ? ' ht="22" customHeight="1"' : ''}>${teks(`A${r}`, j, i === 0 ? G.judul : G.tebal)}</row>`)
  }
  if ((l.judul ?? []).length) r++ // baris kosong pemisah

  r++
  const barisHeader = r
  rows.push(`<row r="${r}" ht="30" customHeight="1">${l.kolom.map((k, ci) => teks(`${huruf(ci)}${r}`, k.judul, G.header)).join('')}</row>`)

  for (const b of l.baris) {
    r++
    rows.push(`<row r="${r}">${l.kolom.map((k, ci) => sel(ci, r, b[ci] ?? null, GAYA_DATA[k.tipe], k.tipe)).join('')}</row>`)
  }
  const barisTerakhirData = r

  if (l.total) {
    r++
    rows.push(`<row r="${r}">${l.kolom.map((k, ci) => sel(ci, r, l.total![ci] ?? null, GAYA_TOTAL[k.tipe])).join('')}</row>`)
  }

  const akhir = huruf(l.kolom.length - 1)
  const adaData = l.baris.length > 0
  const rentangFilter = `$A$${barisHeader}:$${akhir}$${barisTerakhirData}`

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${barisHeader}" topLeftCell="A${barisHeader + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${l.kolom.map((k, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${k.lebar ?? LEBAR[k.tipe]}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>${adaData ? `<autoFilter ref="A${barisHeader}:${akhir}${barisTerakhirData}"/>` : ''}
</worksheet>`

  const nama = esc(namaLembar)
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${nama}" sheetId="1" r:id="rId1"/></sheets>${adaData ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${nama.replace(/'/g, "''")}'!${rentangFilter}</definedName></definedNames>` : ''}
</workbook>`

  const B = (s: string) => Buffer.from(s, 'utf8')
  return zip([
    { nama: '[Content_Types].xml', isi: B(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { nama: '_rels/.rels', isi: B(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { nama: 'xl/workbook.xml', isi: B(workbook) },
    { nama: 'xl/_rels/workbook.xml.rels', isi: B(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { nama: 'xl/styles.xml', isi: B(STYLES) },
    { nama: 'xl/worksheets/sheet1.xml', isi: B(sheet) },
  ])
}

/** CSV UTF-8 dengan BOM (agar huruf dan angka terbaca benar di Excel). Waktu ditulis sebagai teks WIB. */
export function buatCsv(l: Lembar, formatWaktu: (iso: string) => string): string {
  const esc2 = (v: Sel) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const baris = (cols: Sel[]) => cols.map(esc2).join(',')
  const keluar: string[] = []
  for (const j of l.judul ?? []) keluar.push(baris([j]))
  if ((l.judul ?? []).length) keluar.push('')
  keluar.push(baris(l.kolom.map((k) => k.judul)))
  for (const b of l.baris) {
    keluar.push(baris(l.kolom.map((k, ci) => (k.tipe === 'waktu' && typeof b[ci] === 'string' ? formatWaktu(b[ci] as string) : (b[ci] ?? '')))))
  }
  if (l.total) keluar.push(baris(l.total))
  return '\uFEFF' + keluar.join('\r\n')
}
