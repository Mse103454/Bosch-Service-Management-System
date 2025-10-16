const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
const cartItemsBody = document.getElementById('cart-items');
const vatRateInput = document.getElementById('vat-rate');
const vatRateText = document.getElementById('vat-rate-text');
const subtotalCell = document.getElementById('subtotal');
const vatTotalCell = document.getElementById('vat-total');
const grandTotalCell = document.getElementById('grand-total');
const generatePdfButton = document.getElementById('generate-pdf-btn');

let cart = [];

async function searchParts() {
    const query = searchInput.value.trim();
    if (query.length === 0) {
        searchResults.innerHTML = '';
        return;
    }

    const response = await fetch(`/api/search_parts?query=${encodeURIComponent(query)}`);
    const parts = await response.json();
    
    searchResults.innerHTML = '';
    if (parts.length > 0) {
        parts.forEach(part => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `
                <span>${part.part_code} - ${part.part_name}</span>
                <span>${part.price_eur} EUR</span>
                <button class="add-to-cart-btn" data-code="${part.part_code}" data-name="${part.part_name}" data-price="${(part.price_eur * 35.0).toFixed(2)}">Ekle</button>
            `;
            searchResults.appendChild(div);
        });
    } else {
        searchResults.innerHTML = '<p>Sonuç bulunamadı.</p>';
    }
}

function addToCart(part) {
    const existingItem = cart.find(item => item.part_code === part.part_code);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...part, quantity: 1 });
    }
    renderCart();
}

function removeFromCart(partCode) {
    cart = cart.filter(item => item.part_code !== partCode);
    renderCart();
}

function updateCartQuantity(partCode, quantity) {
    const item = cart.find(item => item.part_code === partCode);
    if (item) {
        item.quantity = quantity;
        if (item.quantity <= 0) {
            removeFromCart(partCode);
        } else {
            renderCart();
        }
    }
}

function calculateTotals() {
    const vatRate = parseFloat(vatRateInput.value) / 100;
    const subtotal = cart.reduce((total, item) => total + (item.price_tl * item.quantity), 0);
    const vatTotal = subtotal * vatRate;
    const grandTotal = subtotal + vatTotal;

    subtotalCell.textContent = `${subtotal.toFixed(2)}`;
    vatTotalCell.textContent = `${vatTotal.toFixed(2)}`;
    grandTotalCell.textContent = `${grandTotal.toFixed(2)}`;
}

function renderCart() {
    cartItemsBody.innerHTML = '';
    cart.forEach(item => {
        const row = document.createElement('tr');
        const total = (item.price_tl * item.quantity).toFixed(2);
        row.innerHTML = `
            <td>${item.part_code}</td>
            <td>${item.part_name}</td>
            <td>${item.price_tl}</td>
            <td><input type="number" value="${item.quantity}" min="1" class="quantity-input" data-code="${item.part_code}"></td>
            <td>${total}</td>
            <td><button class="remove-from-cart-btn" data-code="${item.part_code}">Sil</button></td>
        `;
        cartItemsBody.appendChild(row);
    });
    calculateTotals();
}

async function generatePdf() {
    const customerInfo = {
        name: document.getElementById('input-customer-name').value,
        phone: document.getElementById('input-phone').value,
        address1: document.getElementById('input-address1').value,
        address2: document.getElementById('input-address2').value,
        address3: document.getElementById('input-address3').value,
        address4: document.getElementById('input-address4').value,
        country: document.getElementById('input-country').value,
        customer_no: document.getElementById('input-customer-no').value,
        offer_person_no: document.getElementById('input-offer-person-no').value,
        vehicle_entry_date: document.getElementById('input-vehicle-entry-date').value,
        vehicle_delivery_date: document.getElementById('input-vehicle-delivery-date').value,
        tax_number: document.getElementById('input-tax-number').value,
        external_doc_no: document.getElementById('input-external-doc-no').value,
        service_staff: document.getElementById('input-service-staff').value
    };

    const carInfo = {
        plate_no: document.getElementById('input-plate-no').value,
        make: document.getElementById('input-vehicle-make').value,
        model: document.getElementById('input-vehicle-model').value,
        mileage: document.getElementById('input-mileage').value,
        vehicle_id: document.getElementById('input-vehicle-id').value,
        first_license_date: document.getElementById('input-first-license-date').value,
        next_inspection: document.getElementById('input-next-inspection').value
    };
    
    const vatRate = document.getElementById('vat-rate').value;

    const requestBody = {
        customer_info: customerInfo,
        car_info: carInfo,
        cart: cart,
        vat_rate: vatRate
    };

    try {
        const response = await fetch('/api/create_work_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'is_emri.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            const error = await response.json();
            alert(`Hata: ${error.error}`);
        }
    } catch (error) {
        alert(`PDF oluşturulurken bir hata oluştu: ${error.message}`);
    }
}
        
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('order-date').textContent = new Date().toLocaleDateString('tr-TR');
    vatRateInput.addEventListener('change', () => {
        vatRateText.textContent = vatRateInput.value;
        calculateTotals();
    });
});

searchButton.addEventListener('click', searchParts);
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

cartItemsBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-from-cart-btn')) {
        const partCode = e.target.dataset.code;
        removeFromCart(partCode);
    }
});

cartItemsBody.addEventListener('input', (e) => {
    if (e.target.classList.contains('quantity-input')) {
        const partCode = e.target.dataset.code;
        const quantity = parseInt(e.target.value, 10);
        updateCartQuantity(partCode, quantity);
    }
});

vatRateInput.addEventListener('change', calculateTotals);
generatePdfButton.addEventListener('click', generatePdf);