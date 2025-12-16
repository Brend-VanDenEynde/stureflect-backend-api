const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - Algemeen
 *     summary: API Root - Welkomstbericht
 *     description: Geeft een welkomstbericht en basisinformatie over de API
 *     responses:
 *       200:
 *         description: Succesvol
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Hello from Express on Vercel!
 */
router.get('/', (req, res) => {
  res.send('Hello from Express on Vercel!');
});

module.exports = router;
