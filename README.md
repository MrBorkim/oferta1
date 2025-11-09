# Generator Ofert WolfTax - Zoptymalizowany

## 🚀 Szybka aplikacja do generowania ofert DOCX z podglądem JPG

### Funkcje:
- ⚡ Szybka konwersja DOCX → PDF → JPG (LibreOffice + PyMuPDF)
- 🎨 Pre-rendering szablonów JPG na starcie
- 💾 Cache dla produktów
- 🔄 Real-time WebSocket dla podglądu
- 📄 Wsparcie dla multi-file templates (WolfTax)
- 🎯 Jeden plik app.py - wszystko w środku

### Instalacja:

```bash
# Zainstaluj zależności systemowe
apt-get install -y libreoffice libreoffice-writer

# Zainstaluj zależności Python
pip install -r requirements.txt
```

### Uruchomienie:

```bash
python app.py
```

Aplikacja będzie dostępna na: `http://localhost:40207`

### Struktura projektu:

```
oferta1/
├── app.py                          # Główny plik aplikacji (WSZYSTKO TU!)
├── requirements.txt                # Zależności Python
├── templates/                      # Szablony DOCX
│   ├── wolftax-oferta/            # Szablon WolfTax (6 plików)
│   │   ├── Dok1.docx              # Strona tytułowa
│   │   ├── Doc2.docx              # Wprowadzenie (5 placeholders)
│   │   ├── doc3.docx              # Spis treści (auto-generated)
│   │   ├── doc4.docx              # Podsumowanie (2 placeholders)
│   │   ├── Dok5.docx              # Warunki
│   │   ├── Dok6.docx              # Strona końcowa
│   │   └── fields-description.json # Opis wszystkich pól
│   ├── templates.json             # Konfiguracja szablonów
│   └── wolftax-oferta-fields.json # Mapa placeholders
├── produkty/                       # Produkty/usługi (1.docx - 8.docx)
├── out_jpg/                        # Pre-renderowane JPG szablonów
├── saved_offers/                   # Zapisane oferty JSON
└── generated_offers/               # Wygenerowane oferty DOCX
```

### Konfiguracja pól WolfTax:

Wszystkie pola opisane w: `templates/wolftax-oferta/fields-description.json`

**Pola wymagane:**
- `NazwaFirmyKlienta` - Nazwa firmy klienta
- `Temat` - Temat oferty
- `Termin` - Data/termin realizacji
- `waznosc-oferty` - Ważność oferty (np. "30 dni")
- `Szacowanyczaspracy` - Czas realizacji
- `Wynagrodzenie` - Łączne wynagrodzenie

**Pola opcjonalne:**
- `Sygnatura-sprawy` - Sygnatura sprawy

### API Endpoints:

- `GET /` - Główna strona aplikacji
- `GET /api/templates` - Lista dostępnych szablonów
- `GET /api/products` - Lista produktów
- `POST /api/generate-offer` - Generuj DOCX
- `POST /api/preview-full-offer` - Generuj podgląd JPG
- `POST /api/save-offer` - Zapisz ofertę do JSON
- `GET /api/load-offer/<filename>` - Wczytaj zapisaną ofertę
- `GET /api/saved-offers` - Lista zapisanych ofert
- `GET /api/download-offer/<filename>` - Pobierz wygenerowany DOCX

### WebSocket Events:

- `conversion_progress` - Progress konwersji (message, percent)
- `page_ready` - Gotowa strona podglądu (streaming)

### Optymalizacje:

1. **PyMuPDF zamiast pdf2image** - 3x szybsza konwersja PDF → JPG
2. **Pre-rendering produktów** - cache wypełniany przy starcie
3. **Pre-rendering szablonów** - statyczne JPG w `out_jpg/`
4. **LibreOffice headless** - stabilna konwersja DOCX → PDF
5. **Thread-safe cache** - mutex dla LibreOffice
6. **Kompresja gzip** - mniejszy transfer danych
7. **WebSocket streaming** - real-time podgląd stron

### Changelog:

**v2.0 (2025-01-09):**
- ✨ Zoptymalizowany app.py (774 linii vs 1562 linii)
- ✨ Zintegrowano app4.py bezpośrednio
- ✨ PyMuPDF dla super szybkiej konwersji
- ✨ Pre-rendering JPG szablonów na starcie
- ✨ Szczegółowy JSON z opisem pól (fields-description.json)
- 🗑️ Usunięto zbędne pliki i kod
- 🚀 Znacznie szybsze działanie

### Autor:

Zoptymalizowane przez Claude (Anthropic)
