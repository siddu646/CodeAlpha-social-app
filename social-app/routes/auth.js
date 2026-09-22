const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, email, password, bio = '' } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are all required.' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscores.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(409).json({ error: 'A user with that username or email already exists.' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash, bio) VALUES (?, ?, ?, ?)')
    .run(username, email, passwordHash, bio);

  req.session.userId = result.lastInsertRowid;
  req.session.username = username;

  res.status(201).json({ id: result.lastInsertRowid, username, email, bio });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ id: user.id, username: user.username, email: user.email });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT id, username, email, bio FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: user || null });
});

module.exports = router;
