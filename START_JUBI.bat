@echo off
setlocal
cd /d "%~dp0"
set "PY=.sarus-venv\Scripts\python.exe"
if exist "%PY%" goto run
if exist ".venv\Scripts\python.exe" (
  set "PY=.venv\Scripts\python.exe"
  goto run
)
where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PY=python"
    goto run
  )
  echo Install Python 3.11 or newer and enable Add Python to PATH.
  echo Run the Jubi installer first.
  pause
  exit /b 1
)
set "PY=py -3"
:run
%PY% -c "import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)"
if errorlevel 1 (
  echo Jubi requires Python 3.11 or newer.
  pause
  exit /b 1
)
echo Starting Jubi at http://127.0.0.1:8877 ...
%PY% -m jubi.server
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo Jubi stopped with exit code %RC%.
  pause
)
exit /b %RC%
