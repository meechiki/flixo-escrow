@echo off
echo.
echo ========================================
echo   FLIXO - Auto Deploy to GitHub Pages
echo ========================================
echo.

set /p msg="ใส่ข้อความ commit (หรือกด Enter เพื่อใช้ 'update'): "
if "%msg%"=="" set msg=update

echo.
echo กำลัง push โค้ดขึ้น GitHub...
git add .
git commit -m "%msg%"
git push

echo.
echo ========================================
echo   Deploy สำเร็จ! รอ 1-2 นาที แล้วเปิด
echo   https://meechiki.github.io/flixo-escrow
echo ========================================
echo.
pause
