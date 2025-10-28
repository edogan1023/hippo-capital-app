const tableBody = document.getElementById('usersTableBody');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchForm = document.getElementById('userSearchForm');
const searchInput = document.getElementById('searchInput');

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

// Fetch users from server
async function fetchUsers(reset = false) {
    if (reset) {
        offset = 0;
        tableBody.innerHTML = '';
    }

    const res = await fetch(`/employeeDashboard?offset=${offset}&limit=${limit}&search=${encodeURIComponent(currentSearch)}`, {
        headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();

    data.rows.forEach(user => {
        const row = document.createElement('tr');
        row.classList.add('border-b');
        if (!user.is_active) row.classList.add('bg-gray-200');

        row.onclick = () => window.location.href = `/employeeDashboard/userAccounts/${user.id}`;

        row.innerHTML = `
            <td class="px-4 py-2 whitespace-nowrap text-center">${user.user_title}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${user.first_name} ${user.middle_name || ''} ${user.surname}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${user.user_email}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${formatDateJS(user.dob)}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${user.phone_number}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${user.mother_maiden_name}</td>
            <td class="px-4 py-2 font-semibold whitespace-nowrap text-center">${user.is_active ? 'Active' : 'Deactive'}</td>
            <td class="px-4 py-2 whitespace-nowrap text-center">${user.id}</td>
        `;
        tableBody.appendChild(row);
    });

    offset += data.rows.length;

    // Show/hide Load More
    if (offset >= data.total) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'block';
    }
}

// Load More button click
loadMoreBtn.addEventListener('click', () => fetchUsers());

// Search form submit
searchForm.addEventListener('submit', e => {
    e.preventDefault();
    currentSearch = searchInput.value.trim();
    fetchUsers(true); // reset table
});

// Initial load
fetchUsers();
