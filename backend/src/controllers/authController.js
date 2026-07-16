// src/controllers/authController.js
require('dotenv').config();
const { generateToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Validates username + password and returns a JWT.
 * For this demo, credentials are stored in env vars.
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username !== validUsername || password !== validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ username, role: 'admin' });
    res.json({ token, username, role: 'admin' });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { login };
