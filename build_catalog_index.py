# RXDE: one-time/static alphabetic product navigation; stdlib only.
# Run from repo root, or pass repository root as first argument.
from pathlib import Path
from urllib.parse import urlparse
from collections import defaultdict
import re, sys, html, xml.etree.ElementTree as ET
from datetime import date

root = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
sitemap = root/'sitemap.xml'
if not sitemap.is_file(): sys.exit('ОШИБКА: sitemap.xml не найден в '+str(root))
tree=ET.parse(sitemap); sr=tree.getroot(); ns='{http://www.sitemaps.org/schemas/sitemap/0.9}'
urls=[(e.findtext(ns+'loc') or '').strip() for e in sr.findall(ns+'url')]
# New product files must be discoverable even before their URLs are added to sitemap.
# This is a static build step: never invoked by visitors or price changes.
known_products={url for url in urls if re.fullmatch(r'https://rxde\.online/p/\d{8}/',url)}
folder_products={'https://rxde.online/p/'+d.name+'/' for d in (root/'p').iterdir() if d.is_dir() and re.fullmatch(r'\d{8}',d.name) and (d/'index.html').is_file()} if (root/'p').is_dir() else set()
for u in sorted(folder_products-known_products): urls.append(u)
products=[]; missing=[]
for url in urls:
    m=re.fullmatch(r'https://rxde\.online/p/(\d{8})/',url)
    if not m: continue
    pzn=m.group(1); path=root/'p'/pzn/'index.html'
    if not path.is_file(): missing.append(pzn); continue
    s=path.read_text('utf-8',errors='replace')
    title=re.search(r'<h1\b[^>]*\bid=["\']title["\'][^>]*>(.*?)</h1>',s,re.I|re.S)
    if not title: title=re.search(r'<title[^>]*>(.*?)</title>',s,re.I|re.S)
    if not title: missing.append(pzn); continue
    de=html.unescape(re.sub('<[^>]+>',' ',title.group(1))).strip()
    de=re.sub(r'\s*(?:·\s*PZN.*|\|\s*RXDE.*)$','',de,flags=re.I)
    ru=re.search(r'<p\b[^>]*\bid=["\']titleRu["\'][^>]*>(.*?)</p>',s,re.I|re.S)
    ru=html.unescape(re.sub('<[^>]+>',' ',ru.group(1))).strip() if ru else ''
    name=ru or de
    first=re.search('[А-ЯЁA-Z0-9]',name.upper())
    letter=first.group() if first else '#'
    products.append((letter,name,de,pzn))
if not products: sys.exit('ОШИБКА: нет карточек из sitemap.xml. Ничего не записано.')
if missing and len(missing) > max(5,int((len(products)+len(missing))*.02)):
    sys.exit(f'ОШИБКА: не найдены {len(missing)} страниц из sitemap.xml, например {missing[:6]}; публикация остановлена.')
products.sort(key=lambda r:(r[0],r[1].casefold(),r[3]))
groups=defaultdict(list)
for row in products: groups[row[0]].append(row)
css='''*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;background:#f4f8fa;color:#243c46}a{color:#216e94}a:hover{text-decoration:underline}.wrap{max-width:1100px;margin:auto;padding:24px 18px 70px}.head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}.brand{font-size:22px;font-weight:750;text-decoration:none;color:#244657}.brand b{border:1px solid #c6474c;border-radius:6px;padding:5px;color:#c6474c;margin-right:4px}.card{background:#fff;border:1px solid #d9e7ec;border-radius:15px;padding:20px;margin:15px 0}.nav{display:flex;flex-wrap:wrap;gap:7px}.nav a{display:inline-block;background:#eaf4f9;border:1px solid #cbdfe9;border-radius:8px;padding:5px 11px;text-decoration:none}.nav a:hover{background:#d9edf7}h1{font-size:clamp(23px,4vw,34px);line-height:1.2;margin:25px 0 10px}h2{font-size:21px}ul{list-style:none;padding:0;margin:0}li{padding:10px 0;border-bottom:1px solid #eef1f3}li:last-child{border:0}.meta{font-size:13px;color:#637b86;margin-left:7px}.muted{color:#637b86;font-size:14px}.count{color:#668; font-size:13px}'''
def page(title,body,canonical):
    return ('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<title>'+html.escape(title)+'</title><meta name="description" content="Алфавитный указатель препаратов и товаров RXDE из Германии. Названия, дозировки и ссылки на индивидуальные карточки.">'
      +'<meta name="robots" content="index,follow"><link rel="canonical" href="'+html.escape(canonical,quote=True)+'">'
      +'<style>'+css+'</style></head><body><div class="wrap"><header class="head"><a class="brand" href="../index.html"><b>RX</b> DE</a><a href="../index.html">← В каталог RXDE</a></header>'
      +body+'<footer class="muted">Справочный перечень товаров. Актуальные расчёты отображаются в карточках. Информация не заменяет назначение врача.</footer></div></body></html>\n')

def write_if_changed(path,content):
    if not path.exists() or path.read_text('utf-8') != content:
        path.write_text(content,'utf-8')
out=root/'p'; out.mkdir(exist_ok=True)
links=[]; count=0; created=[]
for letter,items in sorted(groups.items(),key=lambda x:x[0]):
    chunks=[items[i:i+250] for i in range(0,len(items),250)]
    for num,chunk in enumerate(chunks,1):
        slug= 'other' if letter=='#' else ('num' if letter.isdigit() else ('ru-'+str(ord(letter)) if 'А'<=letter<='Я' or letter=='Ё' else 'en-'+letter.lower()))
        name=slug+('-'+str(num) if num>1 else '')+'.html'
        body='<h1>Товары на букву '+html.escape(letter)+'</h1><p class="muted">'+str(len(items))+' позиций в группе. Выберите товар для просмотра описания и актуальной цены.</p><nav class="nav" aria-label="Буквы"><a href="index.html">Все буквы</a></nav><div class="card"><ul>'
        for _,ru,de,pzn in chunk:
            label=html.escape(ru); sub=(f'<span class="meta">{html.escape(de)}</span>' if ru.casefold()!=de.casefold() else '')
            body+=f'<li><a href="{pzn}/index.html">{label}</a> {sub} <span class="meta">PZN {pzn}</span></li>'
        body+='</ul></div>'
        if len(chunks)>1:
            body+='<nav class="nav" aria-label="Страницы группы">'
            for j in range(1,len(chunks)+1):
                part=slug+('-'+str(j) if j>1 else '')+'.html'
                body+=f'<a href="{part}">Страница {j}</a>'
            body+='</nav>'
        write_if_changed(out/name,page('RXDE — товары на букву '+letter,body,'https://rxde.online/p/'+name))
        created.append(name)
        count+=len(chunk)
        if num==1: links.append((letter,name,len(items)))
body='<h1>Алфавитный указатель товаров RXDE</h1><p class="muted">'+str(count)+' позиций. Выберите первую букву названия. Информация о цене обновляется в индивидуальных карточках товаров.</p>'
body+='<nav class="card nav" aria-label="Алфавит">'
for letter,name,n in links: body+=f'<a href="{name}">{html.escape(letter)} <span class="count">{n}</span></a>'
body+='</nav><p>Не нашли препарат? <a href="../index.html">Воспользуйтесь поиском в основном каталоге RXDE</a>.</p>'
write_if_changed(out/'index.html',page('Алфавитный указатель препаратов и товаров из Германии | RXDE',body,'https://rxde.online/p/'))
# Prune only generated alphabet pages that no longer have corresponding product groups.
# Never delete individual product cards or other manual files.
for stale in out.glob('*.html'):
    if stale.name != 'index.html' and re.fullmatch(r'(?:ru-\d+|en-[a-z]|num|other)(?:-\d+)?\.html',stale.name) and stale.name not in created:
        stale.unlink()
# Add the navigation index and letter pages to XML, preserving all existing product URLs.
# Reconcile old generated URLs and existing product page URLs in sitemap.
# Do not touch other entries or metadata.
for node in list(sr.findall(ns+'url')):
    loc=(node.findtext(ns+'loc') or '').strip()
    match_product=re.fullmatch(r'https://rxde\.online/p/(\d{8})/',loc)
    match_letters=re.fullmatch(r'https://rxde\.online/p/((?:ru-\d+|en-[a-z]|num|other)(?:-\d+)?\.html)',loc)
    if (match_product and loc not in folder_products) or (match_letters and match_letters.group(1) not in created):
        sr.remove(node)
existing={(node.findtext(ns+'loc') or '').strip() for node in sr.findall(ns+'url')}
extra=sorted(folder_products)+['https://rxde.online/p/']+['https://rxde.online/p/'+n for n in created]
for u in extra:
    if u not in existing:
        node=ET.SubElement(sr,ns+'url'); ET.SubElement(node,ns+'loc').text=u
ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
# XML serialization is deterministic; do not rewrite file if no URLs changed.
import io
buffer=io.BytesIO(); tree.write(buffer,encoding='utf-8',xml_declaration=True)
new_xml=buffer.getvalue()
if sitemap.read_bytes()!=new_xml: sitemap.write_bytes(new_xml)
print(f'ГОТОВО: {count} товаров, {len(created)} алфавитных страниц, p/index.html, sitemap.xml обновлён.')
if missing: print('Предупреждение: пропущено карточек:',', '.join(missing[:20]))
