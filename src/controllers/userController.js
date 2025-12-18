const userModel = require('../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Login user with email and password
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mailadres en wachtwoord zijn verplicht.' });
    }
    const user = await userModel.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Ongeldig wachtwoord.' });
    }

    // Generate access token
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
    );

    // Save refresh token in database
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await userModel.saveRefreshToken(user.id, refreshToken, tokenExpiresAt);

    res.json({ 
      accessToken, 
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[API] Login error:', error.message);
    res.status(500).json({ error: 'Interne serverfout bij login.' });
  }
}

async function registerUser(req, res) {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'E-mailadres, naam en wachtwoord zijn verplicht.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ongeldig e-mailadres.' });
    }
    const existingUser = await userModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'E-mailadres is al in gebruik.' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = await userModel.createUser({ 
      email, 
      name, 
      github_id: null, 
      password_hash, 
      role: role || 'student' 
    });
    const { password_hash: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('[API] Registration error:', error.message);
    res.status(500).json({ error: 'Interne serverfout bij registratie.' });
  }
}

// Refresh access token
async function refreshAccessToken(req, res) {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is verplicht.' });
    }

    // Validate refresh token in database
    const storedToken = await userModel.getRefreshToken(refreshToken);
    if (!storedToken) {
      return res.status(401).json({ error: 'Ongeldig of verlopen refresh token.' });
    }

    // Verify JWT signature
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Generate new access token
      const newAccessToken = jwt.sign(
        { id: decoded.id, email: decoded.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
      );

      // Generate new refresh token
      const newRefreshToken = jwt.sign(
        { id: decoded.id, email: decoded.email },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
      );

      // Save new refresh token in database
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await userModel.saveRefreshToken(decoded.id, newRefreshToken, tokenExpiresAt);

      res.json({ 
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Refresh token is verlopen.' });
      }
      return res.status(403).json({ error: 'Ongeldig refresh token.' });
    }
  } catch (error) {
    console.error('[API] Token refresh error:', error.message);
    res.status(500).json({ error: 'Interne serverfout bij token vernieuwen.' });
  }
}

// Logout user (revoke refresh token)
async function logoutUser(req, res) {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is verplicht.' });
    }

    await userModel.revokeRefreshToken(refreshToken);
    res.json({ message: 'Succesvol uitgelogd.' });
  } catch (error) {
    console.error('[API] Logout error:', error.message);
    res.status(500).json({ error: 'Interne serverfout bij uitloggen.' });
  }
}

// GitHub OAuth callback
async function githubCallback(req, res) {
  try {
    const user = req.user;

    // Generate access token
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
    );

    // Save refresh token in database
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await userModel.saveRefreshToken(user.id, refreshToken, tokenExpiresAt);

    // Redirect to frontend with tokens (or return JSON)
    // Option 1: Redirect with tokens in URL (not secure, better for dev)
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth-callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Fout bij GitHub callback:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth-error`);
  }
}

// Get user profile
async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const user = await userModel.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Fout bij ophalen profiel:', error);
    res.status(500).json({ error: 'Interne serverfout bij ophalen profiel.' });
  }
}

// Update user profile
async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    // Validation
    const updates = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Naam moet een niet-lege string zijn.' });
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || email.trim().length === 0) {
        return res.status(400).json({ error: 'E-mailadres moet een niet-lege string zijn.' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Ongeldig e-mailadres.' });
      }
      
      // Check if email is already in use by another user
      const existingUser = await userModel.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'E-mailadres is al in gebruik.' });
      }
      updates.email = email.trim().toLowerCase();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Geen velden om bij te werken.' });
    }

    const updatedUser = await userModel.updateUser(userId, updates);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    // Return updated user without password hash
    const { password_hash, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Fout bij bijwerken profiel:', error);
    res.status(500).json({ error: 'Interne serverfout bij bijwerken profiel.' });
  }
}

// Update or set user password
async function updatePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate new password
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Nieuw wachtwoord is verplicht.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens bevatten.' });
    }

    // Get current user
    const user = await userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    // If user already has a password, verify current password
    if (user.password_hash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Huidig wachtwoord is verplicht om je wachtwoord te wijzigen.' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Huidig wachtwoord is onjuist.' });
      }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await userModel.updateUserPassword(userId, newPasswordHash);

    res.json({ message: 'Wachtwoord succesvol bijgewerkt.' });
  } catch (error) {
    console.error('Fout bij bijwerken wachtwoord:', error);
    res.status(500).json({ error: 'Interne serverfout bij bijwerken wachtwoord.' });
  }
}

module.exports = {
  loginUser,
  registerUser,
  refreshAccessToken,
  logoutUser,
  githubCallback,
  getProfile,
  updateProfile,
  updatePassword,
};
