const express = require('express');
const router = express.Router();

const courseRoutes = require('./courseRoutes');
const userRoutes = require('./userRoutes');
const docentRoutes = require('./docentRoutes');

router.use('/courses', courseRoutes);
router.use('/users', userRoutes);
router.use('/', docentRoutes);

module.exports = router;
