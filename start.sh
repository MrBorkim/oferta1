#!/bin/bash
# start.sh - Skrypt startowy dla Generator Ofert

echo "════════════════════════════════════════════════════════════"
echo "🚀 GENERATOR OFERT - URUCHAMIANIE"
echo "════════════════════════════════════════════════════════════"

# Sprawdź czy LibreOffice jest zainstalowany
if ! command -v soffice &> /dev/null; then
    echo "❌ LibreOffice nie znaleziony!"
    echo "Zainstaluj: sudo apt-get install libreoffice libreoffice-writer"
    exit 1
fi

echo "✓ LibreOffice: $(which soffice)"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "🎯 URUCHAMIANIE APLIKACJI"
echo "════════════════════════════════════════════════════════════"
echo ""

# Uruchom aplikację
python3 app.py
