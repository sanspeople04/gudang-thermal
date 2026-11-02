'use client'

import { useMemo, useState, useTransition } from 'react'
import { Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { buatTransaksiAction } from '@/app/actions/transaksi'
import { calculateLineItem } from '@/lib/utils/pricing'
import { rupiah } from '@/lib/format'
import type { AksiHasil } from '@/lib/types'
import { btnPrimary, GalatField, inputCls, labelCls, Pesan } from '@/components/ui'

export type CustomerOpt = { id: string; name: string }
export type UnitOpt = {
  id: string
  productId: string
  productName: string
  unitName: string
  multiplier: number
  price: number
  stock: number
  baseUnit: string
}
export type DiscountOpt = { customer_id: string; product_unit_id: string; amount: number }

type Row = { key: number; unitId: string; qty: string }

export default function TransaksiForm({
  customers,
  units,
  discounts,
}: {
  customers: CustomerOpt[]
  units: UnitOpt[]
  discounts: DiscountOpt[]
}) {
  const [jenis, setJenis] = useState<'penjualan' | 'sampel'>('penjualan')
  const [customerId, setCustomerId] = useState('')
  const [saluran, setSaluran] = useState<'online' | 'offline'>('offline')
  const [catatan, setCatatan] = useState('')
  const [rows, setRows] = useState<Row[]>([{ key: 1, unitId: '', qty: '1' }])
  const [nextKey, setNextKey] = useState(2)
  const [hasil, setHasil] = useState<AksiHasil | null>(null)
  const [pending, startTransition] = useTransition()

  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])

  // Hitung ringkasan (pratinjau). Angka final tetap dihitung ulang oleh database saat disimpan.
  const hitung = useMemo(() => {
    const baris = rows.map((r) => {
      const u = unitMap.get(r.unitId)
      const qty = Math.max(0, Math.floor(Number(r.qty) || 0))
      if (!u || qty < 1) return { subtotal: 0, diskon: 0, qty: 0, qtyBase: 0, u }
      const disc = discounts.find((d) => d.customer_id === customerId && d.product_unit_id === u.id)?.amount ?? 0
      const c = calculateLineItem({
        jenis_transaksi: jenis, qty, base_qty_multiplier: u.multiplier,
        sell_price: u.price, discount_nominal: Math.min(disc, u.price),
      })
      return { subtotal: c.subtotal, diskon: c.discount_unit, qty, qtyBase: c.qty_base, u }
    })
    const pakaiPerProduk = new Map<string, number>()
    for (const b of baris) {
      if (b.u) pakaiPerProduk.set(b.u.productId, (pakaiPerProduk.get(b.u.productId) ?? 0) + b.qtyBase)
    }
    const total = baris.reduce((a, b) => a + b.subtotal, 0)
    const diskonTotal = baris.reduce((a, b) => a + b.diskon * b.qty, 0)
    return { baris, total, diskonTotal, pakaiPerProduk }
  }, [rows, unitMap, discounts, customerId, jenis])

  const stokKurang = (productId: string, stock: number) => (hitung.pakaiPerProduk.get(productId) ?? 0) > stock

  const ubahRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setHasil(null)
    startTransition(async () => {
      const r = await buatTransaksiAction({
        customer_id: customerId,
        jenis_transaksi: jenis,
        saluran: jenis === 'sampel' ? null : saluran,
        catatan_saluran: catatan || undefined,
        items: rows
          .filter((r) => r.unitId)
          .map((r) => ({ product_unit_id: r.unitId, qty: Math.floor(Number(r.qty) || 0) })),
      })
      // Jika sukses, server melakukan redirect ke /arsip. Kode di bawah hanya jalan saat gagal.
      if (r) setHasil(r)
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {hasil && <Pesan ok={hasil.ok}>{hasil.message}</Pesan>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Jenis transaksi</label>
          <select className={inputCls} value={jenis} onChange={(e) => setJenis(e.target.value as 'penjualan' | 'sampel')} disabled={pending}>
            <option value="penjualan">Penjualan</option>
            <option value="sampel">Kirim sampel (gratis)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>Pelanggan</label>
          <select className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={pending}>
            <option value="">Pilih pelanggan…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <GalatField msgs={hasil?.errors?.customer_id} />
        </div>

        {jenis === 'penjualan' && (
          <>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Saluran</label>
              <select className={inputCls} value={saluran} onChange={(e) => setSaluran(e.target.value as 'online' | 'offline')} disabled={pending}>
                <option value="offline">Offline (langsung)</option>
                <option value="online">Online</option>
              </select>
              <GalatField msgs={hasil?.errors?.saluran} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Catatan saluran (opsional)</label>
              <input type="text" className={inputCls} placeholder="mis. Shopee, WhatsApp" value={catatan} onChange={(e) => setCatatan(e.target.value)} disabled={pending} />
            </div>
            <p className="md:col-span-2 text-[13px] text-secondary border-l-4 border-accent bg-page px-3 py-2">
              Invoice dan faktur dibuat otomatis untuk setiap penjualan, lengkap dengan PDF-nya di menu Arsip.
            </p>
          </>
        )}
      </div>

      <div className="border border-divider">
        <div className="hidden md:flex gap-2 bg-page border-b border-divider px-3 py-2">
          <span className={`${labelCls} flex-1`}>Produk</span>
          <span className={`${labelCls} w-28 text-right`}>Jumlah</span>
          <span className={`${labelCls} w-36 text-right`}>Subtotal</span>
          <span className="w-11" />
        </div>
        {rows.map((r, idx) => {
          const b = hitung.baris[idx]
          const u = b.u
          const kurang = u ? stokKurang(u.productId, u.stock) : false
          return (
            <div key={r.key} className="border-b border-divider p-3 flex flex-wrap md:flex-nowrap items-start gap-2">
              <div className="basis-full md:basis-auto md:flex-1 min-w-0">
                <select aria-label="Produk" className={inputCls} value={r.unitId} onChange={(e) => ubahRow(r.key, { unitId: e.target.value })} disabled={pending}>
                  <option value="">Pilih produk…</option>
                  {units.map((x) => (
                    <option key={x.id} value={x.id}>{x.productName} ({x.unitName})</option>
                  ))}
                </select>
                {u && (
                  <p className={`text-[12px] mt-1 flex items-center gap-1 ${kurang ? 'text-danger' : 'text-secondary'}`}>
                    {kurang && <TriangleAlert size={12} />}
                    Stok {u.stock.toLocaleString('id-ID')} {u.baseUnit}
                    {jenis === 'penjualan' && b.diskon > 0 ? ` · diskon ${rupiah(b.diskon)}/${u.unitName}` : ''}
                  </p>
                )}
              </div>
              <input
                aria-label="Jumlah" type="number" inputMode="numeric" min={1} step={1}
                className={`${inputCls} w-28! font-mono text-right`}
                value={r.qty} onChange={(e) => ubahRow(r.key, { qty: e.target.value })} disabled={pending}
              />
              <p className="flex-1 md:flex-none md:w-36 min-h-11 flex items-center justify-end font-mono text-[14px]">{rupiah(b.subtotal)}</p>
              {rows.length > 1 ? (
                <button type="button" aria-label="Hapus baris" className="w-11 h-11 flex items-center justify-center text-secondary hover:text-danger"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} disabled={pending}>
                  <Trash2 size={16} />
                </button>
              ) : (
                <span className="hidden md:block w-11" />
              )}
            </div>
          )
        })}
        <GalatField msgs={hasil?.errors?.items} />
        <div className="p-2">
          <button type="button" className="flex items-center gap-1 text-[12px] font-condensed uppercase tracking-wider border border-primary px-3 py-1.5 hover:bg-primary hover:text-page"
            onClick={() => { setRows((rs) => [...rs, { key: nextKey, unitId: '', qty: '1' }]); setNextKey((k) => k + 1) }} disabled={pending}>
            <Plus size={14} /> Tambah produk
          </button>
        </div>
      </div>

      <div className="bg-page border border-divider p-4 w-full md:w-1/2 lg:w-1/3 self-end flex flex-col gap-2">
        {jenis === 'penjualan' && hitung.diskonTotal > 0 && (
          <div className="flex justify-between text-[13px] text-secondary">
            <span>Total diskon</span><span className="font-mono">- {rupiah(hitung.diskonTotal)}</span>
          </div>
        )}
        <div className="flex justify-between font-condensed uppercase font-semibold text-lg">
          <span>Total akhir</span><span className="font-mono">{rupiah(hitung.total)}</span>
        </div>
        <button type="submit" disabled={pending} className={`${btnPrimary} mt-2 flex items-center justify-center gap-2`}>
          {pending && <Loader2 size={16} className="animate-spin" />} Simpan transaksi
        </button>
        <p className="text-[12px] text-secondary">Harga dan diskon dihitung ulang oleh sistem saat disimpan.</p>
      </div>
    </form>
  )
}
