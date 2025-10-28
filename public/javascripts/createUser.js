// Real-time middle name preview helper
const middleNameInput = document.getElementById('middle_name');
const middlePreview = document.getElementById('middleNamePreview');

function abbreviateMiddle(name) {
    return name.split(' ').filter(Boolean).map(n => n.charAt(0).toUpperCase() + '.').join(' ');
}

middleNameInput.addEventListener('input', () => {
    middlePreview.textContent = abbreviateMiddle(middleNameInput.value);
});

// Email validation
const emailInput = document.getElementById('user_email');
emailInput.addEventListener('input', () => {
    const emailError = document.getElementById('emailError');
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    emailError.style.display = regex.test(emailInput.value) ? 'none' : 'block';
});

// Phone validation
const phoneInput = document.getElementById('phone_number');
phoneInput.addEventListener('input', () => {
    const phoneError = document.getElementById('phoneError');
    const regex = /^[0-9\+\-\s]+$/;
    phoneError.style.display = regex.test(phoneInput.value) || phoneInput.value === '' ? 'none' : 'block';
});

// Toggle password visibility
const toggleButton = document.getElementById('togglePassword');
toggleButton.addEventListener('click', () => {
    const type = password.type === 'password' ? 'text' : 'password';
    password.type = type;
    confirm_password.type = type;
    toggleButton.textContent = type === 'password' ? 'Show' : 'Hide';
});

// Form submission check for password
document.getElementById('createUserForm').addEventListener('submit', function(e){
    const pwd = document.getElementById('password').value;
    const confirmPwd = document.getElementById('confirm_password').value;
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    const passwordError = document.getElementById('passwordError');
    if(!regex.test(pwd) || pwd !== confirmPwd){
        e.preventDefault();
        passwordError.style.display = 'block';
        return false;
    } else {
        passwordError.style.display = 'none';
    }
});
