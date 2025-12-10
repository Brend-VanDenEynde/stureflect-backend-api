const express = require('express');
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no auth required)
router.post('/login', userController.loginUser);
router.post('/register', userController.registerUser);
router.post('/refresh', userController.refreshAccessToken);

// Protected routes (auth required)
router.get('/profile', authenticateToken, userController.getProfile);
router.post('/logout', authenticateToken, userController.logoutUser);

module.exports = router;