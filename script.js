document.addEventListener('DOMContentLoaded', () => {

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('fin-date').value = today;

    let records = JSON.parse(localStorage.getItem('systemRecords')) || [];
    let financials = JSON.parse(localStorage.getItem('financialRecords')) || [];

    // دالة مساعدة: تنسيق الأرقام بفواصل - أرقام إنجليزية
    function fmt(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return Number(num).toLocaleString('en-US');
    }

    // --- نظام التبويبات ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function switchTab(targetId) {
        navItems.forEach(n => n.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));

        const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (targetNav) targetNav.classList.add('active');
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'tab-transactions') renderTransactions();
        if (targetId === 'tab-financial')    renderFinancials();
        if (targetId === 'tab-dashboard')    updateDashboard();
        if (targetId === 'tab-warehouse') {
            renderMaterialsList();
            renderWarehouseBalance();
            renderWhMovements();
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.getAttribute('data-target'));
        });
    });

    // --- الحسابات التلقائية ---
    const qtyInput = document.getElementById('quantity');
    const purchaseInput = document.getElementById('purchase-price');
    const sellingInput = document.getElementById('selling-price');
    const amountReceivedInput = document.getElementById('amount-received');
    const totalSaleDisplay = document.getElementById('total-sale-display');
    const netProfitDisplay = document.getElementById('net-profit-display');
    const remainingDebtDisplay = document.getElementById('remaining-debt-display');

    function calculateLive() {
        const qty = parseFloat(qtyInput.value) || 0;
        const purchase = parseFloat(purchaseInput.value) || 0;
        const selling = parseFloat(sellingInput.value) || 0;
        const received = parseFloat(amountReceivedInput.value) || 0;

        const totalSale = qty * selling;
        const netProfit = (selling - purchase) * qty;
        const totalPurchase = qty * purchase;
        const remaining = totalPurchase - received;

        totalSaleDisplay.textContent = fmt(totalSale);
        netProfitDisplay.textContent = fmt(netProfit);
        remainingDebtDisplay.textContent = fmt(remaining);
    }

    // تعبئة المبلغ الواصل تلقائياً بـ الكمية × سعر الشراء
    function autoFillReceived() {
        const qty = parseFloat(qtyInput.value) || 0;
        const purchase = parseFloat(purchaseInput.value) || 0;
        const total = qty * purchase;
        amountReceivedInput.value = total > 0 ? Math.round(total) : '';
        calculateLive();
    }

    qtyInput.addEventListener('input', autoFillReceived);
    purchaseInput.addEventListener('input', () => { autoFillReceived(); saveDefaultPrices(); });
    sellingInput.addEventListener('input', () => { calculateLive(); saveDefaultPrices(); });
    amountReceivedInput.addEventListener('input', calculateLive);

    // حفظ وتحميل أسعار الشراء والبيع الافتراضية
    function saveDefaultPrices() {
        const p = purchaseInput.value;
        const s = sellingInput.value;
        if (p) localStorage.setItem('defaultPurchasePrice', p);
        if (s) localStorage.setItem('defaultSellingPrice', s);
    }

    function loadDefaultPrices() {
        const defPurchase = localStorage.getItem('defaultPurchasePrice');
        const defSelling = localStorage.getItem('defaultSellingPrice');
        if (defPurchase && !purchaseInput.value) purchaseInput.value = defPurchase;
        if (defSelling && !sellingInput.value) sellingInput.value = defSelling;
        calculateLive();
    }

    loadDefaultPrices();

    // --- حفظ أو تعديل حركة المبيعات ---
    const form = document.getElementById('record-form');
    const recordIdInput = document.getElementById('record-id');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const currentId = recordIdInput.value;
        const inputDate = document.getElementById('date').value;
        const inputCar = document.getElementById('car-info').value.trim();

        // منع تكرار السيارة في نفس اليوم فقط
        const isCarDuplicate = records.some(rec =>
            rec.date === inputDate &&
            rec.carInfo.trim().toLowerCase() === inputCar.toLowerCase() &&
            String(rec.id) !== String(currentId)
        );

        if (isCarDuplicate) {
            alert(`عذراً، السيارة (${inputCar}) مسجلة مسبقاً بتاريخ ${inputDate}.\nيمكن تسجيلها في يوم مختلف.`);
            return;
        }

        const qty = parseFloat(qtyInput.value) || 0;
        const purchase = parseFloat(purchaseInput.value) || 0;
        const selling = parseFloat(sellingInput.value) || 0;
        const received = parseFloat(amountReceivedInput.value) || 0;

        const recordData = {
            id: currentId ? parseInt(currentId) : Date.now(),
            date: inputDate,
            driverName: document.getElementById('driver-name').value.trim(),
            companyName: document.getElementById('company-name').value.trim(),
            carInfo: inputCar,
            materialType: document.getElementById('material-type').value.trim(),
            unitType: document.getElementById('unit-type').value,
            quantity: qty,
            purchasePrice: purchase,
            sellingPrice: selling,
            totalSale: qty * selling,
            netProfit: (selling - purchase) * qty,
            cashierName: document.getElementById('cashier-name').value.trim(),
            amountReceived: received,
            remainingDebt: (qty * purchase) - received
        };

        if (currentId) {
            const index = records.findIndex(r => String(r.id) === String(currentId));
            if (index !== -1) records[index] = recordData;
            alert('✅ تم تعديل الحركة بنجاح!');
        } else {
            records.push(recordData);
            alert('✅ تم حفظ الحركة بنجاح!');
        }

        localStorage.setItem('systemRecords', JSON.stringify(records));
        resetSalesForm();
    });

    function resetSalesForm() {
        form.reset();
        recordIdInput.value = '';
        submitBtn.textContent = 'حفظ البيانات';
        document.getElementById('date').value = today;
        loadDefaultPrices();
    }

    // --- عرض الحركات اليومية مع فلتر السائق والشركة ---
    const transactionsBody = document.getElementById('transactions-body');
    const searchDriver = document.getElementById('search-driver');
    const searchCompany = document.getElementById('search-company');
    const searchDate = document.getElementById('search-date');

    function renderTransactions() {
        transactionsBody.innerHTML = '';
        const driverFilter = searchDriver.value.trim().toLowerCase();
        const companyFilter = searchCompany.value.trim().toLowerCase();
        const dateFilter = searchDate.value;

        const filteredRecords = records.filter(rec => {
            const matchDriver = driverFilter ? rec.driverName.toLowerCase().includes(driverFilter) : true;
            const matchCompany = companyFilter ? rec.companyName.toLowerCase().includes(companyFilter) : true;
            const matchDate = dateFilter ? rec.date === dateFilter : true;
            return matchDriver && matchCompany && matchDate;
        });

        if (filteredRecords.length === 0) {
            const tr = document.createElement('tr');
            tr.className = 'empty-row';
            tr.innerHTML = `<td colspan="12">لا توجد حركات مطابقة للبحث</td>`;
            transactionsBody.appendChild(tr);
            return;
        }

        filteredRecords.sort((a, b) => b.id - a.id).forEach(rec => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${rec.date}</td>
                <td>${rec.driverName}</td>
                <td>${rec.carInfo}</td>
                <td>${rec.companyName}</td>
                <td>${rec.materialType} (${rec.unitType})</td>
                <td>${fmt(rec.quantity)}</td>
                <td>${fmt(rec.purchasePrice)}</td>
                <td>${fmt(rec.sellingPrice)}</td>
                <td>${fmt(rec.amountReceived)}</td>
                <td style="color:#ff5252; font-weight:bold;">${fmt(rec.remainingDebt)}</td>
                <td style="color:#00e676; font-weight:bold;">${fmt(rec.netProfit)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-edit edit-sale" data-id="${rec.id}">تعديل</button>
                        <button class="action-btn btn-delete delete-sale" data-id="${rec.id}">حذف</button>
                    </div>
                </td>
            `;
            transactionsBody.appendChild(tr);
        });
    }

    transactionsBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-sale')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const rec = records.find(r => r.id === id);
            if (rec) {
                recordIdInput.value = rec.id;
                document.getElementById('date').value = rec.date;
                document.getElementById('driver-name').value = rec.driverName;
                document.getElementById('company-name').value = rec.companyName;
                document.getElementById('car-info').value = rec.carInfo;
                document.getElementById('material-type').value = rec.materialType;
                document.getElementById('unit-type').value = rec.unitType;
                qtyInput.value = rec.quantity;
                purchaseInput.value = rec.purchasePrice;
                sellingInput.value = rec.sellingPrice;
                document.getElementById('cashier-name').value = rec.cashierName;
                amountReceivedInput.value = rec.amountReceived;
                submitBtn.textContent = 'تعديل البيانات';
                calculateLive();
                switchTab('tab-add');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else if (e.target.classList.contains('delete-sale')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (confirm('هل أنت متأكد من حذف هذه الحركة؟')) {
                records = records.filter(r => r.id !== id);
                localStorage.setItem('systemRecords', JSON.stringify(records));
                renderTransactions();
            }
        }
    });

    searchDriver.addEventListener('input', renderTransactions);
    searchCompany.addEventListener('input', renderTransactions);
    searchDate.addEventListener('change', renderTransactions);

    // --- حركات الصندوق مع التعبئة التلقائية للمبلغ ---
    const finForm = document.getElementById('financial-form');
    const finIdInput = document.getElementById('financial-id');
    const finSubmitBtn = document.getElementById('fin-submit-btn');
    const finEntity = document.getElementById('fin-entity');
    const finType = document.getElementById('fin-type');
    const finAmount = document.getElementById('fin-amount');
    const debtHint = document.getElementById('debt-hint');

    // تعبئة تلقائية: عند كتابة اسم الجهة + نوع صرف → يحسب الديون المتبقية
    function autoFillDebt() {
        const entityVal = finEntity.value.trim().toLowerCase();
        const typeVal = finType.value;

        if (!entityVal || typeVal !== 'payment') {
            debtHint.style.display = 'none';
            return;
        }

        // حساب الديون المتبقية لهذه الجهة من سجلات المبيعات
        let totalDebt = 0;
        records.forEach(r => {
            if (r.companyName.toLowerCase().includes(entityVal) || r.driverName.toLowerCase().includes(entityVal)) {
                totalDebt += (r.remainingDebt || 0);
            }
        });

        // طرح ما تم تسديده مسبقاً بسندات القبض
        financials.forEach(f => {
            if (f.entityName.toLowerCase().includes(entityVal)) {
                if (f.type === 'receipt') totalDebt -= f.amount;
                if (f.type === 'payment') totalDebt += f.amount;
            }
        });

        if (totalDebt > 0) {
            debtHint.style.display = 'block';
            debtHint.innerHTML = `<i class="fas fa-info-circle"></i> إجمالي الديون المتبقية على هذه الجهة: <strong>${fmt(totalDebt)}</strong>`;
            // تعبئة المبلغ تلقائياً إذا كان فارغاً
            if (!finAmount.value) {
                finAmount.value = totalDebt.toFixed(0);
            }
        } else {
            debtHint.style.display = 'block';
            debtHint.innerHTML = `<i class="fas fa-check-circle" style="color:var(--profit-color)"></i> لا توجد ديون متبقية على هذه الجهة`;
        }
    }

    finEntity.addEventListener('input', autoFillDebt);
    finType.addEventListener('change', autoFillDebt);

    finForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = finIdInput.value;
        const data = {
            id: id ? parseInt(id) : Date.now(),
            date: document.getElementById('fin-date').value,
            type: finType.value,
            amount: parseFloat(finAmount.value) || 0,
            entityName: finEntity.value.trim(),
            notes: document.getElementById('fin-notes').value.trim()
        };

        if (id) {
            const idx = financials.findIndex(f => f.id.toString() === id);
            if (idx > -1) financials[idx] = data;
            alert('✅ تم تعديل السند بنجاح!');
        } else {
            financials.push(data);
            alert('✅ تم حفظ السند بنجاح!');
        }

        localStorage.setItem('financialRecords', JSON.stringify(financials));
        finForm.reset();
        finIdInput.value = '';
        finSubmitBtn.textContent = 'حفظ السند';
        document.getElementById('fin-date').value = today;
        debtHint.style.display = 'none';
        renderFinancials();
    });

    // عرض سجل الصندوق مع الأيقونات المميزة
    function renderFinancials() {
        const body = document.getElementById('financial-body');
        body.innerHTML = '';

        if (financials.length === 0) {
            const tr = document.createElement('tr');
            tr.className = 'empty-row';
            tr.innerHTML = `<td colspan="6">لا توجد سندات مسجلة</td>`;
            body.appendChild(tr);
            return;
        }

        [...financials].sort((a, b) => b.id - a.id).forEach(f => {
            const tr = document.createElement('tr');
            const isReceipt = f.type === 'receipt';
            const typeHTML = isReceipt
                ? `<span class="icon-receipt"><i class="fas fa-arrow-circle-down"></i></span><span style="color:#00e676; font-weight:bold;">قبض</span>`
                : `<span class="icon-payment"><i class="fas fa-arrow-circle-up"></i></span><span style="color:#ff5252; font-weight:bold;">صرف</span>`;

            tr.innerHTML = `
                <td>${f.date}</td>
                <td>${typeHTML}</td>
                <td>${f.entityName}</td>
                <td style="font-weight:bold;">${fmt(f.amount)}</td>
                <td>${f.notes || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-edit fin-edit" data-id="${f.id}">تعديل</button>
                        <button class="action-btn btn-delete fin-delete" data-id="${f.id}">حذف</button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    document.getElementById('financial-body').addEventListener('click', (e) => {
        if (e.target.classList.contains('fin-edit')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const rec = financials.find(f => f.id === id);
            if (rec) {
                finIdInput.value = rec.id;
                document.getElementById('fin-date').value = rec.date;
                finType.value = rec.type;
                finAmount.value = rec.amount;
                finEntity.value = rec.entityName;
                document.getElementById('fin-notes').value = rec.notes;
                finSubmitBtn.textContent = 'تعديل السند';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else if (e.target.classList.contains('fin-delete')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (confirm('هل متأكد من حذف هذا السند نهائياً؟')) {
                financials = financials.filter(f => f.id !== id);
                localStorage.setItem('financialRecords', JSON.stringify(financials));
                renderFinancials();
            }
        }
    });

    // --- كشف الحساب التفصيلي الكامل ---
    document.getElementById('btn-generate-stmt').addEventListener('click', () => {
        const from = document.getElementById('stmt-from').value;
        const to = document.getElementById('stmt-to').value;
        const entity = document.getElementById('stmt-entity').value.trim().toLowerCase();

        if (!entity) {
            alert('يرجى إدخال اسم الجهة المطلوبة للكشف!');
            return;
        }

        let stmtRecords = [];

        // مبيعات الجهة
        records.forEach(r => {
            if (r.companyName.toLowerCase().includes(entity) || r.driverName.toLowerCase().includes(entity)) {
                if ((!from || r.date >= from) && (!to || r.date <= to)) {
                    stmtRecords.push({
                        date: r.date,
                        type: 'فاتورة مبيعات',
                        person: r.driverName,
                        car: r.carInfo,
                        material: r.materialType,
                        quantity: r.quantity,
                        unit: r.unitType,
                        purchasePrice: r.purchasePrice,
                        debit: r.quantity * r.purchasePrice,
                        credit: r.amountReceived
                    });
                }
            }
        });

        // سندات القبض والصرف
        financials.forEach(f => {
            if (f.entityName.toLowerCase().includes(entity)) {
                if ((!from || f.date >= from) && (!to || f.date <= to)) {
                    const isReceipt = f.type === 'receipt';
                    stmtRecords.push({
                        date: f.date,
                        type: isReceipt ? '✅ سند قبض' : '🔴 سند صرف',
                        person: f.entityName,
                        car: '-',
                        material: f.notes || '-',
                        quantity: '-',
                        unit: '-',
                        purchasePrice: '-',
                        debit: isReceipt ? 0 : f.amount,
                        credit: isReceipt ? f.amount : 0
                    });
                }
            }
        });

        stmtRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

        const stmtBody = document.getElementById('stmt-body');
        stmtBody.innerHTML = '';

        let totalDebit = 0;
        let totalCredit = 0;

        if (stmtRecords.length === 0) {
            const tr = document.createElement('tr');
            tr.className = 'empty-row';
            tr.innerHTML = `<td colspan="10">لا توجد حركات لهذه الجهة في الفترة المحددة</td>`;
            stmtBody.appendChild(tr);
        } else {
            stmtRecords.forEach(row => {
                totalDebit += row.debit;
                totalCredit += row.credit;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.date}</td>
                    <td style="font-size:0.85rem;">${row.type}</td>
                    <td>${row.person}</td>
                    <td>${row.car}</td>
                    <td>${row.material}</td>
                    <td>${row.quantity !== '-' ? fmt(row.quantity) : '-'}</td>
                    <td>${row.unit}</td>
                    <td>${row.purchasePrice !== '-' ? fmt(row.purchasePrice) : '-'}</td>
                    <td style="color:#ff5252; font-weight:bold;">${row.debit > 0 ? fmt(row.debit) : '-'}</td>
                    <td style="color:#00e676; font-weight:bold;">${row.credit > 0 ? fmt(row.credit) : '-'}</td>
                `;
                stmtBody.appendChild(tr);
            });
        }

        const finalBalance = totalDebit - totalCredit;
        document.getElementById('stmt-final-balance').textContent = fmt(finalBalance);
        document.getElementById('stmt-total-paid').textContent = fmt(totalCredit);
        document.getElementById('stmt-result').style.display = 'block';
    });

    // --- الإحصاء مع فلتر السائق والجدول التفصيلي ---
    const filterCompanySelect = document.getElementById('filter-company');
    const filterDriverInput = document.getElementById('filter-driver');

    function updateDashboard() {
        const companies = [...new Set(records.map(r => r.companyName).filter(Boolean))];
        const currentSelection = filterCompanySelect.value;
        filterCompanySelect.innerHTML = '<option value="all">الكل</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            filterCompanySelect.appendChild(option);
        });
        filterCompanySelect.value = currentSelection || 'all';
        calculateDashboardStats();
    }

    function calculateDashboardStats() {
        const selectedCompany = filterCompanySelect.value;
        const driverFilter = filterDriverInput.value.trim().toLowerCase();

        let filteredRecords = records;

        if (selectedCompany !== 'all') {
            filteredRecords = filteredRecords.filter(r => r.companyName === selectedCompany);
        }
        if (driverFilter) {
            filteredRecords = filteredRecords.filter(r => r.driverName.toLowerCase().includes(driverFilter));
        }

        let totalQty = 0;
        let totalProfit = 0;
        let totalDebt = 0;
        let safeBalance = 0;

        filteredRecords.forEach(rec => {
            totalQty += rec.quantity;
            totalProfit += rec.netProfit;
            totalDebt += rec.remainingDebt;
        });

        // رصيد الصندوق العام
        records.forEach(r => safeBalance += (r.amountReceived || 0));
        financials.forEach(f => {
            if (f.type === 'receipt') safeBalance += f.amount;
            if (f.type === 'payment') safeBalance -= f.amount;
        });

        document.getElementById('stat-total-qty').textContent = fmt(totalQty);
        document.getElementById('stat-total-profit').textContent = fmt(totalProfit);
        document.getElementById('stat-total-debt').textContent = fmt(totalDebt);
        document.getElementById('stat-safe-balance').textContent = fmt(safeBalance);

        // عرض الجدول التفصيلي إذا كانت هناك فلترة
        const detailSection = document.getElementById('detail-section');
        const detailBody = document.getElementById('detail-body');
        detailBody.innerHTML = '';

        if (selectedCompany !== 'all' || driverFilter) {
            detailSection.style.display = 'block';

            if (filteredRecords.length === 0) {
                const tr = document.createElement('tr');
                tr.className = 'empty-row';
                tr.innerHTML = `<td colspan="11">لا توجد حركات مطابقة</td>`;
                detailBody.appendChild(tr);
            } else {
                [...filteredRecords].sort((a, b) => b.id - a.id).forEach(rec => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${rec.date}</td>
                        <td>${rec.driverName}</td>
                        <td>${rec.carInfo}</td>
                        <td>${rec.materialType}</td>
                        <td>${fmt(rec.quantity)}</td>
                        <td>${rec.unitType}</td>
                        <td>${fmt(rec.purchasePrice)}</td>
                        <td>${fmt(rec.sellingPrice)}</td>
                        <td>${fmt(rec.amountReceived)}</td>
                        <td style="color:#ff5252; font-weight:bold;">${fmt(rec.remainingDebt)}</td>
                        <td style="color:#00e676; font-weight:bold;">${fmt(rec.netProfit)}</td>
                    `;
                    detailBody.appendChild(tr);
                });
            }
        } else {
            detailSection.style.display = 'none';
        }
    }

    filterCompanySelect.addEventListener('change', calculateDashboardStats);
    filterDriverInput.addEventListener('input', calculateDashboardStats);

    // ============================================================
    // نظام إدارة المخزن
    // ============================================================
    let whMaterials = JSON.parse(localStorage.getItem('whMaterials')) || [];
    let whMovements = JSON.parse(localStorage.getItem('whMovements')) || [];

    const whDateInput      = document.getElementById('wh-date');
    const whMaterialSelect = document.getElementById('wh-material');
    const whFilterMat      = document.getElementById('wh-filter-material');

    whDateInput.value = today;

    // --- إدارة قائمة المواد ---
    function saveMaterials() {
        localStorage.setItem('whMaterials', JSON.stringify(whMaterials));
    }

    function renderMaterialsList() {
        const list = document.getElementById('materials-list');
        list.innerHTML = '';
        whMaterials.forEach(mat => {
            const tag = document.createElement('div');
            tag.className = 'material-tag';
            tag.innerHTML = `<span>${mat}</span><button class="tag-del" data-mat="${mat}">✕</button>`;
            list.appendChild(tag);
        });

        // تحديث قوائم الاختيار
        [whMaterialSelect, whFilterMat].forEach(sel => {
            const current = sel.value;
            sel.innerHTML = sel === whFilterMat
                ? '<option value="all">كل المواد</option>'
                : '<option value="">-- اختر مادة --</option>';
            whMaterials.forEach(mat => {
                const opt = document.createElement('option');
                opt.value = mat;
                opt.textContent = mat;
                sel.appendChild(opt);
            });
            sel.value = current;
        });
    }

    document.getElementById('btn-add-material').addEventListener('click', () => {
        const name = document.getElementById('wh-material-name').value.trim();
        if (!name) { alert('أدخل اسم المادة أولاً'); return; }
        if (whMaterials.includes(name)) { alert('هذه المادة موجودة مسبقاً'); return; }
        whMaterials.push(name);
        saveMaterials();
        renderMaterialsList();
        document.getElementById('wh-material-name').value = '';
        renderWarehouseBalance();
    });

    document.getElementById('materials-list').addEventListener('click', e => {
        if (e.target.classList.contains('tag-del')) {
            const mat = e.target.getAttribute('data-mat');
            if (confirm(`حذف المادة "${mat}" من القائمة؟`)) {
                whMaterials = whMaterials.filter(m => m !== mat);
                saveMaterials();
                renderMaterialsList();
                renderWarehouseBalance();
                renderWhMovements();
            }
        }
    });

    // --- تسجيل حركة مخزنية ---
    const whForm = document.getElementById('warehouse-form');

    whForm.addEventListener('submit', e => {
        e.preventDefault();
        const mat = whMaterialSelect.value;
        if (!mat) { alert('يرجى اختيار المادة أولاً'); return; }

        const recId = document.getElementById('wh-record-id').value;
        const qty   = parseFloat(document.getElementById('wh-quantity').value) || 0;
        const price = parseFloat(document.getElementById('wh-price').value) || 0;

        const data = {
            id:       recId ? parseInt(recId) : Date.now(),
            date:     whDateInput.value,
            type:     document.getElementById('wh-type').value,
            material: mat,
            unit:     document.getElementById('wh-unit').value,
            quantity: qty,
            price:    price,
            total:    qty * price,
            notes:    document.getElementById('wh-notes').value.trim()
        };

        if (recId) {
            const idx = whMovements.findIndex(m => String(m.id) === String(recId));
            if (idx > -1) whMovements[idx] = data;
            alert('✅ تم تعديل الحركة بنجاح!');
        } else {
            whMovements.push(data);
            alert('✅ تم حفظ الحركة بنجاح!');
        }

        localStorage.setItem('whMovements', JSON.stringify(whMovements));
        whForm.reset();
        document.getElementById('wh-record-id').value = '';
        document.getElementById('wh-submit-btn').textContent = 'حفظ الحركة';
        whDateInput.value = today;
        renderWarehouseBalance();
        renderWhMovements();
    });

    // --- رصيد المخزن لكل مادة ---
    function renderWarehouseBalance() {
        const grid = document.getElementById('wh-balance-grid');
        grid.innerHTML = '';

        if (whMaterials.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">لم تُضف أي مواد بعد</p>';
            return;
        }

        whMaterials.forEach(mat => {
            let totalIn = 0, totalOut = 0;
            let unitLabel = '';
            whMovements.filter(m => m.material === mat).forEach(m => {
                if (m.type === 'in')  { totalIn  += m.quantity; unitLabel = m.unit; }
                if (m.type === 'out') { totalOut += m.quantity; unitLabel = m.unit; }
            });
            const balance = totalIn - totalOut;
            const isLow   = balance <= 0;

            const box = document.createElement('div');
            box.className = 'glass-panel-inner wh-balance-box';
            box.style.borderColor = isLow ? 'var(--danger-color)' : 'var(--accent-color)';
            box.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:1rem;">${mat}</span>
                    <span style="font-size:0.8rem; color:var(--text-secondary);">${unitLabel || ''}</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:10px; text-align:center;">
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">داخل</div>
                        <div style="color:#00e676; font-weight:bold;">${fmt(totalIn)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">خارج</div>
                        <div style="color:#ff5252; font-weight:bold;">${fmt(totalOut)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">الرصيد</div>
                        <div style="color:${isLow ? '#ff5252' : '#fff'}; font-weight:bold; font-size:1.1rem;">${fmt(balance)}</div>
                    </div>
                </div>
            `;
            grid.appendChild(box);
        });
    }

    // --- سجل حركات المخزن ---
    function renderWhMovements() {
        const body       = document.getElementById('wh-movements-body');
        const matFilter  = document.getElementById('wh-filter-material').value;
        const typeFilter = document.getElementById('wh-filter-type').value;
        body.innerHTML   = '';

        const filtered = whMovements.filter(m => {
            const matchMat  = matFilter  === 'all' || m.material === matFilter;
            const matchType = typeFilter === 'all' || m.type     === typeFilter;
            return matchMat && matchType;
        });

        if (filtered.length === 0) {
            body.innerHTML = `<tr class="empty-row"><td colspan="9">لا توجد حركات مطابقة</td></tr>`;
            return;
        }

        [...filtered].sort((a, b) => b.id - a.id).forEach(m => {
            const isIn   = m.type === 'in';
            const typeHtml = isIn
                ? `<span style="color:#00e676; font-weight:bold;">📥 داخل</span>`
                : `<span style="color:#ff5252; font-weight:bold;">📤 خارج</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.date}</td>
                <td>${typeHtml}</td>
                <td>${m.material}</td>
                <td style="font-weight:bold;">${fmt(m.quantity)}</td>
                <td>${m.unit}</td>
                <td>${m.price > 0 ? fmt(m.price) : '-'}</td>
                <td>${m.total > 0 ? fmt(m.total) : '-'}</td>
                <td>${m.notes || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-edit wh-edit" data-id="${m.id}">تعديل</button>
                        <button class="action-btn btn-delete wh-del" data-id="${m.id}">حذف</button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    document.getElementById('wh-movements-body').addEventListener('click', e => {
        if (e.target.classList.contains('wh-edit')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const m  = whMovements.find(x => x.id === id);
            if (m) {
                document.getElementById('wh-record-id').value = m.id;
                whDateInput.value = m.date;
                document.getElementById('wh-type').value     = m.type;
                whMaterialSelect.value                        = m.material;
                document.getElementById('wh-unit').value     = m.unit;
                document.getElementById('wh-quantity').value = m.quantity;
                document.getElementById('wh-price').value    = m.price;
                document.getElementById('wh-notes').value    = m.notes;
                document.getElementById('wh-submit-btn').textContent = 'تعديل الحركة';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else if (e.target.classList.contains('wh-del')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (confirm('هل متأكد من حذف هذه الحركة؟')) {
                whMovements = whMovements.filter(x => x.id !== id);
                localStorage.setItem('whMovements', JSON.stringify(whMovements));
                renderWarehouseBalance();
                renderWhMovements();
            }
        }
    });

    document.getElementById('wh-filter-material').addEventListener('change', renderWhMovements);
    document.getElementById('wh-filter-type').addEventListener('change', renderWhMovements);

    // تهيئة أولية للمخزن
    renderMaterialsList();

});
