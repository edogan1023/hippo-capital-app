document.addEventListener("DOMContentLoaded", () => {
    console.log("Forgot password JS loaded");

    const form = document.getElementById("forgot-password-form");
    const mainBtn = document.getElementById("mainSubmit");

    const step1 = document.getElementById("step-1");
    const step2 = document.getElementById("step-2");
    const step3 = document.getElementById("step-3");

    const timerDisplay = document.getElementById("timer");
    const timeoutMessage = document.getElementById("timeout-message");

    const toggleNewPassword = document.getElementById("toggleNewPassword");
    const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

    let currentStep = 1;
    let email = "";
    let timerInterval;
    let timeRemaining = 5 * 60; // 5 minutes in seconds

    //format time as mm:ss
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    // 5-minute countdown timer
    const startTimer = () => {
        timerDisplay.textContent = `Time remaining: ${formatTime(timeRemaining)}`;
        timerInterval = setInterval(() => {
            timeRemaining--;
            timerDisplay.textContent = `Time remaining: ${formatTime(timeRemaining)}`;
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                timeoutMessage.classList.remove("hidden");
                step2.querySelector("input").disabled = true;
                mainBtn.disabled = true;
                mainBtn.classList.add("opacity-50", "cursor-not-allowed");
            }
        }, 1000);
    };

    // Toggle password visibility
    const togglePasswordVisibility = (inputId, buttonId) => {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);

        button.addEventListener("click", () => {
            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            button.textContent = isHidden ? "Hide" : "Show";
        });
    };

    togglePasswordVisibility("newPassword", "toggleNewPassword");
    togglePasswordVisibility("confirmPassword", "toggleConfirmPassword");

    // click handler
    mainBtn.addEventListener("click", async () => {
        if (currentStep === 1) {
            // Verify identity
            email = document.getElementById("email").value.trim();
            const maidenName = document.getElementById("maidenName").value.trim();
            const securityWord = document.getElementById("securityWord").value.trim();

            if (!email || !maidenName || !securityWord) {
                alert("Please fill out all fields.");
                return;
            }

            try {
                const res = await fetch("/forgotPassword", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, maidenName, securityWord }),
                });

                const result = await res.json();
                console.log("Step 1 response:", result);

                if (result.success) {
                    alert("Verification successful! Check your email for a code.");
                    step1.classList.add("hidden");
                    step2.classList.remove("hidden");
                    currentStep = 2;
                    mainBtn.textContent = "Verify Code";
                    startTimer();
                } else {
                    alert("Invalid information. Please check and try again.");
                }
            } catch (err) {
                console.error("Step 1 error:", err);
                alert("Server error. Please try again later.");
            }

        } else if (currentStep === 2) {
            // Verify reset code
            const code = document.getElementById("securityCode").value.trim();
            if (!code) {
                alert("Please enter your security code.");
                return;
            }

            try {
                const res = await fetch("/forgotPassword/verify-reset-code", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, code }),
                });

                const result = await res.json();
                console.log("Step 2 response:", result);

                if (result.valid) {
                    clearInterval(timerInterval);
                    step2.classList.add("hidden");
                    step3.classList.remove("hidden");
                    mainBtn.textContent = "Reset Password";
                    currentStep = 3;
                } else {
                    alert("Invalid or expired code. Please try again.");
                }
            } catch (err) {
                console.error("Step 2 error:", err);
                alert("Server error. Please try again later.");
            }

        } else if (currentStep === 3) {
            // Reset password
            const newPassword = document.getElementById("newPassword").value.trim();
            const confirmPassword = document.getElementById("confirmPassword").value.trim();

            if (!newPassword || !confirmPassword) {
                alert("Please fill out both password fields.");
                return;
            }
            if (newPassword !== confirmPassword) {
                alert("Passwords do not match.");
                return;
            }

            try {
                const res = await fetch("/forgotPassword/reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, newPassword }),
                });

                const result = await res.json();
                console.log("Step 3 response:", result);

                if (result.success) {
                    alert("Password reset successful! You may now log in.");
                    window.location.href = "/login";
                } else {
                    alert("Password reset failed. Please try again.");
                }
            } catch (err) {
                console.error("Step 3 error:", err);
                alert("Server error. Please try again later.");
            }
        }
    });
});
