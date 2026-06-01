@echo off
echo Starting Anatomy Flash...
start "Backend" cmd /c "cd /d d:\ABstuye\server && node index.js"
timeout /t 2 /nobreak >nul
start "Frontend" cmd /c "cd /d d:\ABstuye\client && npx vite --host"
timeout /t 3 /nobreak >nul
start http://localhost:5173
echo Done! Browser opened.
