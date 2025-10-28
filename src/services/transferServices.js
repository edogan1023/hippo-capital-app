import dbPool from "./database.js";
import bcrypt from 'bcrypt';

export async function login(userEmail, password) {
    if (!userEmail || !password) {
        throw new Error('Email and password are required');
    }

    const sql = 'SELECT id, user_email, password, user_type, is_active FROM user WHERE user_email = ?';
    const [rows] = await dbPool.execute(sql, [userEmail]);

    if (rows.length === 0) {
        throw new Error('User not found');
    }

    const user = rows[0];
    const storedPassword = user.password;

    let valid = false;

    if (storedPassword.startsWith('$2')) {
        // Password is hashed
        valid = await bcrypt.compare(password, storedPassword);
    } else {
        // Plain text password, check directly
        valid = (password === storedPassword);
        if (valid) {
            // Upgrade to hashed password
            const hashed = await bcrypt.hash(password, 10);
            await dbPool.execute('UPDATE user SET password = ? WHERE id = ?', [hashed, user.id]);
        }
    }

    if (!valid) {
        throw new Error('Invalid password');
    }

    console.log('User Account:', user);
    console.log('Login successful for user:', userEmail);

    return user;
}

export async function getUserById(userId) {
    const sql = 'SELECT user_title, first_name, middle_name, surname FROM user WHERE id = ?';
    const [rows] = await dbPool.execute(sql, [userId]);

    if (rows.length === 0) {
        throw new Error('User not found');
    }

    return rows[0];
}
