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
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token });
  } catch (error) {
    console.error('Fout bij inloggen:', error);
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
    console.error('Fout bij registratie:', error);
    res.status(500).json({ error: 'Interne serverfout bij registratie.' });
  }
}

module.exports = {
  loginUser,
  registerUser,
};
