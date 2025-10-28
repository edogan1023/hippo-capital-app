import express from 'express';
import dbPool from '../services/database.js';
import bcrypt from 'bcrypt';
import { sendResetCode } from '../services/emailService.js';

const router = express.Router();
const resetCodes = new Map();

// initially load page
router.get('/', (req, res) => {
    res.render('forgotPassword');
});

//Identity verification
router.post('/', async (req, res) => {
    const { email, maidenName, securityWord } = req.body;
    console.log('POST /forgotPassword - Identity check:', req.body);

    if (!email || !maidenName || !securityWord) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const sql = `
            SELECT id FROM user
            WHERE user_email = ? AND mother_maiden_name = ? AND security_word = ?
        `;
        const [rows] = await dbPool.execute(sql, [email, maidenName, securityWord]);
        console.log('DB query result:', rows);

        if (!rows || rows.length === 0) {
            console.log('No matching user found');
            return res.json({ success: false });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        resetCodes.set(email, { code, timestamp: Date.now() });

        await sendResetCode(email, code);
        console.log(`Reset code sent to ${email}: ${code}`);

        res.json({ success: true });
    } catch (err) {
        console.error('Error in POST /forgotPassword:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

//Code verification
router.post('/verify-reset-code', (req, res) => {
    const { email, code } = req.body;
    console.log('POST /verify-reset-code:', req.body);

    if (!email || !code) {
        return res.status(400).json({ valid: false, error: 'Missing email or code' });
    }

    const record = resetCodes.get(email);
    if (!record) {
        console.log('No reset code found for email');
        return res.json({ valid: false });
    }

    const expired = Date.now() - record.timestamp > 5 * 60 * 1000;
    if (expired) {
        console.log(`Code expired for ${email}`);
        resetCodes.delete(email);
        return res.json({ valid: false });
    }

    if (record.code !== code) {
        console.log(`Invalid code for ${email}`);
        return res.json({ valid: false });
    }

    res.json({ valid: true });
});

// Password reset
router.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    console.log('POST /reset-password:', req.body);

    if (!email || !newPassword) {
        return res.status(400).json({ success: false, error: 'Missing email or password' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const sql = 'UPDATE user SET password = ? WHERE user_email = ?';
        await dbPool.execute(sql, [hashedPassword, email]);

        resetCodes.delete(email);
        console.log(`Password updated for ${email}`);

        res.json({ success: true });
    } catch (err) {
        console.error('Error during password reset:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
