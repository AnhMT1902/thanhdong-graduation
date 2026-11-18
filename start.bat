@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0" || exit /b 1
if not exist ".env" (
  copy ".env.example" ".env" >nul
  if errorlevel 1 exit /b 1
)
docker compose up --build -d --wait
if errorlevel 1 (
  echo Docker Compose failed. Check the output above.
  pause
  exit /b 1
)
docker compose ps
if errorlevel 1 (
  pause
  exit /b 1
)
echo Open the application URL shown in README.md.
pause >nul
exit /b 0
