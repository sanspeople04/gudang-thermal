'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { tambahSatuanAction, ubahHargaSatuanAction, ubahProdukAction } from '@/app/actions/produk'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'

type Produk = {
  id: string; name: string; type: 'thermal' | 'stiker' | 'sampel'; base_unit: string
  buy_price: number; min_stock: number; is_active: boolean; current_stock: number
}
type Satuan = { id: string; unit_name: string; multiplier: number; sell_price: number }

const num = (s: string) => (s === '' ? undefined : Number(s))

function BarisSatuan({ s }: { s: Satuan }) {
  const [harga, setHarga] = useState(String(s.sell_price))
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <div className="border-b border-divider/50 last:border-b-0 p-3 flex flex-wrap md:flex-nowrap items-end md:items-center gap-2 text-[14px]">
      <div className="basis-full md:basis-auto md:flex-1 min-w-0">
        <p>{s.unit_name}</p>
        <p className="text-[12px] text-secondary font-mono">isi {s.multiplier}</p>
      </div>
      <div className="flex-1 md:flex-none md:w-48 min-w-0">
        <span className="md:hidden font-condensed uppercase text-[11px] tracking-wider text-secondary">Harga jual (Rp)</span>
        <input aria-label={`Harga jual ${s.unit_name}`} type="number" inputMode="numeric" min={0} className={`${inputCls} font-mono text-right`} value={harga} onChange={(e) => setHarga(e.target.value)} disabled={pending} />
      </div>
      <div>
        <button disabled={pending}
          onClick={() => startTransition(async () => setHasil(await ubahHargaSatuanAction({ id: s.id, sell_price: num(harga) })))}
          className="border border-primary px-3 py-2 text-[11px] font-condensed uppercase tracking-wider hover:bg-primary hover:text-page disabled:opacity-60">
          Simpan
        </button>
      </div>
      {hasil && <p className={`basis-full text-[12px] ${hasil.ok ? 'text-primary' : 'text-danger'}`}>{hasil.message}</p>}
    </div>
  )
}

export default function ProdukEditor({ produk, satuan }: { produk: Produk; satuan: Satuan[] }) {
  const [name, setName] = useState(produk.name)
  const [type, setType] = useState(produk.type)
  const [buyPrice, setBuyPrice] = useState(String(produk.buy_price))
  const [minStock, setMinStock] = useState(String(produk.min_stock))
  const [aktif, setAktif] = useState(produk.is_active)
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const [uName, setUName] = useState('')
  const [uMult, setUMult] = useState('')
  const [uHarga, setUHarga] = useState('')
  const [hasilU, setHasilU] = useState<AksiHasil | null>(null)
  const [pendingU, startU] = useTransition()

  const simpan = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)
    startTransition(async () => setHasil(await ubahProdukAction({
      id: produk.id, name, type, buy_price: num(buyPrice), min_stock: num(minStock), is_active: aktif,
    })))
  }

  const tambahSatuan = (e: React.FormEvent) => {
    e.preventDefault()
    setHasilU(null)
    startU(async () => {
      const r = await tambahSatuanAction({ product_id: produk.id, unit_name: uName, multiplier: num(uMult), sell_price: num(uHarga) })
      setHasilU(r)
      if (r.ok) { setUName(''); setUMult(''); setUHarga('') }
    })
  }

  const angka = `${inputCls} font-mono text-right`

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Data produk</h3>
        <form onSubmit={simpan} className="flex flex-col gap-4">
          {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Nama produk</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
              <GalatField msgs={hasil?.errors?.name} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Jenis</label>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as Produk['type'])} disabled={pending}>
                <option value="thermal">Thermal</option>
                <option value="stiker">Stiker</option>
                <option value="sampel">Sampel</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Harga beli per {produk.base_unit} (Rp)</label>
              <input type="number" inputMode="numeric" min={0} className={angka} value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} disabled={pending} />
              <p className="text-[12px] text-secondary">Otomatis berupa rata-rata tertimbang saat stok masuk dari supplier. Ubah manual hanya untuk koreksi.</p>
              <GalatField msgs={hasil?.errors?.buy_price} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Stok minimum (peringatan)</label>
              <input type="number" inputMode="numeric" min={0} className={angka} value={minStock} onChange={(e) => setMinStock(e.target.value)} disabled={pending} />
              <GalatField msgs={hasil?.errors?.min_stock} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} disabled={pending} />
            Produk aktif (produk nonaktif tidak muncul di form transaksi, riwayatnya tetap tersimpan)
          </label>
          <p className="text-[13px] text-secondary">Stok saat ini: <span className="font-mono">{produk.current_stock.toLocaleString('id-ID')} {produk.base_unit}</span>. Stok hanya berubah lewat Stok Masuk dan Stok Keluar.</p>
          <button type="submit" disabled={pending} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
            {pending && <Loader2 size={16} className="animate-spin" />} Simpan produk
          </button>
        </form>
      </section>

      <section className="bg-surface border border-divider p-4 md:p-6">
        <h3 className="font-condensed uppercase text-[14px] tracking-wider border-b-2 border-primary pb-2 mb-4">Satuan jual dan harga</h3>
        <div className="border border-divider mb-4">
          {satuan.map((s) => <BarisSatuan key={s.id + s.sell_price} s={s} />)}
        </div>

        <form onSubmit={tambahSatuan} className="flex flex-col gap-3 border-t border-divider pt-4">
          <p className={labelCls}>Tambah satuan baru</p>
          {hasilU && <Pesan ok={hasilU.ok}>{hasilU.message}</Pesan>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Nama satuan (mis. pak)" value={uName} onChange={(e) => setUName(e.target.value)} disabled={pendingU} />
            <input type="number" inputMode="numeric" min={1} className={angka} placeholder={`Isi (${produk.base_unit})`} value={uMult} onChange={(e) => setUMult(e.target.value)} disabled={pendingU} />
            <input type="number" inputMode="numeric" min={0} className={angka} placeholder="Harga jual (Rp)" value={uHarga} onChange={(e) => setUHarga(e.target.value)} disabled={pendingU} />
          </div>
          <GalatField msgs={hasilU?.errors?.unit_name ?? hasilU?.errors?.multiplier ?? hasilU?.errors?.sell_price} />
          <button type="submit" disabled={pendingU} className={`${btnPrimary} flex items-center justify-center gap-2 md:self-start`}>
            {pendingU && <Loader2 size={16} className="animate-spin" />} Tambah satuan
          </button>
        </form>
      </section>
    </div>
  )
}
