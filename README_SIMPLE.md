# 🚀 Generator Ofert - Instrukcja

## ✅ APLIKACJA NAPRAWIONA I GOTOWA!

### Zmiany:
- ✅ Naprawiono IndentationError
- ✅ Usunięto zależność od docxcompose (własna funkcja merge_documents)
- ✅ Usunięto unoserver (wymaga modułu 'uno' z LibreOffice Python)
- ✅ Uproszczono kod z 1561 do 619 linii
- ✅ Pozostawiono tylko LibreOffice + PyMuPDF

## 📦 Wymagania

### Zależności systemowe:
```bash
sudo apt-get update
sudo apt-get install -y libreoffice libreoffice-writer python3 python3-pip
```

### Zależności Python:
```bash
pip install -r requirements.txt
```

## 🚀 Uruchomienie

### Metoda 1: Normalnie (interaktywnie)
```bash
./start.sh
```

### Metoda 2: W tle (daemon)
```bash
./run_background.sh

# Sprawdź logi:
tail -f app.log

# Zatrzymaj:
./stop.sh
```

### Metoda 3: Ręcznie
```bash
python3 app.py
```

## 🌐 Dostęp

Po uruchomieniu:
- http://localhost:40207
- http://127.0.0.1:40207
- http://[twoje-ip]:40207

## 📊 Wydajność

**LibreOffice headless + PyMuPDF:**
- Konwersja DOCX→PDF: ~5-10s
- Konwersja PDF→JPG: ~0.5s
- Pre-rendering produktów przy starcie
- Cache dla szybszego dostępu

## 🛠️ Rozwiązywanie problemów

### Problem: Brak LibreOffice
```bash
sudo apt-get install libreoffice libreoffice-writer
```

### Problem: Błąd konwersji
```bash
# Test LibreOffice:
soffice --headless --convert-to pdf test.docx

# Sprawdź logi:
cat app.log
```

### Problem: Port zajęty
Zmień port w `app.py` (ostatnia linia):
```python
socketio.run(app, debug=True, host='0.0.0.0', port=50207)
```

## 📝 Struktura projektu

```
oferta1/
├── app.py                  # Główna aplikacja (619 linii)
├── start.sh                # Uruchom interaktywnie
├── run_background.sh       # Uruchom w tle
├── stop.sh                 # Zatrzymaj
├── requirements.txt        # Zależności Python
├── templates/              # Szablony DOCX
│   └── wolftax-oferta/    # 6 plików + JSON z opisem
├── produkty/               # Produkty 1-8.docx
├── out_jpg/                # Pre-renderowane JPG
├── saved_offers/           # Zapisane oferty
└── generated_offers/       # Wygenerowane DOCX
```

## 🎯 Quick Start

```bash
# 1. Instalacja
pip install -r requirements.txt

# 2. Uruchomienie
./start.sh

# 3. Otwórz przeglądarkę
# http://localhost:40207
```

Gotowe! 🎉
