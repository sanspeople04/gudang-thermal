-- =====================================================================
-- TAHAP 5: (1) setiap PENJUALAN otomatis membuat INVOICE dan FAKTUR,
--          (2) pelanggan baru dibuat bersama aturan diskonnya.
-- Syarat: tahap3.sql dan tahap4.sql SUDAH dijalankan. Aman dijalankan ulang.
-- Jalankan SEKALI di Supabase SQL Editor (tab New query yang kosong),
-- LALU pasang zip kode. Urutan ini penting.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Hapus versi lama yang masih memakai parameter p_dokumen
--    (jika dibiarkan, dua versi fungsi akan ada bersamaan dan membingungkan)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_scheduled_order(UUID, channel_type, TEXT, document_type);
DROP FUNCTION IF EXISTS public.create_sale(UUID, transaction_type, channel_type, TEXT, JSONB, document_type);

-- ---------------------------------------------------------------------
-- 2. create_sale: penjualan SELALU menghasilkan invoice + faktur.
--    Sampel tidak menghasilkan dokumen.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sale(
    p_customer_id UUID,
    p_jenis transaction_type,
    p_saluran channel_type,
    p_catatan TEXT,
    p_items JSONB                  -- [{"product_unit_id": "...", "qty": 2}, ...]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale_id UUID;
    v_total INTEGER := 0;
    v_item RECORD;
    v_unit RECORD;
    v_price INTEGER;
    v_disc INTEGER;
    v_sub INTEGER;
    v_base INTEGER;
    v_stock INTEGER;
    v_buy INTEGER;
    v_active BOOLEAN;
    v_date DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;
    IF p_jenis = 'penjualan' AND p_saluran IS NULL THEN
        RAISE EXCEPTION 'Saluran wajib diisi untuk penjualan';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Minimal 1 produk';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
        RAISE EXCEPTION 'Pelanggan tidak ditemukan';
    END IF;

    INSERT INTO sales (customer_id, jenis_transaksi, saluran, catatan_saluran, total_amount, created_by)
    VALUES (
        p_customer_id,
        p_jenis,
        CASE WHEN p_jenis = 'sampel' THEN NULL ELSE p_saluran END,
        NULLIF(trim(p_catatan), ''),
        0,
        auth.uid()
    )
    RETURNING id INTO v_sale_id;

    FOR v_item IN
        SELECT (e->>'product_unit_id')::uuid AS unit_id, (e->>'qty')::int AS qty
          FROM jsonb_array_elements(p_items) AS e
    LOOP
        IF v_item.qty IS NULL OR v_item.qty < 1 THEN
            RAISE EXCEPTION 'Jumlah minimal 1';
        END IF;

        SELECT pu.id, pu.product_id, pu.base_qty_multiplier, pu.sell_price, p.name
          INTO v_unit
          FROM product_units pu JOIN products p ON p.id = pu.product_id
         WHERE pu.id = v_item.unit_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produk atau satuan tidak ditemukan';
        END IF;

        v_base := v_item.qty * v_unit.base_qty_multiplier;

        SELECT current_stock, buy_price, is_active INTO v_stock, v_buy, v_active
          FROM products WHERE id = v_unit.product_id FOR UPDATE;
        IF NOT v_active THEN
            RAISE EXCEPTION 'Produk "%" sudah dinonaktifkan', v_unit.name;
        END IF;
        IF v_stock < v_base THEN
            RAISE EXCEPTION 'Stok "%" tidak cukup: sisa %, diminta %', v_unit.name, v_stock, v_base;
        END IF;

        IF p_jenis = 'sampel' THEN
            v_price := 0;
            v_disc := 0;
        ELSE
            v_price := v_unit.sell_price;
            SELECT COALESCE(MAX(discount_amount), 0) INTO v_disc
              FROM customer_product_discounts
             WHERE customer_id = p_customer_id AND product_unit_id = v_unit.id;
            v_disc := LEAST(v_disc, v_price);
        END IF;

        v_sub := (v_price - v_disc) * v_item.qty;

        INSERT INTO sale_items (sale_id, product_unit_id, qty, qty_base, unit_price, discount_unit, subtotal, cost_total)
        VALUES (v_sale_id, v_unit.id, v_item.qty, v_base, v_price, v_disc, v_sub, v_base * v_buy);

        INSERT INTO stock_movements (product_id, reason, qty_change, unit_cost, sale_id, created_by)
        VALUES (v_unit.product_id, p_jenis::text::stock_reason, -v_base, v_buy, v_sale_id, auth.uid());

        v_total := v_total + v_sub;
    END LOOP;

    UPDATE sales SET total_amount = v_total WHERE id = v_sale_id;

    -- penjualan: invoice dan faktur dibuat bersamaan, dengan nomor urut masing-masing
    IF p_jenis = 'penjualan' THEN
        INSERT INTO documents (type, doc_number, sale_id, date, customer_id, total, created_by)
        VALUES ('invoice', generate_doc_number('invoice'), v_sale_id, v_date, p_customer_id, v_total, auth.uid());

        INSERT INTO documents (type, doc_number, sale_id, date, customer_id, total, created_by)
        VALUES ('faktur', generate_doc_number('faktur'), v_sale_id, v_date, p_customer_id, v_total, auth.uid());
    END IF;

    RETURN v_sale_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Proses jadwal kirim -> penjualan (otomatis invoice + faktur)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_scheduled_order(
    p_order_id UUID,
    p_saluran channel_type,
    p_catatan TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_items JSONB;
    v_sale UUID;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;

    SELECT * INTO v_order FROM scheduled_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pesanan terjadwal tidak ditemukan';
    END IF;
    IF v_order.status <> 'terjadwal' THEN
        RAISE EXCEPTION 'Pesanan sudah berstatus %', v_order.status;
    END IF;

    SELECT jsonb_agg(jsonb_build_object('product_unit_id', product_unit_id, 'qty', qty))
      INTO v_items
      FROM scheduled_order_items WHERE order_id = p_order_id;

    v_sale := public.create_sale(v_order.customer_id, 'penjualan', p_saluran, p_catatan, v_items);

    UPDATE scheduled_orders SET status = 'dikirim', sale_id = v_sale WHERE id = p_order_id;
    RETURN v_sale;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Pelanggan baru + aturan diskon per produk, dalam satu transaksi.
--    Diskon (nominal rupiah per satuan jual) hanya boleh diatur owner.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_customer(
    p_name TEXT,
    p_contact TEXT,
    p_address TEXT,
    p_discounts JSONB DEFAULT '[]'::jsonb    -- [{"product_unit_id": "...", "amount": 10000}, ...]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role role_type := public.get_my_role();
    v_id UUID;
    v_d RECORD;
    v_price INTEGER;
BEGIN
    IF auth.uid() IS NULL OR v_role IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RAISE EXCEPTION 'Nama pelanggan minimal 2 karakter';
    END IF;

    IF p_discounts IS NOT NULL AND jsonb_typeof(p_discounts) = 'array' AND jsonb_array_length(p_discounts) > 0
       AND v_role <> 'owner' THEN
        RAISE EXCEPTION 'Hanya owner yang boleh mengatur diskon pelanggan';
    END IF;

    INSERT INTO customers (name, contact, address)
    VALUES (trim(p_name), NULLIF(trim(p_contact), ''), NULLIF(trim(p_address), ''))
    RETURNING id INTO v_id;

    IF p_discounts IS NOT NULL AND jsonb_typeof(p_discounts) = 'array' THEN
        FOR v_d IN
            SELECT (e->>'product_unit_id')::uuid AS unit_id, (e->>'amount')::int AS amount
              FROM jsonb_array_elements(p_discounts) AS e
        LOOP
            IF v_d.amount IS NULL OR v_d.amount < 0 THEN
                RAISE EXCEPTION 'Diskon tidak boleh negatif';
            END IF;
            IF v_d.amount = 0 THEN
                CONTINUE;
            END IF;

            SELECT sell_price INTO v_price FROM product_units WHERE id = v_d.unit_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Satuan produk untuk diskon tidak ditemukan';
            END IF;
            IF v_d.amount > v_price THEN
                RAISE EXCEPTION 'Diskon melebihi harga jual (maksimal Rp %)', v_price;
            END IF;

            INSERT INTO customer_product_discounts (customer_id, product_unit_id, discount_amount)
            VALUES (v_id, v_d.unit_id, v_d.amount)
            ON CONFLICT (customer_id, product_unit_id) DO UPDATE SET discount_amount = EXCLUDED.discount_amount;
        END LOOP;
    END IF;

    RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Hak eksekusi
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_sale(UUID, transaction_type, channel_type, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_scheduled_order(UUID, channel_type, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_customer(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_sale(UUID, transaction_type, channel_type, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_order(UUID, channel_type, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer(TEXT, TEXT, TEXT, JSONB) TO authenticated;
