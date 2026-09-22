async function initNav() {
  try {
    const meRes = await fetch('/api/auth/me');
    const { user } = await meRes.json();
    window.currentUser = user;

    const authSlot = document.getElementById('nav-auth');
    if (!authSlot) return user;

    if (user) {
      authSlot.innerHTML = `
        <a href="/profile.html?u=${encodeURIComponent(user.username)}">${escapeHtml(user.username)}</a>
        <button id="logout-btn" class="btn-danger-text">Log out</button>
      `;
      document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/index.html';
      });
    } else {
      authSlot.innerHTML = `<a href="/login.html">Log in</a><a href="/register.html">Register</a>`;
    }
    return user;
  } catch (err) {
    console.error('Nav init failed', err);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function timeAgo(iso) {
  const diffSec = Math.round((Date.now() - new Date(iso + 'Z').getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso + 'Z').toLocaleDateString();
}

document.addEventListener('DOMContentLoaded', initNav);
