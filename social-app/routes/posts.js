const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function annotatePost(post, viewerId) {
  const liked = viewerId
    ? !!db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(post.id, viewerId)
    : false;
  return { ...post, likedByMe: liked };
}

// GET /api/posts?feed=following  (default: all/public feed)
router.get('/', (req, res) => {
  const viewerId = req.session.userId || null;
  let sql = `
    SELECT posts.*, users.username,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likeCount,
      (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS commentCount
    FROM posts JOIN users ON users.id = posts.user_id
  `;
  const params = [];

  if (req.query.feed === 'following') {
    if (!viewerId) return res.status(401).json({ error: 'Log in to view your following feed.' });
    sql += ` WHERE posts.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?) OR posts.user_id = ?`;
    params.push(viewerId, viewerId);
  }

  sql += ' ORDER BY posts.created_at DESC LIMIT 100';
  const posts = db.prepare(sql).all(...params);
  res.json(posts.map((p) => annotatePost(p, viewerId)));
});

// POST /api/posts  { content }
router.post('/', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Post content cannot be empty.' });
  if (content.length > 1000) return res.status(400).json({ error: 'Post is too long (max 1000 characters).' });

  const result = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)').run(req.session.userId, content.trim());
  const post = db
    .prepare(
      `SELECT posts.*, users.username, 0 AS likeCount, 0 AS commentCount
       FROM posts JOIN users ON users.id = posts.user_id WHERE posts.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json(annotatePost(post, req.session.userId));
});

// DELETE /api/posts/:id  (author only)
router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.user_id !== req.session.userId) return res.status(403).json({ error: 'You can only delete your own posts.' });

  const del = db.transaction(() => {
    db.prepare('DELETE FROM likes WHERE post_id = ?').run(post.id);
    db.prepare('DELETE FROM comments WHERE post_id = ?').run(post.id);
    db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  });
  del();
  res.json({ ok: true });
});

// POST /api/posts/:id/like
router.post('/:id/like', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  try {
    db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(post.id, req.session.userId);
  } catch (e) {
    // already liked — ignore
  }
  const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?').get(post.id).c;
  res.json({ likeCount, likedByMe: true });
});

// DELETE /api/posts/:id/like
router.delete('/:id/like', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(post.id, req.session.userId);
  const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?').get(post.id).c;
  res.json({ likeCount, likedByMe: false });
});

// GET /api/posts/:id/comments
router.get('/:id/comments', (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const comments = db
    .prepare(
      `SELECT comments.*, users.username FROM comments
       JOIN users ON users.id = comments.user_id
       WHERE post_id = ? ORDER BY comments.created_at ASC`
    )
    .all(post.id);
  res.json(comments);
});

// POST /api/posts/:id/comments  { content }
router.post('/:id/comments', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });
  if (content.length > 500) return res.status(400).json({ error: 'Comment is too long (max 500 characters).' });

  const result = db
    .prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)')
    .run(post.id, req.session.userId, content.trim());

  const comment = db
    .prepare(
      `SELECT comments.*, users.username FROM comments
       JOIN users ON users.id = comments.user_id WHERE comments.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json(comment);
});

module.exports = router;
