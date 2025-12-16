const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authenticatie
 *     summary: Inloggen
 *     description: Authenticeer een gebruiker met email en wachtwoord. Retourneert JWT access token en refresh token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Succesvol ingelogd
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token (15 minuten geldig)
 *                 refreshToken:
 *                   type: string
 *                   description: Refresh token (7 dagen geldig)
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Ongeldige inloggegevens
 */
// Public auth routes
router.post('/login', userController.loginUser);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authenticatie
 *     summary: Registreren
 *     description: Maak een nieuw gebruikersaccount aan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jan Janssen
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jan@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [student, teacher]
 *                 default: student
 *                 example: student
 *     responses:
 *       201:
 *         description: Account succesvol aangemaakt
 *       400:
 *         description: Validatiefout of email bestaat al
 */
router.post('/register', userController.registerUser);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authenticatie
 *     summary: Token vernieuwen
 *     description: Verkrijg een nieuw access token met een refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token verkregen bij login
 *     responses:
 *       200:
 *         description: Nieuw access token gegenereerd
 *       401:
 *         description: Ongeldige of verlopen refresh token
 */
router.post('/refresh', userController.refreshAccessToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authenticatie
 *     summary: Uitloggen
 *     description: Invalideer de huidige sessie en tokens
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Succesvol uitgelogd
 */
router.post('/logout', userController.logoutUser);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags:
 *       - Authenticatie
 *     summary: Haal gebruikersprofiel op
 *     description: Verkrijg de gegevens van de ingelogde gebruiker
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gebruikersprofiel
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Niet geauthenticeerd
 */
// Protected routes
router.get('/profile', authMiddleware, userController.getProfile);

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     tags:
 *       - GitHub OAuth
 *     summary: Start GitHub OAuth flow
 *     description: Redirect naar GitHub voor OAuth authenticatie
 *     responses:
 *       302:
 *         description: Redirect naar GitHub OAuth
 */
// GitHub OAuth routes
router.get('/github', passport.authenticate('github'));

/**
 * @swagger
 * /api/auth/github/callback:
 *   get:
 *     tags:
 *       - GitHub OAuth
 *     summary: GitHub OAuth callback
 *     description: Callback endpoint voor GitHub OAuth. Verwerkt de OAuth response en maakt gebruiker aan of logt in.
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: OAuth authorization code van GitHub
 *     responses:
 *       200:
 *         description: OAuth succesvol, gebruiker ingelogd
 *       302:
 *         description: Redirect naar failure pagina
 */
router.get('/github/callback', passport.authenticate('github', { failureRedirect: '/' }), userController.githubCallback);

module.exports = router;
