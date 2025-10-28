let tableBody;
let loadMoreBtn;
let searchInput;
let dateFilter;

function formatDateJS(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

let offset = 0;
const limit = 20;
let currentSearch = '';
let currentDateFrom = null;
let currentDateTo = null;

// Fetch transactions from server
async function fetchTransactions(reset = false) {
    if (reset) {
        offset = 0;
        tableBody.innerHTML = '';
    }

    const params = new URLSearchParams({
        offset,
        limit,
        search: currentSearch
    });

    if (currentDateFrom && currentDateTo) {
        params.append("dateFrom", currentDateFrom);
        params.append("dateTo", currentDateTo);
    }

    const res = await fetch(`/employeeDashboard/userAccounts/${document.getElementById("user_id").textContent}/userAccountsInfo/${document.getElementById("account_number").textContent}?${params.toString()}`, {
        headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();

    data.rows.forEach(transaction => {
        const row = document.createElement('tr');
        row.classList.add('border-b');
        row.innerHTML = `
            <td class="px-4 py-2 whitespace-nowrap text-center">${formatDateJS(transaction.date_time)}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${transaction.description}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${transaction.flow_direction}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${transaction.type}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${transaction.amount}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${transaction.running_balance}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${transaction.sender_account_number}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${transaction.recipient_account_number}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${transaction.transaction_success}</td>
        `;
        tableBody.appendChild(row);
    });

    offset += data.rows.length;

    // Show/hide Load More
    loadMoreBtn.style.display = offset >= data.total ? 'none' : 'block';
}

document.addEventListener("DOMContentLoaded", function() {
    tableBody = document.getElementById('transactionTableBody');
    loadMoreBtn = document.getElementById('loadMoreBtn');
    searchInput = document.getElementById('searchInput');
    dateFilter = document.getElementById('dateFilter');

    // Initialize Flatpickr (installed locally, loaded via <script> in .hbs)
    flatpickr(dateFilter, {
        dateFormat: "Y-m-d",
        mode: "range",
        onClose: (selectedDates) => {
            if (selectedDates.length === 1) {
                // Single day selected
                currentDateFrom = selectedDates[0].toISOString().split("T")[0];
                currentDateTo = currentDateFrom;
            } else if (selectedDates.length === 2) {
                // Range selected
                currentDateFrom = selectedDates[0].toISOString().split("T")[0];
                currentDateTo = selectedDates[1].toISOString().split("T")[0];
            } else {
                // Nothing selected
                currentDateFrom = null;
                currentDateTo = null;
            }
        }
    });

    // Apply filters button
    document.getElementById("applyFilters").addEventListener("click", () => {
        currentSearch = searchInput.value.trim();
        fetchTransactions(true).catch(console.error);
    });

    // Load more button
    loadMoreBtn.addEventListener("click", () => fetchTransactions());

    // Initial load
    fetchTransactions().catch(console.error);
});
