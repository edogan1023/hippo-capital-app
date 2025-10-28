import express from 'express';

const router = express.Router();

router.get('/', async function (req, res, next) {
    try {
        const userId = req.cookies.userId;
        if (!userId) return res.redirect('/login');

        res.render('adminDashboard',);
    } catch (error) {
        console.error('Error fetching data:', error);
        next(error);
    }
});

export default router;
