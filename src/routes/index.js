import express from 'express';
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  const parameters = {title: 'Hippo Capital'};

  parameters['example'] = 'Example';


  res.render('index', parameters);
});

export default router;
