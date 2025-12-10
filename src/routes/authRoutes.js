const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Public auth routes
router.post('/login', userController.loginUser);
router.post('/register', userController.registerUser);
router.post('/refresh', userController.refreshAccessToken);

module.exports = router;
