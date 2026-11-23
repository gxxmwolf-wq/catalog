@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
set "PY=py -3"
where py >nul 2>nul
if errorlevel 1 set "PY=python"
echo.
echo ==============================================
echo RXDE SEO - PZN / A-B-I / EAN-13
 echo ==============================================
echo Folder: %cd%
if not exist "db.csv" (
  echo ERROR: db.csv not found in this folder.
  pause
  exit /b 2
)
if not exist "sync_seo_products.py" (
  echo ERROR: sync_seo_products.py not found.
  pause
  exit /b 2
)
if not exist "build_catalog_index.py" (
  echo ERROR: build_catalog_index.py not found.
  pause
  exit /b 2
)
echo.
echo Checking installed SEO scripts...
findstr /C:"valid_product_id" "sync_seo_products.py" >nul
if errorlevel 1 (
  echo Applying the guarded one-time patch...
  %PY% -u "RXDE_FIX_SEO_IDS.py"
  if errorlevel 1 (
    echo ERROR: patch did not complete. Original scripts were not published.
    pause
    exit /b 3
  )
) else (
  echo Product-ID patch appears installed; skipping one-time migration.
)
echo.
echo Local CSV modification date:
dir /A:-D "db.csv" | findstr /I "db.csv"
echo.
echo ==============================================
echo RXDE SEO - PREVIEW ONLY
 echo ==============================================
%PY% -u "sync_seo_products.py"
if errorlevel 1 (
  echo ERROR: preview failed. Nothing published.
  pause
  exit /b 4
)
echo.
choice /C YN /M "Create missing pages and rebuild alphabet/sitemap"
if errorlevel 2 (
  echo No changes requested.
  pause
  exit /b 0
)
echo.
echo Applying changes...
%PY% -u "sync_seo_products.py" --apply
if errorlevel 1 (
  echo ERROR: apply failed. Review output before committing.
  pause
  exit /b 5
)
echo.
echo SUCCESS. Review git status / git diff, then commit and sync to GitHub.
pause
