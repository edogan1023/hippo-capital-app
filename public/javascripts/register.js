fetch('/register')
.then(res => res.json())
.then(data => {
const tbody = document.getElementById('table-body');
data.forEach(row => {
const tr = document.createElement('tr');
tr.innerHTML = `
        <td class="px-6 py-4">${row.branch_name}</td>
        <td class="px-6 py-4">${row.branch_address}</td>
      `;
tbody.appendChild(tr);
});
});
