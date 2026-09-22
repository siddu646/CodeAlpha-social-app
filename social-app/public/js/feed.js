const feedEl = document.getElementById('feed');
const composerSlot = document.getElementById('composer-slot');
const alertSlot = document.getElementById('alert-slot');
const tabsEl = document.getElementById('feed-tabs');

let currentFeed = 'all';

function showAlert(message, type = 'error') {
  alertSlot.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
  setTimeout(() => (alertSlot.innerHTML = ''), 3500);
}

function renderComposer(user) {
  if (!user) {
    composerSlot.innerHTML = `
      <div class="composer">
        <p style="margin:0; color:var(--muted);">
          <a href="/login.html" style="color:var(--accent); text-decoration:underline;">Log in</a> to post something.
        </p>
      </div>`;
    return;
  }
  composerSlot.innerHTML = `
    <div class="composer">
      <textarea id="post-input" maxlength="1000" placeholder="What's on your mind, ${escapeHtml(user.username)}?"></textarea>
      <div class="composer-footer">
        <span class="char-count" id="char-count">0 / 1000</span>
        <button class="btn btn-primary" id="post-btn">Post</button>
      </div>
    </div>`;

  const input = document.getElementById('post-input');
  const charCount = document.getElementById('char-count');
  input.addEventListener('input', () => (charCount.textContent = `${input.value.length} / 1000`));

  document.getElementById('post-btn').addEventListener('click', async () => {
    const content = input.value.trim();
    if (!content) return;
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (!res.ok) return showAlert(data.error);
    input.value = '';
    charCount.textContent = '0 / 1000';
    loadFeed();
  });
}

function postCardHtml(p) {
  return `
    <div class="post-card" data-id="${p.id}">
      <div class="post-head">
        <a class="author" href="/profile.html?u=${encodeURIComponent(p.username)}">${escapeHtml(p.username)}</a>
        <span class="time">${timeAgo(p.created_at)}</span>
      </div>
      <div class="post-content">${escapeHtml(p.content)}</div>
      <div class="post-actions">
        <button class="like-btn ${p.likedByMe ? 'liked' : ''}" data-id="${p.id}">
          ${p.likedByMe ? '♥' : '♡'} <span class="like-count">${p.likeCount}</span>
        </button>
        <button class="comment-toggle" data-id="${p.id}">💬 <span class="comment-count">${p.commentCount}</span> comments</button>
        ${window.currentUser && window.currentUser.username === p.username ? `<button class="btn-danger-text delete-post" data-id="${p.id}">Delete</button>` : ''}
      </div>
      <div class="comments-section" id="comments-${p.id}">
        <div class="comment-list" id="comment-list-${p.id}"></div>
        ${
          window.currentUser
            ? `<form class="comment-form" data-id="${p.id}">
                <input type="text" maxlength="500" placeholder="Write a comment&hellip;" required>
                <button class="btn btn-secondary btn-sm" type="submit">Reply</button>
              </form>`
            : `<p class="form-note"><a href="/login.html" style="text-decoration:underline;">Log in</a> to comment.</p>`
        }
      </div>
    </div>`;
}

async function loadFeed() {
  const params = new URLSearchParams();
  if (currentFeed === 'following') params.set('feed', 'following');

  const res = await fetch(`/api/posts?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json();
    feedEl.innerHTML = `<div class="empty-state">${escapeHtml(data.error)}</div>`;
    return;
  }
  const posts = await res.json();

  if (posts.length === 0) {
    feedEl.innerHTML = `<div class="empty-state">Nothing here yet.</div>`;
    return;
  }
  feedEl.innerHTML = posts.map(postCardHtml).join('');
  wireUpPostEvents();
}

function wireUpPostEvents() {
  document.querySelectorAll('.like-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.currentUser) return (window.location.href = '/login.html');
      const id = btn.dataset.id;
      const liked = btn.classList.contains('liked');
      const res = await fetch(`/api/posts/${id}/like`, { method: liked ? 'DELETE' : 'POST' });
      const data = await res.json();
      if (!res.ok) return showAlert(data.error);
      btn.classList.toggle('liked', data.likedByMe);
      btn.querySelector('.like-count').textContent = data.likeCount;
      btn.innerHTML = `${data.likedByMe ? '♥' : '♡'} <span class="like-count">${data.likeCount}</span>`;
    });
  });

  document.querySelectorAll('.comment-toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const section = document.getElementById(`comments-${id}`);
      const nowOpen = section.classList.toggle('open');
      if (nowOpen) await loadComments(id);
    });
  });

  document.querySelectorAll('.delete-post').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      const id = btn.dataset.id;
      await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      loadFeed();
    });
  });

  document.querySelectorAll('.comment-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = form.dataset.id;
      const input = form.querySelector('input');
      const content = input.value.trim();
      if (!content) return;
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (!res.ok) return showAlert(data.error);
      input.value = '';
      await loadComments(id);
      const card = document.querySelector(`.post-card[data-id="${id}"]`);
      const countEl = card.querySelector('.comment-count');
      countEl.textContent = Number(countEl.textContent) + 1;
    });
  });
}

async function loadComments(postId) {
  const res = await fetch(`/api/posts/${postId}/comments`);
  const comments = await res.json();
  const list = document.getElementById(`comment-list-${postId}`);
  list.innerHTML = comments
    .map(
      (c) => `<div class="comment-item">
        <a class="author" href="/profile.html?u=${encodeURIComponent(c.username)}">${escapeHtml(c.username)}</a>
        <span>${escapeHtml(c.content)}</span>
      </div>`
    )
    .join('');
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  tab.classList.add('active');
  currentFeed = tab.dataset.feed;
  loadFeed();
});

(async () => {
  const user = await initNav();
  renderComposer(user);
  loadFeed();
})();
