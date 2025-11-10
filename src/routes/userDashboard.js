import express from 'express';
import { getUserById } from '../services/loginService.js';
import dbPool from "../services/database.js";

const router = express.Router();

router.get('/', async function(req, res, next) {
    try {
        const userId = req.cookies.userId;
        if (!userId) {
            // User is not logged in, redirect to login
            return res.redirect('/login');
        }
        const user = await getUserById(userId);

        const parameters = {
            user,
            menuItems: [
                {id: 'credit-cards', title: 'Credit Cards'},
                {id: 'debit-cards', title: 'Debit Cards'},
                {id: 'overdrafts', title: 'Overdrafts'},
                {id: 'savings', title: 'Savings'},
                {id: 'car-finance', title: 'Car Finance'},
                {id: 'mortgages', title: 'Mortgages'},
                {id: 'loans', title: 'Loans'},
                {id: 'cashback', title: 'Cashback'}
            ]
        };
        res.render('userDashboard', parameters);
    } catch (error) {
        console.error('Error fetching user data:', error);
        return next(error);
    }});

router.get('/cashback', async function(req, res, next){
    try {

        const sql = 'SELECT company_name, cashback, conditions, offer_image FROM cashback_offers ORDER BY company_name ASC';

        // Using execute method with connection pool for better performance
        const [rows, fields] = await dbPool.execute(sql);

        console.log('cashback_offers retrieved:', rows.length);

        res.render('cashback', { cashback_offers: rows });
    } catch (error) {
        console.error('Error fetching cashback_offers:', error);

        // Pass error to Express error handler
        next(error);
    }
});

router.get('/transfer', async function(req, res, next){
    try {

        if (!req.cookies.userId) {
            // User is not logged in, redirect to login
            return res.redirect('/login');
        }

        const userId = req.cookies.userId;
        console.log("Cookie userId:", req.cookies.userId);
        const sql = 'SELECT user_id , account_number , account_type , account_sub_type , balance FROM account WHERE user_id = ? AND is_active = 1 ORDER BY account_number ASC';
        const [rows, fields] = await dbPool.execute(sql, [userId]);
        // Using execute method with connection pool for better performance

        console.log('account data retrieved:', rows.length);

        res.render('transfer', { transfer: rows });
    } catch (error) {
        console.error('Error fetching accounts:', error);

        // Pass error to Express error handler
        next(error);
    }
});

router.post('/transfer/submit', async function(req, res, next){
    console.log("test")
    const {
        selectedAccountNumber,
        selectedBalance,
        destination_account_number,
        amount,
    } = req.body;
    const transactionSuccess = "success";
    console.log('reg body', req.body);
    try {

        // Check if user has enough balance
        if (parseFloat(amount) > parseFloat(selectedBalance)) {
            return res.status(400).send("Insufficient funds.");
        }

        // Update the sender's balance
        const senderBalance = selectedBalance - amount;
        await dbPool.execute(
            "UPDATE account SET balance = ? WHERE account_number = ?",
            [senderBalance, selectedAccountNumber],
        );

        //Validate that the destination account exists & is active
        const [destRows] = await dbPool.execute(
            "SELECT account_number , balance FROM account WHERE is_active = 1 AND account_number = ?",
            [destination_account_number],
        )
        if (destRows.length === 0) {
            throw new Error("account number is invalid / inactive");
            const transactionSuccess = "fail";
        }
        if (destRows.length === 0) {
            return res.status(400).send("account number is invalid / inactive");
            const transactionSuccess = "fail";
        }

        //Update the destination account's balance
        const destBalance = parseFloat(destRows[0].balance);
        const amountNum = parseFloat(amount);
        const updated_destination_balance = destBalance + amountNum;
        await dbPool.execute(
            "UPDATE account SET balance = ? WHERE account_number = ?",
            [updated_destination_balance, destination_account_number ],
        );

        const type_transfer = "transfer";
        const direction_out = "out";
        let { description } = req.body;
        if (!description || description.trim() === "") {
            description = null;
        }

        // Create the sender's transfer row
        await dbPool.execute(
            `INSERT INTO transaction
             (amount, running_balance, date_time, description, type, sender_account_number,recipient_account_number, direction, transaction_success)
             VALUES (?, ?,CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`,
                [
                    amount,
                    senderBalance,
                    description,
                    type_transfer,
                    selectedAccountNumber,
                    destination_account_number,
                    direction_out,
                    transactionSuccess
                ]
        );
        const direction_in = "in";
        // Create the recipient's transfer row
        await dbPool.execute(
            `INSERT INTO transaction
             (amount, running_balance, date_time, description, type, sender_account_number, recipient_account_number, direction, transaction_success)
             VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`,
                [
                    amount,
                    updated_destination_balance,
                    description,
                    type_transfer,
                    selectedAccountNumber,
                    destination_account_number,
                    direction_in,
                    transactionSuccess
                ]

        );


        res.redirect('/userDashboard');

    } catch (error) {
        console.error('Error fetching accounts:', error);

        // Pass error to Express error handler
        next(error);
    }
});

router.get('/accounts', async function(req, res, next){
    try {
        if (!req.cookies.userId) {
            return res.redirect('/login');
        }
        const userId = req.cookies.userId;
        console.log("Cookie userId:", userId);

        // Fetch all active accounts linked to the user using JOIN
        const sql = `
            SELECT a.account_number, a.balance, a.account_type, a.account_sub_type
            FROM account a
            JOIN account_user au ON a.account_number = au.account_number
            WHERE au.user_id = ? AND a.is_active = 1
            ORDER BY a.account_number ASC
        `;
        const [rows] = await dbPool.execute(sql, [userId]);

        console.log('accounts retrieved:', rows.length);
        res.render('accounts', { account: rows });

    } catch (error) {
        console.error('Error fetching accounts:', error);
        next(error);
    }
});

router.get('/accounts/accountInfo/:accountNumber', async function (req, res, next) {
    try {
        if (!req.cookies.userId) {
            return res.redirect('/login');
        }

        const userId = req.cookies.userId;
        const accountNumber = parseInt(req.params.accountNumber);

        // Pagination & search
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const searchInput = req.query.search ? req.query.search.trim() : '';
        const search = searchInput ? `%${searchInput}%` : '%';
        const dateFrom = req.query.dateFrom || null;
        const dateTo = req.query.dateTo || null;

        // --- Account details with JOIN to verify access
        const accountSql = `
            SELECT a.account_number, a.balance, a.account_type, a.account_sub_type, a.date_opened,
                   a.interest_rate_credit, a.interest_rate_debit, a.overdraft_limit, a.is_active
            FROM account a
                     JOIN account_user au ON a.account_number = au.account_number
            WHERE a.account_number = ? AND au.user_id = ? AND a.is_active = 1
        `;
        const [accountRows] = await dbPool.execute(accountSql, [accountNumber, userId]);

        if (!accountRows.length) {
            return res.status(404).send("Account not found or inaccessible.");
        }

        // --- Linked users for this account
        const usersSql = `
            SELECT u.id, u.first_name, u.middle_name, u.surname, au.role
            FROM account_user au
                     JOIN user u ON au.user_id = u.id
            WHERE au.account_number = ?
            ORDER BY au.role ASC
        `;
        const [usersRows] = await dbPool.execute(usersSql, [accountNumber]);

        // --- Transactions with filters
        let txSql = `
            SELECT amount, date_time, description, type, running_balance,
                   sender_account_number, recipient_account_number, transaction_success,
                   CASE
                       WHEN sender_account_number = ? THEN 'Outward'
                       WHEN recipient_account_number = ? THEN 'Inward'
                       END AS flow_direction
            FROM transaction
            WHERE ((sender_account_number = ? AND direction = 'out') OR
                   (recipient_account_number = ? AND direction = 'in'))
              AND transaction_success = 'success'
        `;
        const txParams = [
            accountNumber, // CASE sender
            accountNumber, // CASE recipient
            accountNumber, // WHERE sender
            accountNumber  // WHERE recipient
        ];

        if (searchInput) {
            txSql += " AND (description LIKE ? OR type LIKE ?)";
            txParams.push(search, search);
        }

        if (dateFrom && dateTo) {
            txSql += " AND DATE(date_time) >= ? AND DATE(date_time) <= ?";
            txParams.push(dateFrom, dateTo);
        }

        // --- Count total for pagination
        let countSql = txSql.replace(/ORDER BY.*$/i, '');
        countSql = countSql.replace(/LIMIT.*OFFSET.*$/i, '');
        const [countRows] = await dbPool.execute(`SELECT COUNT(*) as total FROM (${countSql}) AS sub`, txParams);
        const total = countRows[0].total;

        // --- Apply pagination
        txSql += ` ORDER BY date_time DESC LIMIT ${limit} OFFSET ${offset}`;
        const [transactionRows] = await dbPool.query(txSql, txParams);

        // --- Respond JSON for AJAX
        if (req.headers.accept && req.headers.accept.includes("application/json")) {
            return res.json({ rows: transactionRows, total });
        }

        // --- Render normal page
        res.render('accountInfo', {
            account: accountRows[0],
            account_user: usersRows,
            transaction: transactionRows
        });

    } catch (error) {
        console.error('Error fetching account data or transactions:', error);
        next(error);
    }
});

router.get('/accounts/userCreateAccount', async (req, res, next) => {
    try {
        if (!req.cookies.userId) return res.redirect('/login');

        const userId = req.cookies.userId;

        // Get user info
        const [userRows] = await dbPool.execute(
            'SELECT id, credit_score FROM user WHERE id = ?',
            [userId ?? null]
        );

        if (userRows.length === 0) {
            return res.status(404).send('User not found');
        }

        const user = userRows[0];
        res.render('userCreateAccount', { user });

    } catch (err) {
        next(err);
    }
});

router.post('/accounts/userCreateAccount/submit', async (req, res, next) => {
    const userId = req.cookies.userId;
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

        // Start transaction
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




router.get('/loans', async function(req, res, next){
    try {

        if (!req.cookies.userId) {
            // User is not logged in, redirect to login
            return res.redirect('/login');
        }

        const userId = req.cookies.userId;
        console.log("Cookie userId:", req.cookies.userId);
        const sql = 'SELECT loan_number , loan_type , term_months , intrest_rate , principal FROM loans WHERE user_id = ? AND status = "active" ORDER BY loan_number ASC';
        const [rows, fields] = await dbPool.execute(sql, [userId]);
        // Using execute method with connection pool for better performance


        console.log('loans retrieved:', rows.length);

        res.render('loans', { loans: rows });
    } catch (error) {
        console.error('Error fetching loans:', error);

        // Pass error to Express error handler
        next(error);
    }
});

router.get('/loans/pendingLoans', async function(req, res, next){
    try {

        if (!req.cookies.userId) {
            // User is not logged in, redirect to login
            return res.redirect('/login');
        }

        const userId = req.cookies.userId;
        console.log("Cookie userId:", req.cookies.userId);
        const pendingLoanssql = `
            SELECT loan_number, principal, loan_type, intrest_rate, term_months
            FROM loans
            WHERE user_id = ? AND (status = 'pending' OR status = 'rejected')
            ORDER BY loan_number ASC
        `;
        const [rows, fields] = await dbPool.execute(pendingLoanssql, [userId]);
        // Using execute method with connection pool for better performance

        console.log('pending loans retrieved:', rows.length);

        res.render('pendingLoans', { loans: rows });
    } catch (error) {
        console.error('Error fetching loans:', error);

        // Pass error to Express error handler
        next(error);
    }
});

router.get('/loans/:userId/loanApplication', async (req, res, next) => {
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
        res.render('loanApplication', { user });

    } catch (err) {
        next(err);
    }
});

router.get('/loans/loansInfo/:loanNumber', async function (req, res, next) {
    try {
        if (!req.cookies.userId) {
            return res.redirect('/login');
        }

        const userId = req.cookies.userId;
        const loanNumber = req.params.loanNumber;

        console.log("Cookie userId:", userId);
        console.log("Requested loan number:", loanNumber);

        // Query for loans info
        const loansSql = `
            SELECT loan_number, principal, loan_type, intrest_rate, start_date,
                   term_months, end_date, remaining_balance , status , repayment_frequency , collateral , user_id
            FROM loans
            WHERE user_id = ? AND loan_number = ?
            ORDER BY loan_number ASC
        `;
        const [loansRows] = await dbPool.execute(loansSql, [userId, loanNumber]);

        console.log('loans info data retrieved:', loansRows.length, loansRows[0]);


// Separate query to get all users linked to a loan with full names
        const usersSql = `
            SELECT user.id, user.first_name, user.middle_name, user.surname, loan_user.role
            FROM loan_user
                     JOIN user ON loan_user.user_id = user.id
                     JOIN loans ON loan_user.loan_id = loans.id
            WHERE loans.loan_number = ?
            ORDER BY loan_user.role ASC
        `;

        const [usersRows] = await dbPool.execute(usersSql, [loanNumber]);

        console.log('Users linked to loan:', usersRows);

        res.render('loansInfo', {
            loans: loansRows[0], // primary loan info
            loanUsers: usersRows  // the array of users linked to this loan
        });
    } catch (error) {
        console.error('Error fetching loans data:', error);
        next(error);
    }
});



export default router;
