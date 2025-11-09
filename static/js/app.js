// Globalne zmienne
let selectedTemplate = null;  // Wybrany szablon
let templateConfig = null;
let availableProducts = [];
let selectedProducts = [];
let formData = {};
let previewPages = [];
let currentPageIndex = 0;
let previewDebounceTimer = null;
let socket = null;

// Cache dla selektywnej regeneracji
let lastFormData = {};
let lastSelectedProducts = [];

// Auto-refresh tracking
let autoRefreshTimer = null;
let previewIsOutdated = false;
let isInitialLoad = true;  // Flag dla pierwszego ładowania

// Kanban & Custom Fields
let kanbanEnabled = false;  // Toggle dla Kanban mode
let productCustomFields = {};  // {productId: {fieldName: value}}

// Inicjalizacja aplikacji
document.addEventListener('DOMContentLoaded', async () => {
    // Pokaż ekran wyboru szablonu
    await showTemplateSelector();
});

// =============== TEMPLATE SELECTOR ===============

async function showTemplateSelector() {
    try {
        const response = await fetch('/api/templates');
        const data = await response.json();

        const container = document.getElementById('template-options');
        container.innerHTML = '';

        data.templates.forEach(template => {
            const option = document.createElement('div');
            option.className = 'template-option';
            option.dataset.templateId = template.id;

            const icon = template.id === 'aidrops' ? '📄' : '📋';
            const isNew = template.id === 'wolftax';

            option.innerHTML = `
                <div class="template-option-icon">${icon}</div>
                <div class="template-option-name">${template.name}</div>
                <div class="template-option-description">${template.description}</div>
                <div class="template-option-badges">
                    <span class="template-option-badge">${template.type === 'single_file' ? 'Klasyczny' : 'Wielostronicowy'}</span>
                    ${isNew ? '<span class="template-option-badge new">NOWY</span>' : ''}
                    ${template.supports_products ? '<span class="template-option-badge">+ Produkty</span>' : ''}
                </div>
            `;

            option.addEventListener('click', () => selectTemplate(template.id));
            container.appendChild(option);
        });
    } catch (error) {
        console.error('[ERROR] Błąd ładowania szablonów:', error);
        showNotification('Błąd ładowania szablonów', 'error');
    }
}

async function selectTemplate(templateId) {
    console.log(`[TEMPLATE] Wybrano szablon: ${templateId}`);

    // Pokaż pasek ładowania
    const selectorContent = document.querySelector('.template-selector-content');
    selectorContent.innerHTML = `
        <div style="text-align: center; color: white;">
            <div class="spinner" style="border-color: rgba(255,255,255,0.3); border-top-color: white; margin: 0 auto 20px;"></div>
            <h2>Przygotowuję szablon...</h2>
            <p style="opacity: 0.8; margin-top: 10px;">Ładowanie formularza i podglądu</p>
        </div>
    `;

    try {
        // Załaduj szczegóły szablonu + placeholders
        const response = await fetch(`/api/template/${templateId}`);
        selectedTemplate = await response.json();

        console.log('[TEMPLATE] Szczegóły:', selectedTemplate);
        console.log('[TEMPLATE] Placeholders:', selectedTemplate.discovered_placeholders);

        // Ukryj selector, pokaż app
        document.getElementById('template-selector').style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';

        // Połącz z WebSocket
        connectWebSocket();

        // Załaduj aplikację
        await initializeApp();

    } catch (error) {
        console.error('[ERROR] Błąd ładowania szablonu:', error);
        showNotification('Błąd ładowania szablonu', 'error');
    }
}

async function initializeApp() {
    // Renderuj formularz na podstawie placeholders
    renderFormFromPlaceholders();

    // Załaduj produkty
    await loadProducts();

    // Setup event listeners
    setupEventListeners();

    // Początkowy podgląd - WYMUŚ generowanie przy pierwszym starcie
    updatePreview(true); // force = true
}

function renderFormFromPlaceholders() {
    const formFields = document.getElementById('form-fields');
    formFields.innerHTML = '';

    const placeholders = selectedTemplate.discovered_placeholders;

    // Dla każdego pliku i jego placeholders
    for (const [file, data] of Object.entries(placeholders)) {
        const placeholdersList = Array.isArray(data) ? data : data.placeholders;
        const fileName = data.name || file;

        if (placeholdersList && placeholdersList.length > 0) {
            // Nagłówek sekcji (jeśli multi-file)
            if (selectedTemplate.type === 'multi_file') {
                const sectionHeader = document.createElement('h3');
                sectionHeader.textContent = `📄 ${fileName}`;
                sectionHeader.style.color = '#667eea';
                sectionHeader.style.marginTop = '20px';
                sectionHeader.style.marginBottom = '15px';
                sectionHeader.style.fontSize = '1.1em';
                formFields.appendChild(sectionHeader);
            }

            // Pola formularza
            placeholdersList.forEach(placeholder => {
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';

                const label = document.createElement('label');
                label.textContent = placeholder;
                label.htmlFor = placeholder;

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'input-field';
                input.id = placeholder;
                input.name = placeholder;
                input.placeholder = `Wprowadź ${placeholder}...`;

                // Auto-refresh
                input.addEventListener('input', () => {
                    markPreviewOutdated();
                });

                formGroup.appendChild(label);
                formGroup.appendChild(input);
                formFields.appendChild(formGroup);
            });
        }
    }
}

// Połączenie WebSocket
function connectWebSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('='.repeat(80));
        console.log('[WebSocket] ✅ POŁĄCZONO Z SERWEREM!');
        console.log('[WebSocket] Socket ID:', socket.id);
        console.log('='.repeat(80));
    });

    socket.on('conversion_progress', (data) => {
        console.log('[WebSocket] Progress:', data);
        updateProgressBar(data.message, data.percent);
    });

    socket.on('page_ready', (pageData) => {
        console.log('='.repeat(80));
        console.log('[WebSocket] 🎉 ODEBRANO EVENT: page_ready');
        console.log('[WebSocket] Strona numer:', pageData.number);
        console.log('[WebSocket] Ma obraz:', !!pageData.image);
        console.log('[WebSocket] Rozmiar obrazu:', pageData.image ? pageData.image.length : 0, 'znaków');
        console.log('='.repeat(80));
        handlePageReady(pageData);
    });

    socket.on('product_status', (data) => {
        console.log('[WebSocket] Status produktu:', data);
        updateProductStatus(data.product_id, data.status);
    });

    socket.on('disconnect', () => {
        console.log('[WebSocket] Rozłączono');
    });
}

// Aktualizuj pasek postępu
function updateProgressBar(message, percent) {
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressMessage = document.getElementById('progress-message');

    if (percent === 0) {
        // Ukryj progress bar gdy zakończono
        progressContainer.style.display = 'none';
        progressFill.style.width = '0%';
    } else {
        // Pokaż i zaktualizuj progress bar
        progressContainer.style.display = 'block';
        progressFill.style.width = percent + '%';
        progressMessage.textContent = message;
    }
}

// Obsługa gotowej strony (streaming)
function handlePageReady(pageData) {
    console.log(`[WebSocket] ========== Otrzymano stronę ${pageData.number} ==========`);
    console.log('[WebSocket] pageData:', pageData);
    console.log('[WebSocket] Obecne previewPages:', previewPages.length);

    // Znajdź stronę w tablicy lub dodaj
    let existingPage = previewPages.find(p => p.number === pageData.number);

    if (existingPage) {
        console.log('[WebSocket] Aktualizuję istniejącą stronę');
        // Aktualizuj istniejącą stronę
        existingPage.image = pageData.image;
        existingPage.status = 'ready';
        existingPage.has_image = true;
    } else {
        console.log('[WebSocket] Dodaję nową stronę do tablicy');
        // Dodaj nową stronę
        previewPages.push(pageData);
    }

    // Sortuj strony po numerze
    previewPages.sort((a, b) => a.number - b.number);
    console.log('[WebSocket] Strony po sortowaniu:', previewPages.map(p => `${p.number}(${p.status})`).join(', '));

    // Aktualizuj zakładki stron
    console.log('[WebSocket] Renderuję zakładki...');
    renderPagesTabs();

    // POKAZUJ STRONĘ OD RAZU!
    const previewPage = document.getElementById('preview-page');
    const hasPlaceholder = previewPage.querySelector('.preview-placeholder');

    console.log('[WebSocket] hasPlaceholder:', !!hasPlaceholder);
    console.log('[WebSocket] currentPageIndex:', currentPageIndex);

    // Jeśli to strona 1 i mamy placeholder - POKAŻ!
    if (pageData.number === 1) {
        console.log('[WebSocket] ⚡ To jest strona 1 - POKAZUJĘ JĄ!');
        currentPageIndex = 0;
        showPage(0);
    }
    // Jeśli użytkownik patrzy na tę stronę która właśnie przyszła - odśwież
    else if (currentPageIndex === pageData.number - 1) {
        console.log('[WebSocket] ⚡ Użytkownik patrzy na tę stronę - odświeżam!');
        showPage(currentPageIndex);
    }
    // Jeśli to kolejna strona po currentPageIndex - automatycznie przejdź
    else if (pageData.number === currentPageIndex + 2 && !hasPlaceholder) {
        console.log('[WebSocket] ⚡ Automatycznie przechodzę do następnej strony!');
        currentPageIndex++;
        showPage(currentPageIndex);
    }

    console.log(`[WebSocket] ✓ Strona ${pageData.number} gotowa (${previewPages.length} stron w cache)`);
    console.log('[WebSocket] ==============================================');
}

// Oznacz podgląd jako nieaktualny
function markPreviewOutdated() {
    // Ignoruj jeśli to pierwsze ładowanie
    if (isInitialLoad) {
        return;
    }

    previewIsOutdated = true;
    showOutdatedWarning();

    // Auto-refresh po 2 sekundach bezczynności
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = setTimeout(() => {
        console.log('[AUTO-REFRESH] Odświeżam podgląd po 2s bezczynności');
        updatePreview();
    }, 2000);
}

// Pokazywanie / ukrywanie warning
function showOutdatedWarning() {
    let warning = document.getElementById('outdated-warning');
    if (!warning) {
        warning = document.createElement('div');
        warning.id = 'outdated-warning';
        warning.className = 'outdated-warning';
        warning.innerHTML = `
            <span class="warning-icon">⚠️</span>
            <span class="warning-text">Podgląd nieaktualny - odświeżam za <span id="countdown">2</span>s...</span>
            <button id="refresh-now" class="btn-refresh-now">Odśwież teraz</button>
        `;
        document.querySelector('.preview-container').prepend(warning);

        document.getElementById('refresh-now').addEventListener('click', () => {
            clearTimeout(autoRefreshTimer);
            updatePreview();
        });
    }

    warning.style.display = 'flex';

    // Countdown
    let countdown = 2;
    const countdownEl = document.getElementById('countdown');
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) {
            countdownEl.textContent = countdown;
        }
        if (countdown <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function hideOutdatedWarning() {
    const warning = document.getElementById('outdated-warning');
    if (warning) {
        warning.style.display = 'none';
    }
    previewIsOutdated = false;
}


// Aktualizuj status produktu
function updateProductStatus(productId, status) {
    // Znajdź wszystkie strony tego produktu i aktualizuj ich zakładki
    const productPages = previewPages.filter(p => p.product_id === productId);

    productPages.forEach(page => {
        const tab = document.querySelector(`.page-tab[data-page-number="${page.number}"]`);
        if (tab) {
            tab.classList.remove('pending', 'generating', 'ready');
            tab.classList.add(status);

            if (status === 'generating') {
                // Dodaj mini spinner
                if (!tab.querySelector('.mini-spinner')) {
                    const spinner = document.createElement('span');
                    spinner.className = 'mini-spinner';
                    tab.appendChild(spinner);
                }
            } else if (status === 'ready') {
                // Usuń spinner
                const spinner = tab.querySelector('.mini-spinner');
                if (spinner) spinner.remove();
            }
        }
    });
}

// Załaduj konfigurację szablonu
async function loadTemplateConfig() {
    try {
        const response = await fetch('/api/template-config');
        templateConfig = await response.json();
        renderForm();
    } catch (error) {
        showNotification('Błąd ładowania konfiguracji szablonu', 'error');
        console.error(error);
    }
}

// Załaduj listę produktów
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        availableProducts = await response.json();
        renderProducts();
    } catch (error) {
        showNotification('Błąd ładowania produktów', 'error');
        console.error(error);
    }
}

// Renderuj formularz na podstawie konfiguracji
function renderForm() {
    const formFields = document.getElementById('form-fields');
    formFields.innerHTML = '';

    const placeholders = templateConfig.placeholders;

    for (const [key, config] of Object.entries(placeholders)) {
        if (key === 'produkty') continue;

        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = key;
        label.innerHTML = config.label;

        if (config.required) {
            const required = document.createElement('span');
            required.className = 'required';
            required.textContent = '*';
            label.appendChild(required);
        }

        let input;

        switch (config.type) {
            case 'textarea':
                input = document.createElement('textarea');
                input.className = 'textarea-field';
                input.rows = 4;
                break;
            case 'date':
                input = document.createElement('input');
                input.type = 'date';
                input.className = 'input-field';
                input.value = new Date().toISOString().split('T')[0];
                break;
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.step = '0.01';
                input.className = 'input-field';
                break;
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'input-field';
        }

        input.id = key;
        input.name = key;
        input.required = config.required || false;

        // AUTO-REFRESH: Oznacz jako nieaktualny i auto-refresh po 2s
        input.addEventListener('input', () => {
            markPreviewOutdated();
        });

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formFields.appendChild(formGroup);
    }
}

// Renderuj produkty
function renderProducts() {
    const productsList = document.getElementById('products-list');
    productsList.innerHTML = '';

    availableProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.productId = product.id;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `product-${product.id}`;
        checkbox.value = product.id;

        const name = document.createElement('div');
        name.className = 'product-name';
        name.textContent = product.name;

        const id = document.createElement('div');
        id.className = 'product-id';
        id.textContent = `ID: ${product.id}`;

        // Jeśli produkt ma custom fields, dodaj ikonkę
        if (product.has_custom_fields) {
            const badge = document.createElement('span');
            badge.className = 'custom-fields-badge';
            badge.textContent = '⚙️';
            badge.title = `Wymaga wypełnienia: ${product.placeholders.join(', ')}`;
            name.appendChild(badge);
        }

        card.appendChild(checkbox);
        card.appendChild(name);
        card.appendChild(id);

        card.addEventListener('click', (e) => {
            // Jeśli kliknięto badge, pokaż formularz custom fields
            if (e.target.classList.contains('custom-fields-badge')) {
                e.stopPropagation();
                showCustomFieldsModal(product);
                return;
            }

            toggleProduct(product.id, card);
            // AUTO-REFRESH przy zmianie produktów
            markPreviewOutdated();
        });

        productsList.appendChild(card);
    });
}

// Przełącz wybór produktu
function toggleProduct(productId, card) {
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;

    if (checkbox.checked) {
        card.classList.add('selected');
        if (!selectedProducts.includes(productId)) {
            selectedProducts.push(productId);
        }
    } else {
        card.classList.remove('selected');
        selectedProducts = selectedProducts.filter(id => id !== productId);
    }
}

// Zbierz dane z formularza
function collectFormData() {
    const form = document.getElementById('offer-form');
    const data = {};

    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        data[input.name] = input.value;
    });

    return data;
}

// Sprawdź czy dane formularza się zmieniły
function hasFormDataChanged(newData) {
    const oldKeys = Object.keys(lastFormData);
    const newKeys = Object.keys(newData);

    if (oldKeys.length !== newKeys.length) return true;

    for (const key of newKeys) {
        if (lastFormData[key] !== newData[key]) {
            return true;
        }
    }

    return false;
}

// Sprawdź czy produkty się zmieniły
function hasProductsChanged(newProducts) {
    if (lastSelectedProducts.length !== newProducts.length) return true;

    for (let i = 0; i < newProducts.length; i++) {
        if (lastSelectedProducts[i] !== newProducts[i]) {
            return true;
        }
    }

    return false;
}

// Wykryj zmiany i określ co wymaga regeneracji
function detectChanges() {
    const currentFormData = collectFormData();
    const currentProducts = [...selectedProducts];

    const changes = {
        templateChanged: hasFormDataChanged(currentFormData),
        productsChanged: hasProductsChanged(currentProducts),
        addedProducts: [],
        removedProducts: []
    };

    // Wykryj dodane produkty
    for (const product of currentProducts) {
        if (!lastSelectedProducts.includes(product)) {
            changes.addedProducts.push(product);
        }
    }

    // Wykryj usunięte produkty
    for (const product of lastSelectedProducts) {
        if (!currentProducts.includes(product)) {
            changes.removedProducts.push(product);
        }
    }

    return changes;
}

// Aktualizuj podgląd z debounce (opóźnienie aby nie wysyłać za dużo requestów)
function debouncePreviewUpdate() {
    clearTimeout(previewDebounceTimer);

    // Pokaż informację "Pracuję nad zmianami..."
    const previewPage = document.getElementById('preview-page');
    previewPage.innerHTML = `
        <div class="preview-placeholder">
            <div class="spinner"></div>
            <p>Przygotowuję podgląd...</p>
            <p class="hint">Zmiany zostaną wyświetlone za chwilę</p>
        </div>
    `;

    previewDebounceTimer = setTimeout(() => {
        updatePreview();
    }, 2000); // 2s opóźnienia - nie generuj przy każdej literze!
}

// Aktualizuj podgląd
async function updatePreview(force = false) {
    formData = collectFormData();

    // Wykryj zmiany
    const changes = detectChanges();
    console.log('[DEBUG] Wykryte zmiany:', changes);

    // Jeśli nic się nie zmieniło, nie regeneruj (chyba że force=true)
    if (!force && !changes.templateChanged && !changes.productsChanged) {
        console.log('[DEBUG] Brak zmian - pomijam regenerację');
        return;
    }

    const data = {
        templateId: selectedTemplate?.id || 'aidrops',  // WAŻNE: Wyślij ID szablonu!
        templateData: selectedTemplate,  // Pełne dane szablonu
        formData: formData,
        selectedProducts: selectedProducts,
        productCustomFields: productCustomFields,
        streaming: true,
        changes: {
            templateChanged: changes.templateChanged,
            productsChanged: changes.productsChanged,
            addedProducts: changes.addedProducts,
            removedProducts: changes.removedProducts
        }
    };

    console.log('[DEBUG] Wysyłam request do /api/preview-full-offer (STREAMING)');

    // Wyczyść poprzednie strony
    previewPages = [];
    currentPageIndex = 0;

    // Pokaż loading spinner
    const previewPage = document.getElementById('preview-page');
    previewPage.innerHTML = `
        <div class="preview-placeholder">
            <div class="spinner"></div>
            <p>⚡ Generowanie podglądu...</p>
            <p class="hint">Strony będą pojawiać się w miarę gotowości</p>
            <p class="hint-small">Pierwsze strony już za chwilę!</p>
        </div>
    `;

    // Wyczyść zakładki
    document.getElementById('pages-tabs').innerHTML = '<div class="hint">Ładowanie stron...</div>';

    try {
        const response = await fetch('/api/preview-full-offer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log('[DEBUG] Streaming response:', result);

        if (result.success) {
            // Metadane otrzymane - strony będą przychodzić przez WebSocket
            console.log(`[DEBUG] Oczekuję na ${result.total_pages} stron przez WebSocket`);

            // Inicjalizuj WSZYSTKIE strony z metadanych
            if (result.pages_metadata) {
                previewPages = result.pages_metadata.map(meta => ({
                    ...meta,
                    // WAŻNE: Metadane nie mają obrazów! Obrazy przyjdą przez WebSocket
                    has_image: false,
                    image: null,
                    status: 'pending'  // Ustaw jako pending - zaktualizuje się jak przyjdzie WebSocket
                }));

                console.log('[DEBUG] Zainicjowano', previewPages.length, 'stron (czekam na WebSocket)');

                // Renderuj zakładki (będą wyszarzone - pending)
                renderPagesTabs();

                // NIE POKAZUJ jeszcze - poczekaj na WebSocket!
            }

            // Zaktualizuj cache dla kolejnych porównań
            lastFormData = {...formData};
            lastSelectedProducts = [...selectedProducts];
            console.log('[DEBUG] Zaktualizowano cache zmian');

            // Ukryj warning i oznacz że to już nie initial load
            hideOutdatedWarning();
            isInitialLoad = false;
        }
    } catch (error) {
        console.error('[ERROR] Błąd aktualizacji podglądu:', error);
        previewPage.innerHTML = `
            <div class="preview-placeholder">
                <p>Błąd generowania podglądu</p>
                <p class="hint">Sprawdź logi serwera lub odśwież stronę</p>
            </div>
        `;
    }
}

// Renderuj zakładki stron
function renderPagesTabs() {
    const pagesTabs = document.getElementById('pages-tabs');
    pagesTabs.innerHTML = '';

    previewPages.forEach((page, index) => {
        const tab = document.createElement('button');
        tab.className = 'page-tab';
        tab.dataset.pageNumber = page.number;

        // Dodaj status do klasy
        if (page.status) {
            tab.classList.add(page.status);
        }

        // Tekst zakładki
        let tabText = '';
        if (page.type === 'template') {
            tabText = `Str. ${page.number}`;
        } else {
            tabText = `Str. ${page.number}`;
        }

        // Dodaj ikony statusu
        let statusIcon = '';
        if (page.status === 'ready') {
            statusIcon = '<span class="status-icon ready">✓</span>';
        } else if (page.status === 'generating') {
            statusIcon = '<span class="status-icon generating">⟳</span>';
        } else if (page.status === 'pending') {
            statusIcon = '<span class="status-icon pending">⏳</span>';
        }

        tab.innerHTML = `${statusIcon}<span class="tab-text">${tabText}</span>`;

        // Dodaj mini spinner dla stron pending/generating
        if (page.status === 'pending' || page.status === 'generating') {
            const spinner = document.createElement('span');
            spinner.className = 'mini-spinner';
            tab.appendChild(spinner);
        }

        // Tylko ready strony są klikalne
        if (page.status === 'ready') {
            tab.addEventListener('click', () => showPage(index));
        } else {
            tab.style.cursor = 'not-allowed';
            tab.style.opacity = '0.5';
        }

        pagesTabs.appendChild(tab);
    });

    updatePageCounter();
}

// Pokaż konkretną stronę
async function showPage(index) {
    if (index < 0 || index >= previewPages.length) return;

    currentPageIndex = index;
    const page = previewPages[index];

    const previewPage = document.getElementById('preview-page');

    // Lazy loading: jeśli strona nie ma obrazu, pobierz go
    if (page.has_image && !page.image) {
        console.log('[DEBUG] Lazy loading strony', index);
        previewPage.innerHTML = `
            <div class="preview-placeholder">
                <div class="spinner"></div>
                <p>Ładowanie strony ${page.number}...</p>
            </div>
        `;

        try {
            const response = await fetch('/api/load-page', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    type: page.type,
                    page_index: page.page_index,
                    product_id: page.product_id,
                    formData: formData
                })
            });

            const result = await response.json();

            if (result.success && result.image) {
                page.image = result.image;  // Zapisz w cache frontendu
                console.log('[DEBUG] Strona załadowana z serwera');
            }
        } catch (error) {
            console.error('[ERROR] Błąd lazy loading:', error);
        }
    }

    // Wyświetl obraz zamiast HTML
    if (page.image) {
        console.log('[DEBUG] Pokazuję obraz strony', page.number);
        previewPage.innerHTML = `<img src="${page.image}" alt="Strona ${page.number}" style="width: 100%; height: auto; display: block; margin: 0 auto;">`;
    } else if (page.status === 'pending' || page.status === 'generating') {
        // Strona jeszcze się generuje - pokaż spinner
        console.log('[DEBUG] Strona', page.number, 'jeszcze się generuje');
        previewPage.innerHTML = `
            <div class="preview-placeholder">
                <div class="spinner"></div>
                <p>Generowanie strony ${page.number}...</p>
                <p class="hint">Strona pojawi się za chwilę</p>
            </div>
        `;
    } else if (page.html) {
        // Fallback do HTML jeśli nie ma obrazu
        previewPage.innerHTML = page.html;
    } else {
        console.error('[ERROR] Strona', page.number, 'nie ma obrazu ani HTML!', page);
        previewPage.innerHTML = '<div class="preview-placeholder"><p>Błąd ładowania strony</p></div>';
    }

    // Aktualizuj aktywną zakładkę
    document.querySelectorAll('.page-tab').forEach((tab, i) => {
        if (i === index) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Aktualizuj przyciski nawigacji
    document.getElementById('btn-prev-page').disabled = (index === 0);
    document.getElementById('btn-next-page').disabled = (index === previewPages.length - 1);

    updatePageCounter();

    // Pre-load sąsiednich stron (prefetch)
    prefetchAdjacentPages(index);
}

// Pre-ładuj sąsiednie strony dla płynnej nawigacji
async function prefetchAdjacentPages(currentIndex) {
    const toPreload = [currentIndex - 1, currentIndex + 1];

    for (const idx of toPreload) {
        if (idx >= 0 && idx < previewPages.length) {
            const page = previewPages[idx];

            if (page.has_image && !page.image) {
                console.log('[DEBUG] Prefetch strony', idx);

                try {
                    const response = await fetch('/api/load-page', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            type: page.type,
                            page_index: page.page_index,
                            product_id: page.product_id,
                            formData: formData
                        })
                    });

                    const result = await response.json();

                    if (result.success && result.image) {
                        page.image = result.image;
                        console.log('[DEBUG] Prefetch OK dla strony', idx);
                    }
                } catch (error) {
                    console.error('[ERROR] Błąd prefetch:', error);
                }
            }
        }
    }
}

// Aktualizuj licznik stron
function updatePageCounter() {
    const counter = document.getElementById('page-counter');
    if (previewPages.length > 0) {
        counter.textContent = `Strona ${currentPageIndex + 1} z ${previewPages.length}`;
    } else {
        counter.textContent = 'Brak stron';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Odśwież podgląd
    document.getElementById('btn-refresh-preview').addEventListener('click', () => {
        updatePreview();
        showNotification('Podgląd odświeżony', 'info');
    });

    // Nawigacja stron
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        showPage(currentPageIndex - 1);
    });

    document.getElementById('btn-next-page').addEventListener('click', () => {
        showPage(currentPageIndex + 1);
    });

    // Zapisz ofertę
    document.getElementById('btn-save').addEventListener('click', () => {
        openSaveModal();
    });

    // Wczytaj ofertę
    document.getElementById('btn-load').addEventListener('click', async () => {
        await openLoadModal();
    });

    // Generuj DOCX
    document.getElementById('btn-generate').addEventListener('click', async () => {
        await generateOffer();
    });

    // Modal save
    const saveModal = document.getElementById('save-modal');
    const saveClose = saveModal.querySelector('.close');

    saveClose.addEventListener('click', () => {
        saveModal.style.display = 'none';
    });

    document.getElementById('btn-confirm-save').addEventListener('click', async () => {
        await saveOffer();
    });

    // Modal load
    const loadModal = document.getElementById('load-modal');
    const loadClose = loadModal.querySelector('.close');

    loadClose.addEventListener('click', () => {
        loadModal.style.display = 'none';
    });

    // Zamknij modal po kliknięciu poza nim
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// Otwórz modal zapisu
function openSaveModal() {
    const modal = document.getElementById('save-modal');
    const input = document.getElementById('offer-name');

    const now = new Date();
    const defaultName = `oferta_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    input.value = defaultName;
    modal.style.display = 'block';
    input.focus();
}

// Zapisz ofertę
async function saveOffer() {
    const offerName = document.getElementById('offer-name').value.trim();

    if (!offerName) {
        showNotification('Proszę podać nazwę oferty', 'error');
        return;
    }

    formData = collectFormData();

    const data = {
        offer_name: offerName,
        formData: formData,
        selectedProducts: selectedProducts
    };

    try {
        const response = await fetch('/api/save-offer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showNotification(`Oferta zapisana: ${result.filename}`, 'success');
            document.getElementById('save-modal').style.display = 'none';
        } else {
            showNotification('Błąd zapisu oferty', 'error');
        }
    } catch (error) {
        showNotification('Błąd komunikacji z serwerem', 'error');
        console.error(error);
    }
}

// Otwórz modal wczytywania
async function openLoadModal() {
    const modal = document.getElementById('load-modal');
    const list = document.getElementById('saved-offers-list');

    try {
        const response = await fetch('/api/saved-offers');
        const offers = await response.json();

        list.innerHTML = '';

        if (offers.length === 0) {
            list.innerHTML = '<p class="info-text">Brak zapisanych ofert</p>';
        } else {
            offers.forEach(offer => {
                const item = document.createElement('div');
                item.className = 'saved-offer-item';

                const info = document.createElement('div');
                info.className = 'saved-offer-info';

                const name = document.createElement('h3');
                name.textContent = offer.name;

                const date = document.createElement('p');
                date.textContent = `Zmodyfikowano: ${offer.modified}`;

                info.appendChild(name);
                info.appendChild(date);
                item.appendChild(info);

                item.addEventListener('click', () => loadOffer(offer.filename));

                list.appendChild(item);
            });
        }

        modal.style.display = 'block';
    } catch (error) {
        showNotification('Błąd ładowania listy ofert', 'error');
        console.error(error);
    }
}

// Wczytaj ofertę
async function loadOffer(filename) {
    try {
        const response = await fetch(`/api/load-offer/${filename}`);
        const data = await response.json();

        if (data.formData) {
            for (const [key, value] of Object.entries(data.formData)) {
                const input = document.getElementById(key);
                if (input) {
                    input.value = value;
                }
            }
        }

        if (data.selectedProducts) {
            selectedProducts = data.selectedProducts;

            document.querySelectorAll('.product-card').forEach(card => {
                const productId = card.dataset.productId;
                const checkbox = card.querySelector('input[type="checkbox"]');

                if (selectedProducts.includes(productId)) {
                    card.classList.add('selected');
                    checkbox.checked = true;
                } else {
                    card.classList.remove('selected');
                    checkbox.checked = false;
                }
            });
        }

        document.getElementById('load-modal').style.display = 'none';
        showNotification('Oferta wczytana pomyślnie', 'success');

        // Aktualizuj podgląd
        updatePreview();
    } catch (error) {
        showNotification('Błąd wczytywania oferty', 'error');
        console.error(error);
    }
}

// Generuj ofertę
async function generateOffer() {
    formData = collectFormData();

    const form = document.getElementById('offer-form');
    if (!form.checkValidity()) {
        showNotification('Proszę wypełnić wszystkie wymagane pola', 'error');
        form.reportValidity();
        return;
    }

    if (selectedProducts.length === 0) {
        if (!confirm('Nie wybrano żadnych produktów. Kontynuować?')) {
            return;
        }
    }

    const data = {
        templateId: selectedTemplate?.id || 'aidrops',
        templateData: selectedTemplate,
        formData: formData,
        selectedProducts: selectedProducts,
        productCustomFields: productCustomFields
    };

    try {
        // Progress bar obsługiwany przez WebSocket automatycznie!
        console.log('[DEBUG] Generowanie dokumentu DOCX...');

        const response = await fetch('/api/generate-offer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            const time = result.generation_time || '?';
            showNotification(`✅ Dokument wygenerowany w ${time}!`, 'success');

            // Poczekaj chwilę aby użytkownik zobaczył notyfikację
            setTimeout(() => {
                window.location.href = result.download_url;
            }, 800);
        } else {
            showNotification(`❌ Błąd generowania: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification('❌ Błąd komunikacji z serwerem', 'error');
        console.error(error);
    }
}

// Pokaż notyfikację
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 4000);
}

// =============== CUSTOM FIELDS & KANBAN MODULE ===============

// Pokaż modal z custom fields dla produktu
function showCustomFieldsModal(product) {
    let modal = document.getElementById('custom-fields-modal');

    if (!modal) {
        // Stwórz modal jeśli nie istnieje
        modal = document.createElement('div');
        modal.id = 'custom-fields-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Uzupełnij pola dla: <span id="cf-product-name"></span></h2>
                <div id="custom-fields-form"></div>
                <button class="btn btn-success" id="save-custom-fields">Zapisz</button>
            </div>
        `;
        document.body.appendChild(modal);

        // Close button
        modal.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Wypełnij formularz
    document.getElementById('cf-product-name').textContent = product.name;
    const form = document.getElementById('custom-fields-form');
    form.innerHTML = '';
    form.dataset.productId = product.id;

    product.placeholders.forEach(placeholder => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = placeholder;
        label.htmlFor = `cf-${product.id}-${placeholder}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-field';
        input.id = `cf-${product.id}-${placeholder}`;
        input.name = placeholder;
        input.placeholder = `Wprowadź ${placeholder}...`;

        // Załaduj zapisaną wartość jeśli istnieje
        if (productCustomFields[product.id] && productCustomFields[product.id][placeholder]) {
            input.value = productCustomFields[product.id][placeholder];
        }

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        form.appendChild(formGroup);
    });

    // Save button
    document.getElementById('save-custom-fields').onclick = () => {
        saveCustomFields(product.id);
        modal.style.display = 'none';
        markPreviewOutdated();  // Odśwież podgląd
    };

    modal.style.display = 'block';
}

// Zapisz custom fields dla produktu
function saveCustomFields(productId) {
    const form = document.getElementById('custom-fields-form');
    const inputs = form.querySelectorAll('input');

    if (!productCustomFields[productId]) {
        productCustomFields[productId] = {};
    }

    inputs.forEach(input => {
        productCustomFields[productId][input.name] = input.value;
    });

    console.log(`[CUSTOM FIELDS] Zapisano dla produktu ${productId}:`, productCustomFields[productId]);
    showNotification(`✓ Zapisano dane dodatkowe dla produktu ${productId}`, 'success');
}

// Toggle Kanban Mode
function toggleKanbanMode() {
    kanbanEnabled = !kanbanEnabled;

    const kanbanView = document.getElementById('kanban-view');
    const normalView = document.querySelector('.pages-navigation');

    if (kanbanEnabled) {
        // Przełącz na widok Kanban
        if (kanbanView) kanbanView.style.display = 'flex';
        if (normalView) normalView.style.display = 'none';

        renderKanbanBoard();
        showNotification('📋 Tryb Kanban włączony', 'info');
    } else {
        // Przełącz na widok normalny
        if (kanbanView) kanbanView.style.display = 'none';
        if (normalView) normalView.style.display = 'flex';

        showNotification('📄 Tryb standardowy włączony', 'info');
    }
}

// Renderuj tablicę Kanban
function renderKanbanBoard() {
    let kanbanView = document.getElementById('kanban-view');

    if (!kanbanView) {
        // Stwórz kontener Kanban
        kanbanView = document.createElement('div');
        kanbanView.id = 'kanban-view';
        kanbanView.className = 'kanban-container';

        const previewContainer = document.querySelector('.preview-container');
        previewContainer.insertBefore(kanbanView, previewContainer.firstChild);
    }

    kanbanView.innerHTML = '';

    // Grupuj strony
    const templatePages = previewPages.filter(p => p.type === 'template');
    const productPages = previewPages.filter(p => p.type === 'product');

    // Kolumna: Szablon
    const templateColumn = createKanbanColumn('Szablon', templatePages, 'template');
    kanbanView.appendChild(templateColumn);

    // Kolumna: Produkty
    const productsColumn = createKanbanColumn('Produkty', productPages, 'products');
    kanbanView.appendChild(productsColumn);
}

// Stwórz kolumnę Kanban
function createKanbanColumn(title, pages, columnType) {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.dataset.columnType = columnType;

    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.innerHTML = `<h3>${title}</h3><span class="page-count">${pages.length} str.</span>`;

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'kanban-cards';
    cardsContainer.dataset.columnType = columnType;

    pages.forEach((page, index) => {
        const card = createKanbanCard(page, index);
        cardsContainer.appendChild(card);
    });

    // Drag & Drop
    makeDraggable(cardsContainer);

    column.appendChild(header);
    column.appendChild(cardsContainer);

    return column;
}

// Stwórz kartę Kanban
function createKanbanCard(page, index) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.pageNumber = page.number;
    card.dataset.pageIndex = index;

    const thumbnail = document.createElement('div');
    thumbnail.className = 'kanban-card-thumbnail';

    if (page.image) {
        const img = document.createElement('img');
        img.src = page.image;
        thumbnail.appendChild(img);
    } else {
        thumbnail.innerHTML = '<div class="placeholder">Ładowanie...</div>';
    }

    const info = document.createElement('div');
    info.className = 'kanban-card-info';
    info.innerHTML = `
        <strong>Strona ${page.number}</strong>
        <span>${page.type === 'template' ? 'Szablon' : `Produkt ${page.product_id || ''}`}</span>
    `;

    card.appendChild(thumbnail);
    card.appendChild(info);

    return card;
}

// Obsługa Drag & Drop
function makeDraggable(container) {
    let draggedElement = null;

    container.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            draggedElement = e.target;
            e.target.style.opacity = '0.5';
        }
    });

    container.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            e.target.style.opacity = '1';
        }
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);

        if (afterElement == null) {
            container.appendChild(draggedElement);
        } else {
            container.insertBefore(draggedElement, afterElement);
        }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();

        // Aktualizuj kolejność stron
        updatePageOrder();
        markPreviewOutdated();
    });
}

// Znajdź element po którym wstawić przeciągany element
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Aktualizuj kolejność stron po przeciągnięciu
function updatePageOrder() {
    const cards = document.querySelectorAll('.kanban-card');
    const newOrder = [];

    cards.forEach((card, index) => {
        const pageNumber = parseInt(card.dataset.pageNumber);
        const page = previewPages.find(p => p.number === pageNumber);
        if (page) {
            page.order = index + 1;  // Nowa kolejność
            newOrder.push(page);
        }
    });

    // Sortuj według nowej kolejności
    previewPages.sort((a, b) => (a.order || a.number) - (b.order || b.number));

    console.log('[KANBAN] Zaktualizowano kolejność stron:', previewPages.map(p => p.number));
}
