const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getUserByUsername(username) {
  return db.prepare('SELECT id, username, bio, created_at FROM users WHERE username = ?').get(username);
}

// GET /api/users/:username — profile summary
router.get('/:username', (req, res) => {
  const user = getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const postCount = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE user_id = ?').get(user.id).c;
  const followerCount = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE followee_id = ?').get(user.id).c;
  const followingCount = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?').get(user.id).c;

  let isFollowing = false;
  if (req.session.userId) {
    isFollowing = !!db
      .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?')
      .get(req.session.userId, user.id);
  }

  res.json({ ...user, postCount, followerCount, followingCount, isFollowing, isSelf: req.session.userId === user.id });
});

// GET /api/users/:username/posts
router.get('/:username/posts', (req, res) => {
  const user = getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const posts = db
    .prepare(
      `SELECT posts.*, users.username,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likeCount,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS commentCount
       FROM posts JOIN users ON users.id = posts.user_id
       WHERE posts.user_id = ?
       ORDER BY posts.created_at DESC`
    )
    .all(user.id);

  res.json(posts);
});

// GET /api/users/:username/followers
router.get('/:username/followers', (req, res) => {
  const user = getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const followers = db
    .prepare(
      `SELECT users.id, users.username, users.bio FROM follows
       JOIN users ON users.id = follows.follower_id
       WHERE follows.followee_id = ?`
    )
    .all(user.id);
  res.json(followers);
});

// GET /api/users/:username/following
router.get('/:username/following', (req, res) => {
  const user = getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const following = db
    .prepare(
      `SELECT users.id, users.username, users.bio FROM follows
       JOIN users ON users.id = follows.followee_id
       WHERE follows.follower_id = ?`
    )
    .all(user.id);
  res.json(following);
});

// POST /api/users/:username/follow
router.post('/:username/follow', requireAuth, (req, res) => {
  const target = getUserByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.session.userId) return res.status(400).json({ error: "You can't follow yourself." });

  try {
    db.prepare('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)').run(req.session.userId, target.id);
  } catch (e) {
    // already following — ignore (unique constraint)
  }
  res.json({ ok: true });
});

// DELETE /api/users/:username/follow
router.delete('/:username/follow', requireAuth, (req, res) => {
  const target = getUserByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(req.session.userId, target.id);
  res.json({ ok: true });
});

module.exports = router;
