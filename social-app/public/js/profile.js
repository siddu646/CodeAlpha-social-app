const params = new URLSearchParams(window.location.search);
const username = params.get('u');
const headerEl = document.getElementById('profile-header');
const tabContent = document.getElementById('tab-content');
const alertSlot = document.getElementById('alert-slot');
const tabsEl = document.getElementById('profile-tabs');

let currentTab = 'posts';

function showAlert(message, type = 'error') {
  alertSlot.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
  setTimeout(() => (alertSlot.innerHTML = ''), 3500);
}

async function loadProfile() {
  if (!username) {
    headerEl.innerHTML = `<div class="empty-state">No user specified.</div>`;
    return;
  }
  const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
  if (!res.ok) {
    headerEl.innerHTML = `<div class="empty-state">User not found.</div>`;
    return;
  }
  const u = await res.json();
  document.title = `${u.username} — Nook`;

  headerEl.innerHTML = `
    <div class="profile-header">
      <h1>${escapeHtml(u.username)}</h1>
      ${u.bio ? `<p class="bio">${escapeHtml(u.bio)}</p>` : ''}
      <div class="profile-stats">
        <span><b>${u.postCount}</b> posts</span>
        <span><b>${u.followerCount}</b> followers</span>
        <span><b>${u.followingCount}</b> following</span>
      </div>
      ${
        u.isSelf
          ? ''
          : window.currentUser
          ? `<button class="btn ${u.isFollowing ? 'btn-secondary' : 'btn-primary'}" id="follow-btn">${u.isFollowing ? 'Following' : 'Follow'}</button>`
          : `<a class="btn btn-primary" href="/login.html">Log in to follow</a>`
      }
    </div>`;

  const followBtn = document.getElementById('follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      const following = followBtn.textContent.trim() === 'Following';
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, {
        method: following ? 'DELETE' : 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        return showAlert(data.error);
      }
      loadProfile();
    });
  }
}

function postCardHtml(p) {
  return `
    <div class="post-card">
      <div class="post-head">
        <span class="author">${escapeHtml(p.username)}</span>
        <span class="time">${timeAgo(p.created_at)}</span>
      </div>
      <div class="post-content">${escapeHtml(p.content)}</div>
      <div class="post-actions">
        <span>♡ ${p.likeCount}</span>
        <span>💬 ${p.commentCount} comments</span>
      </div>
    </div>`;
}

function personRowHtml(p) {
  return `<li>
    <a href="/profile.html?u=${encodeURIComponent(p.username)}" style="font-weight:600;">${escapeHtml(p.username)}</a>
    <span style="color:var(--muted); font-size:0.85rem;">${escapeHtml(p.bio || '')}</span>
  </li>`;
}

async function loadTab(tab) {
  currentTab = tab;
  if (!username) return;

  if (tab === 'posts') {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/posts`);
    const posts = await res.json();
    tabContent.innerHTML = posts.length
      ? posts.map(postCardHtml).join('')
      : `<div class="empty-state">No posts yet.</div>`;
  } else {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/${tab}`);
    const people = await res.json();
    tabContent.innerHTML = people.length
      ? `<ul class="people-list">${people.map(personRowHtml).join('')}</ul>`
      : `<div class="empty-state">Nobody here yet.</div>`;
  }
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  tab.classList.add('active');
  loadTab(tab.dataset.tab);
});

(async () => {
  await initNav();
  await loadProfile();
  loadTab('posts');
})();
