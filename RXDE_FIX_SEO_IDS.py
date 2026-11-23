#!/usr/bin/env python3
"""One-time guarded patch for the original RXDE SEO scripts; backups are kept."""
from pathlib import Path
import ast
import shutil
import sys

root = Path(__file__).resolve().parent
sync = root/'sync_seo_products.py'
index = root/'build_catalog_index.py'
files = [sync, index]
if any(not x.is_file() for x in files):
    sys.exit('ERROR: Put this file beside sync_seo_products.py and build_catalog_index.py in D:\\RX.')

identity = '''# Supported URL identities: German 8-digit PZN, A/B/I + 7 digits, valid EAN-13.
ID_PATTERN = re.compile(r'(?:[0-9]{8}|[ABI][0-9]{7}|[0-9]{13})\\Z')

def valid_product_id(raw: str) -> bool:
    raw = (raw or '').strip().upper()
    if not ID_PATTERN.fullmatch(raw):
        return False
    if len(raw) != 13:
        return True
    digits = [int(ch) for ch in raw]
    check = (10 - (sum(digits[:12:2]) + 3 * sum(digits[1:12:2])) % 10) % 10
    return digits[-1] == check

def identity_label(raw: str) -> str:
    return 'EAN' if len(raw) == 13 and raw.isdigit() else ('Код' if raw[:1] in 'ABI' else 'PZN')
'''


def replace_one(s, old, new, name):
    count = s.count(old)
    if count != 1:
        raise RuntimeError(f'{name}: expected exactly one anchor, found {count}: {old[:70]}')
    return s.replace(old, new, 1)

try:
    s0 = sync.read_text(encoding='utf-8-sig')
    i0 = index.read_text(encoding='utf-8-sig')
    s = s0
    s = replace_one(s, 'if not ID_PATTERN.fullmatch(raw):', 'if not valid_product_id(raw):', 'sync filtering')
    s = replace_one(s, "ID_PATTERN = re.compile(r'[0-9]{8}\\Z')", identity.rstrip(), 'sync product-id policy')
    s = replace_one(s, "skipped.append((raw, 'non-standard PZN: needs separate URL policy'));continue", "skipped.append((raw, 'unsupported code or invalid EAN-13 checksum'));continue", 'sync skip reason')
    # The older publisher rejected empty categories; the newer publisher
    # already uses a temporary label. Both are supported.
    old_category = "    if not category:\n        raise ValueError(f'{pid}: Category is empty in db.csv; no SEO page should be created with invented category')"
    if old_category in s:
        s = replace_one(s, old_category, "    if not category:\n        category = 'Другое'  # provisional category; CSV remains unchanged", 'old category fallback')
    elif "category = (r.get('Category') or '').strip() or 'Другое'" not in s:
        raise RuntimeError('category handling is unfamiliar; refusing to modify your scripts')
    # Clarify metadata without altering dynamic product handlers, prices or product IDs.
    title_anchor = "title = f'{name} · PZN {pid} | RXDE'"
    if s.count(title_anchor) not in (1, 2):
        raise RuntimeError('page title: unexpected source version')
    s = s.replace(title_anchor, "title = f'{name} · {identity_label(pid)} {pid} | RXDE'")
    if s.count("f'PZN {pid}.', category + '.',") != 2:
        raise RuntimeError("expected both page and refresh metadata labels")
    s = s.replace("f'PZN {pid}.', category + '.',", "f'{identity_label(pid)} {pid}.', category + '.',")
    s = replace_one(s, "rf'\\g<1>PZN {pid}\\g<2>'", "rf'\\g<1>{identity_label(pid)} {pid}\\g<2>'", 'page header label')
    # Newer SEO publisher refreshes the subtitle with a lambda.
    s = s.replace("m.group(1)+'PZN '+pid+m.group(2)", "m.group(1)+identity_label(pid)+' '+pid+m.group(2)")
    n_facts = s.count("('PZN', pid),")
    if n_facts not in (1, 2):
        raise RuntimeError('product fact labels: unexpected count')
    s = s.replace("('PZN', pid),", "(identity_label(pid), pid),")
    s = replace_one(s, "f'{esc(category)} / PZN {pid}</nav>\\n')", "f'{esc(category)} / {identity_label(pid)} {pid}</nav>\\n')", 'page breadcrumbs')
    # Category-refresh breadcrumb must match the new label for newly generated cards,
    # and the existing PZN wording for previously created cards.
    # On older script breadcrumb update is category-only; on the newer one
    # all managed facts are refreshed. Preserve labels already in HTML.
    s = s.replace("r'( / PZN ' + re.escape(pid) + r'</nav>)'", "r'( / (?:PZN|EAN|Код) ' + re.escape(pid) + r'</nav>)'")
    s = s.replace("r'( / PZN '+re.escape(pid)+r'</nav>)'", "r'( / (?:PZN|EAN|Код) '+re.escape(pid)+r'</nav>)'")
    # Newer managed-card updater prints a static subtitle and uses an exact
    # breadcrumb label. Make it accept previously created PZN wording too.
    # Keep category updater's labels unchanged so manual pages remain protected.
    s = s.replace("( / PZN '+re.escape(pid)+r'</nav>)", "( / (?:PZN|EAN|Код) '+re.escape(pid)+r'</nav>)")

    # Existing generated pages have the old marker; let original updates work unchanged.

    i = i0
    index_policy = '''# Use the same identifier rules as sync_seo_products.py without importing the
# publisher (this script must remain independently executable).
PRODUCT_ID_RE = r'(?:[0-9]{8}|[ABI][0-9]{7}|[0-9]{13})'

def valid_product_id(raw):
    if not re.fullmatch(PRODUCT_ID_RE, raw):
        return False
    if len(raw) != 13:
        return True
    digits = [int(ch) for ch in raw]
    return digits[-1] == (10 - (sum(digits[:12:2]) + 3 * sum(digits[1:12:2])) % 10) % 10

def id_label(raw):
    return 'EAN' if len(raw) == 13 else ('Код' if raw[:1] in 'ABI' else 'PZN')
'''
    i = replace_one(i, 'from datetime import date\n', 'from datetime import date\n'+index_policy, 'index helper')
    i = replace_one(i, "known_products={url for url in urls if re.fullmatch(r'https://rxde\\.online/p/\\d{8}/',url)}", "known_products={url for url in urls if (m := re.fullmatch(r'https://rxde\\.online/p/('+PRODUCT_ID_RE+r')/',url)) and valid_product_id(m.group(1))}", 'index known products')
    i = replace_one(i, "re.fullmatch(r'\\d{8}',d.name)", "valid_product_id(d.name)", 'index folders')
    i = replace_one(i, "m=re.fullmatch(r'https://rxde\\.online/p/(\\d{8})/',url)\n    if not m: continue", "m=re.fullmatch(r'https://rxde\\.online/p/('+PRODUCT_ID_RE+r')/',url)\n    if not m or not valid_product_id(m.group(1)): continue", 'index URLs')
    i = replace_one(i, "match_product=re.fullmatch(r'https://rxde\\.online/p/(\\d{8})/',loc)", "match_product=re.fullmatch(r'https://rxde\\.online/p/('+PRODUCT_ID_RE+r')/',loc)", 'index sitemap cleaning')
    # Don't erase unrelated/invalid sitemap nodes; only remove known valid IDs when their HTML is missing.
    i = replace_one(i, "if (match_product and loc not in folder_products) or (match_letters and match_letters.group(1) not in created):", "if (match_product and valid_product_id(match_product.group(1)) and loc not in folder_products) or (match_letters and match_letters.group(1) not in created):", 'index prune safeguard')
    i = replace_one(i, "f'<li><a href=\"{pzn}/index.html\">{label}</a> {sub} <span class=\"meta\">PZN {pzn}</span></li>'", "f'<li><a href=\"{pzn}/index.html\">{label}</a> {sub} <span class=\"meta\">{id_label(pzn)} {pzn}</span></li>'", 'alphabet display label')

    ast.parse(s, filename=str(sync))
    ast.parse(i, filename=str(index))
    # Guarded idempotence: do not update if already patched or unexpected source version.
    if sync.with_suffix('.py.pre-id-fix.bak').exists() or index.with_suffix('.py.pre-id-fix.bak').exists():
        sys.exit('ERROR: A .pre-id-fix.bak backup already exists. No changes made; review before repeating.')
    for f in files:
        shutil.copy2(f, f.with_suffix('.py.pre-id-fix.bak'))
    sync.write_text(s, encoding='utf-8', newline='\n')
    index.write_text(i, encoding='utf-8', newline='\n')
except Exception as exc:
    sys.exit('PATCH ABORTED; original scripts not intentionally overwritten: '+str(exc))

print('SUCCESS: both SEO scripts patched. Backups: *.py.pre-id-fix.bak')
print('Supported: 8-digit PZN; A/B/I + 7 digits; valid EAN-13.')
print('No product HTML, product mapping or sitemap has been changed by this patch.')
