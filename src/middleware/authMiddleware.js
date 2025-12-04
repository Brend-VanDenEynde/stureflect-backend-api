const jwt = require('jsonwebtoken');

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

module.exports = authenticateToken;