#!/bin/bash
# stop.sh - Zatrzymaj wszystkie serwisy

echo "🛑 Zatrzymuję Generator Ofert..."

# Zabij Flask
pkill -f "python.*app.py" && echo "✓ Zatrzymano Flask app" || echo "  Flask nie działał"

# Zabij unoserver
pkill -f "unoserver" && echo "✓ Zatrzymano unoserver" || echo "  Unoserver nie działał"

echo "✅ Wszystko zatrzymane!"
