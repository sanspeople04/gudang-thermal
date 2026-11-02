-- =====================================================================
-- TAHAP 6: (1) data tambahan untuk invoice sesuai template (email, penandatangan, cap),
--          (2) rincian transaksi pada halaman Laporan (mengikuti filter rentang waktu).
-- Syarat: tahap3, tahap4, dan tahap5 SUDAH dijalankan. Aman dijalankan ulang.
-- Jalankan di Supabase SQL Editor (tab New query yang kosong), LALU pasang zip kode.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolom pengaturan baru
-- ---------------------------------------------------------------------
ALTER TABLE business_settings
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS signer_name TEXT,   -- nama penandatangan di atas tulisan "Hormat Kami"
    ADD COLUMN IF NOT EXISTS stamp_path TEXT;    -- gambar cap + tanda tangan (Storage: business-assets)

-- ---------------------------------------------------------------------
-- 2. Rincian transaksi penjualan pada rentang tanggal (WIB).
--    Transaksi dibatalkan tidak dihitung. Modal (HPP) hanya dikembalikan untuk owner.
--    Dipakai halaman Laporan (p_limit kecil) dan unduhan Excel/CSV (halaman 1000 baris).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.laporan_rincian(
    p_from DATE DEFAULT NULL,
    p_to DATE DEFAULT NULL,
    p_offset INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 100
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from DATE := COALESCE(p_from, DATE '2000-01-01');
    v_to DATE := COALESCE(p_to, (now() AT TIME ZONE 'Asia/Jakarta')::date);
    v_owner BOOLEAN := COALESCE(public.get_my_role() = 'owner', false);
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000);
    v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL OR public.get_my_role() IS NULL THEN
        RAISE EXCEPTION 'Tidak berwenang. Silakan login ulang.';
    END IF;

    WITH daftar AS (
        SELECT sl.id, sl.created_at, sl.saluran, sl.catatan_saluran, sl.total_amount, c.name AS pelanggan
          FROM sales sl
          LEFT JOIN customers c ON c.id = sl.customer_id
         WHERE sl.jenis_transaksi = 'penjualan'
           AND sl.voided_at IS NULL
           AND (sl.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    halaman AS (
        SELECT * FROM daftar ORDER BY created_at DESC, id LIMIT v_limit OFFSET v_offset
    ),
    item AS (
        SELECT si.sale_id,
               SUM(si.cost_total)::bigint AS hpp,
               SUM(si.discount_unit::bigint * si.qty) AS diskon,
               string_agg(p.name || ' (' || si.qty || ' ' || pu.unit_name || ')', ', ' ORDER BY p.name) AS barang
          FROM sale_items si
          JOIN product_units pu ON pu.id = si.product_unit_id
          JOIN products p ON p.id = pu.product_id
         WHERE si.sale_id IN (SELECT id FROM halaman)
         GROUP BY si.sale_id
    )
    SELECT jsonb_build_object(
        'jumlah', (SELECT COUNT(*) FROM daftar),
        'total_omzet', COALESCE((SELECT SUM(total_amount) FROM daftar), 0),
        'total_hpp', CASE WHEN v_owner
                          THEN COALESCE((SELECT SUM(si.cost_total) FROM sale_items si JOIN daftar d ON d.id = si.sale_id), 0)
                          ELSE NULL END,
        'baris', COALESCE((
            SELECT jsonb_agg(
                       jsonb_build_object(
                           'waktu', h.created_at,
                           'pelanggan', h.pelanggan,
                           'saluran', h.saluran,
                           'catatan', h.catatan_saluran,
                           'barang', i.barang,
                           'diskon', COALESCE(i.diskon, 0),
                           'omzet', h.total_amount,
                           'hpp', CASE WHEN v_owner THEN COALESCE(i.hpp, 0) ELSE NULL END
                       )
                       ORDER BY h.created_at DESC, h.id
                   )
              FROM halaman h
              LEFT JOIN item i ON i.sale_id = h.id
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.laporan_rincian(DATE, DATE, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.laporan_rincian(DATE, DATE, INTEGER, INTEGER) TO authenticated;
