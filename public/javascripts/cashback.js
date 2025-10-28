function showTCModal(company, conditions) {
    document.getElementById('tc-modal-title').textContent = company + ' Terms & Conditions';
    document.getElementById('tc-modal-content').textContent = conditions;
    document.getElementById('tc-modal-overlay').classList.remove('hidden');
}
function hideTCModal() {
    document.getElementById('tc-modal-overlay').classList.add('hidden');
}
// Optional: close modal when clicking outside the modal box
document.getElementById('tc-modal-overlay').onclick = function(e) {
    if (e.target === this) this.classList.add('hidden');
};
