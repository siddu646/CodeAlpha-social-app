# Nook — Mini Social Media Platform

A basic social app: user profiles, posts, comments, likes, and follows.

- **Frontend:** plain HTML, CSS, JavaScript
- **Backend:** Node.js + Express.js
- **Database:** SQLite (`better-sqlite3`), file-based, no separate DB server

## Features

- Registration / login (bcrypt-hashed passwords, session auth)
- User profiles with bio, post/follower/following counts
- Create & delete posts (feed page, 1000-char limit)
- Comment on posts
- Like / unlike posts
- Follow / unfollow other users, "All posts" vs "Following" feed tabs
- Followers / following lists on each profile

## Project structure

```
social-app/
├── server.js
├── db/
│   ├── database.js     # SQLite schema: users, posts, comments, likes, follows
│   ├── seed.js           # demo users alice/bram/chen (password: password123)
│   └── social.db          # created on first run
├── middleware/auth.js
├── routes/
│   ├── auth.js             # register/login/logout/me
│   ├── users.js              # profile, follow/unfollow, followers/following
│   └── posts.js                # feed, create/delete, like, comments
└── public/
    ├── index.html               # feed
    ├── profile.html
    ├── login.html / register.html
    ├── css/style.css
    └── js/ (nav.js, feed.js, profile.js)
```

## Getting started

Requires Node.js 18+.

```bash
cd social-app
npm install
npm run seed     # creates db/social.db + demo users/posts
npm start        # http://localhost:3001
```

Log in with `alice`, `bram`, or `chen` — password `password123` — or register
your own account.

## How it works

- **Follows/likes** are modeled as their own tables (`follows`, `likes`) with
  a `UNIQUE` constraint on the pair of IDs, so a follow/like is just an
  insert-or-ignore, and unfollow/unlike is a delete. Counts are computed with
  `COUNT(*)` subqueries rather than stored counters, so they're always
  accurate.
- **Feed:** `GET /api/posts` returns all posts by default; `?feed=following`
  filters to posts by people the logged-in user follows (plus their own).
- **Comments** load on demand when you expand a post, to keep the initial
  feed fast.

## Deploying it

Same approach as the e-commerce app: deploy to **Railway** (or similar),
add a persistent volume, and set `DB_PATH` to a path on that volume plus a
strong `SESSION_SECRET` and `NODE_ENV=production`. See the e-commerce app's
README for the detailed step-by-step if you need it — the process is
identical, just with this repo instead.
