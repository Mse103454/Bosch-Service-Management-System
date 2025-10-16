document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('part-search');
    const searchResults = document.getElementById('search-results');
    const cartItemsTable = document.getElementById('cart-table');
    const subtotalDisplay = document.getElementById('subtotal');
    const discountTotalDisplay = document.getElementById('discount-total');
    const subtotalAfterDiscountDisplay = document.getElementById('subtotal-after-discount');
    const vatTotalDisplay = document.getElementById('vat-total');
    const grandTotalDisplay = document.getElementById('grand-total');
    const exchangeRateInput = document.getElementById('exchange-rate-input');
    const setRateBtn = document.getElementById('set-rate-btn');
    const vatRateInput = document.getElementById('vat-rate-input');
    const profitRateInput = document.getElementById('profit-rate-input');
    const discountRateInput = document.getElementById('discount-rate-input');
    const createWorkOrderHeaderBtn = document.getElementById('create-work-order-header-btn');
    
    // Veritabanı bilgi kutusu
    const dbInfoBox = document.getElementById('db-info-box');
    const dbLocation = document.getElementById('db-location');
    
    // Yeni eklenen elementler
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const addNewPartBtn = document.getElementById('add-new-part-btn');
    const manageSearchInput = document.getElementById('manage-search');
    const manageResults = document.getElementById('manage-results');
    
    // İşçilik elementleri
    const addLaborBtn = document.getElementById('add-labor-btn');
    const addExternalLaborBtn = document.getElementById('add-external-labor-btn');
    const laborDescriptionInput = document.getElementById('labor-description');
    const laborPriceInput = document.getElementById('labor-price');
    const laborItemsContainer = document.getElementById('labor-items');
    
    // Harici parça elementleri
    const addExternalPartBtn = document.getElementById('add-external-part-btn');
    const externalPartCodeInput = document.getElementById('external-part-code');
    const externalPartNameInput = document.getElementById('external-part-name');
    const externalPartPriceInput = document.getElementById('external-part-price');
    const externalPartQuantityInput = document.getElementById('external-part-quantity');
    
    // Silme modalı elementleri - DOM yüklendikten sonra al
    let deleteModal, deleteModalText, confirmDeleteBtn, cancelDeleteBtn;
    let currentPartToDelete = null;
    
    // Modal elementlerini güvenli şekilde al
    function initializeModalElements() {
        deleteModal = document.getElementById('deleteModal');
        deleteModalText = document.getElementById('deleteModalText');
        confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        
        console.log('Modal elements initialized:', {
            deleteModal: !!deleteModal,
            deleteModalText: !!deleteModalText,
            confirmDeleteBtn: !!confirmDeleteBtn,
            cancelDeleteBtn: !!cancelDeleteBtn
        });
        
        // Event listener'ları ekle
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', confirmDelete);
        }

        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }

        // Modal dışına tıklandığında kapat
        if (deleteModal) {
            deleteModal.addEventListener('click', function(e) {
                if (e.target === deleteModal) {
                    closeDeleteModal();
                }
            });
        }
    }
    
    // DOM yüklendikten sonra modal elementlerini başlat
    setTimeout(initializeModalElements, 100);
    
    // Veritabanı bilgi kutusunu göster
    setTimeout(showDatabaseInfo, 2000);

    let cart = [];
    let exchangeRate = 47.0; // Başlangıç varsayılanı

    // Sayfa yüklendiğinde varsayılan kuru giriş alanına yaz
    exchangeRateInput.value = exchangeRate.toFixed(2);

    // Müşteri ve Araç bilgilerinin bulunduğu input'ları al
    const customerInfoInputs = {
        name: document.getElementById('customer-name'),
        address: document.getElementById('customer-address'),
        phone: document.getElementById('customer-phone'),
        order_date: document.getElementById('order-date'),
        customer_no: document.getElementById('customer-no'),
        offer_person_no: document.getElementById('offer-person-no'),
        tax_number: document.getElementById('tax-number'),
        external_doc_no: document.getElementById('external-doc-no')
    };

    const carInfoInputs = {
        plate: document.getElementById('car-plate'),
        visit_km: document.getElementById('visit-km'),
        make: document.getElementById('car-make'),
        model: document.getElementById('car-model'),
        first_license_date: document.getElementById('first-license-date'),
        vin: document.getElementById('car-vin'),
        next_inspection: document.getElementById('next-inspection'),
        vehicle_entry_date: document.getElementById('vehicle-entry-date'),
        vehicle_delivery_date: document.getElementById('vehicle-delivery-date'),
        service_staff: document.getElementById('service-staff')
    };

    // Fonksiyonlar
    function calculateTotals() {
        let subtotal = 0;
        cart.forEach(item => {
            subtotal += item.price_tl * item.quantity;
        });

        const discountRate = parseFloat(discountRateInput.value) || 0;
        const discountTotal = subtotal * (discountRate / 100);
        const subtotalAfterDiscount = subtotal - discountTotal;
        
        const vatRate = parseFloat(vatRateInput.value) || 0;
        const vatTotal = subtotalAfterDiscount * (vatRate / 100);
        const grandTotal = subtotalAfterDiscount + vatTotal;

        subtotalDisplay.textContent = subtotal.toFixed(2) + ' TL';
        discountTotalDisplay.textContent = discountTotal.toFixed(2) + ' TL';
        subtotalAfterDiscountDisplay.textContent = subtotalAfterDiscount.toFixed(2) + ' TL';
        vatTotalDisplay.textContent = vatTotal.toFixed(2) + ' TL';
        grandTotalDisplay.textContent = grandTotal.toFixed(2) + ' TL';
    }

    function renderCart() {
        const cartItemsBody = cartItemsTable.querySelector('tbody');
        cartItemsBody.innerHTML = '';
        const profitRate = parseFloat(profitRateInput.value) || 0;

        cart.forEach(item => {
            let priceWithProfit, itemTotal, itemId, displayCode, displayName;
            
            if (item.type === 'labor') {
                // İşçilik öğeleri için kar oranı uygulanmaz
                priceWithProfit = item.price_tl;
                itemTotal = priceWithProfit * item.quantity;
                itemId = item.labor_id;
                displayCode = 'İŞÇİLİK';
                displayName = item.description;
            } else if (item.type === 'external') {
                // Harici parçalar için kar oranı uygulanır
                priceWithProfit = item.base_price_tl * (1 + profitRate / 100);
                item.price_tl = priceWithProfit; // Sepet verisini güncelle
                itemTotal = priceWithProfit * item.quantity;
                itemId = item.external_id;
                displayCode = item.part_code;
                displayName = item.part_name;
            } else {
                // Normal parça öğeleri için kar oranı uygulanır
                priceWithProfit = item.base_price_tl * (1 + profitRate / 100);
                item.price_tl = priceWithProfit; // Sepet verisini güncelle
                itemTotal = priceWithProfit * item.quantity;
                itemId = item.part_code;
                displayCode = item.part_code;
                displayName = item.part_name;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${displayCode}</td>
                <td>${displayName}</td>
                <td><input type="number" class="quantity-input" data-id="${itemId}" data-type="${item.type || 'part'}" value="${item.quantity}" min="1"></td>
                <td>${priceWithProfit.toFixed(2)} TL</td>
                <td>${itemTotal.toFixed(2)} TL</td>
                <td><button class="remove-from-cart-btn" data-id="${itemId}" data-type="${item.type || 'part'}">Kaldır</button></td>
            `;
            cartItemsBody.appendChild(row);
        });
        calculateTotals();
    }

    function addToCart(part) {
        const existingItem = cart.find(item => item.part_code === part.part_code);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            // base_price_tl, karsız fiyatı tutar, price_tl ise karlı fiyatı
            cart.push({ ...part, quantity: 1, base_price_tl: part.price_tl });
        }
        renderCart();
    }

    function removeFromCart(itemId, itemType = 'part') {
        if (itemType === 'labor') {
            cart = cart.filter(item => !(item.type === 'labor' && item.labor_id === itemId));
        } else if (itemType === 'external') {
            cart = cart.filter(item => !(item.type === 'external' && item.external_id === itemId));
        } else {
            cart = cart.filter(item => item.part_code !== itemId);
        }
        renderCart();
        renderLaborList();
    }

    function addLaborToCart(laborItem) {
        cart.push({
            type: 'labor',
            labor_id: laborItem.id,
            description: laborItem.description,
            price_tl: laborItem.price,
            quantity: 1
        });
        renderCart();
    }

    let laborCounter = 1;
    let laborItems = [];
    
    // İşçilik türleri listesi
    const laborTypes = [
        'Adaptasyon Yapıldı',
        'Aks Kafası Söküldü - Takıldı',
        'Aks Söküldü - Takıldı',
        'Alternatör (Şarj Dinamosu) Revizyonu',
        'Alternatör (Şarj Dinamosu) Söküldü - Takıldı',
        'Ampul Değişimi',
        'Arka Amortisör Söküldü - Takıldı',
        'Arka Balata Değişim İşçiliği (Disk Tipi)',
        'Arka Balata Değişim İşçiliği (Kampana)',
        'Arka Disk + Balata Değişim İşçiliği',
        'Arka Disk Değişim İşçiliği',
        'Arka Tampon Söküldü - Takıldı',
        'Arka Z Rotu Söküldü - Takıldı',
        'Balans Ayarı',
        'Direksiyon Kutusu Söküldü - Takıldı',
        'Egr Söküldü - Takıldı',
        'Egr Temizliği',
        'Egr Yazılım İptali',
        'Elektrik İşçiliği',
        'Elektrik Tesisat Onarımı',
        'Far Söküldü - Takıldı',
        'Gaz Kelebeği Sökme - Takma İşçiliği',
        'Gaz Kelebeği Temizleme İşçiliği',
        'Hava Filtresi Değişimi',
        'Kampana Değişim İşçiliği',
        'Kavrama Adaptasyonu Yapıldı',
        'Kavrama Söküldü - Takıldı',
        'Klima Gazı Çekildi - Basıldı',
        'Klima Kompresörü Söküldü - Takıldı',
        'Lastik Söküldü - Takıldı',
        'Marş Motoru Revizyonu',
        'Marş Motoru Söküldü - Takıldı',
        'Motor Dağıtıldı - Toplandı',
        'Motor Söküldü - Takıldı',
        'Motor Taşıyıcı Traversi Söküldü - Takıldı',
        'Motor Yağı ve Filtresi Değişti',
        'Ön Amortisör Söküldü - Takıldı',
        'Ön Balata Değişim İşçiliği',
        'Ön Disk + Balata Değişim İşçiliği',
        'Ön Disk Değişim İşçiliği',
        'Ön Panel Söküldü - Takıldı',
        'Ön Tampon Söküldü - Takıldı',
        'Ön Z Rotu Söküldü - Takıldı',
        'Park Sensörü Söküldü - Takıldı',
        'Partekül Filtresi Söküldü - Takıldı',
        'Partekül Filtresi Yazılım İptali',
        'Performans Yazılımı',
        'Periyodik Bakım ( Motor Yağı, Yağ, Hava, Polen, Yakıt Filtresi )',
        'Periyodik Bakım ( Motor Yağı, Yağ, Hava, Polen Filtresi )',
        'Polen Filtresi Değişimi',
        'Porya Pres İşçiliği',
        'Porya Söküldü - Takıldı',
        'Radyatör Söküldü - Takıldı',
        'Rot Ayarı',
        'Rot Başı Söküldü - Takıldı',
        'Rot Mili Söküldü - Takıldı',
        'Rotil Söküldü - Takıldı',
        'Salıncak Burcu Press İşçiliği',
        'Salıncak Söküldü - Takıldı',
        'Silindir Kapağı Dağıtıldı - Toplandı',
        'Silindir Kapağı Söküldü - Takıldı',
        'Soğutma Suyu ( Antifriz ) Değişimi',
        'Soğutma Suyu Sistem Temizliği',
        'Stop Lambası Söküldü - Takıldı',
        'Şanzıman Dağıtma-Toplama İşçiliği',
        'Şanzıman Sökme-Takma İşçiliği',
        'Şanzıman Yağ Değişim İşçiliği',
        'Tekerlek Balans Ayarı',
        'Tekerlek Bilyası Pres İşçiliği',
        'Tekerlek Bilyası Söküldü - Takıldı',
        'Triger Seti Değişimi ( Su Pompalı )',
        'Triger Seti Değişimi ( Su Pompasız )',
        'V Kayış Bilyası Söküldü - Takıldı',
        'V Kayışı Söküldü - Takıldı',
        'Yakıt Filtresi Değişimi'
    ];

    function searchLaborTypes() {
        const query = laborDescriptionInput.value.trim();
        const laborSearchResults = document.getElementById('labor-search-results');
        
        if (query.length === 0) {
            laborSearchResults.innerHTML = '';
            laborSearchResults.style.display = 'none';
            return;
        }

        // Türkçe karakterleri normalize et
        const normalizeText = (text) => {
            return text.toLowerCase()
                .replace(/ç/g, 'c')
                .replace(/ğ/g, 'g')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ş/g, 's')
                .replace(/ü/g, 'u')
                .replace(/Ç/g, 'c')
                .replace(/Ğ/g, 'g')
                .replace(/I/g, 'i')
                .replace(/İ/g, 'i')
                .replace(/Ö/g, 'o')
                .replace(/Ş/g, 's')
                .replace(/Ü/g, 'u');
        };

        const normalizedQuery = normalizeText(query);
        
        const filteredTypes = laborTypes.filter(type => {
            const normalizedType = normalizeText(type);
            return normalizedType.includes(normalizedQuery);
        });

        laborSearchResults.innerHTML = '';
        if (filteredTypes.length > 0) {
            filteredTypes.forEach(type => {
                const div = document.createElement('div');
                div.className = 'labor-search-result-item';
                div.textContent = type;
                div.addEventListener('click', () => {
                    laborDescriptionInput.value = type;
                    laborSearchResults.style.display = 'none';
                    laborPriceInput.focus();
                });
                laborSearchResults.appendChild(div);
            });
            laborSearchResults.style.display = 'block';
        } else {
            laborSearchResults.innerHTML = '<div class="labor-search-no-result">Sonuç bulunamadı</div>';
            laborSearchResults.style.display = 'block';
        }
    }

    function addLabor() {
        const description = laborDescriptionInput.value.trim();
        const price = parseFloat(laborPriceInput.value);

        if (!description) {
            alert('Lütfen yapılan işi açıklayın!');
            return;
        }

        if (!price || price <= 0) {
            alert('Lütfen geçerli bir işçilik ücreti girin!');
            return;
        }

        const laborItem = {
            id: `labor_${laborCounter++}`,
            description: description,
            price: price
        };

        laborItems.push(laborItem);
        addLaborToCart(laborItem);
        renderLaborList();

        // Formu temizle
        laborDescriptionInput.value = '';
        laborPriceInput.value = '';
    }

    function addExternalLabor() {
        const description = laborDescriptionInput.value.trim();
        const price = parseFloat(laborPriceInput.value);

        // Validasyon
        if (!description) {
            alert('Lütfen yapılan işi açıklayın!');
            return;
        }

        if (!price || price <= 0) {
            alert('Lütfen geçerli bir işçilik ücreti girin!');
            return;
        }

        // Harici işçilik için özel ID oluştur
        const externalLaborItem = {
            id: `external_labor_${laborCounter++}`,
            description: description,
            price: price,
            isExternal: true
        };

        laborItems.push(externalLaborItem);
        addLaborToCart(externalLaborItem);
        renderLaborList();

        // Formu temizle
        laborDescriptionInput.value = '';
        laborPriceInput.value = '';

        alert('Harici işçilik sepete eklendi!');
    }

    function renderLaborList() {
        laborItemsContainer.innerHTML = '';
        
        laborItems.forEach(labor => {
            const isInCart = cart.some(item => item.type === 'labor' && item.labor_id === labor.id);
            
            const div = document.createElement('div');
            div.className = `labor-item ${labor.isExternal ? 'external-labor-item' : ''}`;
            div.innerHTML = `
                <div class="labor-item-info">
                    <strong>${labor.description}</strong>
                    <span class="labor-price">${labor.price.toFixed(2)} TL</span>
                    ${labor.isExternal ? '<span class="external-label">(HARİCİ)</span>' : ''}
                </div>
                <div class="labor-item-actions">
                    ${!isInCart ? 
                        `<button class="add-labor-to-cart-btn" data-labor-id="${labor.id}">Sepete Ekle</button>` : 
                        `<span class="in-cart-label">Sepette</span>`
                    }
                    <button class="remove-labor-btn" data-labor-id="${labor.id}">Sil</button>
                </div>
            `;
            laborItemsContainer.appendChild(div);
        });
    }

    function removeLaborFromList(laborId) {
        laborItems = laborItems.filter(item => item.id !== laborId);
        // Sepetten de kaldır
        cart = cart.filter(item => !(item.type === 'labor' && item.labor_id === laborId));
        renderLaborList();
        renderCart();
    }

    let externalPartCounter = 1;

    function addExternalPart() {
        const partCode = externalPartCodeInput.value.trim();
        const partName = externalPartNameInput.value.trim();
        const price = parseFloat(externalPartPriceInput.value);
        const quantity = parseInt(externalPartQuantityInput.value);

        // Validasyon
        if (!partCode) {
            alert('Lütfen parça kodunu girin!');
            return;
        }

        if (!partName) {
            alert('Lütfen parça adını girin!');
            return;
        }

        if (!price || price <= 0) {
            alert('Lütfen geçerli bir fiyat girin!');
            return;
        }

        if (!quantity || quantity <= 0) {
            alert('Lütfen geçerli bir miktar girin!');
            return;
        }

        const externalPart = {
            type: 'external',
            external_id: `ext_${externalPartCounter++}`,
            part_code: partCode,
            part_name: partName,
            base_price_tl: price,
            price_tl: price,
            quantity: quantity
        };

        cart.push(externalPart);
        renderCart();

        // Formu temizle
        externalPartCodeInput.value = '';
        externalPartNameInput.value = '';
        externalPartPriceInput.value = '';
        externalPartQuantityInput.value = '1';

        alert('Harici parça sepete eklendi!');
    }

    async function searchParts() {
        const query = searchInput.value.trim();
        if (query.length === 0) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none'; // Arama kutusu boşsa sonuçları gizle
            return;
        }

        try {
            const response = await fetch(`/api/search_parts?query=${encodeURIComponent(query)}`);
            const parts = await response.json();

            searchResults.innerHTML = '';
            if (parts.length > 0) {
                const profitRate = parseFloat(profitRateInput.value) || 0;
                parts.forEach(part => {
                    const price_tl = part.price_eur * exchangeRate;
                    const priceWithProfit = price_tl * (1 + profitRate / 100); // Kar oranını uygula

                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `
                        <div class="search-result-info">
                            <div class="search-result-code">${part.part_code}</div>
                            <div class="search-result-name">${part.part_name}</div>
                        </div>
                        <div class="search-result-price">${priceWithProfit.toFixed(2)} TL</div>
                        <button class="add-to-cart-btn"
                                data-code="${part.part_code}"
                                data-name="${part.part_name}"
                                data-price="${price_tl.toFixed(2)}">
                            Ekle
                        </button>
                    `;
                    searchResults.appendChild(div);
                });
                searchResults.style.display = 'block'; // Sonuçlar varsa göster
            } else {
                searchResults.innerHTML = '<p style="padding: 10px; text-align: center;">Parça bulunamadı.</p>';
                searchResults.style.display = 'block'; // Sonuç yoksa bile "Bulunamadı" yazısını göstermek için block yap
            }
        } catch (error) {
            console.error('Arama sırasında hata oluştu:', error);
            searchResults.innerHTML = '<p style="padding: 10px; text-align: center;">Arama hatası.</p>';
            searchResults.style.display = 'block';
        }
    }

    async function createWorkOrder() {
        const getValue = (element) => element ? element.value : '';

        const customerInfo = {};
        for (const key in customerInfoInputs) {
            customerInfo[key] = getValue(customerInfoInputs[key]);
        }

        const carInfo = {};
        for (const key in carInfoInputs) {
            carInfo[key] = getValue(carInfoInputs[key]);
        }

        const vatRate = parseFloat(vatRateInput.value) || 0;
        const discountRate = parseFloat(discountRateInput.value) || 0;

        const requestBody = {
            customer_info: customerInfo,
            car_info: carInfo,
            cart: cart,
            vat_rate: vatRate,
            discount_rate: discountRate
        };

        // İndirme konumu seçme modalını göster
        pendingWorkOrderData = requestBody;
        showDownloadLocationModal();
    }

    function showDownloadLocationModal() {
        // Modal'ı göster
        downloadLocationModal.style.display = 'flex';
        
        // Input'u temizle
        folderPathInput.value = '';
        selectedFolderPath = '';
        
        // Önizleme bilgilerini güncelle
        updatePreviewInfo();
        
        // Klasör seçme butonuna odaklan
        setTimeout(() => {
            if (selectFolderBtn) {
                selectFolderBtn.focus();
            }
        }, 100);
    }

    function updatePreviewInfo() {
        const plate = carInfoInputs.plate.value.trim() || 'PLAKA_YOK';
        const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '');
        
        // Bugünün tarihi
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const currentDate = day + '/' + month + '/' + year;
        
        // İşçilik bilgileri
        const laborDescriptions = [];
        for (const item of cart) {
            if (item.type === 'labor') {
                if (item.description) {
                    laborDescriptions.push(item.description);
                }
            }
        }
        
        const cleanLabors = laborDescriptions.map(labor => 
            labor
                .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
                .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
                .replace(/Ç/g, 'C').replace(/Ğ/g, 'G').replace(/I/g, 'I')
                .replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ü/g, 'U')
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
        );
        
        const combinedLabors = cleanLabors.join(' + ') || 'ISCILIK_YOK';
        const filename = `${cleanPlate}-${combinedLabors}-${currentDate.replace(/\//g, '')}.pdf`;
        
        // Önizleme bilgilerini güncelle
        previewPath.querySelector('.placeholder').textContent = selectedFolderPath || 'Henüz klasör seçilmedi';
        previewSubfolder.querySelector('.placeholder').textContent = selectedFolderPath ? `${selectedFolderPath}\\${cleanPlate}` : 'Henüz klasör seçilmedi';
        previewFilename.querySelector('.placeholder').textContent = filename;
    }

    async function downloadWorkOrder() {
        if (!selectedFolderPath) {
            alert('Lütfen önce bir klasör seçin!');
            return;
        }

        if (!pendingWorkOrderData) {
            alert('İş emri verisi bulunamadı!');
            return;
        }

        try {
            // Yeni endpoint'i kullan - klasöre kaydet
            const requestData = {
                ...pendingWorkOrderData,
                target_folder: selectedFolderPath
            };

            const response = await fetch('/api/save_work_order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'İş emri oluşturma başarısız oldu.');
            }

            const result = await response.json();
            
            if (result.success) {
                // Modal'ı kapat
                downloadLocationModal.style.display = 'none';
                selectedFolderPath = '';
                pendingWorkOrderData = null;
                
                alert(`✅ İş emri başarıyla oluşturuldu ve kaydedildi!\n\n📁 Klasör: ${result.file_path}\n📄 Dosya: ${result.filename}\n\nPDF dosyası seçilen klasörde plaka adında alt klasör oluşturularak kaydedildi.`);
            } else {
                throw new Error(result.error || 'Bilinmeyen hata');
            }
        } catch (error) {
            console.error('İş emri oluşturma hatası:', error);
            alert(`❌ İş emri oluşturulurken bir hata oluştu:\n\n${error.message}`);
        }
    }

    // Event Dinleyicileri
    setRateBtn.addEventListener('click', () => {
        const newRate = parseFloat(exchangeRateInput.value);
        if (!isNaN(newRate) && newRate > 0) {
            exchangeRate = newRate;
            alert(`EURO kuru başarıyla ${newRate.toFixed(2)} olarak ayarlandı.`);
            // Kur değişince arama sonuçlarını güncelle
            searchParts();
        } else {
            alert('Lütfen geçerli bir kur değeri girin.');
        }
    });

    searchInput.addEventListener('input', () => {
        searchParts();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchParts();
        }
    });

    searchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const part = {
                part_code: e.target.dataset.code,
                part_name: e.target.dataset.name,
                price_tl: parseFloat(e.target.dataset.price)
            };
            addToCart(part);
        }
    });

    cartItemsTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-from-cart-btn')) {
            const itemId = e.target.dataset.id;
            const itemType = e.target.dataset.type;
            removeFromCart(itemId, itemType);
        }
    });

    cartItemsTable.addEventListener('input', (e) => {
        if (e.target.classList.contains('quantity-input')) {
            const itemId = e.target.dataset.id;
            const itemType = e.target.dataset.type;
            const newQuantity = parseInt(e.target.value, 10);
            if (!isNaN(newQuantity) && newQuantity > 0) {
                let item;
                if (itemType === 'labor') {
                    item = cart.find(i => i.type === 'labor' && i.labor_id === itemId);
                } else if (itemType === 'external') {
                    item = cart.find(i => i.type === 'external' && i.external_id === itemId);
                } else {
                    item = cart.find(i => i.part_code === itemId);
                }
                if (item) {
                    item.quantity = newQuantity;
                    renderCart();
                }
            }
        }
    });

    // KDV, Kar ve İskonto oranı değiştiğinde toplamları ve sepeti yeniden hesapla
    vatRateInput.addEventListener('input', calculateTotals);
    profitRateInput.addEventListener('input', renderCart);
    discountRateInput.addEventListener('input', calculateTotals);

    createWorkOrderHeaderBtn.addEventListener('click', createWorkOrder);

    // Sekme işlevselliği
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Tüm sekmeleri pasif yap
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Seçili sekmeyi aktif yap
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // Yeni parça ekleme
    if (addNewPartBtn) {
        addNewPartBtn.addEventListener('click', addNewPart);
    }

    // Parça yönetimi arama
    if (manageSearchInput) {
        manageSearchInput.addEventListener('input', debounce(searchPartsForManagement, 300));
    }

    // İşçilik ekleme
    if (addLaborBtn) {
        addLaborBtn.addEventListener('click', addLabor);
    }

    // Harici işçilik ekleme
    if (addExternalLaborBtn) {
        addExternalLaborBtn.addEventListener('click', addExternalLabor);
    }

    // İndirme konumu modal elementleri
    const downloadLocationModal = document.getElementById('downloadLocationModal');
    const selectFolderBtn = document.getElementById('selectFolderBtn');
    const folderPathInput = document.getElementById('folderPath');
    const confirmDownloadBtn = document.getElementById('confirmDownloadBtn');
    const cancelDownloadBtn = document.getElementById('cancelDownloadBtn');
    const previewPath = document.getElementById('previewPath');
    const previewSubfolder = document.getElementById('previewSubfolder');
    const previewFilename = document.getElementById('previewFilename');

    let selectedFolderPath = '';
    let pendingWorkOrderData = null;

    // İşçilik arama
    if (laborDescriptionInput) {
        laborDescriptionInput.addEventListener('input', searchLaborTypes);
        laborDescriptionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchLaborTypes();
            }
        });
    }

    // Harici parça ekleme
    if (addExternalPartBtn) {
        addExternalPartBtn.addEventListener('click', addExternalPart);
    }

    // İndirme konumu modal event listener'ları
    if (selectFolderBtn) {
        selectFolderBtn.addEventListener('click', () => {
            // Klasör seçme dialog'u aç (prompt ile)
            const folderPath = prompt('Klasör yolunu girin:\n\nÖrnek: C:\\Users\\semih\\Desktop\\Bosch Servis\n\nNot: Windows Explorer\'da klasör yolunu kopyalamak için:\n1. Klasöre sağ tıklayın\n2. "Özellikler" seçin\n3. "Konum" alanındaki yolu kopyalayın');
            
            if (folderPath) {
                // Yolu temizle ve doğrula
                const cleanPath = folderPath.trim().replace(/"/g, '');
                if (cleanPath) {
                    selectedFolderPath = cleanPath;
                    folderPathInput.value = cleanPath;
                    updatePreviewInfo();
                    
                    // Başarı mesajı
                    alert(`✅ Klasör başarıyla seçildi!\n\n📁 ${cleanPath}`);
                }
            }
        });
    }

    // Klasör yolu doğrulama fonksiyonu
    function isValidFolderPath(path) {
        try {
            // Basit doğrulama - gerçek dosya sistemi erişimi olmadığı için
            // sadece format kontrolü yapıyoruz
            if (!path || path.length < 3) return false;
            
            // Windows klasör yolu formatı kontrolü
            const windowsPathRegex = /^[A-Za-z]:\\(?:[^<>:"|?*]+\\)*[^<>:"|?*]*$/;
            return windowsPathRegex.test(path);
        } catch (error) {
            return false;
        }
    }

    if (confirmDownloadBtn) {
        confirmDownloadBtn.addEventListener('click', downloadWorkOrder);
    }

    if (cancelDownloadBtn) {
        cancelDownloadBtn.addEventListener('click', () => {
            downloadLocationModal.style.display = 'none';
            selectedFolderPath = '';
            pendingWorkOrderData = null;
        });
    }

    // Modal dışına tıklandığında kapat
    if (downloadLocationModal) {
        downloadLocationModal.addEventListener('click', (e) => {
            if (e.target === downloadLocationModal) {
                downloadLocationModal.style.display = 'none';
                selectedFolderPath = '';
                pendingWorkOrderData = null;
            }
        });
    }

    // ESC tuşu ile modal'ı kapat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && downloadLocationModal.style.display === 'flex') {
            downloadLocationModal.style.display = 'none';
            selectedFolderPath = '';
            pendingWorkOrderData = null;
        }
    });

    // İşçilik listesi event delegation
    if (laborItemsContainer) {
        laborItemsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-labor-to-cart-btn')) {
                const laborId = e.target.dataset.laborId;
                const laborItem = laborItems.find(item => item.id === laborId);
                if (laborItem) {
                    addLaborToCart(laborItem);
                    renderLaborList();
                }
            } else if (e.target.classList.contains('remove-labor-btn')) {
                const laborId = e.target.dataset.laborId;
                if (confirm('Bu işçiliği silmek istediğinizden emin misiniz?')) {
                    removeLaborFromList(laborId);
                }
            }
        });
    }

    // Yeni parça ekleme fonksiyonu
    function addNewPart() {
        const partCode = document.getElementById('new-part-code').value.trim();
        const partName = document.getElementById('new-part-name').value.trim();
        const category = document.getElementById('new-part-category').value;
        const price = parseFloat(document.getElementById('new-part-price').value);
        const currency = document.getElementById('new-part-currency').value;

        // Validasyon
        if (!partCode || !partName || !category) {
            alert('Parça kodu, parça adı ve kategori alanları zorunludur!');
            return;
        }

        if (!price || price <= 0) {
            alert('Geçerli bir fiyat girilmelidir!');
            return;
        }

        // Fiyat hesaplama - kur ile çarpma
        let priceEur = null;
        let priceTl = null;
        
        if (currency === 'EUR') {
            priceEur = price;
            priceTl = price * exchangeRate; // Euro'yu TL'ye çevir
        } else {
            priceTl = price;
            priceEur = price / exchangeRate; // TL'yi Euro'ya çevir
        }

        const newPartData = {
            part_code: partCode,
            part_name: partName,
            category: category,
            price_eur: priceEur,
            price_tl: priceTl
        };

        fetch('/api/add_part', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newPartData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Hata: ' + data.error);
            } else {
                alert('Parça başarıyla eklendi: ' + data.part_code);
                // Formu temizle
                document.getElementById('new-part-code').value = '';
                document.getElementById('new-part-name').value = '';
                document.getElementById('new-part-category').value = '';
                document.getElementById('new-part-price').value = '';
                document.getElementById('new-part-currency').value = 'EUR';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Bir hata oluştu. Lütfen tekrar deneyin.');
        });
    }

    // Parça yönetimi için arama
    function searchPartsForManagement() {
        const query = manageSearchInput.value.trim();
        if (query.length < 2) {
            manageResults.innerHTML = '';
            return;
        }

        fetch(`/api/search_parts?query=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(parts => {
                displayPartsForManagement(parts);
            })
            .catch(error => {
                console.error('Error:', error);
                manageResults.innerHTML = '<p>Arama sırasında bir hata oluştu.</p>';
            });
    }

    // Parça yönetimi sonuçlarını göster
    function displayPartsForManagement(parts) {
        if (parts.length === 0) {
            manageResults.innerHTML = '<p>Parça bulunamadı.</p>';
            return;
        }

        const resultsHtml = parts.map(part => `
            <div class="manage-part-item" data-part-code="${part.part_code}">
                <div class="manage-part-info">
                    <h4>${part.part_code}</h4>
                    <p><strong>Ad:</strong> ${part.part_name}</p>
                    <p><strong>Euro Fiyat:</strong> ${part.price_eur ? part.price_eur.toFixed(2) + ' €' : 'Belirtilmemiş'}</p>
                </div>
                <div class="manage-part-actions">
                    <button class="edit-btn" onclick="editPart('${part.part_code}')">Düzenle</button>
                    <button class="delete-btn" onclick="showDeleteModal('${part.part_code}', '${part.part_name.replace(/'/g, "\\'")}')">Sil</button>
                </div>
            </div>
        `).join('');
        
        manageResults.innerHTML = resultsHtml;
    }

    // Parça düzenleme fonksiyonu (global olarak erişilebilir)
    window.editPart = function(partCode) {
        fetch(`/api/get_part/${encodeURIComponent(partCode)}`)
            .then(response => response.json())
            .then(part => {
                if (part.error) {
                    alert('Hata: ' + part.error);
                    return;
                }
                showEditForm(part);
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Parça bilgileri alınırken bir hata oluştu.');
            });
    };

    // Düzenleme formunu göster
    function showEditForm(part) {
        const partItem = document.querySelector(`[data-part-code="${part.part_code}"]`);
        const partInfo = partItem.querySelector('.manage-part-info');
        const partActions = partItem.querySelector('.manage-part-actions');

        // Mevcut fiyatı belirle (EUR öncelikli)
        let currentPrice = 0;
        let currentCurrency = 'EUR';
        
        if (part.price_eur && part.price_eur > 0) {
            currentPrice = part.price_eur;
            currentCurrency = 'EUR';
        } else if (part.price_tl && part.price_tl > 0) {
            currentPrice = part.price_tl;
            currentCurrency = 'TL';
        }

        // Düzenleme formunu oluştur
        partInfo.innerHTML = `
            <h4>${part.part_code}</h4>
            <p><strong>Ad:</strong> <input type="text" id="edit-name-${part.part_code}" value="${part.part_name}" style="width: 200px;"></p>
            <p><strong>Fiyat:</strong> 
                <input type="number" id="edit-price-${part.part_code}" value="${currentPrice.toFixed(2)}" step="0.01" style="width: 100px;">
                <select id="edit-currency-${part.part_code}" style="width: 60px; margin-left: 5px;">
                    <option value="EUR" ${currentCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                    <option value="TL" ${currentCurrency === 'TL' ? 'selected' : ''}>TL</option>
                </select>
            </p>
        `;

        partActions.innerHTML = `
            <button class="save-btn" onclick="savePart('${part.part_code}')">Kaydet</button>
            <button class="cancel-btn" onclick="cancelEdit('${part.part_code}')">İptal</button>
        `;
    }

    // Parça kaydetme fonksiyonu (global olarak erişilebilir)
    window.savePart = function(partCode) {
        const newName = document.getElementById(`edit-name-${partCode}`).value.trim();
        const newPrice = parseFloat(document.getElementById(`edit-price-${partCode}`).value);
        const newCurrency = document.getElementById(`edit-currency-${partCode}`).value;

        if (!newName) {
            alert('Parça adı boş olamaz!');
            return;
        }

        if (!newPrice || newPrice <= 0) {
            alert('Geçerli bir fiyat girilmelidir!');
            return;
        }

        // Fiyat hesaplama - kur ile çarpma
        let newEurPrice = null;
        let newTlPrice = null;
        
        if (newCurrency === 'EUR') {
            newEurPrice = newPrice;
            newTlPrice = newPrice * exchangeRate; // Euro'yu TL'ye çevir
        } else {
            newTlPrice = newPrice;
            newEurPrice = newPrice / exchangeRate; // TL'yi Euro'ya çevir
        }

        const updateData = {
            part_code: partCode,
            part_name: newName,
            price_eur: newEurPrice,
            price_tl: newTlPrice
        };

        fetch('/api/update_part', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Hata: ' + data.error);
            } else {
                alert('Parça başarıyla güncellendi!');
                // Yeniden arama yap
                searchPartsForManagement();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Güncelleme sırasında bir hata oluştu.');
        });
    };

    // Düzenlemeyi iptal etme fonksiyonu (global olarak erişilebilir)
    window.cancelEdit = function(partCode) {
        searchPartsForManagement(); // Yeniden arama yaparak orijinal görünümü geri getir
    };

    // Silme modalını göster (global olarak erişilebilir)
    window.showDeleteModal = function(partCode, partName) {
        console.log('showDeleteModal called with:', { partCode, partName });
        
        // Elementler henüz yüklenmediyse, yeniden başlat
        if (!deleteModal || !deleteModalText) {
            console.log('Modal elements not ready, initializing...');
            initializeModalElements();
            
            // Hala bulunamadıysa hata ver
            if (!deleteModal || !deleteModalText) {
                console.error('Modal elements still not found after initialization!');
                // Basit confirm kullan
                if (confirm(`${partCode} - ${partName}\n\nBu parçayı silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) {
                    // Direkt silme API'sini çağır
                    fetch(`/api/delete_part/${encodeURIComponent(partCode)}`, {
                        method: 'DELETE'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            alert('Hata: ' + data.error);
                        } else {
                            alert(data.message);
                            // Arama sonuçlarını yenile
                            if (typeof searchPartsForManagement === 'function') {
                                searchPartsForManagement();
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Silme işlemi sırasında bir hata oluştu.');
                    });
                }
                return;
            }
        }
        
        currentPartToDelete = { code: partCode, name: partName };
        deleteModalText.innerHTML = `
            <strong>${partCode}</strong> kodlu parçayı silmek istediğinizden emin misiniz?
            <br><br>
            <strong>Parça Adı:</strong> ${partName}
            <br><br>
            <span style="color: #dc3545; font-weight: bold;">Bu işlem geri alınamaz!</span>
        `;
        deleteModal.style.display = 'flex';
        console.log('Modal should be visible now');
    };

    // Modal event listeners artık initializeModalElements içinde

    // Silme onaylama fonksiyonu
    function confirmDelete() {
        if (!currentPartToDelete) return;

        fetch(`/api/delete_part/${encodeURIComponent(currentPartToDelete.code)}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Hata: ' + data.error);
            } else {
                alert(data.message);
                // Arama sonuçlarını yenile
                searchPartsForManagement();
                closeDeleteModal();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Silme işlemi sırasında bir hata oluştu.');
        });
    }

    // Modal'ı kapat
    function closeDeleteModal() {
        deleteModal.style.display = 'none';
        currentPartToDelete = null;
    }

    // Debounce fonksiyonu
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Kapatma özelliği: Arama kutusu dışında herhangi bir yere tıklandığında sonuçları gizle
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
        if (!laborDescriptionInput.contains(e.target) && !document.getElementById('labor-search-results').contains(e.target)) {
            document.getElementById('labor-search-results').style.display = 'none';
        }
    });

    // Sayfa yüklendiğinde sepeti ve toplamları hesapla
    renderCart();
    
    // Veritabanı bilgi kutusunu göster
    function showDatabaseInfo() {
        if (dbInfoBox && dbLocation) {
            // Veritabanı konumunu al
            fetch('/api/db_info')
                .then(response => response.json())
                .then(data => {
                    if (data.location) {
                        dbLocation.textContent = data.location;
                        dbInfoBox.style.display = 'block';
                        
                        // 10 saniye sonra otomatik gizle
                        setTimeout(() => {
                            if (dbInfoBox.style.display !== 'none') {
                                dbInfoBox.style.display = 'none';
                            }
                        }, 10000);
                    }
                })
                .catch(error => {
                    console.log('Veritabanı bilgisi alınamadı:', error);
                });
        }
    }
});