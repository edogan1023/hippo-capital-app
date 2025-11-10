import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'hippocapital.services@gmail.com',
        pass: process.env.EMAIL_PASSWORD
    }
});

// Generate 6-digit code
export function generateResetCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send email
export async function sendResetCode(email, code) {
    const mailOptions = {
        from: 'hippocapital.services@gmail.com',
        to: email,
        subject: 'Hippo Capital Password Reset Code',
        text: `Your password reset code is: ${code}. It expires in 5 minutes. If you did not request this please immediately inform us by phone call or physically coming to one of our branches. `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Reset code sent to ${email}`);
    } catch (err) {
        console.error('Error sending reset code:', err);
        throw new Error('Failed to send reset email');
    }
}
