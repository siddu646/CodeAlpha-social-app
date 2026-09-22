// db/seed.js — creates a few demo users, posts, and a follow so the feed isn't empty.
const bcrypt = require('bcryptjs');
const db = require('./database');

const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (existing > 0) {
  console.log(`Users table already has ${existing} rows — skipping seed.`);
  process.exit(0);
}

const insertUser = db.prepare(
  'INSERT INTO users (username, email, password_hash, bio) VALUES (?, ?, ?, ?)'
);
const insertPost = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)');
const insertFollow = db.prepare(
  'INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)'
);
const insertLike = db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)');

const hash = bcrypt.hashSync('password123', 10);

const seed = db.transaction(() => {
  const alice = insertUser.run('alice', 'alice@example.com', hash, 'Coffee, code, and cats.').lastInsertRowid;
  const bram = insertUser.run('bram', 'bram@example.com', hash, 'Trail runner. Building things.').lastInsertRowid;
  const chen = insertUser.run('chen', 'chen@example.com', hash, 'Design & illustration.').lastInsertRowid;

  const p1 = insertPost.run(alice, 'Just shipped a side project — feeling good about it!').lastInsertRowid;
  const p2 = insertPost.run(bram, 'Ran 10k this morning before the heat kicked in.').lastInsertRowid;
  const p3 = insertPost.run(chen, 'New sketch up — feedback welcome.').lastInsertRowid;
  insertPost.run(alice, 'Anyone got good podcast recommendations?');

  insertFollow.run(alice, bram);
  insertFollow.run(alice, chen);
  insertFollow.run(bram, alice);

  insertLike.run(p1, bram);
  insertLike.run(p1, chen);
  insertLike.run(p2, alice);
  insertLike.run(p3, alice);
  insertLike.run(p3, bram);
});

seed();
console.log('Seeded demo users (alice, bram, chen — password: password123), posts, follows, and likes.');
