#!/bin/bash
# start.sh - Skrypt startowy dla Generator Ofert

echo "════════════════════════════════════════════════════════════"
echo "🚀 GENERATOR OFERT - URUCHAMIANIE"
echo "════════════════════════════════════════════════════════════"

# Dodaj ~/.local/bin do PATH (dla unoserver)
export PATH="$HOME/.local/bin:/root/.local/bin:$PATH"

# Sprawdź czy unoserver jest zainstalowany
if ! command -v unoserver &> /dev/null; then
    echo "❌ unoserver nie znaleziony!"
    echo "Instaluję unoserver..."
    pip install --user unoserver
fi

# Sprawdź czy unoserver już działa
if pgrep -f "unoserver" > /dev/null; then
    echo "✓ Unoserver już działa"
else
    echo "🔧 Uruchamiam unoserver w tle..."
    nohup unoserver --daemon > /dev/null 2>&1 &
    sleep 2

    if pgrep -f "unoserver" > /dev/null; then
        echo "✅ Unoserver uruchomiony pomyślnie!"
    else
        echo "⚠️  Unoserver nie uruchomiony - będzie użyty LibreOffice"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🎯 URUCHAMIANIE APLIKACJI"
echo "════════════════════════════════════════════════════════════"
echo ""

# Uruchom aplikację
python3 app.py
