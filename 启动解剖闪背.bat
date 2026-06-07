@echo off
chcp 65001 >nul
title 解剖智学 - Anatomy Flash

echo.
echo   ╔══════════════════════════════╗
echo   ║     解 剖 智 学            ║
echo   ║   Anatomy Flash v1.0       ║
echo   ╚══════════════════════════════╝
echo.

cd /d "%~dp0"

:: Kill any existing node processes on our ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3200" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 1 /nobreak >nul

echo 🚀 正在启动后端服务...
start "解剖智学-后端" /MIN cmd /c "node server\index.js"
timeout /t 2 /nobreak >nul

echo 🎨 正在启动前端服务...
start "解剖智学-前端" /MIN cmd /c "cd client && npx vite --host"

echo.
echo ⏳ 等待服务就绪...
timeout /t 4 /nobreak >nul

:: Check backend
curl -s http://localhost:3200/api/v1/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 后端就绪: http://localhost:3200
) else (
    echo ⚠️  后端可能未启动，请检查
)

:: Check frontend
curl -s http://localhost:5173/ >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 前端就绪: http://localhost:5173
) else (
    echo ⚠️  前端可能未启动，请检查
)

echo.
echo 🎯 正在打开浏览器...
start "" http://localhost:5173/

echo.
echo 📌 关闭此窗口不会影响应用运行
echo 📌 应用数据保存在 data\anatomy.db
echo 📌 浏览器访问: http://localhost:5173
echo.
echo 按任意键隐藏此窗口...
pause >nul
