let tableBody;
let loadMoreBtn;
let searchInput;
let dateFilter;

let offset = 0;
const limit = 20;
let currentSearch = '';
let currentDateFrom = null;
let currentDateTo = null;

function formatDateJS(dateString) {
    if (!dateString) return '';

    const d = new Date(dateString);
    if (isNaN(d.getTime())) return ''; // return empty if invalid date

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}


async function fetchTransactions(reset = false) {
    if (!document.getElementById('accountNumber')) return;
    const accountNumber = document.getElementById('accountNumber').textContent;

    if (reset) {
        offset = 0;
        tableBody.innerHTML = '';
    }

    const searchParam = currentSearch.trim() ? currentSearch.trim() : '%';

    const params = new URLSearchParams({
        offset,
        limit,
        search: searchParam
    });

    if (currentDateFrom && currentDateTo) {
        params.append('dateFrom', currentDateFrom);
        params.append('dateTo', currentDateTo);
    }

    try {
        const res = await fetch(`/userDashboard/accounts/accountInfo/${accountNumber}?${params.toString()}`, {
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();

        if (!data.rows || data.rows.length === 0) {
            console.log('No transactions returned.');
        }

        data.rows.forEach(transaction => {
            const row = document.createElement('tr');
            row.classList.add('border-b', 'hover:bg-gray-50', 'transition');
            row.innerHTML = `
                <td class="px-4 py-3 text-gray-700">${formatDateJS(transaction.date_time)}</td>
                <td class="px-4 py-3 w-40">${transaction.description ? transaction.description : '<span class="text-gray-400 italic">No Description</span>'}</td>
                <td class="px-4 py-3 text-center">${transaction.flow_direction}</td>
                <td class="px-4 py-3">${transaction.type}</td>
                <td class="px-4 py-3 text-gray-800">${transaction.amount}</td>
                <td class="px-4 py-3 text-gray-800 text-center">£${transaction.running_balance}</td>
                <td class="px-4 py-3">${transaction.sender_account_number}</td>
                <td class="px-4 py-3">${transaction.recipient_account_number}</td>
            `;
            tableBody.appendChild(row);
        });

        offset += data.rows.length;
        loadMoreBtn.style.display = offset >= data.total ? 'none' : 'block';
    } catch (err) {
        console.error('Error fetching transactions:', err);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    tableBody = document.getElementById('transactionTableBody');
    loadMoreBtn = document.getElementById('loadMoreBtn') || createLoadMoreButton();
    searchInput = document.getElementById('searchInput');
    dateFilter = document.getElementById('dateFilter');

    // Initialize Flatpickr
    flatpickr(dateFilter, {
        dateFormat: 'Y-m-d',
        mode: 'range',
        onClose: (selectedDates) => {
            if (selectedDates.length === 1) {
                currentDateFrom = selectedDates[0].toISOString().split('T')[0];
                currentDateTo = currentDateFrom;
            } else if (selectedDates.length === 2) {
                currentDateFrom = selectedDates[0].toISOString().split('T')[0];
                currentDateTo = selectedDates[1].toISOString().split('T')[0];
            } else {
                currentDateFrom = null;
                currentDateTo = null;
            }
        }
    });

    // Apply filters
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            currentSearch = searchInput.value;
            fetchTransactions(true);
        });
    }

    // Load more
    loadMoreBtn.addEventListener('click', () => fetchTransactions());

    // **Initial load after everything is ready**
    setTimeout(() => fetchTransactions(true), 50);
});

function createLoadMoreButton() {
    const btn = document.createElement('button');
    btn.id = 'loadMoreBtn';
    btn.className = 'bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 mt-4';
    btn.textContent = 'Load More';
    tableBody.parentNode.appendChild(btn);
    return btn;
}
