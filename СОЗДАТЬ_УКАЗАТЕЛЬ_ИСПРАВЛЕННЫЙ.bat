@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "build_catalog_index.py" (
  echo ERROR: build_catalog_index.py not found.
  pause
  exit /b 1
)
if not exist "sitemap.xml" (
  echo ERROR: sitemap.xml not found.
  pause
  exit /b 1
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "build_catalog_index.py"
) else (
  python "build_catalog_index.py"
)
if errorlevel 1 (
  echo.
  echo ERROR: index build failed.
  pause
  exit /b 1
)
echo.
echo Index build complete.
pause
