#!/usr/bin/env python3
"""RXDE: publish *missing* individual HTML product cards from db.csv.

Usage from D:\\RX:  py -3 sync_seo_products.py            (report only)
                   py -3 sync_seo_products.py --apply    (create missing)
Requires only Python standard library. Does not change prices, existing product cards,
or the existing catalog interface. Reads the local current db.csv only.
"""
from __future__ import annotations
import argparse
import csv
import html
import json
from pathlib import Path
import re
import subprocess
import sys

SITE = 'https://rxde.online'
ID_PATTERN = re.compile(r'[0-9]{8}\Z')


def replace_once(text: str, pattern: str, replacement: str, purpose: str, flags=re.I | re.S) -> str:
    text, count = re.subn(pattern, lambda m: m.expand(replacement) if "\\g<" in replacement else replacement, text, count=1, flags=flags)
    if count != 1:
        raise ValueError(f'Template incompatible: {purpose} (matches {count})')
    return text


def esc(value: str) -> str:
    return html.escape(str(value or '').strip(), quote=True)


def make_card(template: str, r: dict[str, str], root: Path) -> str:
    pid = r['PZN'].strip()
    name = r['Name_DE'].strip()
    russian = r.get('Name_RU', '').strip()
    category = r.get('Category', '').strip() or 'Товары из Европы'
    title = f'{name} · PZN {pid} | RXDE'
    desc = ' '.join(x for x in [name + '.', russian + '.' if russian else '',
                               f'PZN {pid}.', category + '.',
                               r.get('Size', '').strip() + '.' if r.get('Size', '').strip() else '',
                               'Информация о товаре RXDE.'] if x)
    url = f'{SITE}/p/{pid}/'

    # product.html is the canonical current UI template; its search redirect
    # is only for the generic /product.html?pzn=... route and must not run here.
    s = re.sub(r'<script>\s*/\* Redirect known products to their canonical individual pages\..*?</script>\s*', '', template,
               flags=re.I | re.S)
    if '<html' not in s.lower() or 'id="pagePrice"' not in s or 'id="pageQtySlot"' not in s:
        raise ValueError('The local product.html is not the expected current RXDE template')
    s = replace_once(s, r'<title\b[^>]*>.*?</title>',
        '<title>' + esc(title) + '</title>', 'title')
    # base ensures config.js, rates.js, db-live.js and product-page.css load from root.
    # It also ensures product-generic.js resolves images and navigation correctly.
    seo_head = ('\n  <base href="../../">\n'
        f'  <link rel="canonical" href="{esc(url)}">\n'
        f'  <meta name="description" content="{esc(desc)}">\n'
        '  <meta name="robots" content="index,follow">\n'
        '  <link rel="icon" href="favicon.ico" sizes="any">\n')
    # Base MUST precede stylesheet and script references: otherwise the browser
    # resolves their URLs from /p/PZN/ before seeing <base>.
    s = replace_once(s, r'<head\b[^>]*>', '<head>' + seo_head, 'head opening tag')
    s = replace_once(s, r'<body\b[^>]*>', f'<body data-pzn="{pid}">', 'body PZN')
    s = replace_once(s, r'(<span\s+id="headSubtitle"[^>]*>).*?(</span>)',
                     rf'\g<1>PZN {pid}\g<2>', 'head subtitle')
    s = replace_once(s, r'(<h1\s+id="title"[^>]*>).*?(</h1>)',
                     rf'\g<1>{esc(name)}\g<2>', 'product title')
    s = replace_once(s, r'(<p\s+id="titleRu"[^>]*>).*?(</p>)',
                     rf'\g<1>{esc(russian)}\g<2>', 'Russian title')
    facts = [
        ('Действующее вещество', r.get('Substance_DE') or r.get('Substance_RU')),
        ('Форма', r.get('Form_DE') or r.get('Form_RU')),
        ('Дозировка', r.get('Dosage')),
        ('Упаковка', r.get('Size')),
        ('Производитель', r.get('Hersteller')),
        ('Категория', category),
        ('PZN', pid),
    ]
    facts_html = ''.join(f'<div class="generic-fact"><span>{esc(label)}</span><b>{esc(value)}</b></div>'
                         for label, value in facts if str(value or '').strip())
    s = replace_once(s, r'<div\b(?=[^>]*\bid="facts")[^>]*>\s*</div>',
                     f'<div class="generic-facts" id="facts">{facts_html}</div>', 'static product facts')
    # Existing product-generic.js attaches cart/favorite/share handlers. Keep
    # price placeholders; they are updated from db.csv on every page load.
    crumbs = ('<nav aria-label="Навигация" class="rxde-generated-crumbs" '
              'style="font-size:13px;color:#667982;margin:0 0 12px">'
              '<a href="index.html">Каталог RXDE</a> / '
              f'{esc(category)} / PZN {pid}</nav>\n')
    s = replace_once(s, r'(<div class="generic-back-row">.*?</div>)',
                     rf'\g<1>\n{crumbs}', 'breadcrumbs')
    # Include only a short truthful note; no invented composition or PDF.
    note = ('<section class="rxde-minimal-content" style="margin:26px 0 40px;line-height:1.6">'
            '<h2>Информация о товаре</h2><p>Характеристики приведены для справки. '
            'Перед применением ознакомьтесь с инструкцией производителя.</p></section>\n')
    s = replace_once(s, r'</main>', note + '</main>', 'main closing tag')
    # The generic PDF link is hidden by default; no claim that a PDF exists.
    # Images are loaded by product-generic.js from img/<PZN>.jpg if present.
    if '<base href="../../">' not in s or f'data-pzn="{pid}"' not in s:
        raise ValueError('Generated HTML failed basic validation')
    return s


def update_mapping(root: Path, ids: list[str]) -> None:
    f = root / 'product-pages.js'
    if not f.is_file():
        raise FileNotFoundError('product-pages.js not found; refusing to publish incomplete cards')
    old = f.read_text(encoding='utf-8-sig')
    m = re.search(r'window\.RXDE_PRODUCT_PAGES\s*=\s*(\{.*?\})\s*;', old, flags=re.S)
    if not m:
        raise ValueError('product-pages.js mapping format not recognized; no safe rewrite')
    current = json.loads(m.group(1))
    if not isinstance(current, dict):
        raise ValueError('Unexpected product-pages mapping')
    for pid in ids: current[pid] = True
    new_obj = json.dumps(dict(sorted(current.items())), ensure_ascii=False, separators=(',', ':'))
    new = old[:m.start(1)] + new_obj + old[m.end(1):]
    if new != old: f.write_text(new, encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser(description='RXDE: create only missing SEO product pages from local db.csv')
    parser.add_argument('--apply', action='store_true', help='Create missing pages, then refresh alphabet and sitemap')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    root = args.root.resolve()
    db = root / 'db.csv'
    templ = root / 'product.html'
    if not db.is_file() or not templ.is_file():
        print('ERROR: db.csv and product.html must exist in the same RXDE root folder:', root)
        return 2
    with db.open('r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        if not {'PZN', 'Name_DE', 'Name_RU', 'Price'}.issubset(set(reader.fieldnames or [])):
            print('ERROR: db.csv columns are not compatible with RXDE')
            return 2
        rows = list(reader)
    existing, new, skipped, duplicates = [], [], [], []
    encountered = set()
    for row in rows:
        raw = (row.get('PZN') or '').strip().upper()
        if not raw: skipped.append(('EMPTY', 'no PZN'));continue
        if raw in encountered: duplicates.append(raw);continue
        encountered.add(raw)
        if not ID_PATTERN.fullmatch(raw):
            skipped.append((raw, 'non-standard PZN: needs separate URL policy'));continue
        if not (row.get('Name_DE') or '').strip():
            skipped.append((raw, 'missing Name_DE'));continue
        target = root / 'p' / raw / 'index.html'
        (existing if target.is_file() else new).append(row)
    print(f'RXDE SEO: {len(rows)} CSV rows; {len(existing)} existing HTML cards; '
          f'{len(new)} missing cards; {len(skipped)} skipped; {len(duplicates)} duplicates')
    for r in new[:60]:
        pid = r['PZN'].strip()
        print('  NEW:', pid, (r.get('Name_RU') or r['Name_DE'])[:75],
              '[img/PZN.jpg missing]' if not (root/'img'/f'{pid}.jpg').is_file() else '')
    for raw, reason in skipped[:40]: print('  SKIP:', raw, '-', reason)
    if duplicates: print('  DUPLICATE PZN:', ', '.join(duplicates[:25]))
    if not args.apply:
        print('DRY RUN. No files changed. Run with --apply after checking the list.')
        return 0
    if duplicates:
        print('ERROR: duplicate PZN values in db.csv; no files written. Resolve first.')
        return 3
    if skipped:
        print('NOTE: skipped identifiers will NOT get SEO pages or index links in this run.')
    if not (root / 'product-pages.js').is_file() or not (root / 'build_catalog_index.py').is_file():
        print('ERROR: missing product-pages.js or build_catalog_index.py; no files written.')
        return 3
    if not (root / 'sitemap.xml').is_file():
        print('ERROR: sitemap.xml missing; no files written.')
        return 3
    template = templ.read_text(encoding='utf-8-sig')
    pages = []
    try:
        for r in new:
            pages.append((r['PZN'].strip(), make_card(template, r, root)))
    except Exception as exc:
        print('ERROR: template compatibility check failed:', exc)
        return 4
    for pid, contents in pages:
        folder = root / 'p' / pid
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / 'index.html'
        # Exclusive create: prevents accidental overwrite of existing cards.
        with path.open('x', encoding='utf-8', newline='\n') as f: f.write(contents)
    print(f'CREATED: {len(pages)} new HTML cards; no existing HTML cards overwritten.')
    try:
        update_mapping(root, [pid for pid, _ in pages])
        subprocess.run([sys.executable, str(root/'build_catalog_index.py')], cwd=root, check=True)
    except Exception as exc:
        print('ERROR: index/update failed:', exc)
        print('New cards have been created; DO NOT COMMIT until the error is fixed and the script re-run.')
        return 5
    print('SUCCESS: HTML cards + product-pages.js + alphabet + sitemap updated.')
    print('Review git diff/status in VS Code before Commit / Sync Changes.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
