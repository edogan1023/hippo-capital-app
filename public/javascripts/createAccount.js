document.addEventListener('DOMContentLoaded', () => {
    const accountTypeOptions = document.querySelectorAll('input[name="account_type"]');
    const subAccountContainer = document.getElementById('subAccountContainer');
    const subAccountOptions = document.getElementById('subAccountOptions');
    const offerBox = document.getElementById('offerBox');

    const scoreDisplay = document.getElementById('scoreDisplay');
    const rateCredit = document.getElementById('rateCredit');
    const rateDebit = document.getElementById('rateDebit');
    const overdraftLimit = document.getElementById('overdraftLimit');

    const createAccountForm = document.getElementById('createAccountForm');

    // Credit score from backend
    let credit_score = parseInt(document.getElementById('creditScore').textContent);

    let selectedAccountType = null;
    let selectedSubAccountType = null;

    const subAccountMap = {
        personal_single: ['current', 'savings', 'ISA', 'credit'],
        personal_joint: ['current', 'savings', 'credit'],
        business_single: ['current', 'savings', 'credit'],
        'business_multi-signatory': ['current', 'savings']
    };

    accountTypeOptions.forEach(opt => {
        opt.addEventListener('change', () => {
            accountTypeOptions.forEach(o => { if (o !== opt) o.checked = false; });

            selectedAccountType = opt.checked ? opt.value : null;

            if (selectedAccountType) {
                renderSubAccountOptions(selectedAccountType);
                subAccountContainer.classList.remove('hidden');
            } else {
                subAccountContainer.classList.add('hidden');
                offerBox.classList.add('hidden');
            }
        });
    });

    function renderSubAccountOptions(type) {
        subAccountOptions.innerHTML = '';
        const options = subAccountMap[type] || [];
        options.forEach(opt => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" name="sub_account_type" value="${opt}"> ${opt.charAt(0).toUpperCase() + opt.slice(1)}`;
            subAccountOptions.appendChild(label);
        });

        subAccountOptions.querySelectorAll('input').forEach(opt => {
            opt.addEventListener('change', () => {
                subAccountOptions.querySelectorAll('input').forEach(o => { if (o !== opt) o.checked = false; });
                selectedSubAccountType = opt.checked ? opt.value : null;

                if (opt.checked) {
                    calculateOffers(opt.value);
                    offerBox.classList.remove('hidden');
                } else {
                    offerBox.classList.add('hidden');
                }
            });
        });
    }

    function calculateOffers(subType) {
        scoreDisplay.textContent = credit_score;
        let interestCredit = null;
        let interestDebit = null;
        let overdraft = null;

        if (subType === 'current') {
            interestCredit = credit_score > 660 ? '1%' : credit_score >= 500 ? '0.5%' : '0.25%';
            interestDebit = credit_score > 660 ? '18.99%' : credit_score >= 500 ? '15.25%' : '10.15%';
            overdraft = credit_score > 660 ? '£1000' : credit_score >= 500 ? '£850' : '£250';
        }
        else if (subType === 'savings') {
            interestCredit = credit_score > 660 ? '4%' : credit_score >= 500 ? '3.25%' : '2.25%';
        }
        else if (subType === 'ISA') {
            interestCredit = '2.1%';
            interestDebit = credit_score > 660 ? '29.99%' : credit_score >= 500 ? '35.99%' : '41.99%';
        }
        else if (subType === 'credit') {
            interestDebit = credit_score > 660 ? '29.99%' : credit_score >= 500 ? '35.99%' : '41.99%';
        }

        rateCredit.textContent = interestCredit ?? 'N/A';
        rateDebit.textContent = interestDebit ?? 'N/A';
        overdraftLimit.textContent = overdraft ?? 'N/A';
    }

    createAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedAccountType || !selectedSubAccountType) {
            alert('Please select account type and sub-account type.');
            return;
        }

        const userId = parseInt(createAccountForm.dataset.userId);
        const data = {
            account_type: selectedAccountType,
            account_sub_type: selectedSubAccountType,
            interest_rate_credit: rateCredit.textContent !== 'N/A' ? rateCredit.textContent : null,
            interest_rate_debit: rateDebit.textContent !== 'N/A' ? rateDebit.textContent : null,
            overdraft_limit: overdraftLimit.textContent !== 'N/A' ? overdraftLimit.textContent.replace('£','') : null,
            balance: 0,
            user_id: userId,
            date_opened: new Date().toISOString().slice(0, 10),
            is_active: 1
        };

        try {

            const response = await fetch(`/employeeDashboard/userAccounts/${userId}/createAccount/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (response.ok) {
                alert(`Account created successfully! Account Number: ${result.account_number}`);
                window.location.reload();
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (err) {
            console.error(err);
            alert('Error creating account.');
        }
    });
});
