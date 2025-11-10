import express from 'express';
import { getUserById } from '../services/loginService.js';
import dbPool from "../services/database.js";
import bcrypt from 'bcrypt';


const router = express.Router();

router.get('/', async function (req, res, next) {
    try {
        const userId = req.cookies.userId;
        if (!userId) return res.redirect('/login');

        const user = await getUserById(userId);

        // Pagination parameters
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search ? `%${req.query.search.trim()}%` : '%';

        // Count total matching users
        const [countRows] = await dbPool.execute(
            `SELECT COUNT(*) AS total
             FROM user
             WHERE user_type = 'end-user'
               AND (user_email LIKE ? OR first_name LIKE ? OR middle_name LIKE ? OR surname LIKE ?)`,
            [search, search, search, search]
        );
        const total = countRows[0].total;

        // Fetch paginated users
        const [rows] = await dbPool.execute(
            `SELECT user_email, first_name, middle_name, surname, user_title, phone_number, dob, is_active, mother_maiden_name, user_type , id
             FROM user
             WHERE user_type = 'end-user'
               AND (user_email LIKE ? OR first_name LIKE ? OR middle_name LIKE ? OR surname LIKE ?)
             ORDER BY user_email ASC
             LIMIT ${limit} OFFSET ${offset}`,
            [search, search, search, search]
        );

        // Return JSON for AJAX
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({ rows, total });
        }

        // Otherwise render page normally
        res.render('employeeDashboard', { user, branches: rows });
    } catch (error) {
        console.error('Error fetching user data:', error);
        next(error);
    }
});

router.get('/userAccounts/:id', async (req, res, next) => {
    const userIdParam = parseInt(req.params.id, 10);

    try {
        // Get user info
        const [userRows] = await dbPool.execute(
            'SELECT id, user_title, first_name, middle_name, surname, user_email FROM user WHERE id = ?',
            [userIdParam]
        );

        if (userRows.length === 0) {
            return res.status(404).send('User not found');
        }
        const user = userRows[0];

        // --- Get accounts linked to this user using JOIN
        const sql = `
            SELECT a.id, a.account_number, a.account_type, a.account_sub_type, a.date_opened,
                   a.balance, a.is_active
            FROM account a
            JOIN account_user au ON a.account_number = au.account_number
            WHERE au.user_id = ?
            ORDER BY a.account_number ASC
        `;
        const [accountRows] = await dbPool.execute(sql, [userIdParam]);

        res.render('userAccounts', {
            user,
            accounts: accountRows
        });

    } catch (err) {
        console.error('Error fetching user accounts:', err);
        next(err);
    }
});



router.get("/userAccounts/:userId/userAccountsInfo/:accountNumber", async (req, res, next) => {
    try {
        // Keep as string to match DB type
        const userIdParam = parseInt(req.params.userId, 10); // user_id is INT in DB
        const accountNumberParam = req.params.accountNumber;  // account_number kept as string

        // Pagination & search
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search ? `%${req.query.search.trim()}%` : "%";
        const dateFrom = req.query.dateFrom || null;
        const dateTo = req.query.dateTo || null;

        // --- Account info with JOIN to verify user linkage
        const accountSql = `
            SELECT a.account_number, a.balance, a.account_type, a.account_sub_type, a.date_opened,
                   a.interest_rate_credit, a.interest_rate_debit, a.overdraft_limit, a.is_active
            FROM account a
                     JOIN account_user au ON a.account_number = au.account_number
            WHERE a.account_number = ? AND au.user_id = ?
        `;
        const [accountRows] = await dbPool.execute(accountSql, [accountNumberParam, userIdParam]);

        if (!accountRows.length) {
            return res.status(404).send("Account not found or inaccessible for this user.");
        }

        // --- Linked users for this account
        const usersSql = `
            SELECT u.id, u.first_name, u.middle_name, u.surname, au.role
            FROM account_user au
                     JOIN user u ON au.user_id = u.id
            WHERE au.account_number = ?
            ORDER BY au.role ASC
        `;
        const [usersRows] = await dbPool.execute(usersSql, [accountNumberParam]);

        // --- Transactions with filters
        let txSql = `
            SELECT amount, date_time, description, type, running_balance,
                   recipient_account_number, sender_account_number, transaction_success,
                   CASE
                       WHEN sender_account_number = ? THEN 'Outward'
                       WHEN recipient_account_number = ? THEN 'Inward'
                       END AS flow_direction
            FROM transaction
            WHERE (sender_account_number = ? OR recipient_account_number = ?)
              AND (description LIKE ? OR type LIKE ? OR transaction_success LIKE ?)
        `;
        const txParams = [
            accountNumberParam, // CASE sender
            accountNumberParam, // CASE recipient
            accountNumberParam, // WHERE sender
            accountNumberParam, // WHERE recipient
            search,
            search,
            search
        ];

        // Optional date filtering
        if (dateFrom && dateTo) {
            txSql += " AND DATE(date_time) BETWEEN ? AND ?";
            txParams.push(dateFrom, dateTo);
        }

        // Count total matching transactions
        const [countRows] = await dbPool.execute(
            `SELECT COUNT(*) as total FROM (${txSql}) AS sub`,
            txParams
        );
        const total = countRows[0].total;

        // Apply pagination
        txSql += ` ORDER BY date_time DESC LIMIT ${limit} OFFSET ${offset}`;
        const [transactionRows] = await dbPool.query(txSql, txParams);

        // JSON for AJAX
        if (req.headers.accept && req.headers.accept.includes("application/json")) {
            return res.json({ rows: transactionRows, total });
        }

        // Render normal page
        res.render("userAccountsInfo", {
            user_id: userIdParam,
            account: accountRows[0],
            account_user: usersRows,
            transaction: transactionRows
        });

    } catch (error) {
        console.error("Error fetching user account info:", error);
        next(error);
    }
});



// Toggle account open/close
router.post('/userAccounts/:userId/userAccountsInfo/:accountNumber/toggleStatus', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const accountNumber = parseInt(req.params.accountNumber, 10);

        // Get current status and balance
        const [rows] = await dbPool.execute(
            'SELECT is_active, balance FROM account WHERE user_id = ? AND account_number = ?',
            [userId, accountNumber]
        );

        if (rows.length === 0) {
            return res.status(404).send('Account not found');
        }

        const currentStatus = rows[0].is_active;
        const balance = rows[0].balance;

        // If trying to close account, ensure balance is 0
        if (currentStatus === 1 && Math.abs(Number(balance)) > 0.0001) {
            return res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}?error=cannot-close-due-to-balance`);
        }


        const newStatus = currentStatus ? 0 : 1;

        await dbPool.execute(
            'UPDATE account SET is_active = ? WHERE user_id = ? AND account_number = ?',
            [newStatus, userId, accountNumber]
        );

        res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}`);
    } catch (err) {
        console.error(err);
        next(err);
    }
});


// Edit overdraft limit
router.post('/userAccounts/:userId/userAccountsInfo/:accountNumber/editOverdraft', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const accountNumber = parseInt(req.params.accountNumber, 10);
        const newLimit = parseFloat(req.body.overdraft);

        await dbPool.execute(
            'UPDATE account SET overdraft_limit = ? WHERE user_id = ? AND account_number = ?',
            [newLimit, userId, accountNumber]
        );

        res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}`);
    } catch (err) {
        console.error(err);
        next(err);
    }
});

// Add User
router.post('/userAccounts/:userId/userAccountsInfo/:accountNumber/addUser', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const accountNumber = parseInt(req.params.accountNumber, 10);
        const addUserId = parseInt(req.body.addUser, 10);

        // 0. Check if user exists in the 'user' table
        const [userExists] = await dbPool.execute(
            'SELECT id FROM user WHERE id = ?',
            [addUserId]
        );

        if (!userExists.length) {
            return res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}?error=user-not-found`);
        }

        // 1. Check if the user is already linked to this account
        const [alreadyLinked] = await dbPool.execute(
            'SELECT user_id FROM account_user WHERE account_number = ? AND user_id = ?',
            [accountNumber, addUserId]
        );

        if (alreadyLinked.length) {
            return res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}?error=user-already-linked`);
        }

        // 2. Get all existing roles for this account_number
        const [existingUsers] = await dbPool.execute(
            'SELECT role FROM account_user WHERE account_number = ?',
            [accountNumber]
        );

        let role;

        if (existingUsers.length > 1) {
            // More than 1 user → always authorized_signatory
            role = 'authorized_signatory';
        } else if (existingUsers.length === 1) {
            const existingRole = existingUsers[0].role;
            if (existingRole === 'primary_holder') {
                role = 'secondary_holder';
            } else if (existingRole === 'joint_holder') {
                role = 'joint_holder';
            } else if (existingRole === 'authorized_signatory') {
                role = 'authorized_signatory';
            } else {
                role = 'secondary_holder'; // fallback
            }
        } else {
            // No users yet → make new user primary_holder
            role = 'primary_holder';
        }

        // 3. Insert new user with computed role
        await dbPool.execute(
            'INSERT INTO account_user (account_number, user_id, role) VALUES (?, ?, ?)',
            [accountNumber, addUserId, role]
        );

        res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}`);
    } catch (err) {
        console.error(err);
        res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}?error=unexpected-error`);
    }
});


// Remove User
router.post('/userAccounts/:userId/userAccountsInfo/:accountNumber/removeUser', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const accountNumber = parseInt(req.params.accountNumber, 10);
        const removeUserId = parseInt(req.body.removeUser, 10);

        // Fetch the user from the account
        const [userRows] = await dbPool.execute(
            'SELECT role FROM account_user WHERE account_number = ? AND user_id = ?',
            [accountNumber, removeUserId]
        );

        // User not found
        if (!userRows.length) {
            return res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}?error=user-not-found`);
        }

        //User is primary holder
        if (userRows[0].role === 'primary_holder') {
            return res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}?error=cannot-remove-primary-holder`);
        }

        // Safe to delete
        await dbPool.execute(
            'DELETE FROM account_user WHERE account_number = ? AND user_id = ?',
            [accountNumber, removeUserId]
        );

        // Redirect back after successful removal
        res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}`);
    } catch (err) {
        console.error(err);
        // Generic error
        res.redirect(`/employeeDashboard/userAccounts/${userId}/userAccountsInfo/${accountNumber}?error=unexpected-error`);
    }
});



router.get('/userAccounts/:userId/createAccount', async (req, res, next) => {
    try {
        if (!req.cookies.userId) return res.redirect('/login');

        const userId = req.params.userId;

        // Get user info
        const [userRows] = await dbPool.execute(
            'SELECT id, credit_score FROM user WHERE id = ?',
            [userId ?? null]
        );

        if (userRows.length === 0) {
            return res.status(404).send('User not found');
        }

        const user = userRows[0];
        res.render('createAccount', { user });

    } catch (err) {
        next(err);
    }
});


router.post('/userAccounts/:userId/createAccount/submit', async (req, res, next) => {
    const userId = req.params.userId;
    const {
        account_type,
        account_sub_type,
        interest_rate_credit,
        interest_rate_debit,
        overdraft_limit,
        balance,
        date_opened,
        is_active
    } = req.body;

    try {
        // Get last account_number
        const [rows] = await dbPool.execute(
            'SELECT account_number FROM account ORDER BY id DESC LIMIT 1'
        );

        let newAccountNumber = 1;
        if (rows.length > 0) {
            newAccountNumber = parseInt(rows[0].account_number) + 1;
        }

        const creditRate = interest_rate_credit !== null
            ? parseFloat(interest_rate_credit.replace('%',''))
            : null;
        const debitRate  = interest_rate_debit !== null
            ? parseFloat(interest_rate_debit.replace('%',''))
            : null;
        const overdraft  = overdraft_limit !== null
            ? parseFloat(overdraft_limit.replace('£',''))
            : null;

        // Start transaction (optional, but safer)
        const conn = await dbPool.getConnection();
        try {
            await conn.beginTransaction();

            // Insert new account
            await conn.execute(
                `INSERT INTO account
                 (account_number, account_type, balance, user_id, account_sub_type, date_opened, interest_rate_credit, interest_rate_debit, overdraft_limit, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newAccountNumber,
                    account_type,
                    balance,
                    userId,
                    account_sub_type,
                    date_opened,
                    creditRate,
                    debitRate,
                    overdraft,
                    is_active
                ]
            );

            // Insert into account_user
            await conn.execute(
                `INSERT INTO account_user
                 (account_number, user_id)
                 VALUES (?, ?)`,
                [
                    newAccountNumber,
                    userId
                ]
            );

            await conn.commit();

            res.json({ success: true, account_number: newAccountNumber });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});


router.get('/createUser', async (req, res, next) => {
    try {
        if (!req.cookies.userId) return res.redirect('/login');
        res.render('createUser', {});
    } catch (error) {
        console.error('Error loading create account page:', error);
        next(error);
    }
});


router.post('/createUser/submit', async (req, res, next) => {
    try {
        if (!req.cookies.userId) return res.redirect('/login');

        const {
            user_email,
            password,
            confirm_password,
            first_name,
            middle_name,
            surname,
            mother_maiden_name,
            place_of_birth,
            phone_number,
            dob,
            security_word,
            user_title,
            user_type = 'end-user',
            is_active = 1
        } = req.body;


        if (!password || !confirm_password || password !== confirm_password) {
            return res.status(400).send('Passwords do not match or are empty');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);


        // Trim all input fields
        // const user_email = req.body.user_email ? req.body.user_email.trim() : '';
        // const password = req.body.password ? req.body.password.trim() : '';
        // const first_name = req.body.first_name ? req.body.first_name.trim() : '';
        // const middle_name = req.body.middle_name ? req.body.middle_name.trim() : '';
        // const surname = req.body.surname ? req.body.surname.trim() : '';
        // const mother_maiden_name = req.body.mother_maiden_name ? req.body.mother_maiden_name.trim() : '';
        // const place_of_birth = req.body.place_of_birth ? req.body.place_of_birth.trim() : '';
        // const security_word = req.body.security_word ? req.body.security_word.trim() : '';
        // const phone_number = req.body.phone_number ? req.body.phone_number.trim() : '';
        // const user_title = req.body.user_title ? req.body.user_title.trim() : '';
        // let user_type = req.body.user_type ? req.body.user_type.trim() : '';
        // const is_active = req.body.is_active ? req.body.is_active : 1; // default to 1
        // const dob = req.body.dob ? req.body.dob.trim() : '';

// Ensure user_type is valid ENUM
        const validUserTypes = ['end-user', 'employee', 'admin'];
        if (!validUserTypes.includes(user_type)) {
            console.log('Invalid user_type:', JSON.stringify(user_type));
            user_type = 'end-user'; // fallback default
        }


        const sql = `
            INSERT INTO user 
            (user_email, password, first_name, middle_name, surname, mother_maiden_name, place_of_birth, security_word, phone_number,  user_title, user_type, is_active, dob)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;


        await dbPool.execute(sql, [
            user_email.trim(),
            hashedPassword.trim(),
            first_name.trim(),
            middle_name.trim(),
            surname.trim(),
            mother_maiden_name.trim(),
            place_of_birth.trim(),
            security_word.trim(),
            phone_number.trim(),
            user_title.trim(),
            user_type.trim(),
            is_active.trim(),
            dob.trim()
        ]);

        res.redirect(`/employeeDashboard`);
    } catch (error) {
        console.error('Error creating account:', error);
        next(error);
    }
});


export default router;
