let tableContainer;
let searchForm;
let searchInput;
let loadMoreBtn;
let addRowArea;
let addRowBtn;
let modalContainer;
let addModalContainer;
let currentTable = '';
let offset = 0;
const limit = 20;
let currentSearch = '';
let totalRows = 0;
let addForm;

document.addEventListener('DOMContentLoaded', () => {
    afterDomLoaded()
});


function afterDomLoaded() {

    //Add Row Button
    addRowArea = document.createElement('div');
    addRowArea.className = 'flex justify-end mb-2';
    addRowBtn = document.createElement('button');
    addRowBtn.id = 'addRowBtn';
    addRowBtn.className = 'bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded hidden';
    addRowBtn.innerText = '+ Add Row';
    addRowArea.appendChild(addRowBtn);
    //Add Modal
    addRowBtn.addEventListener('click', openAddModal);

    //Modal Container for edit row
    modalContainer = document.createElement('div');
    modalContainer.id = 'editModalContainer';
    modalContainer.className = 'hidden fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modalContainer.innerHTML = `
  <div id="editModal" class="bg-white rounded-lg p-6 w-11/12 max-w-4xl">
    <h2 class="text-xl font-semibold mb-4">Edit Row</h2>
    <form id="editForm">
      <div id="editFieldsContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-4">
        <!-- JS will append input fields here -->
      </div>
      <div class="flex justify-end gap-4 mt-4">
        <button type="button" id="cancelEditBtn" class="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
        <button type="submit" id="saveEditBtn" class="bg-logo-navy text-white px-4 py-2 rounded hover:bg-logo-navy-hover">Save</button>
      </div>
    </form>
  </div>
`;
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) closeModal();
    });

    //container for Add Row modal
    addModalContainer = document.createElement('div');
    addModalContainer.id = 'addModalContainer';
    addModalContainer.className = 'hidden fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    addModalContainer.innerHTML = `
  <div id="addModal" class="bg-white rounded-lg p-6 w-11/12 max-w-4xl">
    <h2 class="text-xl font-semibold mb-4">Add Row</h2>
    <form id="addForm">
      <div id="addFieldsContainer" class="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-4">
        <!-- JS will append input fields here -->
      </div>
      <div class="flex justify-end gap-4 mt-4">
        <button type="button" id="cancelAddBtn" class="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
        <button type="submit" id="saveAddBtn" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Add</button>
      </div>
    </form>
  </div>
`;
    const cancelAddBtn = addModalContainer.querySelector('#cancelAddBtn');
    cancelAddBtn.onclick = closeAddModal;

    tableContainer = document.getElementById('tableContainer');
    searchForm = document.getElementById('tableSearchForm');
    searchInput = document.getElementById('tableSearchInput');
    loadMoreBtn = document.getElementById('loadMoreBtn');

    const tableWrap = document.querySelector('.overflow-x-auto');
    if (tableWrap && tableWrap.parentNode) {
        tableWrap.parentNode.insertBefore(addRowArea, tableWrap);
        document.body.appendChild(modalContainer);
        document.body.appendChild(addModalContainer);
    }

    //Load More button
    loadMoreBtn.addEventListener('click', () => fetchTableData());

    //Search
    searchForm.addEventListener('submit', e => {
        e.preventDefault();
        currentSearch = searchInput.value.trim();
        fetchTableData(true);
    });

    //Table Nav
    document.querySelectorAll('#tableNav button').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTable = btn.dataset.table;
            offset = 0;
            currentSearch = '';
            searchInput.value = '';
            fetchTableData(true);

            // Show Add Row button only for editable tables
            if (['account', 'user', 'branch', 'cashback_offers', 'transaction'].includes(currentTable)) {
                addRowBtn.classList.remove('hidden');
            } else {
                addRowBtn.classList.add('hidden');
            }
        });
    });
}


//Date Formatting by date
function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d)) return String(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

//Date Formatting by date and hour
function formatDateTime(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d)) return String(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

//Date Columns Mapping
const dateColumnsConfig = {
    account: {columns: ['date_opened'], fullTimestamp: false},
    user: {columns: ['dob'], fullTimestamp: false},
    transaction: {columns: ['created_at', 'date_time'], fullTimestamp: true},
    account_user: {columns: [], fullTimestamp: false},
    branch: {columns: [], fullTimestamp: false},
    cashback_offers: {columns: [], fullTimestamp: false}
};

//Editable Columns
const EDITABLE_COLUMNS = {
    account: {
        cols: ['interest_rate_credit', 'interest_rate_debit', 'overdraft_limit', 'is_active'],
        meta: {
            interest_rate_credit: {type: 'decimal', nullable: true},
            interest_rate_debit: {type: 'decimal', nullable: true},
            overdraft_limit: {type: 'decimal', nullable: true},
            is_active: {type: 'tinyint', nullable: false}
        }
    },
    account_user: {cols: [], meta: {}},
    branch: {
        cols: ['branch_name', 'branch_address', 'branch_phone_number'],
        meta: {
            branch_name: {type: 'string', max: 100},
            branch_address: {type: 'string', max: 255},
            branch_phone_number: {type: 'phone', max: 13}
        }
    },
    cashback_offers: {
        cols: ['company_name', 'cashback', 'conditions', 'category', 'offer_image'],
        meta: {
            company_name: {type: 'string', max: 255},
            cashback: {type: 'decimal', nullable: false},
            conditions: {type: 'string', max: 2000},
            category: {type: 'string', max: 100},
            offer_image: {type: 'string', max: 100}
        }
    },
    transaction: {cols: [], meta: {}},
    user: {
        cols: ['user_email', 'first_name', 'middle_name', 'surname', 'mother_maiden_name', 'place_of_birth', 'phone_number', 'user_title', 'user_type', 'is_active', 'dob', 'credit_score'],
        meta: {
            user_email: {type: 'string', max: 50},
            first_name: {type: 'string', max: 50},
            middle_name: {type: 'string', max: 50, nullable: true},
            surname: {type: 'string', max: 100},
            mother_maiden_name: {type: 'string', max: 100, nullable: true},
            place_of_birth: {type: 'string', max: 250, nullable: true},
            phone_number: {type: 'phone', max: 13},
            user_title: {type: 'string', max: 20, nullable: true},
            user_type: {type: 'enum', options: ['end-user', 'employee', 'admin']},
            is_active: {type: 'tinyint'},
            dob: {type: 'date'},
            credit_score: {type: 'int', min: 0, max: 999, nullable: true}
        }
    }
};


//Validation Helpers
function validateField(key, value, meta) {
    if (!meta) return null;
    if (meta.type === 'string') {
        if ((value == null || value === '') && !meta.nullable) return `Field ${key} is required`;
        if (meta.max && String(value).length > meta.max) return `${key} too long (max ${meta.max})`;
    }
    if (meta.type === 'decimal') {
        if (value === '' || value == null) return meta.nullable ? null : `${key} required`;
        if (isNaN(value)) return `${key} must be a number`;
    }
    if (meta.type === 'phone') {
        if (!value) return `${key} required`;
        const digits = String(value).replace(/\D/g, '');
        if (digits.length === 0 || digits.length > meta.max) return `${key} must be numeric up to ${meta.max} digits`;
    }
    if (meta.type === 'enum') {
        if (!meta.options.includes(value)) return `${key} invalid`;
    }
    if (meta.type === 'tinyint') {
        if (!(value === '0' || value === '1' || value === 0 || value === 1)) return `${key} must be 0 or 1`;
    }
    if (meta.type === 'date') {
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return `${key} must be dd/mm/yyyy`;
        const parts = value.split('/');
        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (isNaN(d)) return `${key} not valid`;
    }
    if (meta.type === 'int') {
        if (value === '') return `${key} required`;
        if (!Number.isInteger(Number(value))) return `${key} must be integer`;
        if (meta.min != null && Number(value) < meta.min) return `${key} min ${meta.min}`;
        if (meta.max != null && Number(value) > meta.max) return `${key} max ${meta.max}`;
    }
    return null;
}
function tableHasEdits(table) {
    return EDITABLE_COLUMNS[table] && EDITABLE_COLUMNS[table].cols.length > 0;
}


//Fetch Table
async function fetchTableData(reset = false) {
    if (!currentTable) return;

    if (reset) {
        offset = 0;
        tableContainer.innerHTML = '';
    }

    // Show/hide "Add Row" button
    if (['account_user'].includes(currentTable)) addRowBtn.classList.add('hidden');
    else addRowBtn.classList.remove('hidden');

    // Fetch table data
    const res = await fetch(
        `/adminDashboard/table/${currentTable}?offset=${offset}&limit=${limit}&search=${encodeURIComponent(currentSearch)}`,
        { headers: { 'Accept': 'application/json' } }
    );
    const data = await res.json();
    totalRows = data.total;

    let displayedColumns = data.columns;
    if (currentTable === 'user') displayedColumns = displayedColumns.filter(c => c !== 'password' && c !== 'security_word');

    const hasEdits = tableHasEdits(currentTable);

    // Create table structure if reset
    if (reset) {
        const table = document.createElement('table');
        table.id = 'currentTable';
        table.className = 'min-w-full table-auto bg-white border border-gray-200 rounded-lg';

        const thead = document.createElement('thead');
        thead.className = 'bg-logo-navy text-white';
        const headerRow = document.createElement('tr');
        headerRow.className = 'text-center';

        displayedColumns.forEach(col => {
            const th = document.createElement('th');
            th.className = 'px-4 py-2';
            th.innerText = col;
            headerRow.appendChild(th);
        });

        if (hasEdits) {
            const thAction = document.createElement('th');
            thAction.className = 'px-4 py-2';
            thAction.innerText = 'Action';
            headerRow.appendChild(thAction);
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.id = 'currentTableBody';
        table.appendChild(tbody);

        tableContainer.appendChild(table);
    }

    const tbody = document.getElementById('currentTableBody');

    data.rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'border-b text-center';

        displayedColumns.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-4 py-2 whitespace-nowrap';
            td.innerText = dateColumnsConfig[currentTable]?.columns.includes(col)
                ? (dateColumnsConfig[currentTable].fullTimestamp ? formatDateTime(row[col]) : formatDate(row[col]))
                : (row[col] == null ? '' : row[col]);
            tr.appendChild(td);
        });

        if (hasEdits) {
            const tdAction = document.createElement('td');
            tdAction.className = 'px-4 py-2 flex justify-center gap-2';

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600';
            editBtn.innerText = 'Edit';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(row.id, row);
            });
            tdAction.appendChild(editBtn);

            // Delete button only for branch and cashback_offers
            if (['branch', 'cashback_offers'].includes(currentTable)) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600';
                deleteBtn.innerText = 'Delete';
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Are you sure you want to delete this ${currentTable} row?`)) return;

                    try {
                        const resp = await fetch(`/adminDashboard/table/${currentTable}/${row.id}`, {
                            method: 'DELETE'
                        });
                        const j = await resp.json();
                        if (!resp.ok) {
                            alert('Delete failed: ' + (j.error || resp.statusText));
                            return;
                        }
                        fetchTableData(true);
                    } catch (err) {
                        console.error(err);
                        alert('Network error while deleting');
                    }
                });
                tdAction.appendChild(deleteBtn);
            }

            tr.appendChild(tdAction);
        }

        tbody.appendChild(tr);
    });

    offset += data.rows.length;
    loadMoreBtn.style.display = offset >= totalRows ? 'none' : 'block';
}


//Edit Modal
function openEditModal(rowId, rowData) {
    const meta = EDITABLE_COLUMNS[currentTable];
    if (!meta || !meta.cols.length) return;

    const modal = document.getElementById('editModal');
    const fieldsContainer = document.getElementById('editFieldsContainer');
    fieldsContainer.innerHTML = '';

    for (const col of meta.cols) {
        const fieldMeta = meta.meta[col] || {};
        const wrapper = document.createElement('div');
        const label = document.createElement('label');
        label.className = 'block text-sm font-medium mb-1';
        label.innerText = col;
        wrapper.appendChild(label);

        let input;
        if (fieldMeta.type === 'decimal' || fieldMeta.type === 'int' || fieldMeta.type === 'phone') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = rowData[col] == null ? '' : rowData[col];
        } else if (fieldMeta.type === 'tinyint') {
            input = document.createElement('select');
            const opt1 = document.createElement('option');
            opt1.value = '1';
            opt1.innerText = '1';
            const opt0 = document.createElement('option');
            opt0.value = '0';
            opt0.innerText = '0';
            input.appendChild(opt1);
            input.appendChild(opt0);
            input.value = rowData[col] == null ? '1' : String(rowData[col]);
        } else if (fieldMeta.type === 'date') {
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'dd/mm/yyyy';
            input.value = rowData[col] ? (rowData[col].includes('/') ? rowData[col] : formatDate(rowData[col])) : '';
        } else if (fieldMeta.type === 'enum') {
            input = document.createElement('select');
            for (const opt of fieldMeta.options) {
                const o = document.createElement('option');
                o.value = opt;
                o.innerText = opt;
                input.appendChild(o);
            }
            input.value = rowData[col] || fieldMeta.options[0];
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.value = rowData[col] == null ? '' : rowData[col];
        }

        input.id = `field_${col}`;
        input.name = col;
        input.className = 'border px-2 py-1 rounded w-full';
        wrapper.appendChild(input);
        if (fieldMeta.max) {
            const hint = document.createElement('p');
            hint.className = 'text-xs text-gray-500 mt-1';
            hint.innerText = `Max ${fieldMeta.max} chars`;
            wrapper.appendChild(hint);
        }
        fieldsContainer.appendChild(wrapper);
    }

    modalContainer.classList.remove('hidden');
    const form = document.getElementById('editForm');
    form.onsubmit = null;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {};
        const errors = [];
        for (const col of meta.cols) {
            const input = document.getElementById(`field_${col}`);
            const val = input ? input.value : null;
            const err = validateField(col, val, meta.meta[col]);
            if (err) errors.push(err);
            else {
                if (meta.meta[col] && meta.meta[col].type === 'tinyint') payload[col] = Number(val);
                else if (meta.meta[col] && meta.meta[col].type === 'int') payload[col] = Number(val);
                else payload[col] = val === '' ? null : val;
            }
        }
        if (errors.length) {
            alert('Validation error: ' + errors.join('; '));
            return;
        }
        try {
            const resp = await fetch(`/adminDashboard/table/${currentTable}/${rowId}`, {
                method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
            });
            const j = await resp.json();
            if (!resp.ok) {
                alert('Save failed: ' + (j.error || resp.statusText));
                return;
            }
            closeModal();
            fetchTableData(true);
        } catch (err) {
            console.error(err);
            alert('Network error while saving');
        }
    }, {once: true});

    document.getElementById('cancelEditBtn').onclick = closeModal;
}


// Add Row Modal
function openAddModal() {
    if (!currentTable) return;

    const modal = document.getElementById('addModal');
    const fieldsContainer = document.getElementById('addFieldsContainer');
    fieldsContainer.innerHTML = '';

    // Define rows based on the current table
    const rows = [];

    switch (currentTable) {
        case 'account':
            rows.push({ key: 'user_id', label: 'User ID', type: 'int', nullable: false });
            rows.push({
                key: 'account_type',
                label: 'Account Type',
                type: 'enum',
                options: ['personal_single', 'personal_joint', 'business_single', 'business_multi-signatory']
            });
            rows.push({
                key: 'account_sub_type',
                label: 'Account Sub Type',
                type: 'enum',
                options: ['current', 'savings', 'ISA', 'credit']
            });
            rows.push({ key: 'interest_rate_credit', label: 'Interest Rate Credit', type: 'decimal', nullable: true });
            rows.push({ key: 'interest_rate_debit', label: 'Interest Rate Debit', type: 'decimal', nullable: true });
            rows.push({ key: 'overdraft_limit', label: 'Overdraft Limit', type: 'decimal', nullable: true });
            rows.push({ key: 'is_active', label: 'Is Active', type: 'checkbox' });
            break;

        case 'user':
            rows.push({ key: 'user_email', label: 'Email', type: 'string', nullable: false });
            rows.push({ key: 'password', label: 'Password', type: 'string', nullable: false });
            rows.push({ key: 'first_name', label: 'First Name', type: 'string', nullable: false });
            rows.push({ key: 'middle_name', label: 'Middle Name', type: 'string', nullable: true });
            rows.push({ key: 'surname', label: 'Surname', type: 'string', nullable: false });
            rows.push({ key: 'mother_maiden_name', label: 'Mother Maiden', type: 'string', nullable: true });
            rows.push({ key: 'place_of_birth', label: 'Place of Birth', type: 'string', nullable: true });
            rows.push({ key: 'phone_number', label: 'Phone Number', type: 'phone', nullable: false });
            rows.push({ key: 'user_title', label: 'Title', type: 'string', nullable: true });
            rows.push({
                key: 'user_type',
                label: 'User Type',
                type: 'enum',
                options: ['end-user', 'employee', 'admin'],
                nullable: false
            });
            rows.push({ key: 'is_active', label: 'Is Active', type: 'checkbox' });
            rows.push({ key: 'dob', label: 'DOB', type: 'date', nullable: false });
            rows.push({ key: 'credit_score', label: 'Credit Score', type: 'int', nullable: true });
            break;

        case 'branch':
            rows.push({ key: 'branch_name', label: 'Branch Name', type: 'string', nullable: false });
            rows.push({ key: 'branch_address', label: 'Branch Address', type: 'string', nullable: false });
            rows.push({ key: 'branch_phone_number', label: 'Phone Number', type: 'phone', nullable: false });
            break;

        case 'cashback_offers':
            rows.push({ key: 'company_name', label: 'Company Name', type: 'string', nullable: false });
            rows.push({ key: 'cashback', label: 'Cashback', type: 'decimal', nullable: false });
            rows.push({ key: 'conditions', label: 'Conditions', type: 'string', nullable: false });
            rows.push({ key: 'category', label: 'Category', type: 'string', nullable: false });
            rows.push({ key: 'offer_image', label: 'Offer Image', type: 'string', nullable: false });
            break;

        case 'transaction':
            rows.push({ key: 'amount', label: 'Amount', type: 'decimal', nullable: false });
            rows.push({ key: 'description', label: 'Description', type: 'string', nullable: true });
            rows.push({
                key: 'type',
                label: 'Type',
                type: 'enum',
                options: ['deposit', 'withdrawal', 'payment', 'transfer', 'fee', 'refund', 'interest', 'loan_disbursement'],
                nullable: false
            });
            rows.push({ key: 'sender_account_number', label: 'Sender Account', type: 'int', nullable: false });
            rows.push({ key: 'recipient_account_number', label: 'Recipient Account', type: 'int', nullable: false });
            break;

        default:
            console.warn('No add row GUI defined for this table:', currentTable);
            return;
    }

    // Build input elements
    for (const r of rows) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-3';

        const label = document.createElement('label');
        label.className = 'block text-sm font-medium mb-1';
        label.innerText = r.label;
        wrapper.appendChild(label);

        let input;
        if (r.type === 'enum') {
            input = document.createElement('select');
            for (const opt of r.options) {
                const o = document.createElement('option');
                o.value = opt;
                o.innerText = opt;
                input.appendChild(o);
            }
        } else if (r.type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
        } else if (r.type === 'date') {
            input = document.createElement('input');
            input.type = 'date';
        } else {
            input = document.createElement('input');
            input.type = 'text';
        }

        input.id = `addfield_${r.key}`;
        input.name = r.key;
        input.className = 'border px-2 py-1 rounded w-full';
        wrapper.appendChild(input);
        fieldsContainer.appendChild(wrapper);
    }

    // Show modal
    addModalContainer.classList.remove('hidden');

    // Attach submit handler freshly each time
    const addForm = document.getElementById('addForm');
    addForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {};
        const errors = [];

        for (const r of rows) {
            const input = document.getElementById(`addfield_${r.key}`);
            if (!input) continue;

            let val;
            if (r.type === 'checkbox') val = input.checked ? 1 : 0;
            else val = input.value.trim();

            // Basic validation
            if (r.nullable === false && (val === '' || val === null || val === undefined)) {
                errors.push(`${r.label} is required`);
            }

            // Type-specific conversion
            if (r.type === 'int') val = val === '' ? null : Number(val);
            else if (r.type === 'decimal') {
                if (val === '' || val === null) {
                    val = null;
                } else {
                    // Remove any commas, trim spaces
                    val = val.replace(/,/g, '').trim();
                    // Force to number
                    val = Number(val);
                    if (isNaN(val)) val = null;
                }
            }


            payload[r.key] = val;
        }
        if (currentTable === 'cashback_offers') {
            const cashbackField = document.getElementById('addfield_cashback');
            const val = parseFloat(cashbackField.value);
            if (isNaN(val) || val <=0 || val >=100) {
                errors.push('Cashback must be a number >0 and <100');
            }
        }

        if (errors.length) {
            alert('Validation errors:\n' + errors.join('\n'));
            return;
        }

        try {
            const resp = await fetch(`/adminDashboard/table/${currentTable}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const j = await resp.json();

            if (!resp.ok) {
                alert('Add failed: ' + (j.error || resp.statusText));
                return;
            }

            closeAddModal();
            fetchTableData(true);
        } catch (err) {
            console.error(err);
            alert('Network error while adding');
        }
    };

    // Cancel button
    const cancelBtn = document.getElementById('cancelAddBtn');
    cancelBtn.onclick = closeAddModal;
}


//Close for both Modals
function closeModal() {
    modalContainer.classList.add('hidden');
}
function closeAddModal() {
    addModalContainer.classList.add('hidden');
}


