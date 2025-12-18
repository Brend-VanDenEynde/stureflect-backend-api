const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Middleware om JWT te valideren
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Geen token verstrekt.' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token is verlopen. Log opnieuw in.' });
        } else if (err.name === 'JsonWebTokenError') {
          return res.status(403).json({ error: 'Ongeldige token. Controleer uw token.' });
        } else {
          return res.status(500).json({ error: 'Interne serverfout bij tokenverificatie.' });
        }
      }

      req.user = user; // Voeg de gebruiker toe aan het verzoek
      next();
    });
  } catch (error) {
    return res.status(500).json({ error: 'Onverwachte fout bij tokenverificatie.' });
  }
}

// Middleware om te controleren of gebruiker admin is
async function requireAdmin(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Geen token verstrekt.' 
    });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Token is verlopen. Log opnieuw in.' 
          });
        } else if (err.name === 'JsonWebTokenError') {
          return res.status(403).json({ 
            success: false,
            error: 'FORBIDDEN',
            message: 'Ongeldige token. Controleer uw token.' 
          });
        } else {
          return res.status(500).json({ 
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Interne serverfout bij tokenverificatie.' 
          });
        }
      }

      // Controleer of gebruiker admin is
      try {
        const result = await db.query(
          `SELECT id, email, name, role FROM "user" WHERE id = $1 AND role = 'admin'`,
          [user.id]
        );

        if (result.rows.length === 0) {
          console.log(`[SECURITY] Access denied for user ${user.id}: not an admin`);
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Alleen admins hebben toegang tot deze functie'
          });
        }

        req.user = user; // Voeg de gebruiker toe aan het verzoek
        next();
      } catch (dbError) {
        console.error('[SECURITY] Database error during admin check:', dbError);
        return res.status(500).json({
          success: false,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Fout bij autorisatie controle'
        });
      }
    });
  } catch (error) {
    console.error('[SECURITY] Unexpected error in requireAdmin:', error);
    return res.status(500).json({ 
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Onverwachte fout bij tokenverificatie.' 
    });
  }
}

module.exports = {
  authenticateToken,
  requireAdmin
};