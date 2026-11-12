"""One-time local hook setup for Git-for-Windows / VS Code. Won't overwrite hooks."""
from pathlib import Path
import subprocess, sys, shutil, os
root=Path(__file__).resolve().parent
try:
    result=subprocess.run(['git','rev-parse','--show-toplevel'],cwd=root,capture_output=True,text=True,check=True)
except (OSError,subprocess.CalledProcessError):
    sys.exit('ОШИБКА: запустите из корня клонированного Git-репозитория D:\\RX; команда git недоступна.')
repo=Path(result.stdout.strip()).resolve()
if root!=repo: sys.exit('ОШИБКА: файлы должны лежать в корне репозитория '+str(repo))
try:
    hookpath=subprocess.run(['git','rev-parse','--git-path','hooks/pre-commit'],cwd=root,capture_output=True,text=True,check=True).stdout.strip()
except subprocess.CalledProcessError as e:
    sys.exit(str(e))
target=Path(hookpath)
if not target.is_absolute(): target=(root/target).resolve()
target.parent.mkdir(parents=True,exist_ok=True)
source=root/'scripts'/'rxde-index-precommit'
if target.exists() and target.read_bytes()!=source.read_bytes():
    sys.exit('ОСТАНОВЛЕНО: уже есть другой Git pre-commit hook: '+str(target)+'\nНельзя автоматически перезаписывать его.')
shutil.copyfile(source,target)
try: target.chmod(target.stat().st_mode | 0o111)
except OSError: pass
print('ГОТОВО: перед коммитом новых p/12345678/index.html будет обновляться /p/ и sitemap.xml.')
print('Git hook: '+str(target))
print('Если новая позиция добавлена только в db.csv без HTML-карточки, этот хук не запускается.')
