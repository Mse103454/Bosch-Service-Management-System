@echo off
echo ========================================
echo Bosch Service - Executable Builder
echo ========================================
echo.

echo 1. Python ve pip kontrol ediliyor...
python --version >nul 2>&1
if errorlevel 1 (
    echo HATA: Python bulunamadi! Lutfen Python'u kurun.
    pause
    exit /b 1
)

echo Python bulundu: 
python --version

echo.
echo 2. Gerekli kutuphaneler kuruluyor...
pip install -r requirements.txt
if errorlevel 1 (
    echo HATA: Kutuphane kurulumunda hata olustu!
    pause
    exit /b 1
)

echo.
echo 3. PyInstaller kuruluyor...
pip install pyinstaller
if errorlevel 1 (
    echo HATA: PyInstaller kurulumunda hata olustu!
    pause
    exit /b 1
)

echo.
echo 4. Executable olusturuluyor...
pyinstaller --clean Bosch_Service.spec
if errorlevel 1 (
    echo HATA: Executable olusturulamadi!
    pause
    exit /b 1
)

echo.
echo ========================================
echo BASARILI! Executable olusturuldu.
echo ========================================
echo.
echo Dosya konumu: dist\Bosch_Service.exe
echo.
echo Bu dosyayi kullanicilariniza verebilirsiniz.
echo Tek tikla calisacak, kurulum gerektirmeyecek.
echo.
pause
