import express from 'express';
import dbPool from '../services/database.js';
const app = express();

const router = express.Router();

// List of tables for nav
const TABLES = ['account', 'account_user', 'user', 'branch', 'cashback_offers', 'transaction'];

// Editable columns mapping (server-side authoritative)
const EDITABLE_COLUMNS = {
    account: ['interest_rate_credit', 'interest_rate_debit', 'overdraft_limit', 'is_active'],
    account_user: [], // no edits
    branch: ['branch_name', 'branch_address', 'branch_phone_number'],
    cashback_offers: ['company_name', 'cashback', 'conditions', 'category', 'offer_image'],
    transaction: [], // no edits
    user: ['user_email', 'first_name', 'middle_name', 'surname', 'mother_maiden_name', 'place_of_birth', 'phone_number', 'user_title', 'user_type', 'is_active', 'dob', 'credit_score']
};

// Basic validation functions
function isDecimal(val) {
    return !isNaN(val) && val !== '';
}
function isInteger(val) {
    return Number.isInteger(Number(val));
}
function isBooleanTinyInt(val) {
    return val === 0 || val === 1 || val === '0' || val === '1';
}
function validatePhoneNumber(val) {
    if (val == null) return false;
    const digits = String(val).replace(/\D/g, '');
    return digits.length > 0 && digits.length <= 20;
}
function validateDateDDMMYYYY(val) {
    if (!val) return false;
    // Expect dd/mm/yyyy
    const parts = String(val).split('/');
    if (parts.length !== 3) return false;
    const dd = Number(parts[0]), mm = Number(parts[1]), yyyy = Number(parts[2]);
    if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yyyy)) return false;
    const d = new Date(`${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`);
    return d && d.getFullYear() === yyyy && (d.getMonth() + 1) === mm && d.getDate() === dd;
}

// Render dashboard page (data via AJAX)
router.get('/', async (req, res, next) => {
    try {
        const userId = req.cookies.userId;
        if (!userId) return res.redirect('/login');

        res.render('adminDashboard', { tables: TABLES, user: req.user, title: 'Admin Dashboard' });
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        next(error);
    }
});

// Route to fetch table data dynamically (existing)
router.get('/table/:tableName', async (req, res, next) => {
    try {
        const tableName = req.params.tableName;
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search ? `%${req.query.search.trim()}%` : '%';

        const validTables = TABLES;
        if (!validTables.includes(tableName)) {
            return res.status(400).json({ error: 'Invalid table name' });
        }

        // Get columns for table
        const [columnsRows] = await dbPool.query(`SHOW COLUMNS FROM \`${tableName}\``);
        const columnNames = columnsRows.map(c => c.Field);

        // Build search across all columns (safe because column names are discovered from DB)
        const searchConditions = columnNames.map(() => `?? LIKE ?`).join(' OR ');
        const params = [];
        columnNames.forEach(col => params.push(col, search));

        // Count total
        const [countRows] = await dbPool.query(
            `SELECT COUNT(*) AS total FROM \`${tableName}\` WHERE ${columnNames.map(c => `\`${c}\` LIKE ?`).join(' OR ')}`,
            Array(columnNames.length).fill(search)
        );
        const total = countRows[0].total;

        // Fetch paginated rows
        const [rows] = await dbPool.query(
            `SELECT * FROM \`${tableName}\` WHERE ${columnNames.map(c => `\`${c}\` LIKE ?`).join(' OR ')} ORDER BY id LIMIT ? OFFSET ?`,
            [...Array(columnNames.length).fill(search), limit, offset]
        );

        res.json({ rows, total, columns: columnNames });
    } catch (error) {
        console.error('Error fetching table data:', error);
        next(error);
    }
});

// PUT route to update a row (edit)
router.put('/table/:tableName/:id', async (req, res, next) => {
    try {
        const userId = req.cookies.userId;
        if (!userId) return res.status(403).json({ error: 'Not authenticated' });

        const tableName = req.params.tableName;
        const rowId = req.params.id;
        const validTables = TABLES;
        if (!validTables.includes(tableName)) return res.status(400).json({ error: 'Invalid table' });

        const allowed = EDITABLE_COLUMNS[tableName] || [];
        if (allowed.length === 0) return res.status(400).json({ error: 'No editable columns for this table' });

        const payload = req.body || {};
        const toUpdate = {};
        for (const key of Object.keys(payload)) {
            if (allowed.includes(key)) toUpdate[key] = payload[key];
        }

        if (Object.keys(toUpdate).length === 0) {
            return res.status(400).json({ error: 'No allowed fields provided' });
        }

        // Server-side validation per field
        const errors = [];
        for (const [col, val] of Object.entries(toUpdate)) {
            switch (col) {
                // account decimals / tinyint
                case 'interest_rate_credit':
                case 'interest_rate_debit':
                    if (val === null || val === '') break;
                    if (!isDecimal(val)) errors.push(`${col} must be a decimal`);
                    break;
                case 'overdraft_limit':
                    if (val === null || val === '') break;
                    if (!isDecimal(val)) errors.push(`${col} must be a decimal`);
                    break;
                case 'is_active':
                    if (!isBooleanTinyInt(val)) errors.push('is_active must be 0 or 1');
                    break;

                // branch
                case 'branch_name':
                    if (!val || String(val).length > 100) errors.push('branch_name required (max 100 chars)');
                    break;
                case 'branch_address':
                    if (!val || String(val).length > 255) errors.push('branch_address required (max 255 chars)');
                    break;
                case 'branch_phone_number':
                    if (!validatePhoneNumber(val)) errors.push('branch_phone_number must be numeric up to 13 digits');
                    break;

                // cashback_offers
                case 'company_name':
                    if (!val || String(val).length > 255) errors.push('company_name required (max 255 chars)');
                    break;
                case 'cashback':
                    if (!isDecimal(val)) errors.push('cashback must be a decimal');
                    break;
                case 'conditions':
                    if (val && String(val).length > 2000) errors.push('conditions too long (max 2000 chars)');
                    break;
                case 'category':
                    if (val && String(val).length > 100) errors.push('category too long (max 100 chars)');
                    break;
                case 'offer_image':
                    if (val && String(val).length > 100) errors.push('offer_image too long (max 100 chars)');
                    break;

                // user
                case 'user_email':
                    if (!val || String(val).length > 50) errors.push('user_email required (max 50 chars)');
                    break;
                case 'first_name':
                case 'middle_name':
                    if (val && String(val).length > 50) errors.push(`${col} max 50 chars`);
                    break;
                case 'surname':
                    if (val && String(val).length > 100) errors.push('surname max 100 chars');
                    break;
                case 'mother_maiden_name':
                    if (val && String(val).length > 100) errors.push('mother_maiden_name max 100 chars');
                    break;
                case 'place_of_birth':
                    if (val && String(val).length > 250) errors.push('place_of_birth max 250 chars');
                    break;
                case 'phone_number':
                    if (!validatePhoneNumber(val)) errors.push('phone_number must be numeric up to 13 digits');
                    break;
                case 'user_title':
                    if (val && String(val).length > 20) errors.push('user_title max 20 chars');
                    break;
                case 'user_type':
                    if (!['end-user', 'employee', 'admin'].includes(String(val))) errors.push('user_type invalid');
                    break;
                case 'dob':
                    if (!validateDateDDMMYYYY(val)) errors.push('dob must be dd/mm/yyyy');
                    break;
                case 'credit_score':
                    if (!isInteger(val) || Number(val) < 0 || Number(val) > 999) errors.push('credit_score must be 0-999');
                    break;
                default:
                    break;
            }
        }

        if (errors.length) return res.status(400).json({ error: errors.join('; ') });

        // Build update statement
        const keys = Object.keys(toUpdate);
        const setParts = keys.map(k => `\`${k}\` = ?`).join(', ');
        const values = keys.map(k => {
            // convert some values properly
            if (k === 'is_active') return Number(toUpdate[k]);
            if (k === 'credit_score') return Number(toUpdate[k]);
            if (['interest_rate_credit','interest_rate_debit','overdraft_limit','cashback'].includes(k)) {
                return toUpdate[k] === '' ? null : toUpdate[k];
            }
            const dobVal = payload.dob || null;

        });

        values.push(rowId);

        const sql = `UPDATE \`${tableName}\` SET ${setParts} WHERE id = ?`;
        await dbPool.execute(sql, values);

        // Optionally: write an audit log here (not implemented)
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating row:', error);
        next(error);
    }
});

//POST route to add a row
router.post('/table/:tableName/add', async (req, res, next) => {
    try {
        const userId = req.cookies.userId;
        if (!userId) return res.status(403).json({ error: 'Not authenticated' });

        const tableName = req.params.tableName;
        if (!TABLES.includes(tableName)) return res.status(400).json({ error: 'Invalid table name' });

        const payload = req.body || {};
        let insertData = {};

        // === ACCOUNT TABLE ===
        if (tableName === 'account') {
            const [lastRow] = await dbPool.query('SELECT account_number FROM account ORDER BY account_number DESC LIMIT 1');
            const newAccountNumber = lastRow.length ? lastRow[0].account_number + 1 : 10000001;

            const userIdVal = Number(payload.user_id);
            if (isNaN(userIdVal)) return res.status(400).json({ error: 'user_id must be a number' });
            const [userCheck] = await dbPool.query('SELECT id FROM user WHERE id = ?', [userIdVal]);
            if (!userCheck.length) return res.status(400).json({ error: `User with ID ${userIdVal} does not exist` });

            const accountTypes = ['personal_single','personal_joint','business_single','business_multi-signatory'];
            const accountSubTypes = ['current','savings','ISA','credit'];
            if (!accountTypes.includes(payload.account_type)) return res.status(400).json({ error: 'Invalid account_type' });
            if (!accountSubTypes.includes(payload.account_sub_type)) return res.status(400).json({ error: 'Invalid account_sub_type' });

            ['interest_rate_credit','interest_rate_debit','overdraft_limit'].forEach(field => {
                if (payload[field] !== '' && payload[field] != null && isNaN(payload[field])) {
                    return res.status(400).json({ error: `${field} must be a valid number` });
                }
            });

            if (!(payload.is_active === 0 || payload.is_active === 1 || payload.is_active==='0' || payload.is_active==='1')) {
                return res.status(400).json({ error: 'is_active must be 0 or 1' });
            }

            insertData = {
                id: null,
                account_number: newAccountNumber,
                account_type: payload.account_type,
                balance: 0.00,
                user_id: userIdVal,
                account_sub_type: payload.account_sub_type,
                date_opened: new Date().toISOString().slice(0,10),
                interest_rate_credit: payload.interest_rate_credit || null,
                interest_rate_debit: payload.interest_rate_debit || null,
                overdraft_limit: payload.overdraft_limit || null,
                is_active: Number(payload.is_active)
            };

            const keys = Object.keys(insertData);
            const values = keys.map(k => insertData[k]);
            const placeholders = keys.map(() => '?').join(',');
            await dbPool.execute(`INSERT INTO account (${keys.join(',')}) VALUES (${placeholders})`, values);
            await dbPool.execute('INSERT INTO account_user (account_number, user_id, role) VALUES (?,?,?)', [newAccountNumber, userIdVal, 'primary_holder']);

            return res.json({ success: true, message: `Successfully added account ${newAccountNumber}` });

            // === USER TABLE ===
        } else if (tableName === 'user') {
            if (!payload.user_email) return res.status(400).json({ error: 'Email is required' });
            const [emailCheck] = await dbPool.query('SELECT id FROM user WHERE user_email = ?', [payload.user_email]);
            if (emailCheck.length) return res.status(400).json({ error: 'Email already exists' });

            const pw = payload.password || '';
            const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!?#]).{8,}$/;
            if (!pwRegex.test(pw)) return res.status(400).json({ error: 'Password must be 8+ chars, include upper, lower, number, special (!?#)' });

            if (!payload.phone_number || payload.phone_number.length !== 13) {
                return res.status(400).json({ error: 'Phone number must be exactly 13 characters, spaces included' });
            }

            let dobVal = null;
            if (payload.dob) {
                const parts = payload.dob.split('/');
                if (parts.length !== 3) return res.status(400).json({ error: 'DOB must be in dd/mm/yyyy format' });
                dobVal = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }

            insertData = {
                id: null,
                user_email: payload.user_email,
                password: payload.password,
                first_name: payload.first_name,
                middle_name: payload.middle_name || null,
                surname: payload.surname,
                mother_maiden_name: payload.mother_maiden_name || null,
                place_of_birth: payload.place_of_birth || null,
                security_word: payload.security_word || null,
                phone_number: payload.phone_number,
                user_title: payload.user_title || null,
                user_type: payload.user_type,
                is_active: Number(payload.is_active),
                dob: dobVal,
                credit_score: payload.credit_score || null
            };

            const keys = Object.keys(insertData);
            const values = keys.map(k => insertData[k]);
            const placeholders = keys.map(() => '?').join(',');
            await dbPool.execute(`INSERT INTO user (${keys.join(',')}) VALUES (${placeholders})`, values);

            return res.json({ success: true, message: `Successfully added user ${payload.user_email}` });

            // === BRANCH TABLE ===
        } else if (tableName === 'branch') {
            if (!payload.branch_name || !payload.branch_address || !payload.branch_phone_number) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            if (!/^[\d ]+$/.test(payload.branch_phone_number)) {
                return res.status(400).json({ error: 'Phone number must be digits and spaces only' });
            }
            if (payload.branch_phone_number.length !== 13) {
                return res.status(400).json({ error: 'Phone number must be exactly 13 characters including spaces' });
            }

            insertData = {
                id: null,
                branch_name: payload.branch_name,
                branch_address: payload.branch_address,
                branch_phone_number: payload.branch_phone_number
            };

            const keys = Object.keys(insertData);
            const values = keys.map(k => insertData[k]);
            const placeholders = keys.map(() => '?').join(',');

            // Pass values array
            await dbPool.execute(`INSERT INTO branch (${keys.join(',')}) VALUES (${placeholders})`, values);

            return res.json({ success: true, message: `Successfully added branch ${payload.branch_name}` });


            // === CASHBACK_OFFERS TABLE ===
        } else if (tableName === 'cashback_offers') {
            if (!payload.company_name || !payload.conditions || !payload.category || !payload.offer_image) {
                return res.status(400).json({ error: 'All fields including offer_image are required' });
            }
            const cashbackVal = parseFloat(payload.cashback);
            if (isNaN(cashbackVal) || cashbackVal <= 0 || cashbackVal >= 100) {
                return res.status(400).json({ error: 'Cashback must be a decimal >0 and <100' });
            }

            insertData = {
                id: null,
                company_name: payload.company_name,
                cashback: cashbackVal,
                conditions: payload.conditions,
                category: payload.category,
                offer_image: payload.offer_image
            };

            const keys = Object.keys(insertData);
            const values = keys.map(k => insertData[k]);
            const placeholders = keys.map(() => '?').join(',');
            await dbPool.execute(
                `INSERT INTO cashback_offers (${keys.join(',')}) VALUES (${placeholders})`,
                values
            );

            return res.json({ success: true, message: `Successfully added cashback offer for ${payload.company_name}` });

        // === TRANSACTION TABLE ===
        } else if (tableName === 'transaction') {
            const amount = parseFloat(payload.amount);
            if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Amount must be >0' });

            if (!payload.sender_account_number || !payload.recipient_account_number) {
                return res.status(400).json({ error: 'Sender and recipient accounts are required' });
            }

            const senderAccNum = Number(payload.sender_account_number);
            const recipientAccNum = Number(payload.recipient_account_number);
            if (isNaN(senderAccNum) || isNaN(recipientAccNum) || senderAccNum <= 0 || recipientAccNum <= 0) {
                return res.status(400).json({ error: 'Account numbers must be real' });
            }

            const [senderAccRows] = await dbPool.query('SELECT balance FROM account WHERE account_number = ?', [senderAccNum]);
            const [recipientAccRows] = await dbPool.query('SELECT balance FROM account WHERE account_number = ?', [recipientAccNum]);

            let transactionSuccess = 'success';
            if (!senderAccRows.length || !recipientAccRows.length) transactionSuccess = 'fail';
            if (senderAccRows.length && senderAccRows[0].balance < amount) transactionSuccess = 'fail';

            let senderBalance = senderAccRows.length ? senderAccRows[0].balance : 0;
            let recipientBalance = recipientAccRows.length ? recipientAccRows[0].balance : 0;

            const description = payload.description?.substring(0, 255) || null;
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

            // Only update balances if transaction successful
            if (transactionSuccess === 'success') {
                // Update balances in JS first
                senderBalance = senderAccRows.length ? Number(senderAccRows[0].balance) : 0;
                recipientBalance = recipientAccRows.length ? Number(recipientAccRows[0].balance) : 0;
                senderBalance -= amount;
                recipientBalance += amount;
                console.log(recipientBalance);

                // Update accounts in DB using updated variables
                await dbPool.execute('UPDATE account SET balance = ? WHERE account_number = ?', [senderBalance, senderAccNum]);
                await dbPool.execute('UPDATE account SET balance = ? WHERE account_number = ?', [recipientBalance, recipientAccNum]);
            }

            // Insert transaction rows using updated balances
            const senderRow = {
                id: null,
                amount,
                description,
                type: payload.type,
                sender_account_number: senderAccNum,
                recipient_account_number: recipientAccNum,
                direction: 'out',
                transaction_success: transactionSuccess,
                running_balance: senderBalance,
                created_at: now,
                date_time: now
            };

            const recipientRow = {
                id: null,
                amount,
                description,
                type: payload.type,
                sender_account_number: senderAccNum,
                recipient_account_number: recipientAccNum,
                direction: 'in',
                transaction_success: transactionSuccess,
                running_balance: recipientBalance,
                created_at: now,
                date_time: now
            };

            // Insert sender row
            await dbPool.execute(
                `INSERT INTO transaction
                 (id, amount, description, type, sender_account_number, recipient_account_number, direction, transaction_success, running_balance, created_at, date_time)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    senderRow.id,
                    senderRow.amount,
                    senderRow.description,
                    senderRow.type,
                    senderRow.sender_account_number,
                    senderRow.recipient_account_number,
                    senderRow.direction,
                    senderRow.transaction_success,
                    senderRow.running_balance,
                    senderRow.created_at,
                    senderRow.date_time
                ]
            );

            // Insert recipient row
            await dbPool.execute(
                `INSERT INTO transaction
                 (id, amount, description, type, sender_account_number, recipient_account_number, direction, transaction_success, running_balance, created_at, date_time)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    recipientRow.id,
                    recipientRow.amount,
                    recipientRow.description,
                    recipientRow.type,
                    recipientRow.sender_account_number,
                    recipientRow.recipient_account_number,
                    recipientRow.direction,
                    recipientRow.transaction_success,
                    recipientRow.running_balance,
                    recipientRow.created_at,
                    recipientRow.date_time
                ]
            );

            return res.json({ success: true, message: `Transaction processed (${transactionSuccess})` });
        }


    } catch (error) {
        console.error('Error adding row:', error);
        if (error.code === 'ER_WARN_DATA_OUT_OF_RANGE') {
            return res.status(400).json({ error: 'Numeric field out of range' });
        }
        return res.status(500).json({ error: 'Server error, please check your input and try again' });
    }
});

// DELETE row
router.delete('/table/:tableName/:id', async (req, res, next) => {
    try {
        const tableName = req.params.tableName;
        const rowId = req.params.id;

        if (!['branch','cashback_offers'].includes(tableName)) {
            return res.status(400).json({ error: 'Delete not allowed for this table' });
        }

        await dbPool.execute(`DELETE FROM \`${tableName}\` WHERE id = ?`, [rowId]);

        res.json({ success: true, message: `${tableName} row deleted` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error while deleting' });
    }
});


export default router;
