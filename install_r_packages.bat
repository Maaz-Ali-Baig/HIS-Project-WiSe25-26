@echo off
REM Install R packages for HIS Project
echo Installing R packages for HIS Project...
echo.

Rscript backend\R_scripts\install_packages.R

if %errorlevel% equ 0 (
    echo.
    echo R packages installed successfully!
) else (
    echo.
    echo Failed to install R packages. Make sure R is installed and in your PATH.
    echo Download R from: https://cran.r-project.org/
)

pause
