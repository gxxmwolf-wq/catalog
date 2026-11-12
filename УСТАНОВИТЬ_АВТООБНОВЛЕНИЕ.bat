@echo off
setlocal
cd /d "%~dp0"
if not exist "install_seo_hook.py" (
  echo ERROR: install_seo_hook.py not found in this folder.
  pause
  exit /b 1
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 install_seo_hook.py
) else (
  python install_seo_hook.py
)
if errorlevel 1 (
  echo.
  echo ERROR: installation failed. See messages above.
  pause
  exit /b 1
)
echo.
echo SUCCESS: Git hook installed. Check git status before Commit.
pause
