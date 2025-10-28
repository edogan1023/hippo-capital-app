import express from 'express';
import * as loginService from "../services/loginService.js";
const router = express.Router();

router.get('/', function(req, res, next) {
    const parameters = {title: 'Hippo Capital'};
    res.render('login', parameters);
});

router.post('/', async function(req, res, next) {
    try {
        const userEmail = req.body.userEmail;
        const password = req.body.password;
        const remember = req.body.remember;

        const user = await loginService.login(userEmail, password);

        req.session.userId = user.id;

        console.log(user);

        const cookieDuration = remember ? 1000 * 60 * 60 * 24 : 1000 * 60; // 24 hours or 1 minute

        res.cookie('userId', user.id, { httpOnly: true, secure: false, maxAge: cookieDuration });
        res.cookie('userType', user.user_type, { httpOnly: true, secure: false, maxAge: cookieDuration });

        if(user.user_type === 'employee' && user.is_active === 1) {
            return res.redirect('/employeeDashboard');
        }

        else if(user.user_type === 'end-user' && user.is_active === 1) {
            return res.redirect('/userDashboard');
        }
        else if (user.user_type === 'admin' && user.is_active === 1) {
            return res.redirect('/adminDashboard');
        }
        else {
            return res.render('login', { error: 'Your account is not active or does not exist.' });
        }
    } catch (err) {
        next(err);
    }
});




export default router;
