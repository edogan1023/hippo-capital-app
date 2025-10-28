import express from 'express';
const router = express.Router();
import dbPool from "../services/database.js";

router.get('/', async function(req, res, next) {
    try {
        const sql = 'SELECT id, branch_name, branch_address, branch_phone_number FROM branch ORDER BY branch_name ASC';

        // Using execute method with connection pool for better performance
        const [rows, fields] = await dbPool.execute(sql);

        console.log('Branches retrieved:', rows.length);

        res.render('register', { branches: rows });
    } catch (error) {
        console.error('Error fetching branches:', error);

        // Pass error to Express error handler
        next(error);
    }
});

export default router;

