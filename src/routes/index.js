const express = require('express');
const router = express.Router();

const courseRoutes = require('./courseRoutes');
const userRoutes = require('./userRoutes');
const docentRoutes = require('./docentRoutes');
const studentRoutes = require('./studentRoutes');

router.use('/courses', courseRoutes);
router.use('/users', userRoutes);
router.use('/students', studentRoutes);
router.use('/', docentRoutes);

module.exports = router;
