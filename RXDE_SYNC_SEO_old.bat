@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title RXDE SEO synchronization

if not exist "sync_seo_products.py" (
  echo ERROR: sync_seo_products.py is missing.
  goto :fail
)
if not exist "build_catalog_index.py" (
  echo ERROR: build_catalog_index.py is missing.
  goto :fail
)
if not exist "db.csv" (
  echo ERROR: db.csv is missing. Update the local database first.
  goto :fail
)
if not exist "sitemap.xml" (
  echo ERROR: sitemap.xml is missing.
  goto :fail
)

where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON=py -3"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Python 3 is not installed or is not on PATH.
    goto :fail
  )
  set "PYTHON=python"
)

echo ==============================================
echo RXDE SEO: PREVIEW ONLY - no files are modified
 echo ==============================================
%PYTHON% "sync_seo_products.py"
if errorlevel 1 goto :fail

echo.
echo Check the NEW and SKIP lists above.
echo Y = create missing pages and refresh index + sitemap.
echo N = exit without changes.
choice /C YN /N /M "Apply changes? [Y/N]: "
if errorlevel 2 goto :cancel
if errorlevel 1 goto :apply
goto :cancel

:apply
echo.
echo ==============================================
echo RXDE SEO: APPLY
 echo ==============================================
%PYTHON% "sync_seo_products.py" --apply
if errorlevel 1 goto :fail
echo.
echo SUCCESS. Check Git changes, then Commit and Sync in VS Code.
pause
exit /b 0

:cancel
echo.
echo Cancelled. No SEO changes applied.
pause
exit /b 0

:fail
echo.
echo FAILED. Do not Commit until the error is resolved.
pause
exit /b 1
