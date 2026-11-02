export interface PricingInput {
  jenis_transaksi: 'penjualan' | 'sampel'
  qty: number
  base_qty_multiplier: number
  sell_price: number
  discount_nominal: number
  override_discount?: number
}

export function calculateLineItem(input: PricingInput) {
  const { jenis_transaksi, qty, base_qty_multiplier, sell_price, discount_nominal, override_discount } = input
  const qty_base = qty * base_qty_multiplier

  if (jenis_transaksi === 'sampel') {
    return { unit_price: 0, discount_unit: 0, subtotal: 0, qty_base, is_overridden: false }
  }

  const is_overridden = override_discount !== undefined && override_discount !== null
  const final_discount = is_overridden ? override_discount : discount_nominal
  
  const unit_price = sell_price
  const subtotal = (unit_price - final_discount) * qty

  return { unit_price, discount_unit: final_discount, subtotal, qty_base, is_overridden }
}