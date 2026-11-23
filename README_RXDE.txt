RXDE SEO identifier update (23 November 2026)

1. Close the old BAT window.
2. Copy RXDE_FIX_SEO_IDS.py and RXDE_SEO_FIXED.bat into D:\RX, next to
   sync_seo_products.py, build_catalog_index.py, db.csv and product.html.
3. Double-click RXDE_SEO_FIXED.bat.
4. Review the preview; press Y to generate HTML and rebuild the index and sitemap.
5. Check p\A0000003\index.html and p\4270002822559\index.html (when
   the item exists in the local CSV).
6. Review git diff and commit/sync changes.

Supported product IDs:
- 8 decimal digits (German PZN)
- A, B or I followed by exactly seven digits (country-specific internal codes)
- 13 decimal digits with a valid EAN-13 check digit

All other codes, including DHL service codes, are skipped.
A missing category is marked temporarily 'Другое' on newly generated pages;
original CSV is not modified, and a later category update can replace it.
Existing HTML product pages are not overwritten by the generator.
The patcher backs up both original Python scripts as *.py.pre-id-fix.bak.

If preview does not show a newly added product, check that its code appears
in the local D:\RX\db.csv. The script does NOT read the Google Sheet live.

The provided scripts are designed against the versions of
sync_seo_products.py (265 lines) and build_catalog_index.py (120 lines)
read from the RXDE Project. On an incompatible version the patch will stop,
without applying a partial replacement.
