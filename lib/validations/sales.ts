import { z } from 'zod'

export const saleItemSchema = z.object({
  product_unit_id: z.guid("ID Satuan tidak valid"),
  qty: z.number().int().min(1, "Jumlah minimal 1"),
  override_discount: z.number().min(0).optional(),
  override_reason: z.string().optional(),
})

export const createSaleSchema = z
  .object({
    customer_id: z.guid("Pilih pelanggan yang valid"),
    jenis_transaksi: z.enum(['penjualan', 'sampel'], { error: "Pilih jenis transaksi" }),
    saluran: z.enum(['online', 'offline']).nullable(),
    catatan_saluran: z.string().optional(),
    items: z.array(saleItemSchema).min(1, "Minimal 1 produk"),
  })
  .refine(
    (d) => d.jenis_transaksi === 'sampel' || d.saluran !== null,
    { message: "Pilih saluran penjualan (online/offline)", path: ['saluran'] }
  )
