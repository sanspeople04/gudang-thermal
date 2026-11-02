-- =====================================================================
-- TAHAP 3: stok masuk/keluar, arsip dokumen, pembagian role
-- Aman dijalankan ulang (idempotent). Jalankan SEKALI di Supabase SQL Editor,
-- di tab "New query" yang kosong.
--
-- PERHATIAN: bagian 3 MENGHAPUS SEMUA policy RLS di schema public lalu
-- membuatnya ulang. Jika Anda punya policy buatan sendiri, simpan dulu.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Riwayat pergerakan stok + trigger yang memperbarui products.current_stock
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    reason stock_reason NOT NULL,
    qty_change INTEGER NOT NULL,            -- satuan dasar (mis. roll). Positif = masuk, negatif = keluar
    sale_id UUID REFERENCES sales(id),
    note TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (reason = 'supplier' AND qty_change > 0) OR
        (reason IN ('penjualan', 'sampel', 'rusak') AND qty_change < 0) OR
        (reason = 'retur' AND qty_change <> 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements (created_at DESC);

CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE products SET current_stock = current_stock + NEW.qty_change
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON stock_movements;
CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- ---------------------------------------------------------------------
-- 2. Fungsi bantu
-- ---------------------------------------------------------------------
-- Role pengguna yang sedang login (NULL jika belum punya profil)
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS role_type
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Nomor dokumen: pakai zona waktu WIB, dan SECURITY DEFINER agar bisa menulis document_sequences
CREATE OR REPLACE FUNCTION generate_doc_number(doc_type TEXT) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
    v_year_month TEXT := to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM');
    v_seq INT;
    v_prefix TEXT;
BEGIN
    IF doc_type = 'invoice' THEN v_prefix := 'INV';
    ELSIF doc_type = 'faktur' THEN v_prefix := 'FKT';
    ELSE RAISE EXCEPTION 'Tipe dokumen tidak valid';
    END IF;

    INSERT INTO document_sequences (year_month) VALUES (v_year_month) ON CONFLICT DO NOTHING;

    IF doc_type = 'invoice' THEN
        UPDATE document_sequences SET invoice_seq = invoice_seq + 1
        WHERE year_month = v_year_month RETURNING invoice_seq INTO v_seq;
    ELSE
        UPDATE document_sequences SET faktur_seq = faktur_seq + 1
        WHERE year_month = v_year_month RETURNING faktur_seq INTO v_seq;
    END IF;

    RETURN v_prefix || '/' || to_char(v_date, 'YYYY/MM') || '/' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------
-- 3. RLS: aktifkan, hapus policy lama, buat policy per role
-- ---------------------------------------------------------------------
ALTER TABLE profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_product_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements            ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- profiles: semua pengguna login boleh membaca (nama dipakai di arsip). Perubahan hanya lewat server (service role).
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true);

-- business_settings: baca semua, ubah hanya owner
CREATE POLICY bs_select ON business_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY bs_update ON business_settings FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'owner') WITH CHECK (public.get_my_role() = 'owner');

-- customers: owner dan admin boleh tambah/ubah, hapus hanya owner
CREATE POLICY customers_select ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY customers_insert ON customers FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IS NOT NULL);
CREATE POLICY customers_update ON customers FOR UPDATE TO authenticated
  USING (public.get_my_role() IS NOT NULL) WITH CHECK (public.get_my_role() IS NOT NULL);
CREATE POLICY customers_delete ON customers FOR DELETE TO authenticated USING (public.get_my_role() = 'owner');

-- produk, satuan, diskon: baca semua, kelola (harga, diskon) hanya owner.
-- current_stock hanya berubah lewat trigger, bukan edit manual.
CREATE POLICY products_select ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_owner ON products FOR ALL TO authenticated
  USING (public.get_my_role() = 'owner') WITH CHECK (public.get_my_role() = 'owner');

CREATE POLICY product_units_select ON product_units FOR SELECT TO authenticated USING (true);
CREATE POLICY product_units_owner ON product_units FOR ALL TO authenticated
  USING (public.get_my_role() = 'owner') WITH CHECK (public.get_my_role() = 'owner');

CREATE POLICY cpd_select ON customer_product_discounts FOR SELECT TO authenticated USING (true);
CREATE POLICY cpd_owner ON customer_product_discounts FOR ALL TO authenticated
  USING (public.get_my_role() = 'owner') WITH CHECK (public.get_my_role() = 'owner');

-- jadwal kirim: owner dan admin boleh tambah/ubah, hapus hanya owner
CREATE POLICY so_select ON scheduled_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY so_insert ON scheduled_orders FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IS NOT NULL);
CREATE POLICY so_update ON scheduled_orders FOR UPDATE TO authenticated
  USING (public.get_my_role() IS NOT NULL) WITH CHECK (public.get_my_role() IS NOT NULL);
CREATE POLICY so_delete ON scheduled_orders FOR DELETE TO authenticated USING (public.get_my_role() = 'owner');

CREATE POLICY soi_select ON scheduled_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY soi_insert ON scheduled_order_items FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IS NOT NULL);
CREATE POLICY soi_update ON scheduled_order_items FOR UPDATE TO authenticated
  USING (public.get_my_role() IS NOT NULL) WITH CHECK (public.get_my_role() IS NOT NULL);
CREATE POLICY soi_delete ON scheduled_order_items FOR DELETE TO authenticated USING (public.get_my_role() = 'owner');

-- sales, sale_items, documents, stock_movements: HANYA BACA dari aplikasi.
-- Penulisan wajib lewat fungsi create_sale / record_stock_movement / set_document_status di bawah.
CREATE POLICY sales_select ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY sale_items_select ON sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY documents_select ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY stock_movements_select ON stock_movements FOR SELECT TO authenticated USING (true);

-- document_sequences: tanpa policy (hanya generate_doc_number yang boleh menyentuhnya)

-- ---------------------------------------------------------------------
-- 4. Fungsi transaksi (semua dalam satu transaksi database)
-- ---------------------------------------------------------------------

-- 4a. Stok masuk (supplier/retur) dan barang rusak
CREATE OR REPLACE FUNCTION public.record_stock_movement(
    p_product_unit_id UUID,
    p_qty INTEGER,
    p_reason stock_reason,
    p_note TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_unit RECORD;
    v_base INTEGER;
    v_change INTEGER;
    v_stock INTEGER;
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

    SELECT pu.product_id, pu.base_qty_multiplier, p.name
      INTO v_unit
      FROM product_units pu JOIN products p ON p.id = pu.product_id
     WHERE pu.id = p_product_unit_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produk atau satuan tidak ditemukan';
    END IF;

    v_base := p_qty * v_unit.base_qty_multiplier;
    v_change := CASE WHEN p_reason = 'rusak' THEN -v_base ELSE v_base END;

    IF v_change < 0 THEN
        SELECT current_stock INTO v_stock FROM products WHERE id = v_unit.product_id FOR UPDATE;
        IF v_stock < v_base THEN
            RAISE EXCEPTION 'Stok "%" tidak cukup: sisa %, diminta %', v_unit.name, v_stock, v_base;
        END IF;
    END IF;

    INSERT INTO stock_movements (product_id, reason, qty_change, note, created_by)
    VALUES (v_unit.product_id, p_reason, v_change, NULLIF(trim(p_note), ''), auth.uid());
END;
$$;

-- 4b. Penjualan / sampel: simpan sales + sale_items, potong stok, buat dokumen (opsional)
--     Harga & diskon diambil dari database, bukan dari kiriman browser.
CREATE OR REPLACE FUNCTION public.create_sale(
    p_customer_id UUID,
    p_jenis transaction_type,
    p_saluran channel_type,
    p_catatan TEXT,
    p_items JSONB,                  -- [{"product_unit_id": "...", "qty": 2}, ...]
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

        -- kunci baris produk lalu cek stok (nilai sudah mencakup baris sebelumnya di transaksi ini)
        SELECT current_stock INTO v_stock FROM products WHERE id = v_unit.product_id FOR UPDATE;
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

        INSERT INTO sale_items (sale_id, product_unit_id, qty, qty_base, unit_price, discount_unit, subtotal)
        VALUES (v_sale_id, v_unit.id, v_item.qty, v_base, v_price, v_disc, v_sub);

        INSERT INTO stock_movements (product_id, reason, qty_change, sale_id, created_by)
        VALUES (v_unit.product_id, p_jenis::text::stock_reason, -v_base, v_sale_id, auth.uid());

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

-- 4c. Ubah status dokumen. Aturan role ditegakkan di sini.
--     admin : draft -> terkirim
--     owner : draft/terkirim -> terkirim, lunas, dibatalkan (alasan wajib)
--     lunas dan dibatalkan bersifat final.
CREATE OR REPLACE FUNCTION public.set_document_status(
    p_id UUID,
    p_status document_status,
    p_reason TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role role_type := public.get_my_role();
    v_cur document_status;
BEGIN
    IF auth.uid() IS NULL OR v_role IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;

    SELECT status INTO v_cur FROM documents WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dokumen tidak ditemukan';
    END IF;
    IF v_cur IN ('lunas', 'dibatalkan') THEN
        RAISE EXCEPTION 'Dokumen berstatus % sudah final dan tidak bisa diubah', v_cur;
    END IF;

    IF p_status = 'terkirim' THEN
        IF v_cur <> 'draft' THEN RAISE EXCEPTION 'Hanya dokumen draft yang bisa ditandai terkirim'; END IF;
    ELSIF p_status = 'lunas' THEN
        IF v_role <> 'owner' THEN RAISE EXCEPTION 'Hanya owner yang boleh menandai lunas'; END IF;
    ELSIF p_status = 'dibatalkan' THEN
        IF v_role <> 'owner' THEN RAISE EXCEPTION 'Hanya owner yang boleh membatalkan dokumen'; END IF;
        IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RAISE EXCEPTION 'Alasan pembatalan wajib diisi'; END IF;
    ELSE
        RAISE EXCEPTION 'Status tidak diizinkan';
    END IF;

    UPDATE documents
       SET status = p_status,
           cancel_reason = CASE WHEN p_status = 'dibatalkan' THEN trim(p_reason) ELSE cancel_reason END
     WHERE id = p_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Hak eksekusi fungsi: hanya pengguna yang sudah login
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION generate_doc_number(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_stock_movement(UUID, INTEGER, stock_reason, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_sale(UUID, transaction_type, channel_type, TEXT, JSONB, document_type) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_document_status(UUID, document_status, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION generate_doc_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(UUID, INTEGER, stock_reason, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(UUID, transaction_type, channel_type, TEXT, JSONB, document_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_document_status(UUID, document_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
