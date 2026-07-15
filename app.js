// ============================================
// Quản lý Nhập Xuất Tồn Hàng Hóa
// ============================================

(function () {
    'use strict';

    // --- Data Store (localStorage) ---
    const STORAGE_KEYS = {
        PRODUCTS: 'inventory_products',
        TRANSACTIONS: 'inventory_transactions',
        SUPPLIERS: 'inventory_suppliers',
        CUSTOMERS: 'inventory_customers'
    };

    function loadData(key) {
        try {
            var data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }
    function saveData(key, data) {
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    }

    var products = loadData(STORAGE_KEYS.PRODUCTS);
    var transactions = loadData(STORAGE_KEYS.TRANSACTIONS);
    var suppliers = loadData(STORAGE_KEYS.SUPPLIERS);
    var customers = loadData(STORAGE_KEYS.CUSTOMERS);

    // --- Utilities ---
    function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }
    function getTodayDate() { return new Date().toISOString().split('T')[0]; }
    function formatDate(d) { var p = d.split('-'); return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : d; }
    function formatCurrency(a) { return a ? Number(a).toLocaleString('vi-VN') + ' đ' : '-'; }
    function formatNumber(n) { return Number(n).toLocaleString('vi-VN'); }
    function escapeHtml(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function showToast(message, type) {
        type = type || 'success';
        var container = document.querySelector('.toast-container');
        if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(function () { toast.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(function () { toast.remove(); }, 300); }, 3000);
    }

    // --- Tab Navigation ---
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('tab-' + tabId).classList.add('active');
            if (tabId === 'import' || tabId === 'export') populateSelects();
            if (tabId === 'reports') populateReportFilters();
        });
    });

    // --- Delete Modal ---
    var deleteModal = document.getElementById('deleteModal');
    var pendingDeleteCb = null;
    function showDeleteModal(msg, cb) {
        document.getElementById('deleteMessage').textContent = msg;
        pendingDeleteCb = cb;
        deleteModal.classList.remove('hidden');
    }
    document.getElementById('btnConfirmDelete').addEventListener('click', function () { if (pendingDeleteCb) pendingDeleteCb(); deleteModal.classList.add('hidden'); pendingDeleteCb = null; });
    document.getElementById('btnCancelDelete').addEventListener('click', function () { deleteModal.classList.add('hidden'); pendingDeleteCb = null; });
    document.querySelector('#deleteModal .modal-overlay').addEventListener('click', function () { deleteModal.classList.add('hidden'); pendingDeleteCb = null; });

    // =============================================
    // PRODUCT MANAGEMENT
    // =============================================
    var btnAddProduct = document.getElementById('btnAddProduct');
    var productForm = document.getElementById('productForm');
    var formProduct = document.getElementById('formProduct');
    var btnCancelProduct = document.getElementById('btnCancelProduct');
    var productFormTitle = document.getElementById('productFormTitle');
    var editingProductId = null;

    btnAddProduct.addEventListener('click', function () { editingProductId = null; productFormTitle.textContent = 'Thêm sản phẩm mới'; formProduct.reset(); productForm.classList.remove('hidden'); });
    btnCancelProduct.addEventListener('click', function () { productForm.classList.add('hidden'); formProduct.reset(); editingProductId = null; });

    formProduct.addEventListener('submit', function (e) {
        e.preventDefault();
        var code = document.getElementById('productCode').value.trim();
        var name = document.getElementById('productName').value.trim();
        var unit = document.getElementById('productUnit').value.trim();
        var price = parseInt(document.getElementById('productPrice').value) || 0;
        var note = document.getElementById('productNote').value.trim();
        if (!code || !name || !unit) { showToast('Vui lòng điền đầy đủ thông tin bắt buộc!', 'error'); return; }
        if (editingProductId) {
            var idx = products.findIndex(function (p) { return p.id === editingProductId; });
            if (idx !== -1) {
                if (products.find(function (p) { return p.code === code && p.id !== editingProductId; })) { showToast('Mã hàng đã tồn tại!', 'error'); return; }
                products[idx].code = code; products[idx].name = name; products[idx].unit = unit; products[idx].price = price; products[idx].note = note;
                showToast('Cập nhật sản phẩm thành công!');
            }
        } else {
            if (products.find(function (p) { return p.code === code; })) { showToast('Mã hàng đã tồn tại!', 'error'); return; }
            products.push({ id: generateId(), code: code, name: name, unit: unit, price: price, note: note, stock: 0, createdAt: new Date().toISOString() });
            showToast('Thêm sản phẩm thành công!');
        }
        saveData(STORAGE_KEYS.PRODUCTS, products); renderProducts(); updateDashboard();
        productForm.classList.add('hidden'); formProduct.reset(); editingProductId = null;
    });

    function editProduct(id) {
        var p = products.find(function (x) { return x.id === id; }); if (!p) return;
        editingProductId = id; productFormTitle.textContent = 'Sửa sản phẩm';
        document.getElementById('productCode').value = p.code; document.getElementById('productName').value = p.name;
        document.getElementById('productUnit').value = p.unit; document.getElementById('productPrice').value = p.price;
        document.getElementById('productNote').value = p.note || ''; productForm.classList.remove('hidden');
    }
    function deleteProduct(id) {
        showDeleteModal('Xóa sản phẩm này? Các chứng từ liên quan cũng sẽ bị xóa.', function () {
            products = products.filter(function (p) { return p.id !== id; });
            transactions = transactions.filter(function (t) { return !t.lines || !t.lines.some(function (l) { return l.productId === id; }); });
            saveData(STORAGE_KEYS.PRODUCTS, products); saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
            renderProducts(); renderHistory(); updateDashboard(); showToast('Đã xóa sản phẩm!');
        });
    }
    function renderProducts() {
        var tbody = document.getElementById('productsBody');
        if (!products.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Chưa có sản phẩm nào.</td></tr>'; return; }
        tbody.innerHTML = products.map(function (p) {
            var sc = p.stock === 0 ? 'stock-out' : p.stock <= 10 ? 'stock-low' : 'stock-ok';
            var sl = p.stock === 0 ? 'Hết hàng' : p.stock <= 10 ? 'Sắp hết' : p.stock;
            return '<tr><td><strong>'+escapeHtml(p.code)+'</strong></td><td>'+escapeHtml(p.name)+'</td><td>'+escapeHtml(p.unit)+'</td><td>'+formatCurrency(p.price)+'</td><td><span class="stock-badge '+sc+'">'+sl+'</span></td><td><div class="action-btns"><button class="btn btn-primary btn-sm" onclick="window.app.editProduct(\''+p.id+'\')">Sửa</button><button class="btn btn-danger btn-sm" onclick="window.app.deleteProduct(\''+p.id+'\')">Xóa</button></div></td></tr>';
        }).join('');
    }

    // =============================================
    // SUPPLIER MANAGEMENT
    // =============================================
    var btnAddSupplier = document.getElementById('btnAddSupplier');
    var supplierForm = document.getElementById('supplierForm');
    var formSupplier = document.getElementById('formSupplier');
    var btnCancelSupplier = document.getElementById('btnCancelSupplier');
    var supplierFormTitle = document.getElementById('supplierFormTitle');
    var editingSupplierId = null;

    btnAddSupplier.addEventListener('click', function () { editingSupplierId = null; supplierFormTitle.textContent = 'Thêm nhà cung cấp mới'; formSupplier.reset(); supplierForm.classList.remove('hidden'); });
    btnCancelSupplier.addEventListener('click', function () { supplierForm.classList.add('hidden'); formSupplier.reset(); editingSupplierId = null; });

    formSupplier.addEventListener('submit', function (e) {
        e.preventDefault();
        var code = document.getElementById('supplierCode').value.trim(), name = document.getElementById('supplierName').value.trim();
        var phone = document.getElementById('supplierPhone').value.trim(), email = document.getElementById('supplierEmail').value.trim();
        var tax = document.getElementById('supplierTax').value.trim(), address = document.getElementById('supplierAddress').value.trim();
        var note = document.getElementById('supplierNote').value.trim();
        if (!code || !name) { showToast('Vui lòng điền mã và tên NCC!', 'error'); return; }
        if (editingSupplierId) {
            var idx = suppliers.findIndex(function (s) { return s.id === editingSupplierId; });
            if (idx !== -1) {
                if (suppliers.find(function (s) { return s.code === code && s.id !== editingSupplierId; })) { showToast('Mã NCC đã tồn tại!', 'error'); return; }
                suppliers[idx] = { id: editingSupplierId, code: code, name: name, phone: phone, email: email, tax: tax, address: address, note: note };
                showToast('Cập nhật NCC thành công!');
            }
        } else {
            if (suppliers.find(function (s) { return s.code === code; })) { showToast('Mã NCC đã tồn tại!', 'error'); return; }
            suppliers.push({ id: generateId(), code: code, name: name, phone: phone, email: email, tax: tax, address: address, note: note });
            showToast('Thêm NCC thành công!');
        }
        saveData(STORAGE_KEYS.SUPPLIERS, suppliers); renderSuppliers(); supplierForm.classList.add('hidden'); formSupplier.reset(); editingSupplierId = null;
    });
    function editSupplier(id) {
        var s = suppliers.find(function (x) { return x.id === id; }); if (!s) return;
        editingSupplierId = id; supplierFormTitle.textContent = 'Sửa nhà cung cấp';
        document.getElementById('supplierCode').value = s.code; document.getElementById('supplierName').value = s.name;
        document.getElementById('supplierPhone').value = s.phone || ''; document.getElementById('supplierEmail').value = s.email || '';
        document.getElementById('supplierTax').value = s.tax || ''; document.getElementById('supplierAddress').value = s.address || '';
        document.getElementById('supplierNote').value = s.note || ''; supplierForm.classList.remove('hidden');
    }
    function deleteSupplier(id) { showDeleteModal('Xóa nhà cung cấp này?', function () { suppliers = suppliers.filter(function (s) { return s.id !== id; }); saveData(STORAGE_KEYS.SUPPLIERS, suppliers); renderSuppliers(); showToast('Đã xóa NCC!'); }); }
    function renderSuppliers() {
        var tbody = document.getElementById('suppliersBody');
        if (!suppliers.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Chưa có nhà cung cấp nào.</td></tr>'; return; }
        tbody.innerHTML = suppliers.map(function (s) {
            return '<tr><td><strong>'+escapeHtml(s.code)+'</strong></td><td>'+escapeHtml(s.name)+'</td><td>'+escapeHtml(s.phone||'-')+'</td><td>'+escapeHtml(s.email||'-')+'</td><td>'+escapeHtml(s.tax||'-')+'</td><td><div class="action-btns"><button class="btn btn-primary btn-sm" onclick="window.app.editSupplier(\''+s.id+'\')">Sửa</button><button class="btn btn-danger btn-sm" onclick="window.app.deleteSupplier(\''+s.id+'\')">Xóa</button></div></td></tr>';
        }).join('');
    }

    // =============================================
    // CUSTOMER MANAGEMENT
    // =============================================
    var btnAddCustomer = document.getElementById('btnAddCustomer');
    var customerForm = document.getElementById('customerForm');
    var formCustomer = document.getElementById('formCustomer');
    var btnCancelCustomer = document.getElementById('btnCancelCustomer');
    var customerFormTitle = document.getElementById('customerFormTitle');
    var editingCustomerId = null;

    btnAddCustomer.addEventListener('click', function () { editingCustomerId = null; customerFormTitle.textContent = 'Thêm khách hàng mới'; formCustomer.reset(); customerForm.classList.remove('hidden'); });
    btnCancelCustomer.addEventListener('click', function () { customerForm.classList.add('hidden'); formCustomer.reset(); editingCustomerId = null; });

    formCustomer.addEventListener('submit', function (e) {
        e.preventDefault();
        var code = document.getElementById('customerCode').value.trim(), name = document.getElementById('customerName').value.trim();
        var phone = document.getElementById('customerPhone').value.trim(), email = document.getElementById('customerEmail').value.trim();
        var tax = document.getElementById('customerTax').value.trim(), address = document.getElementById('customerAddress').value.trim();
        var note = document.getElementById('customerNote').value.trim();
        if (!code || !name) { showToast('Vui lòng điền mã và tên KH!', 'error'); return; }
        if (editingCustomerId) {
            var idx = customers.findIndex(function (c) { return c.id === editingCustomerId; });
            if (idx !== -1) {
                if (customers.find(function (c) { return c.code === code && c.id !== editingCustomerId; })) { showToast('Mã KH đã tồn tại!', 'error'); return; }
                customers[idx] = { id: editingCustomerId, code: code, name: name, phone: phone, email: email, tax: tax, address: address, note: note };
                showToast('Cập nhật KH thành công!');
            }
        } else {
            if (customers.find(function (c) { return c.code === code; })) { showToast('Mã KH đã tồn tại!', 'error'); return; }
            customers.push({ id: generateId(), code: code, name: name, phone: phone, email: email, tax: tax, address: address, note: note });
            showToast('Thêm KH thành công!');
        }
        saveData(STORAGE_KEYS.CUSTOMERS, customers); renderCustomers(); customerForm.classList.add('hidden'); formCustomer.reset(); editingCustomerId = null;
    });
    function editCustomer(id) {
        var c = customers.find(function (x) { return x.id === id; }); if (!c) return;
        editingCustomerId = id; customerFormTitle.textContent = 'Sửa khách hàng';
        document.getElementById('customerCode').value = c.code; document.getElementById('customerName').value = c.name;
        document.getElementById('customerPhone').value = c.phone || ''; document.getElementById('customerEmail').value = c.email || '';
        document.getElementById('customerTax').value = c.tax || ''; document.getElementById('customerAddress').value = c.address || '';
        document.getElementById('customerNote').value = c.note || ''; customerForm.classList.remove('hidden');
    }
    function deleteCustomer(id) { showDeleteModal('Xóa khách hàng này?', function () { customers = customers.filter(function (c) { return c.id !== id; }); saveData(STORAGE_KEYS.CUSTOMERS, customers); renderCustomers(); showToast('Đã xóa KH!'); }); }
    function renderCustomers() {
        var tbody = document.getElementById('customersBody');
        if (!customers.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Chưa có khách hàng nào.</td></tr>'; return; }
        tbody.innerHTML = customers.map(function (c) {
            return '<tr><td><strong>'+escapeHtml(c.code)+'</strong></td><td>'+escapeHtml(c.name)+'</td><td>'+escapeHtml(c.phone||'-')+'</td><td>'+escapeHtml(c.email||'-')+'</td><td>'+escapeHtml(c.tax||'-')+'</td><td><div class="action-btns"><button class="btn btn-primary btn-sm" onclick="window.app.editCustomer(\''+c.id+'\')">Sửa</button><button class="btn btn-danger btn-sm" onclick="window.app.deleteCustomer(\''+c.id+'\')">Xóa</button></div></td></tr>';
        }).join('');
    }

    // =============================================
    // POPULATE SELECTS
    // =============================================
    function populateSelects() {
        var importSupplier = document.getElementById('importSupplier');
        var exportCustomer = document.getElementById('exportCustomer');

        importSupplier.innerHTML = '<option value="">-- Chọn nhà cung cấp --</option>' +
            suppliers.map(function (s) { return '<option value="'+s.id+'">'+escapeHtml(s.code)+' - '+escapeHtml(s.name)+'</option>'; }).join('');
        exportCustomer.innerHTML = '<option value="">-- Chọn khách hàng --</option>' +
            customers.map(function (c) { return '<option value="'+c.id+'">'+escapeHtml(c.code)+' - '+escapeHtml(c.name)+'</option>'; }).join('');
    }

    function getProductOptions(selectedId) {
        return '<option value="">-- Chọn SP --</option>' +
            products.map(function (p) { return '<option value="'+p.id+'"'+(p.id===selectedId?' selected':'')+'>'+escapeHtml(p.code)+' - '+escapeHtml(p.name)+' ('+escapeHtml(p.unit)+')</option>'; }).join('');
    }

    // =============================================
    // SEARCHABLE PRODUCT SELECT COMPONENT
    // =============================================
    function createSearchableProductSelect(container, selectedId, onChangeCallback) {
        var wrapper = document.createElement('div');
        wrapper.className = 'searchable-select';

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'searchable-input';
        input.placeholder = 'Gõ để tìm sản phẩm...';
        input.autocomplete = 'off';

        var hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.className = 'line-product-value';

        var dropdown = document.createElement('div');
        dropdown.className = 'searchable-dropdown';

        wrapper.appendChild(input);
        wrapper.appendChild(hiddenInput);
        wrapper.appendChild(dropdown);
        container.appendChild(wrapper);

        // If there's already a selected product, show it
        if (selectedId) {
            var prod = products.find(function (p) { return p.id === selectedId; });
            if (prod) {
                input.value = prod.code + ' - ' + prod.name + ' (' + prod.unit + ')';
                hiddenInput.value = selectedId;
            }
        }

        function showDropdown() { dropdown.classList.add('open'); }
        function hideDropdown() { dropdown.classList.remove('open'); }

        function renderDropdown(filter) {
            var filtered = products;
            if (filter) {
                var f = filter.toLowerCase();
                filtered = products.filter(function (p) {
                    return p.code.toLowerCase().includes(f) || p.name.toLowerCase().includes(f) || p.unit.toLowerCase().includes(f);
                });
            }
            if (!filtered.length) {
                dropdown.innerHTML = '<div class="searchable-item searchable-empty">Không tìm thấy</div>';
            } else {
                dropdown.innerHTML = filtered.map(function (p) {
                    return '<div class="searchable-item" data-id="'+p.id+'"><strong>'+escapeHtml(p.code)+'</strong> - '+escapeHtml(p.name)+' <span class="searchable-unit">('+escapeHtml(p.unit)+')</span></div>';
                }).join('');
            }
            showDropdown();
        }

        input.addEventListener('focus', function () {
            // Clear hidden value when user starts editing to allow re-selection
            renderDropdown(input.value);
        });

        input.addEventListener('input', function () {
            hiddenInput.value = '';  // Clear selection when typing
            renderDropdown(input.value);
        });

        dropdown.addEventListener('mousedown', function (e) {
            e.preventDefault(); // Prevent blur from firing before click
            var item = e.target.closest('.searchable-item');
            if (item && item.dataset.id) {
                var prod = products.find(function (p) { return p.id === item.dataset.id; });
                if (prod) {
                    input.value = prod.code + ' - ' + prod.name + ' (' + prod.unit + ')';
                    hiddenInput.value = prod.id;
                    hideDropdown();
                    if (onChangeCallback) onChangeCallback(prod);
                }
            }
        });

        input.addEventListener('blur', function () {
            setTimeout(function () { hideDropdown(); }, 200);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { hideDropdown(); input.blur(); }
        });

        return { wrapper: wrapper, input: input, hiddenInput: hiddenInput };
    }

    // =============================================
    // VOUCHER LINES ENGINE (shared for import, export, edit)
    // =============================================
    function createLineRow(tbody, prefix, lineData) {
        var row = document.createElement('tr');
        var idx = tbody.querySelectorAll('tr').length + 1;
        var productId = lineData ? lineData.productId : '';
        var qty = lineData ? lineData.quantity : '';
        var price = lineData ? lineData.unitPrice : '';
        var amount = lineData ? lineData.amount : '';
        var tax = lineData ? lineData.tax : '';
        var subtotal = lineData ? lineData.subtotal : '';

        row.innerHTML =
            '<td class="line-stt">' + idx + '</td>' +
            '<td class="line-product-cell"></td>' +
            '<td><input type="number" class="line-qty" value="'+(qty||'')+'" min="1" placeholder="0"></td>' +
            '<td><input type="number" class="line-price" value="'+(price||'')+'" min="0" placeholder="0"></td>' +
            '<td class="line-amount">'+(amount ? formatCurrency(amount) : '-')+'</td>' +
            '<td><input type="number" class="line-tax" value="'+(tax||'')+'" min="0" placeholder="0"></td>' +
            '<td class="line-subtotal">'+(subtotal ? formatCurrency(subtotal) : '-')+'</td>' +
            '<td><button type="button" class="btn-remove-line" title="Xóa dòng">&times;</button></td>';

        tbody.appendChild(row);

        // Create searchable product select
        var productCell = row.querySelector('.line-product-cell');
        var qtyInput = row.querySelector('.line-qty');
        var priceInput = row.querySelector('.line-price');
        var taxInput = row.querySelector('.line-tax');
        var removeBtn = row.querySelector('.btn-remove-line');

        function calcLine() {
            var q = parseInt(qtyInput.value) || 0;
            var p = parseInt(priceInput.value) || 0;
            var t = parseInt(taxInput.value) || 0;
            var amt = q * p;
            var sub = amt + t;
            row.querySelector('.line-amount').textContent = amt ? formatCurrency(amt) : '-';
            row.querySelector('.line-subtotal').textContent = sub ? formatCurrency(sub) : '-';
            calcTotals(tbody, prefix);
        }

        var searchSelect = createSearchableProductSelect(productCell, productId, function (prod) {
            if (prod && prod.price) { priceInput.value = prod.price; calcLine(); }
        });

        qtyInput.addEventListener('input', calcLine);
        priceInput.addEventListener('input', calcLine);
        taxInput.addEventListener('input', calcLine);

        removeBtn.addEventListener('click', function () {
            row.remove();
            reindexLines(tbody);
            calcTotals(tbody, prefix);
        });

        return row;
    }

    function reindexLines(tbody) {
        var rows = tbody.querySelectorAll('tr');
        rows.forEach(function (r, i) { r.querySelector('.line-stt').textContent = i + 1; });
    }

    function calcTotals(tbody, prefix) {
        var rows = tbody.querySelectorAll('tr');
        var totalAmount = 0, totalTax = 0, grandTotal = 0;
        rows.forEach(function (r) {
            var q = parseInt(r.querySelector('.line-qty').value) || 0;
            var p = parseInt(r.querySelector('.line-price').value) || 0;
            var t = parseInt(r.querySelector('.line-tax').value) || 0;
            var amt = q * p;
            totalAmount += amt;
            totalTax += t;
            grandTotal += amt + t;
        });
        document.getElementById(prefix + 'TotalAmount').textContent = formatCurrency(totalAmount);
        document.getElementById(prefix + 'TotalTax').textContent = formatCurrency(totalTax);
        document.getElementById(prefix + 'GrandTotal').textContent = formatCurrency(grandTotal);
    }

    function getLinesData(tbody) {
        var lines = [];
        tbody.querySelectorAll('tr').forEach(function (r) {
            var hiddenInput = r.querySelector('.line-product-value');
            var productId = hiddenInput ? hiddenInput.value : '';
            var qty = parseInt(r.querySelector('.line-qty').value) || 0;
            var price = parseInt(r.querySelector('.line-price').value) || 0;
            var tax = parseInt(r.querySelector('.line-tax').value) || 0;
            if (productId && qty > 0) {
                var prod = products.find(function (x) { return x.id === productId; });
                lines.push({
                    productId: productId,
                    productCode: prod ? prod.code : '',
                    productName: prod ? prod.name : '',
                    quantity: qty,
                    unitPrice: price,
                    amount: qty * price,
                    tax: tax,
                    subtotal: qty * price + tax
                });
            }
        });
        return lines;
    }

    // =============================================
    // IMPORT (Nhập hàng) - Multi-line
    // =============================================
    var formImport = document.getElementById('formImport');
    var importLinesBody = document.getElementById('importLinesBody');
    var importDateEl = document.getElementById('importDate');
    importDateEl.value = getTodayDate();

    document.getElementById('btnAddImportLine').addEventListener('click', function () {
        createLineRow(importLinesBody, 'import');
    });
    // Add first line by default
    createLineRow(importLinesBody, 'import');

    formImport.addEventListener('submit', function (e) {
        e.preventDefault();
        var supplierId = document.getElementById('importSupplier').value;
        var date = document.getElementById('importDate').value;
        var invoiceSeri = document.getElementById('importInvoiceSeri').value.trim();
        var invoiceNumber = document.getElementById('importInvoiceNumber').value.trim();
        var note = document.getElementById('importNote').value.trim();

        if (!supplierId) { showToast('Vui lòng chọn nhà cung cấp!', 'error'); return; }
        if (!date) { showToast('Vui lòng chọn ngày nhập!', 'error'); return; }

        var lines = getLinesData(importLinesBody);
        if (!lines.length) { showToast('Vui lòng thêm ít nhất 1 dòng hàng hóa!', 'error'); return; }

        var supplier = suppliers.find(function (s) { return s.id === supplierId; });
        if (!supplier) { showToast('NCC không tồn tại!', 'error'); return; }

        // Update stock
        for (var i = 0; i < lines.length; i++) {
            var pIdx = products.findIndex(function (p) { return p.id === lines[i].productId; });
            if (pIdx === -1) { showToast('Sản phẩm "' + lines[i].productName + '" không tồn tại!', 'error'); return; }
            products[pIdx].stock += lines[i].quantity;
        }

        var totalAmount = lines.reduce(function (s, l) { return s + l.amount; }, 0);
        var totalTax = lines.reduce(function (s, l) { return s + l.tax; }, 0);
        var grandTotal = lines.reduce(function (s, l) { return s + l.subtotal; }, 0);

        transactions.push({
            id: generateId(),
            type: 'import',
            supplierId: supplierId,
            supplierName: supplier.name,
            customerId: null,
            customerName: null,
            lines: lines,
            totalAmount: totalAmount,
            totalTax: totalTax,
            grandTotal: grandTotal,
            invoiceSeri: invoiceSeri,
            invoiceNumber: invoiceNumber,
            date: date,
            note: note,
            createdAt: new Date().toISOString()
        });

        saveData(STORAGE_KEYS.PRODUCTS, products);
        saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
        renderProducts(); renderHistory(); updateDashboard();
        showToast('Nhập hàng thành công! (' + lines.length + ' dòng)');

        // Reset form
        formImport.reset(); importDateEl.value = getTodayDate();
        importLinesBody.innerHTML = '';
        createLineRow(importLinesBody, 'import');
        calcTotals(importLinesBody, 'import');
    });

    // =============================================
    // EXPORT (Xuất hàng) - Multi-line
    // =============================================
    var formExport = document.getElementById('formExport');
    var exportLinesBody = document.getElementById('exportLinesBody');
    var exportDateEl = document.getElementById('exportDate');
    exportDateEl.value = getTodayDate();

    document.getElementById('btnAddExportLine').addEventListener('click', function () {
        createLineRow(exportLinesBody, 'export');
    });
    createLineRow(exportLinesBody, 'export');

    formExport.addEventListener('submit', function (e) {
        e.preventDefault();
        var customerId = document.getElementById('exportCustomer').value;
        var date = document.getElementById('exportDate').value;
        var invoiceSeri = document.getElementById('exportInvoiceSeri').value.trim();
        var invoiceNumber = document.getElementById('exportInvoiceNumber').value.trim();
        var note = document.getElementById('exportNote').value.trim();

        if (!customerId) { showToast('Vui lòng chọn khách hàng!', 'error'); return; }
        if (!date) { showToast('Vui lòng chọn ngày xuất!', 'error'); return; }

        var lines = getLinesData(exportLinesBody);
        if (!lines.length) { showToast('Vui lòng thêm ít nhất 1 dòng hàng hóa!', 'error'); return; }

        var customer = customers.find(function (c) { return c.id === customerId; });
        if (!customer) { showToast('Khách hàng không tồn tại!', 'error'); return; }

        // Check stock
        for (var i = 0; i < lines.length; i++) {
            var pIdx = products.findIndex(function (p) { return p.id === lines[i].productId; });
            if (pIdx === -1) { showToast('Sản phẩm "' + lines[i].productName + '" không tồn tại!', 'error'); return; }
            if (products[pIdx].stock < lines[i].quantity) {
                showToast('Tồn kho "' + products[pIdx].name + '" không đủ! (Tồn: ' + products[pIdx].stock + ')', 'error'); return;
            }
        }
        // Deduct stock
        for (var j = 0; j < lines.length; j++) {
            var pIdx2 = products.findIndex(function (p) { return p.id === lines[j].productId; });
            products[pIdx2].stock -= lines[j].quantity;
        }

        var totalAmount = lines.reduce(function (s, l) { return s + l.amount; }, 0);
        var totalTax = lines.reduce(function (s, l) { return s + l.tax; }, 0);
        var grandTotal = lines.reduce(function (s, l) { return s + l.subtotal; }, 0);

        transactions.push({
            id: generateId(),
            type: 'export',
            supplierId: null,
            supplierName: null,
            customerId: customerId,
            customerName: customer.name,
            lines: lines,
            totalAmount: totalAmount,
            totalTax: totalTax,
            grandTotal: grandTotal,
            invoiceSeri: invoiceSeri,
            invoiceNumber: invoiceNumber,
            date: date,
            note: note,
            createdAt: new Date().toISOString()
        });

        saveData(STORAGE_KEYS.PRODUCTS, products);
        saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
        renderProducts(); renderHistory(); updateDashboard();
        showToast('Xuất hàng thành công! (' + lines.length + ' dòng)');

        formExport.reset(); exportDateEl.value = getTodayDate();
        exportLinesBody.innerHTML = '';
        createLineRow(exportLinesBody, 'export');
        calcTotals(exportLinesBody, 'export');
    });

    // =============================================
    // HISTORY (supports multi-line transactions)
    // =============================================
    var filterType = document.getElementById('filterType');
    var filterSearch = document.getElementById('filterSearch');
    filterType.addEventListener('change', renderHistory);
    filterSearch.addEventListener('input', renderHistory);

    function renderHistory() {
        var tbody = document.getElementById('historyBody');
        var type = filterType.value;
        var search = filterSearch.value.toLowerCase().trim();

        var filtered = transactions.slice();
        if (type !== 'all') filtered = filtered.filter(function (t) { return t.type === type; });
        if (search) {
            filtered = filtered.filter(function (t) {
                var match = (t.supplierName && t.supplierName.toLowerCase().includes(search)) ||
                    (t.customerName && t.customerName.toLowerCase().includes(search)) ||
                    (t.invoiceSeri && t.invoiceSeri.toLowerCase().includes(search)) ||
                    (t.invoiceNumber && t.invoiceNumber.toLowerCase().includes(search)) ||
                    (t.note && t.note.toLowerCase().includes(search));
                if (!match && t.lines) {
                    match = t.lines.some(function (l) {
                        return (l.productCode && l.productCode.toLowerCase().includes(search)) ||
                            (l.productName && l.productName.toLowerCase().includes(search));
                    });
                }
                return match;
            });
        }
        filtered.sort(function (a, b) { return new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt); });

        if (!filtered.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="10">Chưa có giao dịch nào.</td></tr>'; return; }

        tbody.innerHTML = filtered.map(function (t) {
            var typeLabel = t.type === 'import' ? 'Nhập' : 'Xuất';
            var typeClass = t.type === 'import' ? 'type-import' : 'type-export';
            var partner = t.type === 'import' ? escapeHtml(t.supplierName || '-') : escapeHtml(t.customerName || '-');
            var invoice = (t.invoiceSeri || t.invoiceNumber) ? escapeHtml(t.invoiceSeri || '') + ' - ' + escapeHtml(t.invoiceNumber || '') : '-';

            // Multi-line: show products summary
            var productsHtml = '-';
            var totalQty = 0;
            if (t.lines && t.lines.length) {
                productsHtml = t.lines.map(function (l) { return escapeHtml(l.productCode); }).join(', ');
                totalQty = t.lines.reduce(function (s, l) { return s + l.quantity; }, 0);
            } else if (t.productCode) {
                // Backward compat with old single-line format
                productsHtml = escapeHtml(t.productCode) + ' - ' + escapeHtml(t.productName);
                totalQty = t.quantity || 0;
            }

            var amount = t.totalAmount || t.amount || 0;
            var tax = t.totalTax || t.tax || 0;
            var total = t.grandTotal || t.total || 0;

            return '<tr>' +
                '<td>' + formatDate(t.date) + '</td>' +
                '<td><span class="type-badge ' + typeClass + '">' + typeLabel + '</span></td>' +
                '<td>' + partner + '</td>' +
                '<td>' + productsHtml + '</td>' +
                '<td><strong>' + totalQty + '</strong></td>' +
                '<td class="currency">' + formatCurrency(amount) + '</td>' +
                '<td class="currency">' + formatCurrency(tax) + '</td>' +
                '<td class="currency">' + formatCurrency(total) + '</td>' +
                '<td class="invoice-info">' + invoice + '</td>' +
                '<td><div class="action-btns">' +
                '<button class="btn btn-primary btn-sm" onclick="window.app.editTransaction(\'' + t.id + '\')">Sửa</button>' +
                '<button class="btn btn-danger btn-sm" onclick="window.app.deleteTransaction(\'' + t.id + '\')">Xóa</button>' +
                '</div></td></tr>';
        }).join('');
    }

    // =============================================
    // EDIT TRANSACTION (Multi-line modal)
    // =============================================
    var editTransModal = document.getElementById('editTransModal');
    var formEditTrans = document.getElementById('formEditTrans');
    var btnCancelEditTrans = document.getElementById('btnCancelEditTrans');
    var editTransOverlay = document.getElementById('editTransOverlay');
    var editLinesBody = document.getElementById('editLinesBody');

    document.getElementById('btnAddEditLine').addEventListener('click', function () {
        createLineRow(editLinesBody, 'edit');
    });

    function editTransaction(id) {
        var t = transactions.find(function (x) { return x.id === id; });
        if (!t) return;

        document.getElementById('editTransId').value = t.id;
        document.getElementById('editTransType').value = t.type;
        document.getElementById('editTransTitle').textContent = t.type === 'import' ? 'Sửa phiếu nhập hàng' : 'Sửa phiếu xuất hàng';

        // Partner select
        var partnerLabel = document.getElementById('editTransPartnerLabel');
        var partnerSelect = document.getElementById('editTransPartner');
        if (t.type === 'import') {
            partnerLabel.textContent = 'Nhà cung cấp *';
            partnerSelect.innerHTML = '<option value="">-- Chọn NCC --</option>' +
                suppliers.map(function (s) { return '<option value="'+s.id+'"'+(s.id===t.supplierId?' selected':'')+'>'+escapeHtml(s.code)+' - '+escapeHtml(s.name)+'</option>'; }).join('');
        } else {
            partnerLabel.textContent = 'Khách hàng *';
            partnerSelect.innerHTML = '<option value="">-- Chọn KH --</option>' +
                customers.map(function (c) { return '<option value="'+c.id+'"'+(c.id===t.customerId?' selected':'')+'>'+escapeHtml(c.code)+' - '+escapeHtml(c.name)+'</option>'; }).join('');
        }

        document.getElementById('editTransDate').value = t.date;
        document.getElementById('editTransSeri').value = t.invoiceSeri || '';
        document.getElementById('editTransInvoiceNum').value = t.invoiceNumber || '';
        document.getElementById('editTransNote').value = t.note || '';

        // Populate lines
        editLinesBody.innerHTML = '';
        if (t.lines && t.lines.length) {
            t.lines.forEach(function (l) { createLineRow(editLinesBody, 'edit', l); });
        } else if (t.productId) {
            // Backward compat
            createLineRow(editLinesBody, 'edit', { productId: t.productId, quantity: t.quantity, unitPrice: t.amount ? Math.round(t.amount / t.quantity) : 0, amount: t.amount || 0, tax: t.tax || 0, subtotal: t.total || 0 });
        }
        calcTotals(editLinesBody, 'edit');
        editTransModal.classList.remove('hidden');
    }

    function closeEditModal() { editTransModal.classList.add('hidden'); formEditTrans.reset(); editLinesBody.innerHTML = ''; }
    btnCancelEditTrans.addEventListener('click', closeEditModal);
    editTransOverlay.addEventListener('click', closeEditModal);

    formEditTrans.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = document.getElementById('editTransId').value;
        var type = document.getElementById('editTransType').value;
        var partnerId = document.getElementById('editTransPartner').value;
        var date = document.getElementById('editTransDate').value;
        var invoiceSeri = document.getElementById('editTransSeri').value.trim();
        var invoiceNumber = document.getElementById('editTransInvoiceNum').value.trim();
        var note = document.getElementById('editTransNote').value.trim();

        if (!partnerId) { showToast('Vui lòng chọn NCC/KH!', 'error'); return; }
        if (!date) { showToast('Vui lòng chọn ngày!', 'error'); return; }

        var lines = getLinesData(editLinesBody);
        if (!lines.length) { showToast('Cần ít nhất 1 dòng hàng hóa!', 'error'); return; }

        var tIdx = transactions.findIndex(function (x) { return x.id === id; });
        if (tIdx === -1) { showToast('Không tìm thấy chứng từ!', 'error'); return; }

        var oldTrans = transactions[tIdx];

        // Revert old stock
        if (oldTrans.lines && oldTrans.lines.length) {
            oldTrans.lines.forEach(function (l) {
                var pi = products.findIndex(function (p) { return p.id === l.productId; });
                if (pi !== -1) {
                    if (oldTrans.type === 'import') products[pi].stock -= l.quantity;
                    else products[pi].stock += l.quantity;
                }
            });
        } else if (oldTrans.productId) {
            var pi = products.findIndex(function (p) { return p.id === oldTrans.productId; });
            if (pi !== -1) {
                if (oldTrans.type === 'import') products[pi].stock -= (oldTrans.quantity || 0);
                else products[pi].stock += (oldTrans.quantity || 0);
            }
        }

        // Check stock for export
        if (type === 'export') {
            for (var i = 0; i < lines.length; i++) {
                var pIdx = products.findIndex(function (p) { return p.id === lines[i].productId; });
                if (pIdx === -1) { showToast('SP không tồn tại!', 'error'); reapplyOldStock(oldTrans); return; }
                if (products[pIdx].stock < lines[i].quantity) {
                    showToast('Tồn kho "' + products[pIdx].name + '" không đủ!', 'error');
                    reapplyOldStock(oldTrans); return;
                }
            }
        }

        // Apply new stock
        for (var j = 0; j < lines.length; j++) {
            var pIdx2 = products.findIndex(function (p) { return p.id === lines[j].productId; });
            if (pIdx2 === -1) { showToast('SP không tồn tại!', 'error'); reapplyOldStock(oldTrans); return; }
            if (type === 'import') products[pIdx2].stock += lines[j].quantity;
            else products[pIdx2].stock -= lines[j].quantity;
        }

        var supplierName = null, supplierId = null, customerName = null, customerId = null;
        if (type === 'import') {
            var sup = suppliers.find(function (s) { return s.id === partnerId; });
            if (!sup) { showToast('NCC không tồn tại!', 'error'); return; }
            supplierId = partnerId; supplierName = sup.name;
        } else {
            var cus = customers.find(function (c) { return c.id === partnerId; });
            if (!cus) { showToast('KH không tồn tại!', 'error'); return; }
            customerId = partnerId; customerName = cus.name;
        }

        var totalAmount = lines.reduce(function (s, l) { return s + l.amount; }, 0);
        var totalTax = lines.reduce(function (s, l) { return s + l.tax; }, 0);
        var grandTotal = lines.reduce(function (s, l) { return s + l.subtotal; }, 0);

        transactions[tIdx] = {
            id: id, type: type, supplierId: supplierId, supplierName: supplierName,
            customerId: customerId, customerName: customerName,
            lines: lines, totalAmount: totalAmount, totalTax: totalTax, grandTotal: grandTotal,
            invoiceSeri: invoiceSeri, invoiceNumber: invoiceNumber, date: date, note: note,
            createdAt: oldTrans.createdAt
        };

        saveData(STORAGE_KEYS.PRODUCTS, products); saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
        renderProducts(); renderHistory(); updateDashboard();
        showToast('Cập nhật chứng từ thành công!');
        closeEditModal();
    });

    function reapplyOldStock(oldTrans) {
        if (oldTrans.lines && oldTrans.lines.length) {
            oldTrans.lines.forEach(function (l) {
                var pi = products.findIndex(function (p) { return p.id === l.productId; });
                if (pi !== -1) {
                    if (oldTrans.type === 'import') products[pi].stock += l.quantity;
                    else products[pi].stock -= l.quantity;
                }
            });
        } else if (oldTrans.productId) {
            var pi = products.findIndex(function (p) { return p.id === oldTrans.productId; });
            if (pi !== -1) {
                if (oldTrans.type === 'import') products[pi].stock += (oldTrans.quantity || 0);
                else products[pi].stock -= (oldTrans.quantity || 0);
            }
        }
    }

    // =============================================
    // DELETE TRANSACTION
    // =============================================
    function deleteTransaction(id) {
        showDeleteModal('Xóa chứng từ này? Tồn kho sẽ được điều chỉnh lại.', function () {
            var tIdx = transactions.findIndex(function (x) { return x.id === id; });
            if (tIdx === -1) return;
            var t = transactions[tIdx];

            // Revert stock
            if (t.lines && t.lines.length) {
                t.lines.forEach(function (l) {
                    var pi = products.findIndex(function (p) { return p.id === l.productId; });
                    if (pi !== -1) {
                        if (t.type === 'import') products[pi].stock -= l.quantity;
                        else products[pi].stock += l.quantity;
                        if (products[pi].stock < 0) products[pi].stock = 0;
                    }
                });
            } else if (t.productId) {
                var pi = products.findIndex(function (p) { return p.id === t.productId; });
                if (pi !== -1) {
                    if (t.type === 'import') products[pi].stock -= (t.quantity || 0);
                    else products[pi].stock += (t.quantity || 0);
                    if (products[pi].stock < 0) products[pi].stock = 0;
                }
            }

            transactions.splice(tIdx, 1);
            saveData(STORAGE_KEYS.PRODUCTS, products); saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
            renderProducts(); renderHistory(); updateDashboard();
            showToast('Đã xóa chứng từ!');
        });
    }

    // =============================================
    // DASHBOARD
    // =============================================
    function updateDashboard() {
        document.getElementById('totalProducts').textContent = products.length;
        var totalImport = 0, totalExport = 0;
        transactions.forEach(function (t) {
            var qty = 0;
            if (t.lines && t.lines.length) qty = t.lines.reduce(function (s, l) { return s + l.quantity; }, 0);
            else qty = t.quantity || 0;
            if (t.type === 'import') totalImport += qty;
            else totalExport += qty;
        });
        var totalStock = products.reduce(function (s, p) { return s + p.stock; }, 0);
        document.getElementById('totalImport').textContent = formatNumber(totalImport);
        document.getElementById('totalExport').textContent = formatNumber(totalExport);
        document.getElementById('totalStock').textContent = formatNumber(totalStock);
    }

    // =============================================
    // REPORTS
    // =============================================
    var currentReport = 'inventory';
    var reportTabBtns = document.querySelectorAll('.report-tab-btn');
    var reportContents = document.querySelectorAll('.report-content');

    reportTabBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            currentReport = this.getAttribute('data-report');
            reportTabBtns.forEach(function (b) { b.classList.remove('active'); });
            reportContents.forEach(function (c) { c.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('report-' + currentReport).classList.add('active');
            updateReportPartnerFilter();
        });
    });

    function updateReportPartnerFilter() {
        var label = document.getElementById('rptPartnerLabel');
        var select = document.getElementById('rptPartner');
        var group = document.getElementById('rptPartnerGroup');

        if (currentReport === 'inventory') {
            group.style.display = 'none';
        } else if (currentReport === 'import-detail') {
            group.style.display = '';
            label.textContent = 'Nhà cung cấp';
            select.innerHTML = '<option value="">-- Tất cả --</option>' +
                suppliers.map(function (s) { return '<option value="'+s.id+'">'+escapeHtml(s.code)+' - '+escapeHtml(s.name)+'</option>'; }).join('');
        } else {
            group.style.display = '';
            label.textContent = 'Khách hàng';
            select.innerHTML = '<option value="">-- Tất cả --</option>' +
                customers.map(function (c) { return '<option value="'+c.id+'">'+escapeHtml(c.code)+' - '+escapeHtml(c.name)+'</option>'; }).join('');
        }
    }

    function populateReportFilters() {
        var rptProduct = document.getElementById('rptProduct');
        rptProduct.innerHTML = '<option value="">-- Tất cả --</option>' +
            products.map(function (p) { return '<option value="'+p.id+'">'+escapeHtml(p.code)+' - '+escapeHtml(p.name)+'</option>'; }).join('');
        updateReportPartnerFilter();
    }

    document.getElementById('btnRunReport').addEventListener('click', function () {
        if (currentReport === 'inventory') runInventoryReport();
        else if (currentReport === 'import-detail') runImportDetailReport();
        else runExportDetailReport();
    });

    // --- Báo cáo Nhập xuất tồn kho ---
    function runInventoryReport() {
        var fromDate = document.getElementById('rptFromDate').value;
        var toDate = document.getElementById('rptToDate').value;
        var productId = document.getElementById('rptProduct').value;

        var targetProducts = productId ? products.filter(function (p) { return p.id === productId; }) : products.slice();

        if (!targetProducts.length) {
            document.getElementById('rptInventoryBody').innerHTML = '<tr class="empty-row"><td colspan="7">Không có dữ liệu.</td></tr>';
            document.getElementById('rptInventoryFoot').innerHTML = '';
            return;
        }

        var rows = [];
        var sumOpenStock = 0, sumImport = 0, sumExport = 0, sumCloseStock = 0;

        targetProducts.forEach(function (p) {
            var importQty = 0, exportQty = 0;

            transactions.forEach(function (t) {
                var inRange = true;
                if (fromDate && t.date < fromDate) inRange = false;
                if (toDate && t.date > toDate) inRange = false;

                if (inRange && t.lines && t.lines.length) {
                    t.lines.forEach(function (l) {
                        if (l.productId === p.id) {
                            if (t.type === 'import') importQty += l.quantity;
                            else exportQty += l.quantity;
                        }
                    });
                } else if (inRange && t.productId === p.id) {
                    if (t.type === 'import') importQty += (t.quantity || 0);
                    else exportQty += (t.quantity || 0);
                }
            });

            // Tồn đầu kỳ = tồn hiện tại - nhập trong kỳ + xuất trong kỳ (nếu chỉ tính kỳ lọc)
            // Nếu không có filter ngày → tồn đầu = 0, nhập = all, xuất = all, tồn cuối = current
            var openStock, closeStock;
            if (!fromDate && !toDate) {
                openStock = 0;
                closeStock = p.stock;
            } else {
                // Tính tồn đầu kỳ: tồn hiện tại trừ tất cả biến động từ fromDate trở đi
                var importAfter = 0, exportAfter = 0;
                transactions.forEach(function (t) {
                    var afterStart = !fromDate || t.date >= fromDate;
                    if (afterStart && t.lines && t.lines.length) {
                        t.lines.forEach(function (l) {
                            if (l.productId === p.id) {
                                if (t.type === 'import') importAfter += l.quantity;
                                else exportAfter += l.quantity;
                            }
                        });
                    } else if (afterStart && t.productId === p.id) {
                        if (t.type === 'import') importAfter += (t.quantity || 0);
                        else exportAfter += (t.quantity || 0);
                    }
                });
                openStock = p.stock - importAfter + exportAfter;
                if (openStock < 0) openStock = 0;
                closeStock = openStock + importQty - exportQty;
            }

            sumOpenStock += openStock;
            sumImport += importQty;
            sumExport += exportQty;
            sumCloseStock += closeStock;

            rows.push('<tr>' +
                '<td>' + escapeHtml(p.code) + '</td>' +
                '<td class="text-left">' + escapeHtml(p.name) + '</td>' +
                '<td>' + escapeHtml(p.unit) + '</td>' +
                '<td>' + openStock + '</td>' +
                '<td>' + importQty + '</td>' +
                '<td>' + exportQty + '</td>' +
                '<td><strong>' + closeStock + '</strong></td>' +
                '</tr>');
        });

        document.getElementById('rptInventoryBody').innerHTML = rows.join('');
        document.getElementById('rptInventoryFoot').innerHTML = '<tr>' +
            '<td colspan="3"><strong>Tổng cộng</strong></td>' +
            '<td>' + sumOpenStock + '</td>' +
            '<td>' + sumImport + '</td>' +
            '<td>' + sumExport + '</td>' +
            '<td><strong>' + sumCloseStock + '</strong></td></tr>';
    }

    // --- Báo cáo Bảng kê chi tiết nhập ---
    function runImportDetailReport() {
        var fromDate = document.getElementById('rptFromDate').value;
        var toDate = document.getElementById('rptToDate').value;
        var productId = document.getElementById('rptProduct').value;
        var partnerId = document.getElementById('rptPartner').value;

        var filtered = transactions.filter(function (t) { return t.type === 'import'; });
        if (fromDate) filtered = filtered.filter(function (t) { return t.date >= fromDate; });
        if (toDate) filtered = filtered.filter(function (t) { return t.date <= toDate; });
        if (partnerId) filtered = filtered.filter(function (t) { return t.supplierId === partnerId; });

        filtered.sort(function (a, b) { return a.date.localeCompare(b.date); });

        var rows = [];
        var sumQty = 0, sumAmount = 0, sumTax = 0, sumTotal = 0;

        filtered.forEach(function (t) {
            var invoice = (t.invoiceSeri || t.invoiceNumber) ? escapeHtml(t.invoiceSeri || '') + ' - ' + escapeHtml(t.invoiceNumber || '') : '-';
            var lines = t.lines && t.lines.length ? t.lines : [{ productId: t.productId, productCode: t.productCode || '', productName: t.productName || '', quantity: t.quantity || 0, unitPrice: 0, amount: t.amount || 0, tax: t.tax || 0, subtotal: t.total || 0 }];

            lines.forEach(function (l) {
                if (productId && l.productId !== productId) return;

                sumQty += l.quantity;
                sumAmount += l.amount;
                sumTax += l.tax;
                sumTotal += l.subtotal;

                rows.push('<tr>' +
                    '<td>' + formatDate(t.date) + '</td>' +
                    '<td>' + invoice + '</td>' +
                    '<td class="text-left">' + escapeHtml(t.supplierName || '-') + '</td>' +
                    '<td>' + escapeHtml(l.productCode) + '</td>' +
                    '<td class="text-left">' + escapeHtml(l.productName) + '</td>' +
                    '<td>' + l.quantity + '</td>' +
                    '<td class="text-right">' + formatCurrency(l.unitPrice) + '</td>' +
                    '<td class="text-right">' + formatCurrency(l.amount) + '</td>' +
                    '<td class="text-right">' + formatCurrency(l.tax) + '</td>' +
                    '<td class="text-right">' + formatCurrency(l.subtotal) + '</td>' +
                    '</tr>');
            });
        });

        if (!rows.length) {
            document.getElementById('rptImportBody').innerHTML = '<tr class="empty-row"><td colspan="10">Không có dữ liệu.</td></tr>';
            document.getElementById('rptImportFoot').innerHTML = '';
            return;
        }

        document.getElementById('rptImportBody').innerHTML = rows.join('');
        document.getElementById('rptImportFoot').innerHTML = '<tr>' +
            '<td colspan="5"><strong>Tổng cộng</strong></td>' +
            '<td>' + sumQty + '</td>' +
            '<td></td>' +
            '<td class="text-right">' + formatCurrency(sumAmount) + '</td>' +
            '<td class="text-right">' + formatCurrency(sumTax) + '</td>' +
            '<td class="text-right"><strong>' + formatCurrency(sumTotal) + '</strong></td></tr>';
    }

    // --- Báo cáo Bảng kê chi tiết xuất ---
    function runExportDetailReport() {
        var fromDate = document.getElementById('rptFromDate').value;
        var toDate = document.getElementById('rptToDate').value;
        var productId = document.getElementById('rptProduct').value;
        var partnerId = document.getElementById('rptPartner').value;

        var filtered = transactions.filter(function (t) { return t.type === 'export'; });
        if (fromDate) filtered = filtered.filter(function (t) { return t.date >= fromDate; });
        if (toDate) filtered = filtered.filter(function (t) { return t.date <= toDate; });
        if (partnerId) filtered = filtered.filter(function (t) { return t.customerId === partnerId; });

        filtered.sort(function (a, b) { return a.date.localeCompare(b.date); });

        var rows = [];
        var sumQty = 0, sumAmount = 0, sumTax = 0, sumTotal = 0;

        filtered.forEach(function (t) {
            var invoice = (t.invoiceSeri || t.invoiceNumber) ? escapeHtml(t.invoiceSeri || '') + ' - ' + escapeHtml(t.invoiceNumber || '') : '-';
            var lines = t.lines && t.lines.length ? t.lines : [{ productId: t.productId, productCode: t.productCode || '', productName: t.productName || '', quantity: t.quantity || 0, unitPrice: 0, amount: t.amount || 0, tax: t.tax || 0, subtotal: t.total || 0 }];

            lines.forEach(function (l) {
                if (productId && l.productId !== productId) return;

                sumQty += l.quantity;
                sumAmount += l.amount;
                sumTax += l.tax;
                sumTotal += l.subtotal;

                rows.push('<tr>' +
                    '<td>' + formatDate(t.date) + '</td>' +
                    '<td>' + invoice + '</td>' +
                    '<td class="text-left">' + escapeHtml(t.customerName || '-') + '</td>' +
                    '<td>' + escapeHtml(l.productCode) + '</td>' +
                    '<td class="text-left">' + escapeHtml(l.productName) + '</td>' +
                    '<td>' + l.quantity + '</td>' +
                    '<td class="text-right">' + formatCurrency(l.unitPrice) + '</td>' +
                    '<td class="text-right">' + formatCurrency(l.amount) + '</td>' +
                    '<td class="text-right">' + formatCurrency(l.tax) + '</td>' +
                    '<td class="text-right">' + formatCurrency(l.subtotal) + '</td>' +
                    '</tr>');
            });
        });

        if (!rows.length) {
            document.getElementById('rptExportBody').innerHTML = '<tr class="empty-row"><td colspan="10">Không có dữ liệu.</td></tr>';
            document.getElementById('rptExportFoot').innerHTML = '';
            return;
        }

        document.getElementById('rptExportBody').innerHTML = rows.join('');
        document.getElementById('rptExportFoot').innerHTML = '<tr>' +
            '<td colspan="5"><strong>Tổng cộng</strong></td>' +
            '<td>' + sumQty + '</td>' +
            '<td></td>' +
            '<td class="text-right">' + formatCurrency(sumAmount) + '</td>' +
            '<td class="text-right">' + formatCurrency(sumTax) + '</td>' +
            '<td class="text-right"><strong>' + formatCurrency(sumTotal) + '</strong></td></tr>';
    }

    // =============================================
    // EXPOSE & INIT
    // =============================================
    window.app = {
        editProduct: editProduct, deleteProduct: deleteProduct,
        editSupplier: editSupplier, deleteSupplier: deleteSupplier,
        editCustomer: editCustomer, deleteCustomer: deleteCustomer,
        editTransaction: editTransaction, deleteTransaction: deleteTransaction
    };

    renderProducts(); renderSuppliers(); renderCustomers(); renderHistory(); updateDashboard(); populateSelects(); populateReportFilters();

})();
