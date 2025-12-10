const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const courseRoutes = require('./courseRoutes');
const userRoutes = require('./userRoutes');
const docentRoutes = require('./docentRoutes');

// Auth routes (public)
router.use('/auth', authRoutes);

// User routes (mix of public and protected)
router.use('/user', userRoutes);

// Course routes
router.use('/courses', courseRoutes);

// Docent/teacher routes
router.use('/', docentRoutes);

module.exports = router;
