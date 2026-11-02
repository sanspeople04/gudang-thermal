-- =====================================================================
-- TAHAP 4: pelanggan, produk, jadwal, laporan keuangan, PDF, WhatsApp
-- Syarat: tahap3.sql SUDAH dijalankan. Aman dijalankan ulang (idempotent).
-- Jalankan SEKALI di Supabase SQL Editor, tab "New query" yang kosong.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolom baru
-- ---------------------------------------------------------------------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0);

ALTER TABLE business_settings
    ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 7 CHECK (payment_terms_days >= 0),
    ADD COLUMN IF NOT EXISTS doc_footer_note TEXT;

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- modal barang saat transaksi (harga beli per satuan dasar x qty_base), untuk HPP
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS cost_total INTEGER NOT NULL DEFAULT 0;

-- harga beli per satuan dasar pada setiap pergerakan stok; is_opening = stok awal (bukan belanja)
ALTER TABLE stock_movements
    ADD COLUMN IF NOT EXISTS unit_cost INTEGER,
    ADD COLUMN IF NOT EXISTS is_opening BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE scheduled_orders ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id);

-- data lama: tandai stok awal, isi modal transaksi lama dengan harga beli saat ini
UPDATE stock_movements SET is_opening = true WHERE note = 'Stok awal' AND NOT is_opening;

UPDATE sale_items si
   SET cost_total = si.qty_base * p.buy_price
  FROM product_units pu JOIN products p ON p.id = pu.product_id
 WHERE pu.id = si.product_unit_id AND si.cost_total = 0;

UPDATE stock_movements m
   SET unit_cost = p.buy_price
  FROM products p
 WHERE p.id = m.product_id AND m.unit_cost IS NULL AND m.reason IN ('penjualan', 'sampel', 'rusak');

-- ---------------------------------------------------------------------
-- 2. Tabel baru: biaya operasional, log WhatsApp
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
    kategori TEXT NOT NULL CHECK (kategori IN ('ongkir', 'listrik_air', 'gaji', 'sewa', 'perawatan', 'pemasaran', 'lainnya')),
    keterangan TEXT,
    jumlah INTEGER NOT NULL CHECK (jumlah > 0),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_tanggal ON expenses (tanggal DESC);

CREATE TABLE IF NOT EXISTS wa_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    message TEXT,
    success BOOLEAN NOT NULL,
    response TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_logs_document ON wa_logs (document_id, created_at DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_logs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_owner ON expenses;
CREATE POLICY expenses_owner ON expenses FOR ALL TO authenticated
  USING (public.get_my_role() = 'owner') WITH CHECK (public.get_my_role() = 'owner');

DROP POLICY IF EXISTS wa_logs_select ON wa_logs;
CREATE POLICY wa_logs_select ON wa_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS wa_logs_insert ON wa_logs;
CREATE POLICY wa_logs_insert ON wa_logs FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IS NOT NULL AND created_by = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Penyimpanan file (privat). Diakses hanya lewat server (service role).
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false), ('business-assets', 'business-assets', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. Stok masuk: sekarang mencatat harga beli (rata-rata tertimbang)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_stock_movement(UUID, INTEGER, stock_reason, TEXT);

CREATE OR REPLACE FUNCTION public.record_stock_movement(
    p_product_unit_id UUID,
    p_qty INTEGER,
    p_reason stock_reason,
    p_note TEXT DEFAULT NULL,
    p_unit_cost INTEGER DEFAULT NULL      -- harga beli per SATUAN DASAR (mis. per roll), wajib untuk supplier
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_unit RECORD;
    v_prod RECORD;
    v_base INTEGER;
    v_change INTEGER;
    v_cost INTEGER;
    v_new_buy INTEGER;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;
    IF p_qty IS NULL OR p_qty < 1 THEN
        RAISE EXCEPTION 'Jumlah minimal 1';
    END IF;
    IF p_reason NOT IN ('supplier', 'retur', 'rusak') THEN
        RAISE EXCEPTION 'Jenis pencatatan tidak valid';
    END IF;

    SELECT pu.product_id, pu.base_qty_multiplier INTO v_unit
      FROM product_units pu WHERE pu.id = p_product_unit_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produk atau satuan tidak ditemukan';
    END IF;

    SELECT id, name, current_stock, buy_price, is_active INTO v_prod
      FROM products WHERE id = v_unit.product_id FOR UPDATE;
    IF NOT v_prod.is_active THEN
        RAISE EXCEPTION 'Produk "%" sudah dinonaktifkan', v_prod.name;
    END IF;

    v_base := p_qty * v_unit.base_qty_multiplier;

    IF p_reason = 'supplier' THEN
        IF p_unit_cost IS NULL OR p_unit_cost <= 0 THEN
            RAISE EXCEPTION 'Harga beli wajib diisi untuk stok dari supplier';
        END IF;
        v_cost := p_unit_cost;
        v_change := v_base;
        -- harga beli produk = rata-rata tertimbang (stok lama x harga lama + masuk x harga baru)
        v_new_buy := ROUND(
            ((v_prod.current_stock::numeric * v_prod.buy_price) + (v_base::numeric * p_unit_cost))
            / (v_prod.current_stock + v_base)
        )::int;
        UPDATE products SET buy_price = v_new_buy WHERE id = v_prod.id;
    ELSIF p_reason = 'retur' THEN
        v_cost := v_prod.buy_price;
        v_change := v_base;
    ELSE  -- rusak
        IF v_prod.current_stock < v_base THEN
            RAISE EXCEPTION 'Stok "%" tidak cukup: sisa %, diminta %', v_prod.name, v_prod.current_stock, v_base;
        END IF;
        v_cost := v_prod.buy_price;
        v_change := -v_base;
    END IF;

    INSERT INTO stock_movements (product_id, reason, qty_change, unit_cost, note, created_by)
    VALUES (v_prod.id, p_reason, v_change, v_cost, NULLIF(trim(p_note), ''), auth.uid());
END;
$$;

-- ---------------------------------------------------------------------
-- 5. create_sale: sekarang menyimpan modal (cost_total, unit_cost) dan menolak produk nonaktif
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sale(
    p_customer_id UUID,
    p_jenis transaction_type,
    p_saluran channel_type,
    p_catatan TEXT,
    p_items JSONB,
    p_dokumen document_type DEFAULT NULL
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

    IF p_dokumen IS NOT NULL AND p_jenis = 'penjualan' THEN
        INSERT INTO documents (type, doc_number, sale_id, date, customer_id, total, created_by)
        VALUES (
            p_dokumen,
            generate_doc_number(p_dokumen::text),
            v_sale_id,
            (now() AT TIME ZONE 'Asia/Jakarta')::date,
            p_customer_id,
            v_total,
            auth.uid()
        );
    END IF;

    RETURN v_sale_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Produk baru (owner): produk + satuan jual + stok awal dalam satu transaksi
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_product(
    p_name TEXT,
    p_type product_type,
    p_base_unit TEXT,
    p_buy_price INTEGER,
    p_min_stock INTEGER,
    p_initial_stock INTEGER,
    p_units JSONB                 -- [{"unit_name":"dus","multiplier":100,"sell_price":330000}, ...]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_u JSONB;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS DISTINCT FROM 'owner' THEN
        RAISE EXCEPTION 'Hanya owner yang boleh menambah produk';
    END IF;
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RAISE EXCEPTION 'Nama produk minimal 2 karakter';
    END IF;
    IF p_units IS NULL OR jsonb_typeof(p_units) <> 'array' OR jsonb_array_length(p_units) = 0 THEN
        RAISE EXCEPTION 'Minimal 1 satuan jual';
    END IF;
    IF COALESCE(p_buy_price, 0) < 0 OR COALESCE(p_initial_stock, 0) < 0 OR COALESCE(p_min_stock, 0) < 0 THEN
        RAISE EXCEPTION 'Angka tidak boleh negatif';
    END IF;

    INSERT INTO products (name, type, base_unit, buy_price, min_stock, current_stock)
    VALUES (trim(p_name), p_type, trim(p_base_unit), COALESCE(p_buy_price, 0), COALESCE(p_min_stock, 0), 0)
    RETURNING id INTO v_id;

    FOR v_u IN SELECT value FROM jsonb_array_elements(p_units)
    LOOP
        INSERT INTO product_units (product_id, unit_name, base_qty_multiplier, sell_price)
        VALUES (v_id, trim(v_u->>'unit_name'), (v_u->>'multiplier')::int, (v_u->>'sell_price')::int);
    END LOOP;

    IF COALESCE(p_initial_stock, 0) > 0 THEN
        INSERT INTO stock_movements (product_id, reason, qty_change, unit_cost, note, is_opening, created_by)
        VALUES (v_id, 'supplier', p_initial_stock, COALESCE(p_buy_price, 0), 'Stok awal', true, auth.uid());
    END IF;

    RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 7. Jadwal kirim
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_scheduled_order(
    p_customer_id UUID,
    p_delivery_date DATE,
    p_items JSONB                 -- [{"product_unit_id":"...","qty":2}, ...]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_item RECORD;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;
    IF p_delivery_date < (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
        RAISE EXCEPTION 'Tanggal kirim tidak boleh sebelum hari ini';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Minimal 1 produk';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND is_active) THEN
        RAISE EXCEPTION 'Pelanggan tidak ditemukan atau nonaktif';
    END IF;

    INSERT INTO scheduled_orders (customer_id, delivery_date, created_by)
    VALUES (p_customer_id, p_delivery_date, auth.uid())
    RETURNING id INTO v_id;

    FOR v_item IN
        SELECT (e->>'product_unit_id')::uuid AS unit_id, (e->>'qty')::int AS qty
          FROM jsonb_array_elements(p_items) AS e
    LOOP
        IF v_item.qty IS NULL OR v_item.qty < 1 THEN
            RAISE EXCEPTION 'Jumlah minimal 1';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM product_units WHERE id = v_item.unit_id) THEN
            RAISE EXCEPTION 'Produk atau satuan tidak ditemukan';
        END IF;
        INSERT INTO scheduled_order_items (order_id, product_unit_id, qty)
        VALUES (v_id, v_item.unit_id, v_item.qty);
    END LOOP;

    RETURN v_id;
END;
$$;

-- Proses jadwal -> membuat penjualan (stok berkurang) lalu status 'dikirim'
CREATE OR REPLACE FUNCTION public.process_scheduled_order(
    p_order_id UUID,
    p_saluran channel_type,
    p_catatan TEXT,
    p_dokumen document_type DEFAULT NULL
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

    v_sale := public.create_sale(v_order.customer_id, 'penjualan', p_saluran, p_catatan, v_items, p_dokumen);

    UPDATE scheduled_orders SET status = 'dikirim', sale_id = v_sale WHERE id = p_order_id;
    RETURN v_sale;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_order(p_order_id UUID) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status order_status;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;
    SELECT status INTO v_status FROM scheduled_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pesanan terjadwal tidak ditemukan';
    END IF;
    IF v_status <> 'terjadwal' THEN
        RAISE EXCEPTION 'Hanya pesanan berstatus terjadwal yang bisa dibatalkan';
    END IF;
    UPDATE scheduled_orders SET status = 'dibatalkan' WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 8. Pembatalan transaksi (owner): stok dikembalikan, dokumen ikut dibatalkan
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id UUID, p_reason TEXT) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale RECORD;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS DISTINCT FROM 'owner' THEN
        RAISE EXCEPTION 'Hanya owner yang boleh membatalkan transaksi';
    END IF;
    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Alasan pembatalan wajib diisi';
    END IF;

    SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaksi tidak ditemukan';
    END IF;
    IF v_sale.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Transaksi sudah dibatalkan sebelumnya';
    END IF;

    INSERT INTO stock_movements (product_id, reason, qty_change, unit_cost, sale_id, note, created_by)
    SELECT m.product_id, 'retur'::stock_reason, -m.qty_change, m.unit_cost, m.sale_id, 'Pembatalan transaksi', auth.uid()
      FROM stock_movements m
     WHERE m.sale_id = p_sale_id AND m.qty_change < 0 AND m.reason IN ('penjualan', 'sampel');

    UPDATE sales
       SET voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
     WHERE id = p_sale_id;

    UPDATE documents
       SET status = 'dibatalkan', cancel_reason = 'Transaksi dibatalkan: ' || trim(p_reason)
     WHERE sale_id = p_sale_id AND status <> 'dibatalkan';

    UPDATE scheduled_orders SET status = 'dibatalkan' WHERE sale_id = p_sale_id AND status <> 'dibatalkan';
END;
$$;

-- ---------------------------------------------------------------------
-- 9. Laporan
--    Transaksi yang dibatalkan (voided) tidak dihitung. Tanggal memakai WIB.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.laporan_penjualan(p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from DATE := COALESCE(p_from, DATE '2000-01-01');
    v_to DATE := COALESCE(p_to, (now() AT TIME ZONE 'Asia/Jakarta')::date);
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;

    WITH s AS (
        SELECT id, saluran, total_amount, to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS bln
          FROM sales
         WHERE jenis_transaksi = 'penjualan'
           AND voided_at IS NULL
           AND (created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    )
    SELECT jsonb_build_object(
        'ringkas', jsonb_build_object(
            'omzet', COALESCE((SELECT SUM(total_amount) FROM s), 0),
            'transaksi', (SELECT COUNT(*) FROM s),
            'diskon', COALESCE((SELECT SUM(si.discount_unit::bigint * si.qty) FROM sale_items si JOIN s ON s.id = si.sale_id), 0)
        ),
        'bulanan', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('bulan', b.bln, 'omzet', b.omzet, 'transaksi', b.n) ORDER BY b.bln)
              FROM (SELECT bln, SUM(total_amount) AS omzet, COUNT(*) AS n FROM s GROUP BY bln) b
        ), '[]'::jsonb),
        'saluran', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('saluran', c.saluran, 'omzet', c.omzet, 'transaksi', c.n) ORDER BY c.omzet DESC)
              FROM (SELECT saluran, SUM(total_amount) AS omzet, COUNT(*) AS n FROM s GROUP BY saluran) c
        ), '[]'::jsonb),
        'produk', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('nama', d.nama, 'satuan_dasar', d.base_unit, 'qty_base', d.qty_base, 'omzet', d.omzet) ORDER BY d.omzet DESC)
              FROM (
                  SELECT p.name AS nama, p.base_unit, SUM(si.qty_base) AS qty_base, SUM(si.subtotal) AS omzet
                    FROM sale_items si
                    JOIN s ON s.id = si.sale_id
                    JOIN product_units pu ON pu.id = si.product_unit_id
                    JOIN products p ON p.id = pu.product_id
                   GROUP BY p.id, p.name, p.base_unit
              ) d
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.laporan_keuangan(p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from DATE := COALESCE(p_from, DATE '2000-01-01');
    v_to DATE := COALESCE(p_to, (now() AT TIME ZONE 'Asia/Jakarta')::date);
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS DISTINCT FROM 'owner' THEN
        RAISE EXCEPTION 'Hanya owner yang boleh melihat laporan keuangan';
    END IF;

    WITH s AS (
        SELECT id, jenis_transaksi, total_amount, to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS bln
          FROM sales
         WHERE voided_at IS NULL
           AND (created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    ev AS (
        -- omzet penjualan
        SELECT s.bln AS bln, s.total_amount::bigint AS omzet, 0::bigint AS hpp, 0::bigint AS biaya_sampel,
               0::bigint AS rusak, 0::bigint AS biaya_ops, 0::bigint AS belanja
          FROM s WHERE s.jenis_transaksi = 'penjualan'
        UNION ALL
        -- modal barang yang terjual (HPP)
        SELECT s.bln, 0::bigint, si.cost_total::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint
          FROM s JOIN sale_items si ON si.sale_id = s.id WHERE s.jenis_transaksi = 'penjualan'
        UNION ALL
        -- modal barang yang dikirim sebagai sampel
        SELECT s.bln, 0::bigint, 0::bigint, si.cost_total::bigint, 0::bigint, 0::bigint, 0::bigint
          FROM s JOIN sale_items si ON si.sale_id = s.id WHERE s.jenis_transaksi = 'sampel'
        UNION ALL
        -- barang rusak
        SELECT to_char(m.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM'), 0::bigint, 0::bigint, 0::bigint,
               ((-m.qty_change)::bigint * COALESCE(m.unit_cost, 0)), 0::bigint, 0::bigint
          FROM stock_movements m
         WHERE m.reason = 'rusak'
           AND (m.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
        UNION ALL
        -- biaya operasional
        SELECT to_char(e.tanggal, 'YYYY-MM'), 0::bigint, 0::bigint, 0::bigint, 0::bigint, e.jumlah::bigint, 0::bigint
          FROM expenses e WHERE e.tanggal BETWEEN v_from AND v_to
        UNION ALL
        -- belanja stok dari supplier (stok awal tidak dihitung)
        SELECT to_char(m.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM'), 0::bigint, 0::bigint, 0::bigint,
               0::bigint, 0::bigint, (m.qty_change::bigint * COALESCE(m.unit_cost, 0))
          FROM stock_movements m
         WHERE m.reason = 'supplier' AND NOT m.is_opening
           AND (m.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    )
    SELECT jsonb_build_object(
        'total', (
            SELECT jsonb_build_object(
                'omzet', COALESCE(SUM(omzet), 0),
                'hpp', COALESCE(SUM(hpp), 0),
                'biaya_sampel', COALESCE(SUM(biaya_sampel), 0),
                'kerugian_rusak', COALESCE(SUM(rusak), 0),
                'biaya_operasional', COALESCE(SUM(biaya_ops), 0),
                'belanja_stok', COALESCE(SUM(belanja), 0)
            ) FROM ev
        ),
        'bulanan', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                       'bulan', x.bln, 'omzet', x.omzet, 'hpp', x.hpp, 'biaya_sampel', x.biaya_sampel,
                       'kerugian_rusak', x.rusak, 'biaya_operasional', x.biaya_ops, 'belanja_stok', x.belanja
                   ) ORDER BY x.bln)
              FROM (
                  SELECT bln, SUM(omzet) AS omzet, SUM(hpp) AS hpp, SUM(biaya_sampel) AS biaya_sampel,
                         SUM(rusak) AS rusak, SUM(biaya_ops) AS biaya_ops, SUM(belanja) AS belanja
                    FROM ev GROUP BY bln
              ) x
        ), '[]'::jsonb),
        'biaya_kategori', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('kategori', k.kategori, 'jumlah', k.j) ORDER BY k.j DESC)
              FROM (
                  SELECT kategori, SUM(jumlah) AS j FROM expenses
                   WHERE tanggal BETWEEN v_from AND v_to GROUP BY kategori
              ) k
        ), '[]'::jsonb),
        'produk', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('nama', d.nama, 'omzet', d.omzet, 'hpp', d.hpp) ORDER BY d.omzet DESC)
              FROM (
                  SELECT p.name AS nama, SUM(si.subtotal) AS omzet, SUM(si.cost_total) AS hpp
                    FROM sale_items si
                    JOIN s ON s.id = si.sale_id AND s.jenis_transaksi = 'penjualan'
                    JOIN product_units pu ON pu.id = si.product_unit_id
                    JOIN products p ON p.id = pu.product_id
                   GROUP BY p.id, p.name
              ) d
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------
-- 10. Hak eksekusi fungsi
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.record_stock_movement(UUID, INTEGER, stock_reason, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_sale(UUID, transaction_type, channel_type, TEXT, JSONB, document_type) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_product(TEXT, product_type, TEXT, INTEGER, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_scheduled_order(UUID, DATE, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_scheduled_order(UUID, channel_type, TEXT, document_type) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_scheduled_order(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_sale(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.laporan_penjualan(DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.laporan_keuangan(DATE, DATE) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_stock_movement(UUID, INTEGER, stock_reason, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(UUID, transaction_type, channel_type, TEXT, JSONB, document_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_product(TEXT, product_type, TEXT, INTEGER, INTEGER, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_scheduled_order(UUID, DATE, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_order(UUID, channel_type, TEXT, document_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.laporan_penjualan(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.laporan_keuangan(DATE, DATE) TO authenticated;
