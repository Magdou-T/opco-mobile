@echo off
title Calculateur OPCO - Demarrage...
color 1F

echo.
echo  ========================================
echo   Calculateur de Financement OPCO
echo  ========================================
echo.
echo  Demarrage du serveur en cours...
echo  Le navigateur va s'ouvrir automatiquement.
echo.
echo  Pour arreter : fermez cette fenetre.
echo  ========================================
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo  Installation des dependances...
    echo  (premiere utilisation uniquement, patientez...)
    echo.
    call npm install
    echo.
)

:: Start the server and open browser after a delay
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

:: Run dev server (this blocks until the window is closed)
call npm run dev
