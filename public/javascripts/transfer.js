document.addEventListener("DOMContentLoaded", () => {
    const amountError = document.getElementById('amount-error');
    const amountInput = document.getElementById("amount");
    const cards = document.querySelectorAll(".card");
    const transferButton = document.getElementById("transferButton");
    const hiddenAccountInput = document.getElementById("selectedAccountNumber");
    const hiddenBalanceInput = document.getElementById("selectedBalance");


    cards.forEach(card => {
        card.addEventListener("click", () => {
            // Reset all cards
            cards.forEach(c => c.setAttribute("aria-selected", "false"));

            // Set clicked card as selected
            card.setAttribute("aria-selected", "true");

            // Fill hidden inputs with the card's data
            hiddenAccountInput.value = card.dataset.accountNumber;
            hiddenBalanceInput.value = card.dataset.balance;

            // Enable transfer button once an account is selected
            transferButton.removeAttribute("disabled");
        });
    });
    if (amountInput) {
        amountInput.addEventListener("blur", () => {
            let val = parseFloat(amountInput.value);
            if (!isNaN(val)) {
                amountInput.value = val.toFixed(2);
            }
        });
    }

});
