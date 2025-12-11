const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');

// Public auth routes
router.post('/login', userController.loginUser);
router.post('/register', userController.registerUser);
router.post('/refresh', userController.refreshAccessToken);
router.post('/logout', userController.logoutUser);

// GitHub OAuth routes
router.get('/github', passport.authenticate('github'));
router.get('/github/callback', passport.authenticate('github', { failureRedirect: '/' }), userController.githubCallback);

module.exports = router;
