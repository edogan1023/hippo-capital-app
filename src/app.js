import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import hbs from 'hbs';
import indexRouter from './routes/index.js';
import loginRouter from './routes/login.js';
import forgotPasswordRouter from './routes/forgotPassword.js';
import registerRouter from './routes/register.js';
import businessRouter from './routes/business.js';
import aboutUsRouter from './routes/aboutUs.js';
import userDashboardRouter from './routes/userDashboard.js';
import employeeDashboardRouter from './routes/employeeDashboard.js';
import adminDashboardRouter from './routes/adminDashboard.js';
import path from 'path';
import { fileURLToPath } from 'url';
import createError from 'http-errors';
import { registerHandlebarHelpers } from './handlebarHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
import session from 'express-session';

hbs.registerPartials(path.join(__dirname, 'views/partials'));

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname,'..', 'public')));
app.use(express.static('public'));

app.use('/', indexRouter);
app.use('/login', loginRouter);
app.use('/forgotPassword', forgotPasswordRouter);
app.use('/register', registerRouter);
app.use('/business', businessRouter);
app.use('/about-us', aboutUsRouter);
app.use('/userDashboard', userDashboardRouter);
app.use('/employeeDashboard', employeeDashboardRouter);
app.use('/adminDashboard', adminDashboardRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  if (err.status === 404) {
    res.status(404).render('404error');
  } else {
    res.status(err.status || 500).render('error');
  }
});

// Register custom Handlebars helpers
registerHandlebarHelpers(hbs);



export default app;
