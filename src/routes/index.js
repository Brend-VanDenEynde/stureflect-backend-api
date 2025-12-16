const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const courseRoutes = require('./courseRoutes');
const userRoutes = require('./userRoutes');
const docentRoutes = require('./docentRoutes');
const studentRoutes = require('./studentRoutes');
const adminRoutes = require('./adminRoutes');
const webhookRoutes = require('./webhookRoutes');

// Auth routes (public)
router.use('/auth', authRoutes);

// User routes (mix of public and protected)
router.use('/user', userRoutes);

// Course routes
router.use('/courses', courseRoutes);
router.use('/users', userRoutes);
router.use('/students', studentRoutes);

// Docent/teacher routes
router.use('/docent', docentRoutes);

// Admin routes
router.use('/', adminRoutes);

// Webhook routes (GitHub webhooks)
router.use('/webhooks', webhookRoutes);

module.exports = router;
