const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// Login endpoint
router.post('/login', userController.loginUser);

// Register endpoint
router.post('/register', userController.registerUser);

module.exports = router;