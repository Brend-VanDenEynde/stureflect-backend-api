const express = require('express');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no auth required)
router.post('/login', userController.loginUser);
router.post('/register', userController.registerUser);
router.post('/refresh', userController.refreshAccessToken);

// Protected routes (auth required)
router.get('/profile', authenticateToken, userController.getProfile);

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     tags:
 *       - Authenticatie
 *     summary: Update gebruikersprofiel
 *     description: |
 *       Werk naam en/of e-mailadres van de ingelogde gebruiker bij.
 *       Minimaal één veld moet worden meegegeven.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jan Janssen
 *                 description: Nieuwe naam (optioneel)
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jan.nieuw@example.com
 *                 description: Nieuw e-mailadres (optioneel)
 *     responses:
 *       200:
 *         description: Profiel succesvol bijgewerkt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validatiefout of e-mail al in gebruik
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: E-mailadres is al in gebruik.
 *       401:
 *         description: Niet geauthenticeerd
 *       404:
 *         description: Gebruiker niet gevonden
 *       500:
 *         description: Server error
 */
router.put('/profile', authenticateToken, userController.updateProfile);

/**
 * @swagger
 * /api/user/password:
 *   put:
 *     tags:
 *       - Authenticatie
 *     summary: Stel wachtwoord in of wijzig wachtwoord
 *     description: |
 *       Gebruikers kunnen hun wachtwoord instellen of wijzigen.
 *       
 *       **GitHub gebruikers** (zonder wachtwoord): kunnen direct een wachtwoord instellen zonder `currentPassword`.
 *       
 *       **Gebruikers met bestaand wachtwoord**: moeten `currentPassword` opgeven voor verificatie.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: oudWachtwoord123
 *                 description: Huidig wachtwoord (alleen verplicht als gebruiker al een wachtwoord heeft)
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: nieuwWachtwoord123
 *                 minLength: 6
 *                 description: Nieuw wachtwoord (minimaal 6 tekens)
 *     responses:
 *       200:
 *         description: Wachtwoord succesvol bijgewerkt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Wachtwoord succesvol bijgewerkt.
 *       400:
 *         description: Validatiefout (bijv. wachtwoord te kort of huidig wachtwoord ontbreekt)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Wachtwoord moet minimaal 6 tekens bevatten.
 *       401:
 *         description: Niet geauthenticeerd of huidig wachtwoord onjuist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Huidig wachtwoord is onjuist.
 *       404:
 *         description: Gebruiker niet gevonden
 *       500:
 *         description: Server error
 */
router.put('/password', authenticateToken, userController.updatePassword);

router.post('/logout', authenticateToken, userController.logoutUser);

module.exports = router;