from pathlib import Path
import sys,re
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(r'D:\RX')
p=root/'p'
if not p.is_dir(): raise SystemExit(f'ОШИБКА: отсутствует {p}')
if not (root/'db-live.js').is_file(): raise SystemExit('ОШИБКА: отсутствует db-live.js рядом с index.html')
files=list(p.glob('*/index.html'))
if not files:raise SystemExit('ОШИБКА: страниц не найдено')
old=re.compile(r'<script\s+src=["\']db_local\.js(?:\?[^"\']*)?["\']\s*></script>\s*<script\s+src=["\']product-pages\.js[^"\']*["\']\s*></script>\s*<script\s+src=["\']product-generic\.js[^"\']*["\']\s*></script>',re.I)
new='<script src="db-live.js?mode=generic&amp;v=20261109"></script>'
count=already=other=0
for f in files:
 t=f.read_text(encoding='utf-8-sig')
 if old.search(t):
  nt,n=old.subn(new,t,count=1)
  if n!=1: raise SystemExit('Неожиданное совпадение: '+str(f))
  f.write_text(nt,encoding='utf-8')
  count+=1
 elif 'db-live.js?mode=generic' in t:already+=1
 else:
  other+=1
  print('НЕИЗВЕСТНЫЙ ШАБЛОН:',f)
print(f'Проверено страниц: {len(files)}; исправлено: {count}; уже исправлено: {already}; требуется ручная проверка: {other}')
if other:raise SystemExit('Есть непроверенные страницы. НЕ ПУБЛИКОВАТЬ до выяснения.')
print('Готово. Генерация медицинских данных не запускалась; заменено только подключение источника базы.')
