const express = require('express');
const router = express.Router();

const courseRoutes = require('./courseRoutes');

router.use('/courses', courseRoutes);

module.exports = router;
